(function () {
  'use strict';

  const KEY      = 'anivcrm_v2';
  const AUTH_KEY = 'anivcrm_logged_user';

  // ── Circuit breaker — evita loop infinito de push ──────────────────
  let _pushFailCount = 0;
  const MAX_PUSH_FAILS = 3;

  // ── Janela de silêncio — suprime pull logo após um push local ──────
  // Evita que o polling sobrescreva dados recém-gravados antes do banco confirmar.
  let _lastPushAt = 0;
  const PUSH_QUIET_MS = 8000; // 8s de silêncio após qualquer push local

  function markPush() { _lastPushAt = Date.now(); }
  function inQuietWindow() { return (Date.now() - _lastPushAt) < PUSH_QUIET_MS; }

  // ── Helper HTTP ────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    return data;
  }

  // ── Migração de status legados ─────────────────────────────────────
  function migrateStatus(s) {
    if (s === 'pendente')                       return '01';
    if (s === 'aprovado' || s === 'ativo')      return '02';
    if (s === 'recusado' || s === 'cancelado')  return '03';
    return s || '01';
  }

  // ── Normaliza dados vindos do banco para o formato do app ──────────
  function normalizeFromDB(data) {
    if (data.clientes) {
      data.clientes = data.clientes.map(c => ({
        ...c,
        negocio:        c.negocio        || null,
        sugestao:       c.sugestao       || null,
        oferta_enviada: !!c.oferta_enviada,
        telefone:       c.telefone       || '',
      }));
    }
    if (data.empresas) {
      data.empresas = data.empresas.map(e => ({
        ...e,
        horarios:     e.horarios
          ? (typeof e.horarios === 'string' ? JSON.parse(e.horarios) : e.horarios)
          : [],
        usuario:      e.usuario      || '',
        master:       e.master       || '',
        is_sugestao:  !!e.is_sugestao,
        indicado_por: e.indicado_por || '',
        estacionamento: !!e.estacionamento,
        brinquedoteca:  !!e.brinquedoteca,
        comida_vegana:  !!e.comida_vegana,
        cadeirinha:      !!e.cadeirinha,
        delivery:       !!e.delivery,
        status:       migrateStatus(e.status),
      }));
    }
    if (!data.empresas) data.empresas = [];
    delete data.sugestoes;
    return data;
  }

  // ── Normaliza dados do app para envio ao banco ─────────────────────
  function normalizeForDB(data) {
    const out = { empresas: [], clientes: [] };

    out.clientes = (data.clientes || []).map(c => ({
      ...c,
      negocio:        c.negocio        || null,
      sugestao:       c.sugestao       || null,
      oferta_enviada: c.oferta_enviada ? 1 : 0,
      telefone:       c.telefone       || '',
      master:         c.master         || '',
      usuario:        c.usuario        || '',
    }));

    out.empresas = (data.empresas || []).map(e => ({
      ...e,
      horarios:     e.horarios
        ? (typeof e.horarios === 'string' ? e.horarios : JSON.stringify(e.horarios))
        : null,
      usuario:      e.usuario      || '',
      master:       e.master       || '',
      is_sugestao:    e.is_sugestao    ? 1 : 0,
      indicado_por:   e.indicado_por   || '',
      estacionamento: e.estacionamento ? 1 : 0,
      brinquedoteca:  e.brinquedoteca  ? 1 : 0,
      comida_vegana:  e.comida_vegana  ? 1 : 0,
      cadeirinha:     e.cadeirinha     ? 1 : 0,
      delivery:       e.delivery       ? 1 : 0,
    }));

    return out;
  }

  // ── Normaliza um único registro para o banco ───────────────────────
  function normalizeRecordForDB(table, record) {
    if (table === 'clientes') {
      return {
        ...record,
        negocio:        record.negocio        || null,
        sugestao:       record.sugestao       || null,
        oferta_enviada: record.oferta_enviada ? 1 : 0,
        telefone:       record.telefone       || '',
        master:         record.master         || '',
        usuario:        record.usuario        || '',
      };
    }
    if (table === 'empresas') {
      return {
        ...record,
        horarios:     record.horarios
          ? (typeof record.horarios === 'string' ? record.horarios : JSON.stringify(record.horarios))
          : null,
        usuario:      record.usuario      || '',
        master:       record.master       || '',
        is_sugestao:    record.is_sugestao    ? 1 : 0,
        indicado_por:   record.indicado_por   || '',
        estacionamento: record.estacionamento ? 1 : 0,
        brinquedoteca:  record.brinquedoteca  ? 1 : 0,
        comida_vegana:  record.comida_vegana  ? 1 : 0,
        cadeirinha:     record.cadeirinha     ? 1 : 0,
        delivery:       record.delivery       ? 1 : 0,
      };
    }
    return record;
  }

  // ── Pull completo do banco ─────────────────────────────────────────
  async function pullFromDB() {
    // Não sobrescreve se acabamos de fazer um push — evita condição de corrida
    if (inQuietWindow()) {
      console.log('[db-bridge] pull suprimido (janela de silêncio após push)');
      return;
    }
    try {
      const raw  = await api('GET', '/api/bulk-export');
      const data = normalizeFromDB(raw);
      localStorage.setItem(KEY, JSON.stringify(data));
      _pushFailCount = 0;
    } catch (e) {
      console.warn('[db-bridge] pull falhou:', e.message);
    }
  }

  // ── Push de um único registro (granular) ──────────────────────────
  // table  : 'clientes' | 'empresas'
  // id     : valor da PK
  // pkField: nome do campo PK (default: 'usuario' para clientes, 'negocio' para empresas)
  async function pushRecord(table, id, pkField) {
    const pk = pkField || (table === 'clientes' ? 'usuario' : 'negocio');
    try {
      const raw  = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const list = data[table] || [];
      const rec  = list.find(r => r[pk] === id);

      if (!rec) {
        // Registro deletado — apaga no servidor
        await api('DELETE', '/api/' + table + '/' + id);
        return;
      }

      const payload = normalizeRecordForDB(table, rec);

      // Tenta PUT primeiro; se falhar com 404, faz POST
      try {
        await api('PUT', '/api/' + table + '/' + id, payload);
      } catch (putErr) {
        if (putErr.message && putErr.message.includes('404')) {
          await api('POST', '/api/' + table, payload);
        } else {
          throw putErr;
        }
      }
      markPush();
      _pushFailCount = 0;
    } catch (e) {
      _pushFailCount++;
      console.warn('[db-bridge] pushRecord falhou (' + _pushFailCount + '/' + MAX_PUSH_FAILS + '):', e.message);
    }
  }

  // ── Bulk push (fallback para sincronização completa) ───────────────
  let _pushTimer = null;
  function scheduleBulkPush() {
    if (_pushFailCount >= MAX_PUSH_FAILS) {
      console.warn('[db-bridge] push suspenso após', MAX_PUSH_FAILS, 'falhas. Aguardando servidor.');
      return;
    }
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(async () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const data = normalizeForDB(JSON.parse(raw));
        await api('POST', '/api/bulk-import', data);
        markPush();
        _pushFailCount = 0;
      } catch (e) {
        _pushFailCount++;
        console.warn('[db-bridge] bulk push falhou (' + _pushFailCount + '/' + MAX_PUSH_FAILS + '):', e.message);
      }
    }, 400);
  }

  // ── Intercepta localStorage.setItem para bulk push ────────────────
  const _origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    _origSet.call(this, k, v);
    if (k === KEY) scheduleBulkPush();
  };

  // ── Polling de 5s — detecta mudanças e re-renderiza ───────────────
  let _lastSnapshot = '';
  function startPolling() {
    setInterval(async () => {
      const before = localStorage.getItem(KEY) || '';
      await pullFromDB();
      const after = localStorage.getItem(KEY) || '';

      if (after !== before) {
        // Banco mudou externamente — re-renderiza a tela ativa
        const activeScreen = document.querySelector('.screen:not(.hidden)');
        if (activeScreen) {
          const screenName = activeScreen.id.replace('screen-', '');
          if (typeof window.gotoScreen === 'function') {
            window.gotoScreen(screenName);
          }
        }
      }
    }, 5000);
  }

  // ── Override registrarUsuario para chamar API diretamente ──────────
  window._dbBridgeOverrideRegistrar = function () {
    const orig = window.registrarUsuario;
    if (!orig) return;

    window.registrarUsuario = async function () {
      const nome      = document.getElementById('auth-nome')?.value.trim()  || '';
      const nascInput = document.getElementById('auth-nasc')?.value         || '';
      const email     = document.getElementById('auth-email')?.value.trim() || '';
      const tel       = document.getElementById('auth-tel')?.value.trim()   || '';

      if (!nome || !nascInput) {
        if (window.toast) toast('Nome e Data de Nascimento são obrigatórios!', 'err');
        return;
      }

      const masterId  = window.gid('M');
      const usuarioId = window.gid('U');
      const perfilId  = window.gid('P');
      const nasc = window.parseDateToDB ? window.parseDateToDB(nascInput) : nascInput;

      const u = {
        usuario:    usuarioId,
        master:     masterId,
        negocio:    null,
        sugestao:   null,
        perfil_id:  perfilId,
        nome,
        nasc,
        email,
        telefone:   tel,
        senha_hash: '',
        rua: '', num: '', comp: '',
        bairro: '', cep: '', cidade: '', uf: '',
        status: 'ativo',
        oferta_enviada: 0,
        enviado_em: '',
        criado_em: new Date().toISOString()
      };

      try {
        await api('POST', '/api/clientes', u);
      } catch (e) {
        if (window.toast) toast('Erro ao salvar no banco: ' + e.message, 'err');
        return;
      }

      const uLocal = { ...u, oferta_enviada: false };
      const db = JSON.parse(localStorage.getItem(KEY) || '{"empresas":[],"clientes":[]}');
      db.clientes.unshift(uLocal);
      // Usa _origSet para não disparar bulk push (já salvamos via API)
      _origSet.call(localStorage, KEY, JSON.stringify(db));
      localStorage.setItem(AUTH_KEY, u.usuario);

      window.currentUser = uLocal;
      const modal = document.getElementById('modal-auth');
      if (modal) modal.classList.remove('open');
      if (window.toast) toast('Conta criada com sucesso!');
      if (window.initApp) window.initApp();
    };
  };

  // ── Intercepta DOMContentLoaded para rodar pull antes de tudo ─────
  const _pendingDCL = [];
  const _origAddEL  = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (this === document && type === 'DOMContentLoaded') {
      _pendingDCL.push({ fn, opts });
      return;
    }
    _origAddEL.call(this, type, fn, opts);
  };

  _origAddEL.call(document, 'DOMContentLoaded', async function () {
    EventTarget.prototype.addEventListener = _origAddEL;
    await pullFromDB();

    // Expõe funções globalmente
    window._dbBridgePull       = pullFromDB;
    window._dbBridgePushRecord = pushRecord;
    window._dbBridgeMarkPush   = markPush;

    window._dbBridgeOverrideRegistrar();
    startPolling();

    _pendingDCL.forEach(({ fn }) => { try { fn(); } catch (e) {} });
  });

})();
