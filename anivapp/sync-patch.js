/**
 * sync-patch.js — AnivApp
 * Carregado APÓS scripts.js e db-bridge.js.
 *
 * Problema resolvido:
 *   salvarEmpresa, salvarClienteInline, excluirEmpresa, excluirCliente,
 *   toggleBloqueio, toggleEnviado, recusarSugestaoRapido, recusarSolicitacao,
 *   recusarEmpresaPendente — todas gravavam só no localStorage e dependiam
 *   do bulk-import do db-bridge para chegar ao banco, o que pode falhar.
 *
 * Solução:
 *   Após cada save() local, chamamos _dbBridgePushRecord(table, id) para
 *   sincronizar aquele registro específico com o servidor imediatamente,
 *   sem depender do bulk-import.
 */
(function () {
  'use strict';

  // Aguarda o DOM + db-bridge estarem prontos
  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // Helper: push granular com fallback silencioso
  // Marca a janela de silêncio ANTES do push para que o polling
  // não sobrescreva o localStorage antes do banco confirmar.
  function syncRecord(table, id) {
    if (typeof window._dbBridgeMarkPush === 'function') {
      window._dbBridgeMarkPush(); // inicia janela de silêncio imediatamente
    }
    if (typeof window._dbBridgePushRecord === 'function') {
      window._dbBridgePushRecord(table, id).catch(e =>
        console.warn('[sync-patch] pushRecord falhou:', e.message)
      );
    }
  }

  // Helper: DELETE no servidor
  async function apiDelete(path) {
    try {
      await fetch(path, { method: 'DELETE' });
    } catch (e) {
      console.warn('[sync-patch] DELETE falhou:', e.message);
    }
  }

  whenReady(function () {

    // ── salvarEmpresa ──────────────────────────────────────────────
    const _origSalvarEmpresa = window.salvarEmpresa;
    if (typeof _origSalvarEmpresa === 'function') {
      window.salvarEmpresa = function () {
        // Captura o ID antes de salvar (para saber se é edição)
        const editId = document.getElementById('e-id')?.value || null;
        _origSalvarEmpresa.apply(this, arguments);
        // Após o save, descobre o ID (novo ou existente)
        // A função original salva no localStorage — lemos de lá
        try {
          const db = JSON.parse(localStorage.getItem('anivcrm_v2') || '{}');
          const emps = db.empresas || [];
          const target = editId
            ? emps.find(e => e.negocio === editId)
            : emps[0]; // nova empresa vai para o início
          if (target) syncRecord('empresas', target.negocio);
        } catch (e) {
          console.warn('[sync-patch] salvarEmpresa sync:', e.message);
        }
      };
    }

    // ── salvarClienteInline ────────────────────────────────────────
    const _origSalvarCliente = window.salvarClienteInline;
    if (typeof _origSalvarCliente === 'function') {
      window.salvarClienteInline = function () {
        const editId = document.getElementById('f-id')?.value || null;
        _origSalvarCliente.apply(this, arguments);
        try {
          const db = JSON.parse(localStorage.getItem('anivcrm_v2') || '{}');
          const clis = db.clientes || [];
          const target = editId
            ? clis.find(c => c.usuario === editId)
            : clis[0];
          if (target) syncRecord('clientes', target.usuario);
        } catch (e) {
          console.warn('[sync-patch] salvarClienteInline sync:', e.message);
        }
      };
    }

    // ── excluirEmpresa ─────────────────────────────────────────────
    const _origExcluirEmpresa = window.excluirEmpresa;
    if (typeof _origExcluirEmpresa === 'function') {
      window.excluirEmpresa = function (id) {
        _origExcluirEmpresa.apply(this, arguments);
        apiDelete('/api/empresas/' + id);
      };
    }

    // ── excluirCliente ─────────────────────────────────────────────
    const _origExcluirCliente = window.excluirCliente;
    if (typeof _origExcluirCliente === 'function') {
      window.excluirCliente = function (id) {
        _origExcluirCliente.apply(this, arguments);
        apiDelete('/api/clientes/' + id);
      };
    }

    // ── confirmarExclusao (botão no perfil do cliente) ─────────────
    // Essa função já usa confirmarAcao com callback — o delete chega
    // via excluirCliente (sobrescrito acima), então não precisa patch extra.

    // ── toggleBloqueio ─────────────────────────────────────────────
    const _origToggleBloq = window.toggleBloqueio;
    if (typeof _origToggleBloq === 'function') {
      window.toggleBloqueio = function () {
        const id = document.getElementById('f-id')?.value;
        _origToggleBloq.apply(this, arguments);
        if (id) syncRecord('clientes', id);
      };
    }

    // ── toggleEnviado (marcar/desmarcar oferta enviada) ────────────
    const _origToggleEnv = window.toggleEnviado;
    if (typeof _origToggleEnv === 'function') {
      window.toggleEnviado = function (id) {
        _origToggleEnv.apply(this, arguments);
        if (id) syncRecord('clientes', id);
      };
    }

    // ── recusarSugestaoRapido ──────────────────────────────────────
    const _origRecSugRap = window.recusarSugestaoRapido;
    if (typeof _origRecSugRap === 'function') {
      window.recusarSugestaoRapido = function (id) {
        _origRecSugRap.apply(this, arguments);
        if (id) syncRecord('empresas', id);
      };
    }

    // ── recusarSolicitacao ─────────────────────────────────────────
    const _origRecSol = window.recusarSolicitacao;
    if (typeof _origRecSol === 'function') {
      window.recusarSolicitacao = function (id) {
        _origRecSol.apply(this, arguments);
        if (id) syncRecord('empresas', id);
      };
    }

    // ── recusarEmpresaPendente ─────────────────────────────────────
    const _origRecEmpPend = window.recusarEmpresaPendente;
    if (typeof _origRecEmpPend === 'function') {
      window.recusarEmpresaPendente = function (id) {
        _origRecEmpPend.apply(this, arguments);
        if (id) syncRecord('empresas', id);
      };
    }

    // ── salvarSugestao (modal de indicação no admin) ───────────────
    const _origSalvarSug = window.salvarSugestao;
    if (typeof _origSalvarSug === 'function') {
      window.salvarSugestao = function () {
        const editId = document.getElementById('sug-id')?.value || null;
        _origSalvarSug.apply(this, arguments);
        try {
          const db = JSON.parse(localStorage.getItem('anivcrm_v2') || '{}');
          const emps = db.empresas || [];
          const target = editId
            ? emps.find(e => e.negocio === editId)
            : emps[0];
          if (target) syncRecord('empresas', target.negocio);
        } catch (e) {
          console.warn('[sync-patch] salvarSugestao sync:', e.message);
        }
      };
    }

    // ── salvarPerfil (app — usuário edita o próprio perfil) ────────
    const _origSalvarPerfil = window.salvarPerfil;
    if (typeof _origSalvarPerfil === 'function') {
      window.salvarPerfil = function () {
        _origSalvarPerfil.apply(this, arguments);
        const uid = localStorage.getItem('anivcrm_logged_user');
        if (uid) syncRecord('clientes', uid);
      };
    }

    // ── salvarNegocio (app — usuário cadastra o próprio negócio) ───
    const _origSalvarNeg = window.salvarNegocio;
    if (typeof _origSalvarNeg === 'function') {
      window.salvarNegocio = function () {
        _origSalvarNeg.apply(this, arguments);
        try {
          const uid = localStorage.getItem('anivcrm_logged_user');
          if (!uid) return;
          const db = JSON.parse(localStorage.getItem('anivcrm_v2') || '{}');
          const neg = (db.empresas || []).find(e => e.usuario === uid);
          if (neg) syncRecord('empresas', neg.negocio);
        } catch (e) {
          console.warn('[sync-patch] salvarNegocio sync:', e.message);
        }
      };
    }

    // ── enviarSugestao (app — usuário indica um local) ─────────────
    const _origEnviarSug = window.enviarSugestao;
    if (typeof _origEnviarSug === 'function') {
      window.enviarSugestao = function () {
        _origEnviarSug.apply(this, arguments);
        try {
          const db = JSON.parse(localStorage.getItem('anivcrm_v2') || '{}');
          const last = (db.empresas || [])[0];
          if (last && last.is_sugestao) syncRecord('empresas', last.negocio);
        } catch (e) {
          console.warn('[sync-patch] enviarSugestao sync:', e.message);
        }
      };
    }

    console.log('[sync-patch] injetado com sucesso.');
  });

})();
