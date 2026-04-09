// ═══════════════════════════════════════════════════════════════════
// ANIVCRM - SISTEMA CONSOLIDADO v2.0 - SCRIPTS COMPLETO
// ═══════════════════════════════════════════════════════════════════

// ── TAILWIND CONFIG ─────────────────────────────────────────────────
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { 
        sans: ['DM Sans', 'sans-serif'], 
        mono: ['DM Mono', 'monospace'] 
      },
      colors: {
        primary: { 
          DEFAULT: '#3b5bdb', 
          hover: '#2b4ac7', 
          light: '#e7f0ff',
          border: '#b8d0ff'
        },
        surface: { 
          DEFAULT: '#ffffff', 
          2: '#f8f9fa', 
          3: '#e9ecef' 
        },
        ink: { 
          DEFAULT: '#212529', 
          muted: '#6c757d', 
          light: '#adb5bd' 
        },
        edge: { 
          DEFAULT: '#dee2e6', 
          strong: '#ced4da' 
        },
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES E HELPERS BASE
// ═══════════════════════════════════════════════════════════════════

const KEY = 'anivcrm_v2';
const AUTH_KEY = 'anivcrm_logged_user';
const CFG_KEY = 'anivcrm_cfg';
const DIAS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

let currentUser = null;
let _eCurrentStep = 1;
let _sgCurrentStep = 1;
let _nCurrentStep = 1;
let _pCurrentStep = 1;
let _sCurrentStep = 1;
let _sugModoAtual = 'cliente';
let empTab = 'ativas';
let solFiltro = '01';
let sugestaoFiltro = '01';
let ofertaFiltro = 'todos';
let catFiltro = 'todos'; // filtro por categoria/segmento
let raioKm = 30;
let userLat = null;
let userLng = null;
let userCityMode = false;
let geoCache = {};
let distCache = {};
let _adminPStep = 1;
let _adminProfile = null;

// ── Geração de ID ──────────────────────────────────────────────────
// Prefixos padrão: M=master, U=usuario, N=negocio, S=sugestao, P=perfil
function gid(prefix = '') {
  const id = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
  return prefix ? `${prefix}-${id}` : id;
}

// ── Storage ─────────────────────────────────────────────────────────
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data) return { empresas: [], clientes: [] };
    if (data.clientes) {
      data.clientes.forEach(c => {
        if (!c.perfil_id) c.perfil_id = gid('P');
      });
    }
    return data;
  } catch {
    return { empresas: [], clientes: [] };
  }
}

function save(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
}

function loadCfg() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCfg(d) {
  localStorage.setItem(CFG_KEY, JSON.stringify(d));
}

// ── Formatação ─────────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDatetime(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function mmdd(d) {
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function bdayMMDD(s) {
  if (!s) return '';
  const p = s.split('-');
  return p[1] + '-' + p[2];
}

function bdayThisWeek(s) {
  if (!s) return false;
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(d.getFullYear(), parseInt(s.split('-')[1]) - 1, parseInt(s.split('-')[2]));
  if (b < t) b.setFullYear(b.getFullYear() + 1);
  const diff = (b - t) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function daysUntilBday(nasc) {
  if (!nasc) return -1;
  const d = new Date();
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(d.getFullYear(), parseInt(nasc.split('-')[1]) - 1, parseInt(nasc.split('-')[2]));
  if (b < today) b.setFullYear(b.getFullYear() + 1);
  return Math.round((b - today) / (1000 * 60 * 60 * 24));
}

function parseDateToDB(str) {
  if (!str || str.length !== 10) return '';
  const [d, m, y] = str.split('/');
  return `${y}-${m}-${d}`;
}

function formatDateToInput(str) {
  if (!str) return '';
  const p = str.split('-');
  return p.length !== 3 ? str : `${p[2]}/${p[1]}/${p[0]}`;
}

function isValidDate(d) {
  if (d.length !== 10) return false;
  const p = d.split('/');
  if (p.length !== 3) return false;
  const day = +p[0], month = +p[1], year = +p[2];
  return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100;
}

function fmtDist(d) {
  if (d === null || d === undefined) return '';
  if (d < 1) return Math.round(d * 1000) + ' m';
  return d.toFixed(1).replace('.', ',') + ' km';
}

function diaAtualNome() {
  return ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][new Date().getDay()];
}

// ═══════════════════════════════════════════════════════════════════
// MÁSCARAS
// ═══════════════════════════════════════════════════════════════════

function maskPhone(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
  e.target.value = v;
}

function maskDate(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  v = v.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
  e.target.value = v;
}

function maskCEP(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  v = v.replace(/^(\d{5})(\d)/, '$1-$2');
  e.target.value = v;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 8) {
    buscarCEP(digits, e.target);
  }
}

function maskCPF(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/^(\d{3})(\d)/, '$1.$2')
       .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
       .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  e.target.value = v;
}

async function buscarCEP(cep, inputEl) {
  inputEl.style.borderColor = '#93c5fd';
  inputEl.disabled = true;
  
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    
    if (data.erro) {
      toast('CEP não encontrado.', 'err');
      inputEl.style.borderColor = '#fca5a5';
    } else {
      const id = inputEl.id;
      const prefix = id.replace('-cep', '');
      
      const set = (field, val) => {
        const el = document.getElementById(prefix + '-' + field);
        if (el && val) {
          el.value = val;
          el.style.borderColor = '#86efac';
        }
      };
      
      set('rua', data.logradouro);
      set('bairro', data.bairro);
      set('cidade', data.localidade);
      
      const ufEl = document.getElementById(prefix + '-uf');
      if (ufEl && data.uf) {
        // Tenta setar diretamente primeiro (mais robusto)
        ufEl.value = data.uf.trim();
        // Fallback manual por loop caso o select não aceite diretamente
        if (!ufEl.value) {
          for (let o of ufEl.options) {
            if (o.value.trim() === data.uf.trim() || o.text.trim() === data.uf.trim()) {
              o.selected = true;
              break;
            }
          }
        }
        ufEl.style.borderColor = '#86efac';
      }
      
      toast('Endereço preenchido!');
      inputEl.style.borderColor = '#86efac';
      
      setTimeout(() => {
        const n = document.getElementById(prefix + '-num');
        if (n) n.focus();
      }, 150);
    }
  } catch {
    toast('Erro ao buscar CEP.', 'err');
    inputEl.style.borderColor = '#fca5a5';
  } finally {
    inputEl.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOAST & MODALS
// ═══════════════════════════════════════════════════════════════════

function toast(msg, type = '') {
  const w = document.getElementById('toast-wrap');
  if (!w) return;
  
  const t = document.createElement('div');
  t.className = 'toast-item flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white max-w-xs';
  t.style.background = type === 'err' ? '#e03131' : type === 'info' ? '#3b5bdb' : '#212529';
  t.innerHTML = `<span class="text-lg">${type === 'err' ? '✕' : '✓'}</span><span>${msg}</span>`;
  w.appendChild(t);
  
  setTimeout(() => {
    t.style.cssText += 'opacity:0;transform:translateX(24px);transition:all .3s';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  const box = el.querySelector('.modal-form-box,.modal-box');
  if (box) box.scrollTop = 0;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
}

function confirmarAcao(title, msg, cb) {
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-msg');
  const okEl = document.getElementById('confirm-ok');
  
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
  if (okEl) okEl.onclick = () => { closeModal('modal-confirm'); cb(); };
  
  openModal('modal-confirm');
}

// ═══════════════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════════════════════════

const SCREEN_NAMES = {
  dashboard: 'Painel',
  empresas: 'Empresas',
  clientes: 'Clientes',
  aniversarios: 'Aniversários',
  sugestoes: 'Indicações',
  perfil: 'Meu Perfil',
  home: 'Início',
  ofertas: 'Locais e Ofertas',
  negocio: 'Meus Negócios'
};

function gotoScreen(name, btn) {
  // Esconde todas as screens
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  
  // Remove active de todos os nav-btn
  document.querySelectorAll('.nav-btn, .nav-btn-app').forEach(n => n.classList.remove('active'));
  
  // Mostra a screen correta
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.remove('hidden');
  
  // Adiciona active no botão
  if (btn) btn.classList.add('active');
  else {
    document.querySelectorAll('.nav-btn, .nav-btn-app').forEach(b => {
      if ((b.getAttribute('onclick') || '').includes("'" + name + "'")) b.classList.add('active');
    });
  }
  
  // Atualiza título
  const topbar = document.getElementById('topbar-title');
  if (topbar) {
    if (topbar.getAttribute('data-logo-mode') === 'true') {
      topbar.textContent = '';
    } else {
      topbar.textContent = SCREEN_NAMES[name] || name;
    }
  }
  
  // Renderizações específicas
  switch(name) {
    case 'dashboard': renderDashboard(); break;
    case 'empresas': 
      if (empTab === 'ativas') renderEmpresas();
      else if (empTab === 'solicitacoes') renderSolicitacoes();
      else if (empTab === 'indicacoes') renderSugestoes();
      break;
    case 'clientes': renderClientes(); break;
    case 'aniversarios': renderAniversarios(); break;
    case 'sugestoes': 
      if (document.getElementById('screen-dashboard')) {
        // No admin, "sugestoes" agora é a aba Indicações dentro de Empresas
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('screen-empresas')?.classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        switchEmpTab('indicacoes');
        return;
      } else {
        // App: pull fresco para mostrar status atualizado das indicações
        if (window._dbBridgePull) {
          window._dbBridgePull().then(() => renderSugestoesApp());
        } else {
          renderSugestoesApp();
        }
      }
      break;
    case 'perfil': 
      if (document.getElementById('screen-dashboard')) {
        loadAdminProfile();
      } else {
        renderPerfil();
      }
      break;
    case 'home': renderHome(); break;
    case 'ofertas': 
      if (window._dbBridgePull) {
        window._dbBridgePull().then(() => renderOfertas());
      } else {
        renderOfertas();
      }
      break;
    case 'negocio': 
      // Faz pull do banco antes de renderizar para pegar aprovações recentes do admin
      if (window._dbBridgePull) {
        window._dbBridgePull().then(() => renderNegocio());
      } else {
        renderNegocio();
      }
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════════

// ── Verificação de autenticação ─────────────────────────────────────
// Se não há usuário logado, redireciona para acessos.html.
// launcher.html é isento (atalho dev) — identificado por ?dev=1 ou pela
// ausência dos elementos screen-home / screen-dashboard.
function requireAuth() {
  const uid = localStorage.getItem(AUTH_KEY);
  const db  = load();
  currentUser = uid ? (db.clientes.find(c => c.usuario === uid) || null) : null;
  if (uid && !currentUser) {
    console.warn("Reset detectado. Limpando LocalStorage...");
    localStorage.clear();
    window.location.replace('acessos.html');
    return false;
  }
  if (!currentUser) {
    window.location.replace('acessos.html');
    return false;
  }
  return true;
}

function checkAuth() {
  if (!requireAuth()) return;
  const modal = document.getElementById('modal-auth');
  if (modal) modal.classList.remove('open');
  initApp();
}

// ── Funções de validação compartilhadas (usadas em acessos.html e em
//    qualquer página que precise validar campos de cadastro/perfil) ───

// DDDs válidos no Brasil (ANATEL)
const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19,
  21,22,24,
  27,28,
  31,32,33,34,35,37,38,
  41,42,43,44,45,46,
  47,48,49,
  51,53,54,55,
  61,
  62,64,
  63,
  65,66,
  67,
  68,
  69,
  71,73,74,75,77,
  79,
  81,87,
  82,
  83,
  84,
  85,88,
  86,89,
  91,93,94,
  92,97,
  95,
  96,
  98,99
]);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashSenha(senha) {
  try { return 'h_' + btoa(unescape(encodeURIComponent(senha))); }
  catch { return 'h_' + btoa(senha); }
}

// Máscara de nome: só letras, acentos, espaços e hifens
function maskNome(e) {
  const input = e.target;
  const cleaned = input.value.replace(/[^a-zA-ZÀ-ÿ\s\-']/g, '');
  if (input.value !== cleaned) input.value = cleaned;
  input.classList.remove('error');
}

// Validação de nome completo no blur
function validarNomeBlur(e) {
  const input = e.target;
  const v = input.value.trim();
  if (!v) return;
  const palavras = v.split(/\s+/).filter(p => p.length >= 2);
  if (palavras.length < 2) {
    if (window.toast) toast('Informe o nome completo (nome e sobrenome).', 'err');
    input.classList.add('error');
    input.value = '';
    setTimeout(() => input.classList.remove('error'), 2000);
    return;
  }
  const semVogal = /[^aeiouáéíóúâêîôûãõàèìòùäëïöüAEIOUÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÄËÏÖÜ]{4,}/;
  if (palavras.some(p => semVogal.test(p))) {
    if (window.toast) toast('Nome inválido — parece não ser um nome real.', 'err');
    input.classList.add('error');
    input.value = '';
    setTimeout(() => input.classList.remove('error'), 2000);
    return;
  }
  input.classList.remove('error');
  input.classList.add('success');
  setTimeout(() => input.classList.remove('success'), 1500);
}

// Validação avançada de data de nascimento
function isValidDateStrict(d) {
  if (!d || d.length !== 10) return false;
  const p = d.split('/');
  if (p.length !== 3 || p[2].length !== 4) return false;
  const day = parseInt(p[0], 10), month = parseInt(p[1], 10), year = parseInt(p[2], 10);
  const anoAtual = new Date().getFullYear();
  if (isNaN(year) || year < (anoAtual - 115) || year > anoAtual) return false;
  if (isNaN(month) || month < 1 || month > 12) return false;
  if (isNaN(day) || day < 1 || day > 31) return false;
  if ([4, 6, 9, 11].includes(month) && day > 30) return false;
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (day > (isLeap ? 29 : 28)) return false;
  }
  return true;
}

function dateErrorMsg(d) {
  if (!d || d.length < 10) return 'Preencha a data no formato DD/MM/AAAA.';
  const p = d.split('/');
  if (p.length !== 3 || p[2].length !== 4) return 'O ano deve ter 4 dígitos (ex: 1990).';
  const day = parseInt(p[0], 10), month = parseInt(p[1], 10), year = parseInt(p[2], 10);
  const anoAtual = new Date().getFullYear();
  if (isNaN(month) || month < 1 || month > 12) return 'Mês inválido — use 01 a 12.';
  if (year > anoAtual) return `Ano inválido — não pode ser no futuro (máx. ${anoAtual}).`;
  if (year < anoAtual - 115) return `Ano inválido — máximo de 115 anos atrás (mín. ${anoAtual - 115}).`;
  if (isNaN(day) || day < 1 || day > 31) return 'Dia inválido — use 01 a 31.';
  if ([4,6,9,11].includes(month) && day > 30) return ['Abril','Junho','Setembro','Novembro'][[4,6,9,11].indexOf(month)] + ' tem no máximo 30 dias.';
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (day > (isLeap ? 29 : 28)) return `Fevereiro de ${year} tem no máximo ${isLeap ? 29 : 28} dias.`;
  }
  return 'Data inválida.';
}

// Máscara de data com autocompletar zero à esquerda
function maskDateStrict(e) {
  const input = e.target;
  const isDeleting = e.inputType && e.inputType.startsWith('delete');
  let digits = input.value.replace(/\D/g, '').slice(0, 8);
  if (isDeleting) {
    let v = digits;
    if (v.length > 4) v = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4);
    else if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
    input.value = v;
    input.classList.remove('error');
    return;
  }
  let dd = digits.slice(0, 2), mm = digits.slice(2, 4), aaaa = digits.slice(4, 8);
  if (mm.length > 0 && dd.length === 1) dd = '0' + dd;
  if (aaaa.length > 0 && mm.length === 1) mm = '0' + mm;
  let resultado = dd;
  if (mm)   resultado += '/' + mm;
  if (aaaa) resultado += '/' + aaaa;
  input.value = resultado;
  input.classList.remove('error');
}

function validarDataBlur(e) {
  const input = e.target;
  const v = input.value.trim();
  if (!v) return;
  if (v.length === 10 && isValidDateStrict(v)) {
    input.classList.remove('error');
    input.classList.add('success');
    setTimeout(() => input.classList.remove('success'), 1500);
    return;
  }
  if (window.toast) toast(dateErrorMsg(v), 'err');
  input.classList.add('error');
  input.value = '';
  setTimeout(() => input.classList.remove('error'), 2000);
}

// Validação de telefone celular no blur
function validarTelBlur(e) {
  const input = e.target;
  const v = input.value.trim();
  if (!v) return;
  const digits = v.replace(/\D/g, '');
  if (digits.length !== 11) {
    if (window.toast) toast('Celular deve ter 11 dígitos: DDD + 9 + número.', 'err');
    input.classList.add('error'); input.value = '';
    setTimeout(() => input.classList.remove('error'), 2000); return;
  }
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (!DDDS_VALIDOS.has(ddd)) {
    if (window.toast) toast(`DDD (${ddd}) inválido — não existe no Brasil.`, 'err');
    input.classList.add('error'); input.value = '';
    setTimeout(() => input.classList.remove('error'), 2000); return;
  }
  if (digits[2] !== '9') {
    if (window.toast) toast('Número de celular deve começar com 9 após o DDD.', 'err');
    input.classList.add('error'); input.value = '';
    setTimeout(() => input.classList.remove('error'), 2000); return;
  }
  input.classList.remove('error');
  input.classList.add('success');
  setTimeout(() => input.classList.remove('success'), 1500);
}

// Busca CEP via ViaCEP e preenche campos com prefixo dado
async function buscarCEP(prefixo) {
  const cepInput = document.getElementById(prefixo + 'cep');
  if (!cepInput) return;
  const cep = cepInput.value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  cepInput.classList.add('success');
  cepInput.disabled = true;
  try {
    const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) {
      if (window.toast) toast('CEP não encontrado.', 'err');
      cepInput.classList.remove('success'); cepInput.classList.add('error');
      setTimeout(() => cepInput.classList.remove('error'), 2000);
    } else {
      const set = (id, val) => {
        const el = document.getElementById(prefixo + id);
        if (el && val) { el.value = val; el.classList.add('success'); setTimeout(() => el.classList.remove('success'), 1500); }
      };
      set('rua', data.logradouro);
      set('bairro', data.bairro);
      set('cidade', data.localidade);
      const ufEl = document.getElementById(prefixo + 'uf');
      if (ufEl && data.uf) {
        for (let o of ufEl.options) { if (o.value === data.uf.trim()) { o.selected = true; break; } }
        ufEl.classList.add('success'); setTimeout(() => ufEl.classList.remove('success'), 1500);
      }
      if (window.toast) toast('Endereço preenchido! ✨');
      cepInput.classList.add('success');
      setTimeout(() => { const num = document.getElementById(prefixo + 'num'); if (num) num.focus(); }, 200);
    }
  } catch {
    if (window.toast) toast('Erro ao buscar CEP. Verifique sua conexão.', 'err');
    cepInput.classList.remove('success'); cepInput.classList.add('error');
    setTimeout(() => cepInput.classList.remove('error'), 2000);
  } finally {
    cepInput.disabled = false;
  }
}

function initApp() {
  updateHeader();
  
  // Verifica se é admin ou app
  const isAdmin = document.getElementById('screen-dashboard');
  const isApp = document.getElementById('screen-home');
  
  if (isAdmin) {
    initAdmin();
  } else if (isApp) {
    gotoScreen('ofertas');
  }
}

function updateHeader() {
  if (!currentUser) return;
  
  const elNome = document.getElementById('header-nome');
  if (elNome) elNome.textContent = currentUser.nome.split(' ')[0];
  
  const elAvatar = document.getElementById('header-avatar');
  if (elAvatar) elAvatar.textContent = currentUser.nome.charAt(0).toUpperCase();
  
  const elNasc = document.getElementById('header-nasc');
  if (elNasc) elNasc.textContent = formatDateToInput(currentUser.nasc);

  // Primeira letra do nome nos botões mobile e desktop
  const primeiraLetra = currentUser.nome.trim()[0].toUpperCase();
  const elIniciais = document.getElementById('header-iniciais');
  if (elIniciais) elIniciais.textContent = primeiraLetra;
  const elIniciaisDesktop = document.getElementById('header-iniciais-desktop');
  if (elIniciaisDesktop) elIniciaisDesktop.textContent = primeiraLetra;
}

function registrarUsuario() {
  const nome = document.getElementById('auth-nome').value.trim();
  const nascInput = document.getElementById('auth-nasc').value;
  const email = document.getElementById('auth-email')?.value.trim() || '';
  const tel = document.getElementById('auth-tel')?.value.trim() || '';
  
  if (!nome || !nascInput) {
    toast('Nome e Data de Nascimento são obrigatórios!', 'err');
    return;
  }
  
  if (!isValidDate(nascInput)) {
    toast('Data de nascimento inválida. Use DD/MM/AAAA', 'err');
    return;
  }
  
  const db = load();
  const masterId  = gid('M');  // M-XXXXXX — agrupador
  const usuarioId = gid('U');  // U-XXXXXX — identidade pessoal
  const perfilId  = gid('P');  // P-XXXXXX — perfil de exibição
  
  const u = {
    usuario:   usuarioId,   // U-XXXXXX (PK da tabela clientes)
    master:    masterId,    // M-XXXXXX (agrupador obrigatório)
    negocio:   null,        // N-XXXXXX quando tiver negócio
    sugestao:  null,        // S-XXXXXX se veio de indicação
    perfil_id: perfilId,
    nome,
    nasc:      parseDateToDB(nascInput),
    email,
    telefone:  tel,
    rua: '', num: '', comp: '',
    bairro: '', cep: '', cidade: '', uf: '',
    status: 'ativo',
    oferta_enviada: false,
    criado_em: new Date().toISOString()
  };
  
  db.clientes.unshift(u);
  save(db);
  localStorage.setItem(AUTH_KEY, u.usuario);
  currentUser = u;
  
  const modal = document.getElementById('modal-auth');
  if (modal) modal.classList.remove('open');
  
  toast('Conta criada com sucesso!');
  initApp();
}

function sair() {
  localStorage.removeItem(AUTH_KEY);
  window.location.replace('acessos.html');
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// MIGRAÇÃO: corrige status_perfil de empresas legadas
// Empresas com usuario = verificado; empresas sem usuario (sugestão) = comunidade
// Roda uma vez no initAdmin para sanar dados anteriores ao padrão atual
// ═══════════════════════════════════════════════════════════════════
function migrateEmpresasStatusPerfil() {
  const db = load();
  let changed = false;
  (db.empresas || []).forEach(e => {
    const deveSerVerificado = !!e.usuario;
    const correto = deveSerVerificado ? 'verificado' : 'comunidade';
    if (e.status_perfil !== correto) {
      e.status_perfil = correto;
      changed = true;
    }
  });
  if (changed) save(db);
}

function initAdmin() {
  migrateEmpresasStatusPerfil(); // corrige dados legados: status_perfil ausente/errado
  const d = new Date();
  const topbarDate = document.getElementById('topbar-date');
  if (topbarDate) {
    topbarDate.textContent = d.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  const h = d.getHours();
  const dashGreet = document.getElementById('dash-greet');
  if (dashGreet) {
    dashGreet.textContent = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + '! 👋';
  }
  
  renderDashboard();
  checkBdayAlert();
  updateSugestoesBadge();
  
  // Atualiza avatar do admin com inicial do usuário logado
  const db = load();
  const uid = localStorage.getItem('anivcrm_logged_user');
  const adminUser = uid ? (db.clientes || []).find(c => c.usuario === uid) : null;
  const adminAvatarBtn = document.querySelector('button[onclick="toggleSidebar()"]');
  if (adminAvatarBtn && adminUser && adminUser.nome) {
    adminAvatarBtn.textContent = adminUser.nome.charAt(0).toUpperCase();
  }
  
  // Listener para fechar modais clicando fora
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function renderDashboard() {
  const db = load();
  const today = mmdd(new Date());
  
  const bdayToday = db.clientes.filter(c => bdayMMDD(c.nasc) === today);
  const bdayWeek = db.clientes.filter(c => bdayThisWeek(c.nasc));
  const enviadas = db.clientes.filter(c => c.oferta_enviada).length;
  const pendentes = db.clientes.length - enviadas;
  const hhEmps = db.empresas.filter(e => e.horarios && e.horarios.some(h => h.hh)).length;
  const solPend = (db.empresas || []).filter(e => !e.is_sugestao && e.status === '01').length;
  
  const m = String(new Date().getMonth() + 1).padStart(2, '0');
  const bdayMes = db.clientes.filter(c => c.nasc && c.nasc.split('-')[1] === m).length;
  const verif = db.empresas.filter(e => e.status_perfil === 'verificado').length;
  
  // Grid de stats
  const statsGrid = document.getElementById('stats-grid');
  if (statsGrid) {
    const cards = [
      { icon: '🏢', label: 'Empresas', val: db.empresas.length, sub: verif + ' verificadas', screen: 'empresas', color: 'text-blue-600', bg: 'bg-blue-50' },
      { icon: '👥', label: 'Clientes', val: db.clientes.length, sub: bdayMes + ' aniversariam este mês', screen: 'clientes', color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { icon: '🎂', label: 'Aniversários Hoje', val: bdayToday.length, sub: bdayToday.length === 0 ? 'Nenhum hoje' : 'Parabéns!', screen: 'aniversarios', color: 'text-green-600', bg: 'bg-green-50' },
      { icon: '📅', label: 'Esta Semana', val: bdayWeek.length, sub: 'próximos 7 dias', screen: 'aniversarios', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    ];
    
    statsGrid.innerHTML = cards.map(c => `
      <div onclick="gotoScreen('${c.screen}',null)" 
           class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all">
        <div class="flex items-start justify-between mb-3">
          <div class="w-10 h-10 rounded-xl ${c.bg} ${c.color} flex items-center justify-center text-xl">${c.icon}</div>
        </div>
        <div class="text-3xl font-bold tracking-tight leading-none">${c.val}</div>
        <div class="text-sm font-semibold text-gray-800 mt-1">${c.label}</div>
        <div class="text-xs text-gray-500 mt-1">${c.sub}</div>
      </div>
    `).join('');
  }
  
  // Tabelas de aniversários
  const dashToday = document.getElementById('dash-today');
  const dashWeek = document.getElementById('dash-week');
  
  if (dashToday) {
    if (bdayToday.length) {
      dashToday.innerHTML = bdayToday.map(c => clienteBdayCard(c, db)).join('');
    } else {
      dashToday.innerHTML = '<div class="text-center py-6 text-gray-400"><div class="text-3xl mb-2">😴</div><p class="text-sm">Nenhum aniversariante hoje.</p></div>';
    }
  }
  
  if (dashWeek) {
    const wo = bdayWeek.filter(c => bdayMMDD(c.nasc) !== today);
    if (wo.length) {
      dashWeek.innerHTML = wo.slice(0, 6).map(c => clienteBdayCard(c, db)).join('');
    } else {
      dashWeek.innerHTML = '<div class="text-center py-6 text-gray-400"><div class="text-3xl mb-2">🗓️</div><p class="text-sm">Nenhum nos próximos dias.</p></div>';
    }
  }
  
  renderRelatorios();
}

function clienteBdayCard(c, db) {
  const emp = db.empresas.find(e => e.negocio === c.negocio);
  const ini = c.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `
    <div class="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div class="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-600">${ini}</div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm truncate">${c.nome}</div>
        <div class="text-xs text-gray-500 truncate">${emp ? '🏢 ' + emp.empresa : '—'} · ${c.telefone || c.email || 'Sem contato'}</div>
      </div>
      ${c.oferta_enviada 
        ? '<span class="text-xs text-green-600 font-bold">✓ Enviado</span>' 
        : `<button onclick="marcarEnviado('${c.usuario}')" class="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100">Marcar</button>`}
    </div>`;
}

function renderRelatorios() {
  const db = load();
  const totalEmp = db.empresas.length;
  const totalCli = db.clientes.length;
  const enviadas = db.clientes.filter(c => c.oferta_enviada).length;
  const pct = totalCli ? Math.round((enviadas / totalCli) * 100) : 0;
  
  // Top empresas
  const empCount = db.empresas.map(e => ({
    ...e,
    count: db.clientes.filter(c => c.negocio === e.negocio).length
  })).sort((a, b) => b.count - a.count).slice(0, 6);
  
  const maxCount = empCount[0]?.count || 1;
  
  const relTopEmp = document.getElementById('rel-top-emp');
  if (relTopEmp) {
    if (empCount.length) {
      relTopEmp.innerHTML = empCount.map(e => `
        <div class="flex items-center gap-3 mb-3">
          <span class="text-sm font-medium w-36 truncate">${e.empresa}</span>
          <div class="flex-1 bg-gray-100 rounded-full h-2">
            <div class="bg-blue-500 rounded-full h-2" style="width:${Math.max(4, (e.count / maxCount) * 100)}%"></div>
          </div>
          <span class="mono text-xs text-gray-500 w-6 text-right">${e.count}</span>
        </div>
      `).join('');
    } else {
      relTopEmp.innerHTML = '<p class="text-sm text-gray-400">Nenhuma empresa cadastrada.</p>';
    }
  }
  
  // Aniversários por mês
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const bDayPerMonth = meses.map((_, i) => db.clientes.filter(c => c.nasc && parseInt(c.nasc.split('-')[1]) - 1 === i).length);
  const maxBday = Math.max(...bDayPerMonth, 1);
  
  const relBdayMes = document.getElementById('rel-bday-mes');
  if (relBdayMes) {
    relBdayMes.innerHTML = `
      <div class="flex items-end gap-1.5 h-24">
        ${bDayPerMonth.map((v, i) => `
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full rounded-t ${i === new Date().getMonth() ? 'bg-blue-500' : 'bg-blue-200'}" 
                 style="height:${Math.max(4, (v / maxBday) * 80)}px"></div>
            <span class="text-[9px] text-gray-400 font-medium">${meses[i]}</span>
          </div>
        `).join('')}
      </div>`;
  }
  
  // Ofertas enviadas
  const relOfertas = document.getElementById('rel-ofertas');
  if (relOfertas) {
    relOfertas.innerHTML = `
      <div class="flex items-center gap-4 mb-3">
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">${enviadas}</div>
          <div class="text-xs text-gray-400">Enviadas</div>
        </div>
        <div class="flex-1 bg-gray-100 rounded-full h-3">
          <div class="bg-green-500 rounded-full h-3" style="width:${pct}%"></div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-600">${totalCli - enviadas}</div>
          <div class="text-xs text-gray-400">Pendentes</div>
        </div>
      </div>
      <p class="text-xs text-gray-500">${pct}% das ofertas foram enviadas.</p>`;
  }
  
  // Happy Hour
  const hhEmps = db.empresas.filter(e => e.horarios && e.horarios.some(h => h.hh));
  const relHh = document.getElementById('rel-hh');
  if (relHh) {
    if (hhEmps.length) {
      relHh.innerHTML = `
        <p class="text-sm text-gray-500 mb-3">${hhEmps.length} de ${totalEmp} empresas têm happy hour.</p>
        <div class="space-y-2">
          ${hhEmps.slice(0, 5).map(e => `
            <div class="flex items-center gap-2 text-sm">
              <span class="text-yellow-600">🍺</span>
              <span class="font-medium">${e.empresa}</span>
            </div>
          `).join('')}
          ${hhEmps.length > 5 ? `<p class="text-xs text-gray-400">+${hhEmps.length - 5} mais...</p>` : ''}
        </div>`;
    } else {
      relHh.innerHTML = '<p class="text-sm text-gray-400">Nenhuma empresa com Happy Hour.</p>';
    }
  }
}

function checkBdayAlert() {
  const db = load();
  const today = mmdd(new Date());
  const lista = db.clientes.filter(c => bdayMMDD(c.nasc) === today);
  
  const alert = document.getElementById('bday-alert');
  const names = document.getElementById('bday-alert-names');
  
  if (alert && lista.length) {
    alert.classList.remove('hidden');
    const nomes = lista.map(c => c.nome).join(', ');
    names.textContent = lista.length === 1 ? `${nomes} faz aniversário hoje!` : `${nomes} fazem aniversário hoje!`;
  }
}

function updateSugestoesBadge() {
  const db = load();
  
  // Badge Indicações — atualiza tanto o badge-sugestoes (nav legado) quanto badge-ind-tab (aba)
  const pendingInd = (db.empresas || []).filter(e => e.is_sugestao && e.status === '01').length;
  ['badge-sugestoes', 'badge-ind-tab'].forEach(bid => {
    const b = document.getElementById(bid);
    if (!b) return;
    if (pendingInd > 0) { b.classList.remove('hidden'); b.textContent = pendingInd; }
    else { b.classList.add('hidden'); }
  });
  
  // Badge Solicitações (donas pendentes = empresas com status 01 e usuario preenchido)
  const pendingSol = (db.empresas || []).filter(e => e.status === '01' && e.usuario).length;
  const badgeSol = document.getElementById('badge-solicitacoes');
  if (badgeSol) {
    if (pendingSol > 0) {
      badgeSol.classList.remove('hidden');
      badgeSol.textContent = pendingSol;
    } else {
      badgeSol.classList.add('hidden');
    }
  }
  
  const badgeSolTab = document.getElementById('badge-sol-tab');
  if (badgeSolTab) {
    if (pendingSol > 0) {
      badgeSolTab.classList.remove('hidden');
      badgeSolTab.textContent = pendingSol;
    } else {
      badgeSolTab.classList.add('hidden');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: EMPRESAS
// ═══════════════════════════════════════════════════════════════════

function switchEmpTab(tab) {
  empTab = tab;
  
  document.querySelectorAll('.emp-tab-btn').forEach(b => {
    b.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
    b.classList.add('text-gray-400');
  });
  
  const active = document.getElementById('emp-tab-' + tab);
  if (active) {
    active.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
    active.classList.remove('text-gray-400');
  }
  
  document.getElementById('emp-panel-ativas')?.classList.toggle('hidden', tab !== 'ativas');
  document.getElementById('emp-panel-solicitacoes')?.classList.toggle('hidden', tab !== 'solicitacoes');
  document.getElementById('emp-panel-indicacoes')?.classList.toggle('hidden', tab !== 'indicacoes');
  
  if (tab === 'ativas') renderEmpresas();
  else if (tab === 'solicitacoes') renderSolicitacoes();
  else if (tab === 'indicacoes') renderSugestoes();
}

function renderEmpresas() {
  const db = load();
  const q = (document.getElementById('search-emp')?.value || '').toLowerCase();
  
  // Aba "Ativas" = todas as empresas com status '02' (aprovadas)
  // Inclui verificadas (têm dono) e comunidade (sugestões aprovadas) — ambas ficam aqui
  let list = db.empresas.filter(e => e.status === '02');
  if (q) list = list.filter(e => (e.empresa || '').toLowerCase().includes(q));
  
  const tbody = document.getElementById('emp-tbody');
  const empty = document.getElementById('emp-empty');
  
  if (!tbody) return;
  
  if (!list.length) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  
  empty?.classList.add('hidden');
  
  tbody.innerHTML = list.map(e => {
    const dono = e.usuario ? (db.clientes || []).find(c => c.usuario === e.usuario) : null;
    const addr = [e.rua, e.num, e.bairro, e.cidade, e.uf].filter(Boolean).join(', ') || '—';
    const hhOn = e.horarios && e.horarios.some(h => h.hh && !h.fechado);
    
    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">
          <div class="font-semibold flex items-center gap-2">${e.empresa || e.nome || ''}
            ${e.status_perfil === 'verificado' ? '<span class="badge-verificado">🛡️ Verificado</span>' : '<span class="badge-comunidade">🤝 Comunidade</span>'}
            ${hhOn ? '<span class="badge-pendente">🍺 HH</span>' : ''}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">${addr}</div>
        </td>
        <td class="px-4 py-3">
          <div class="mono text-sm">${e.telefone || '—'}</div>
          <div class="text-xs text-gray-400">${e.email || ''}</div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1.5 flex-wrap max-w-[120px]">
            ${e.estacionamento ? '<span title="Estacionamento" class="text-lg grayscale-0">🚗</span>' : '<span class="text-lg grayscale opacity-20">🚗</span>'}
            ${e.brinquedoteca ? '<span title="Brinquedoteca" class="text-lg grayscale-0">🧸</span>' : '<span class="text-lg grayscale opacity-20">🧸</span>'}
            ${e.comida_vegana ? '<span title="Comida Vegana" class="text-lg grayscale-0">🌱</span>' : '<span class="text-lg grayscale opacity-20">🌱</span>'}
            ${e.cadeirinha ? '<span title="Cadeirinha" class="text-lg grayscale-0">🪑</span>' : '<span class="text-lg grayscale opacity-20">🪑</span>'}
            ${e.delivery ? '<span title="Delivery" class="text-lg grayscale-0">🛵</span>' : '<span class="text-lg grayscale opacity-20">🛵</span>'}
          </div>
        </td>
        <td class="px-4 py-3 max-w-[200px]">
          <div class="text-sm font-medium">${e.oferta_destaque || '—'}</div>
          <div class="text-xs text-gray-400">${e.oferta_tipo || ''}</div>
        </td>
        <td class="px-4 py-3">
          <span class="badge-aprovado">${e.oferta_valida || '—'}</span>
        </td>
        <td class="px-4 py-3">
          ${dono ? `<div class="text-sm font-semibold text-purple-700">👑 ${dono.nome}</div>` : '<span class="text-xs text-gray-400 italic">Sem dono</span>'}
        </td>
        <td class="px-4 py-3 text-right">
          <div class="flex gap-2 justify-end">
            <button onclick="openEmpModal('${e.negocio}')" class="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">✏️ Editar</button>
            <button onclick="confirmar('empresa','${e.negocio}')" class="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-100">🗑</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openEmpModal(id) {
  const isEdit = !!id;
  document.getElementById('emp-modal-title').textContent = isEdit ? 'Editar Empresa' : 'Nova Empresa';
  
  const db = load();
  
  if (isEdit) {
    const emp = db.empresas.find(e => e.negocio === id);
    if (!emp) return;
    
    document.getElementById('e-id').value = emp.negocio;
    document.getElementById('e-nome').value = emp.empresa || '';
    document.getElementById('e-status-perfil').value = emp.status_perfil || 'comunidade';
    document.getElementById('e-segmento').value = emp.segmento || '';
    document.getElementById('e-tel').value = emp.telefone || '';
    document.getElementById('e-email').value = emp.email || '';
    document.getElementById('e-ig').value = emp.ig || '';
    document.getElementById('e-site').value = emp.site || '';
    document.getElementById('e-cardapio').value = emp.cardapio || '';
    document.getElementById('e-rua').value = emp.rua || '';
    document.getElementById('e-num').value = emp.num || '';
    document.getElementById('e-comp').value = emp.comp || '';
    document.getElementById('e-bairro').value = emp.bairro || '';
    document.getElementById('e-cep').value = emp.cep || '';
    document.getElementById('e-cidade').value = emp.cidade || '';
    document.getElementById('e-uf').value = emp.uf || '';
    document.getElementById('e-oferta-tipo').value = emp.oferta_tipo || 'Produto/Brinde Grátis';
    document.getElementById('e-oferta-val').value = emp.oferta_valida || 'No dia do aniversário';
    document.getElementById('e-oferta-desc').value = emp.oferta_destaque || '';
    document.getElementById('e-oferta-detalhe').value = emp.oferta_detalhe || '';
    document.getElementById('e-oferta-regras').value = emp.oferta_regras || '';
    
    // Novos campos
    document.getElementById('e-estacionamento').checked = !!emp.estacionamento;
    document.getElementById('e-brinquedoteca').checked = !!emp.brinquedoteca;
    document.getElementById('e-comida-vegana').checked = !!emp.comida_vegana;
    document.getElementById('e-cadeirinha').checked = !!emp.cadeirinha;
    document.getElementById('e-delivery').checked = !!emp.delivery;
    
    buildSched(emp.horarios || null, 'e-');
    updateHHDescVis('e-');
    const hhDescEl = document.getElementById('e-hh-desc');
    if (hhDescEl) hhDescEl.value = emp.hh_desc || '';
    renderDonoPanel(emp.usuario || '', db);
  } else {
    document.getElementById('e-id').value = '';
    ['e-nome', 'e-tel', 'e-email', 'e-ig', 'e-site', 'e-cardapio', 'e-rua', 'e-num', 'e-comp', 'e-bairro', 'e-cep', 'e-cidade', 'e-oferta-desc', 'e-oferta-regras'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.value = '';
    });
    document.getElementById('e-status-perfil').value = 'comunidade';
    document.getElementById('e-segmento').value = '';
    document.getElementById('e-uf').value = '';
    document.getElementById('e-oferta-tipo').value = 'Produto/Brinde Grátis';
    document.getElementById('e-oferta-val').value = 'No dia do aniversário';
    buildSched(null, 'e-');
    updateHHDescVis('e-');
    const hhDescElNew = document.getElementById('e-hh-desc');
    if (hhDescElNew) hhDescElNew.value = '';
    
    // Reset novos campos
    ['e-estacionamento', 'e-brinquedoteca', 'e-comida-vegana', 'e-cadeirinha', 'e-delivery'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    
    renderDonoPanel('', db);
  }
  
  updateOfertaPreview();
  
  _eCurrentStep = 1;
  document.querySelectorAll('#modal-emp .n-step').forEach(s => s.classList.remove('active'));
  document.getElementById('e-step-1').classList.add('active');
  document.getElementById('e-prev-btn').classList.add('hidden');
  document.getElementById('e-next-btn').textContent = 'Próximo →';
  document.getElementById('e-step-label').textContent = 'Etapa 1 de 6';
  
  for (let i = 1; i <= 6; i++) {
    const dot = document.getElementById('e-dot-' + i);
    if (dot) dot.style.background = i === 1 ? '#3b5bdb' : '#e2e8f0';
  }
  
  openModal('modal-emp');
}

function renderDonoPanel(donoId, db) {
  document.getElementById('emp-dono-busca').value = '';
  document.getElementById('emp-dono-resultados').innerHTML = '';
  document.getElementById('emp-dono-resultados').classList.add('hidden');
  document.getElementById('emp-dono-id-selecionado').value = donoId || '';
  
  if (donoId) {
    const cli = (db.clientes || []).find(c => c.usuario === donoId);
    if (cli) {
      document.getElementById('emp-dono-avatar').textContent = cli.nome.charAt(0).toUpperCase();
      document.getElementById('emp-dono-master-id').textContent = cli.master || cli.usuario;
      document.getElementById('emp-dono-nome').textContent = cli.nome || '';
      document.getElementById('emp-dono-contato').textContent = [cli.telefone, cli.email].filter(Boolean).join(' · ') || 'Sem contato';
      document.getElementById('emp-dono-atual').classList.remove('hidden');
      document.getElementById('emp-dono-vazio').classList.add('hidden');
      return;
    }
  }
  
  document.getElementById('emp-dono-atual').classList.add('hidden');
  document.getElementById('emp-dono-vazio').classList.remove('hidden');
}

function buscarDonoEmp(q) {
  const res = document.getElementById('emp-dono-resultados');
  if (!q || q.length < 2) {
    res.classList.add('hidden');
    res.innerHTML = '';
    return;
  }
  
  const db = load();
  const ql = q.toLowerCase();
  const matches = (db.clientes || []).filter(c =>
    (c.nome || '').toLowerCase().includes(ql) ||
    (c.email || '').toLowerCase().includes(ql) ||
    (c.telefone || '').includes(q)
  ).slice(0, 6);
  
  if (!matches.length) {
    res.innerHTML = '<p class="px-4 py-3 text-sm text-gray-400 italic">Nenhum cliente encontrado.</p>';
    res.classList.remove('hidden');
    return;
  }
  
  res.innerHTML = matches.map(c => `
    <button type="button" onclick="selecionarDonoEmp('${c.usuario}')" 
            class="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 flex items-center gap-3">
      <div class="w-7 h-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-xs font-bold text-purple-700">${c.nome.charAt(0).toUpperCase()}</div>
      <div class="min-w-0">
        <p class="font-semibold text-sm truncate">${c.nome}</p>
        <p class="text-xs text-gray-400 mono">${[c.telefone, c.email].filter(Boolean).join(' · ') || 'Sem contato'}</p>
      </div>
    </button>`).join('');
  res.classList.remove('hidden');
}

function selecionarDonoEmp(clienteId) {
  const db = load();
  document.getElementById('emp-dono-busca').value = '';
  document.getElementById('emp-dono-resultados').classList.add('hidden');
  document.getElementById('emp-dono-id-selecionado').value = clienteId;
  renderDonoPanel(clienteId, db);
}

function updateOfertaPreview() {
  const tipo = document.getElementById('e-oferta-tipo')?.value || '';
  const desc = document.getElementById('e-oferta-desc')?.value.trim() || '';
  const el = document.getElementById('oferta-preview');
  
  if (el) {
    if (desc) {
      el.classList.remove('hidden');
      document.getElementById('oferta-preview-txt').textContent = tipo + ': ' + desc;
    } else {
      el.classList.add('hidden');
    }
  }
}

// ── Wizard step helper (compartilhado por todos os modais multi-etapa) ──
// pfx      : prefixo dos IDs  (ex: 'e' → e-step-N, e-dot-N, e-prev-btn…)
// cur      : passo atual (número)
// total    : total de etapas
// saveFn   : função chamada ao confirmar no último passo
// scrollId : ID do modal cujo .modal-form-box deve rolar pro topo (opcional)
// Retorna  : novo valor do passo atual
function _wizStep(pfx, cur, total, saveFn, scrollId, n) {
  if (n === 1 && cur === total) { saveFn(); return cur; }

  document.getElementById(pfx + '-step-' + cur)?.classList.remove('active');
  cur += n;
  document.getElementById(pfx + '-step-' + cur)?.classList.add('active');

  document.getElementById(pfx + '-prev-btn')?.classList.toggle('hidden', cur === 1);
  const nextBtn = document.getElementById(pfx + '-next-btn');
  if (nextBtn) nextBtn.textContent = cur === total ? 'Salvar ✓' : 'Próximo →';
  const lbl = document.getElementById(pfx + '-step-label');
  if (lbl) lbl.textContent = 'Etapa ' + cur + ' de ' + total;

  for (let i = 1; i <= total; i++) {
    const dot = document.getElementById(pfx + '-dot-' + i);
    if (dot) dot.style.background = i <= cur ? '#3b5bdb' : '#e2e8f0';
  }

  if (scrollId) {
    const box = document.getElementById(scrollId)?.querySelector('.modal-form-box');
    if (box) box.scrollTop = 0;
  }
  return cur;
}

function eStep(n) {
  if (n === 1 && _eCurrentStep === 2) {
    const nome = document.getElementById('e-nome')?.value.trim();
    if (!nome) { toast('O nome da empresa é obrigatório.', 'err'); return; }
  }
  _eCurrentStep = _wizStep('e', _eCurrentStep, 6, salvarEmpresa, 'modal-emp', n);
}

function salvarEmpresa() {
  const nome = document.getElementById('e-nome').value.trim();
  const desc = document.getElementById('e-oferta-desc').value.trim();
  
  if (!nome) {
    toast('Nome da empresa é obrigatório.', 'err');
    return;
  }
  if (!desc) {
    toast('Descreva a oferta de aniversário.', 'err');
    return;
  }
  
  const db = load();
  const editId = document.getElementById('e-id').value;
  const empOriginal = editId ? (db.empresas.find(e => e.negocio === editId) || {}) : {};
  const novoDono = document.getElementById('emp-dono-id-selecionado')?.value || '';
  
  // Se é nova empresa, o master vem do dono (se tiver) ou é criado novo
  const donoCliente = novoDono ? (db.clientes || []).find(c => c.usuario === novoDono) : null;
  const masterRef = empOriginal.master || (donoCliente ? donoCliente.master : gid('M'));
  
  const emp = {
    negocio:  editId || gid('N'),     // N-XXXXXX (PK)
    master:   masterRef,              // M-XXXXXX — herda do dono ou novo
    usuario:  novoDono,               // U-XXXXXX do dono
    sugestao: empOriginal.sugestao || null,  // S-XXXXXX se veio de indicação
    origem_sug_id: empOriginal.origem_sug_id || '',
    criado_em: empOriginal.criado_em || new Date().toISOString(),
    empresa: nome,
    status_conta:  'ativa',
    status_perfil: document.getElementById('e-status-perfil').value,
    telefone: document.getElementById('e-tel').value.trim(),
    email:    document.getElementById('e-email').value.trim(),
    ig:       document.getElementById('e-ig').value.trim(),
    site:     document.getElementById('e-site').value.trim(),
    cardapio: document.getElementById('e-cardapio').value.trim(),
    rua:      document.getElementById('e-rua').value.trim(),
    num:      document.getElementById('e-num').value.trim(),
    comp:     document.getElementById('e-comp').value.trim(),
    bairro:   document.getElementById('e-bairro').value.trim(),
    cep:      document.getElementById('e-cep').value.trim(),
    cidade:   document.getElementById('e-cidade').value.trim(),
    uf:       document.getElementById('e-uf').value,
    segmento: document.getElementById('e-segmento').value.trim(),
    horarios: collectSched('e-'),
    hh_desc:  (document.getElementById('e-hh-desc')?.value.trim() || ''),
    oferta_tipo:     document.getElementById('e-oferta-tipo').value,
    oferta_valida:   document.getElementById('e-oferta-val').value,
    oferta_destaque: desc,
    oferta_detalhe:  document.getElementById('e-oferta-detalhe').value.trim(),
    oferta_regras:   document.getElementById('e-oferta-regras').value.trim(),
    estacionamento:  document.getElementById('e-estacionamento').checked ? 1 : 0,
    brinquedoteca:   document.getElementById('e-brinquedoteca').checked ? 1 : 0,
    comida_vegana:   document.getElementById('e-comida-vegana').checked ? 1 : 0,
    cadeirinha:      document.getElementById('e-cadeirinha').checked ? 1 : 0,
    delivery:        document.getElementById('e-delivery').checked ? 1 : 0,
    lat: empOriginal.lat || null,
    lng: empOriginal.lng || null,
    // Preserva status e aprovado_em — editar não deve resetar o status da empresa
    status:      empOriginal.status      || '01',
    aprovado_em: empOriginal.aprovado_em || '',
    atualizado_em: new Date().toISOString(),
  };
  
  if (editId) {
    const i = db.empresas.findIndex(e => e.negocio === editId);
    if (i !== -1) db.empresas[i] = emp;
  } else {
    db.empresas.unshift(emp);
  }
  
  save(db);
  closeModal('modal-emp');
  renderEmpresas();
  updateSugestoesBadge();
  toast(editId ? 'Empresa atualizada!' : 'Empresa cadastrada!');
}

function excluirEmpresa(id) {
  const db = load();
  db.empresas = db.empresas.filter(e => e.negocio !== id);
  // Desvincula clientes que tinham esse negócio
  db.clientes.forEach(c => { if (c.negocio === id) c.negocio = null; });
  save(db);
  renderEmpresas();
  renderDashboard();
  toast('Empresa removida.');
}

// ── Horários ───────────────────────────────────────────────────────

function buildSched(horarios, pfx = 'e-') {
  const c = document.getElementById(pfx + 'sched-container');
  if (!c) return;
  c.innerHTML = '';
  
  const data = horarios && horarios.length === 7 ? horarios : DIAS.map(d => ({
    dia: d,
    slots: [{ ini: '08:00', fim: '18:00' }],
    fechado: false,
    hh: false,
    hh_slots: [{ ini: '17:00', fim: '19:00' }]
  }));
  
  data.forEach((h, i) => c.appendChild(buildDiaRow(h, i, pfx)));
  // Atualiza visibilidade do bloco de descrição global de HH (admin)
  updateHHDescVis(pfx);
}

function buildDiaRow(h, i, pfx) {
  const div = document.createElement('div');
  div.className = 'sched-row' + (h.fechado ? ' closed' : '');
  div.dataset.idx = i;
  
  const hhSlots = h.hh_slots && h.hh_slots.length ? h.hh_slots : [{ ini: '17:00', fim: '19:00' }];
  const hhNota = (h.hh_nota || h.hh_desc || '').replace(/"/g, '&quot;');
  
  div.innerHTML = `
    <div class="flex items-center gap-3 px-4 py-2.5">
      <span class="w-28 text-xs font-bold text-gray-800 shrink-0">${h.dia}</span>
      <div class="flex items-center gap-2 flex-wrap flex-1" id="${pfx}slots-${i}">
        ${h.slots.map((s, si) => slotHTML(i, si, s.ini, s.fim, pfx)).join('')}
        ${!h.fechado ? `<button onclick="addSlot(${i},'${pfx}')" type="button" class="text-xs border border-dashed border-gray-300 text-gray-400 rounded px-2 py-0.5 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">+ intervalo</button>` : ''}
      </div>
      <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer shrink-0">
        <input type="checkbox" ${h.fechado ? 'checked' : ''} onchange="toggleFechado(${i},this,'${pfx}')" class="accent-blue-500">
        Fechado
      </label>
    </div>
    <div class="hh-sub" id="${pfx}hh-row-${i}" ${h.fechado ? 'style="opacity:.4;pointer-events:none"' : ''}>
      <div class="flex items-center gap-3 px-4 py-2">
        <span class="w-28 text-xs font-bold text-blue-600 shrink-0">🍺 Happy Hour</span>
        <div class="flex items-center gap-2 flex-wrap flex-1" id="${pfx}hh-slots-${i}">
          ${h.hh ? hhSlots.map((s, si) => hhSlotHTML(i, si, s.ini, s.fim, pfx)).join('') + `<button onclick="addHHSlot(${i},'${pfx}')" type="button" class="text-xs border border-dashed border-blue-300 text-blue-500 rounded px-2 py-0.5 hover:bg-blue-50 transition-all">+ intervalo</button>` : '<span class="text-xs text-gray-400 italic">Sem HH neste dia</span>'}
        </div>
        <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer shrink-0">
          <input type="checkbox" ${h.hh ? 'checked' : ''} onchange="toggleHHDia(${i},this,'${pfx}')" class="accent-blue-500">
          Tem HH
        </label>
      </div>
      <div id="${pfx}hh-nota-row-${i}" style="${h.hh ? '' : 'display:none'}" class="px-4 pb-3">
        <input type="text" id="${pfx}hh-nota-${i}" value="${hhNota}"
          placeholder="O que tem no HH? Ex: Chopp a R$7, drinks em dobro..."
          class="w-full border border-blue-200 rounded-lg px-3 h-8 text-xs bg-white focus:outline-none focus:border-blue-400 placeholder-gray-400"
          style="background:#fefbff">
      </div>
    </div>`;
  
  return div;
}

function slotHTML(di, si, ini, fim, pfx) {
  return `<span id="${pfx}slot-${di}-${si}" class="flex items-center gap-1.5">
    <input type="time" id="${pfx}si-${di}-${si}" value="${ini}" class="border border-gray-200 rounded px-2 focus:outline-none focus:border-blue-400" style="width:88px;height:30px">
    <span class="text-xs text-gray-400 font-semibold">às</span>
    <input type="time" id="${pfx}sf-${di}-${si}" value="${fim}" class="border border-gray-200 rounded px-2 focus:outline-none focus:border-blue-400" style="width:88px;height:30px">
    ${si > 0 ? `<button onclick="removeSlot(${di},${si},'${pfx}')" type="button" class="text-gray-400 hover:text-red-500 text-base px-1 transition-colors">×</button>` : ''}
  </span>`;
}

function hhSlotHTML(di, si, ini, fim, pfx) {
  return `<span id="${pfx}hh-slot-${di}-${si}" class="flex items-center gap-1.5">
    <input type="time" id="${pfx}hsi-${di}-${si}" value="${ini}" class="border border-blue-200 rounded px-2 bg-white focus:outline-none focus:border-blue-400" style="width:88px;height:28px">
    <span class="text-xs text-gray-400 font-semibold">às</span>
    <input type="time" id="${pfx}hsf-${di}-${si}" value="${fim}" class="border border-blue-200 rounded px-2 bg-white focus:outline-none focus:border-blue-400" style="width:88px;height:28px">
    ${si > 0 ? `<button onclick="removeHHSlot(${di},${si},'${pfx}')" type="button" class="text-gray-400 hover:text-red-500 text-base px-1 transition-colors">×</button>` : ''}
  </span>`;
}

function addSlot(di, pfx) {
  const s = document.getElementById(pfx + 'slots-' + di);
  const btn = s.querySelector('button');
  const n = s.querySelectorAll('[id^="' + pfx + 'slot-' + di + '-"]').length;
  const tmp = document.createElement('div');
  tmp.innerHTML = slotHTML(di, n, '13:00', '18:00', pfx);
  s.insertBefore(tmp.firstChild, btn);
}

function removeSlot(di, si, pfx) {
  const e = document.getElementById(pfx + 'slot-' + di + '-' + si);
  if (e) e.remove();
}

function addHHSlot(di, pfx) {
  const s = document.getElementById(pfx + 'hh-slots-' + di);
  const btn = s.querySelector('button');
  const n = s.querySelectorAll('[id^="' + pfx + 'hh-slot-' + di + '-"]').length;
  const tmp = document.createElement('div');
  tmp.innerHTML = hhSlotHTML(di, n, '17:00', '19:00', pfx);
  s.insertBefore(tmp.firstChild, btn);
}

function removeHHSlot(di, si, pfx) {
  const e = document.getElementById(pfx + 'hh-slot-' + di + '-' + si);
  if (e) e.remove();
}

function toggleFechado(i, cb, pfx) {
  const row = document.querySelector('#' + pfx + 'sched-container .sched-row[data-idx="' + i + '"]');
  row.classList.toggle('closed', cb.checked);
  row.querySelectorAll('input[type=time]').forEach(x => x.disabled = cb.checked);
  
  const ab = document.getElementById(pfx + 'slots-' + i).querySelector('button[onclick^="addSlot"]');
  if (ab) ab.style.display = cb.checked ? 'none' : '';
  
  const hhr = document.getElementById(pfx + 'hh-row-' + i);
  if (hhr) {
    if (cb.checked) {
      hhr.style.opacity = '.4';
      hhr.style.pointerEvents = 'none';
    } else {
      hhr.style.opacity = '';
      hhr.style.pointerEvents = '';
    }
  }
}

function toggleHHDia(i, cb, pfx) {
  const s = document.getElementById(pfx + 'hh-slots-' + i);
  s.innerHTML = cb.checked
    ? hhSlotHTML(i, 0, '17:00', '19:00', pfx) + `<button onclick="addHHSlot(${i},'${pfx}')" type="button" class="text-xs border border-dashed border-blue-300 text-blue-500 rounded px-2 py-0.5 hover:bg-blue-50 transition-all">+ intervalo</button>`
    : '<span class="text-xs text-gray-400 italic">Sem HH neste dia</span>';
  const notaRow = document.getElementById(pfx + 'hh-nota-row-' + i);
  if (notaRow) notaRow.style.display = cb.checked ? '' : 'none';
  if (!cb.checked) {
    const notaEl = document.getElementById(pfx + 'hh-nota-' + i);
    if (notaEl) notaEl.value = '';
  }
  // Atualiza visibilidade do bloco global de descrição HH (admin modal)
  updateHHDescVis(pfx);
}

// Atualiza visibilidade do bloco "Descrição do Happy Hour" no modal admin
function updateHHDescVis(pfx) {
  if (pfx !== 'e-') return; // só existe no modal do admin
  const wrap = document.getElementById('hh-desc-wrap');
  if (!wrap) return;
  const container = document.getElementById('e-sched-container');
  if (!container) return;
  const anyHH = Array.from(container.querySelectorAll('.sched-row')).some(row => {
    const hhCb = row.querySelector('.hh-sub label input[type=checkbox]');
    return hhCb && hhCb.checked;
  });
  wrap.classList.toggle('hidden', !anyHH);
}

function collectSched(pfx) {
  return Array.from(document.querySelectorAll('#' + pfx + 'sched-container .sched-row')).map((row, i) => {
    const fechado = row.querySelector('.flex:first-child label input')?.checked || false;
    const hh = document.getElementById(pfx + 'hh-row-' + i)?.querySelector('label input')?.checked || false;
    
    const slots = Array.from(document.getElementById(pfx + 'slots-' + i)?.querySelectorAll('[id^="' + pfx + 'slot-' + i + '-"]') || []).map((_, si) => ({
      ini: (document.getElementById(pfx + 'si-' + i + '-' + si) || {}).value || '',
      fim: (document.getElementById(pfx + 'sf-' + i + '-' + si) || {}).value || ''
    }));
    
    const hh_slots = Array.from(document.getElementById(pfx + 'hh-slots-' + i)?.querySelectorAll('[id^="' + pfx + 'hh-slot-' + i + '-"]') || []).map((_, si) => ({
      ini: (document.getElementById(pfx + 'hsi-' + i + '-' + si) || {}).value || '',
      fim: (document.getElementById(pfx + 'hsf-' + i + '-' + si) || {}).value || ''
    }));
    
    const hh_nota = (document.getElementById(pfx + 'hh-nota-' + i) || {}).value || '';
    
    return { dia: DIAS[i], slots, fechado, hh, hh_slots, hh_nota };
  });
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: CLIENTES
// ═══════════════════════════════════════════════════════════════════

function renderClientes() {
  const db = load();
  const q = (document.getElementById('search-cli')?.value || '').toLowerCase();
  
  document.getElementById('cli-panel-lista').classList.remove('hidden');
  document.getElementById('cli-panel-perfil').classList.add('hidden');
  
  let list = db.clientes;
  if (q) list = list.filter(c => (c.nome || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.telefone || '').includes(q));
  
  const tbody = document.getElementById('cli-tbody');
  const empty = document.getElementById('cli-empty');
  
  if (!tbody) return;
  
  if (!list.length) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  
  empty?.classList.add('hidden');
  
  tbody.innerHTML = list.map(c => {
    const emp = db.empresas.find(e => e.negocio === c.negocio);
    const negocios = db.empresas.filter(e => e.usuario === c.usuario);
    const isToday = bdayMMDD(c.nasc) === mmdd(new Date());
    
    return `
      <tr class="hover:bg-gray-50 transition-all cursor-pointer group" onclick="abrirPerfil('${c.usuario}')">
        <td class="px-6 py-4">
          <div class="font-bold text-gray-800 flex items-center gap-2">
            ${c.nome}
            ${isToday ? '<span class="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-bold">🎂 Hoje</span>' : ''}
          </div>
          <div class="text-xs text-gray-400">${c.email || 'Sem e-mail'}</div>
        </td>
        <td class="px-6 py-4 mono text-gray-500 text-sm">${c.telefone || '—'}</td>
        <td class="px-6 py-4 text-gray-500 text-sm">${fmtDate(c.nasc)}</td>
        <td class="px-6 py-4 text-gray-500 text-sm">${emp ? emp.empresa : negocios.length ? negocios[0].empresa : '—'}</td>
        <td class="px-6 py-4 text-right">
          <button class="text-blue-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-all">Ver perfil →</button>
        </td>
      </tr>`;
  }).join('');
}

function abrirPerfil(id) {
  const db = load();
  const c = db.clientes.find(x => x.usuario === id);
  if (!c) return;
  
  document.getElementById('cli-panel-lista').classList.add('hidden');
  document.getElementById('cli-panel-perfil').classList.remove('hidden');
  
  document.getElementById('f-id').value = c.usuario;
  document.getElementById('id-master').textContent = c.master || c.usuario;
  document.getElementById('id-pessoal').textContent = c.usuario;
  document.getElementById('cli-breadcrumb-nome').textContent = c.nome || '';
  
  const negocios = db.empresas.filter(e => e.usuario === c.usuario);
  document.getElementById('id-neg-count').textContent = negocios.length ? negocios.length + ' negócio(s)' : 'Nenhum negócio';
  document.getElementById('id-neg-list').innerHTML = negocios.length
    ? negocios.map(e => `<div class="flex items-center gap-2 text-xs"><span class="mono text-gray-400">${e.negocio}</span><span class="text-gray-300 font-semibold">· ${e.empresa}</span></div>`).join('')
    : '<p class="text-gray-400 text-xs italic">Sem negócios vinculados.</p>';
  
  const isBloq = c.status === 'bloqueado';
  document.getElementById('stat-status').textContent = isBloq ? 'Bloqueado' : 'Ativo';
  document.getElementById('stat-status').className = 'text-xs font-bold uppercase ' + (isBloq ? 'text-red-600' : 'text-green-600');
  document.getElementById('btn-bloquear').textContent = isBloq ? 'Desbloquear' : 'Bloquear';
  document.getElementById('stat-negocios').textContent = negocios.length;
  
  const fields = {
    'f-nome':   c.nome   || '',
    'f-nasc':   c.nasc   || '',
    'f-tel':    c.telefone || '',
    'f-email':  c.email  || '',
    'f-cep':    c.cep    || '',
    'f-num':    c.num    || '',
    'f-rua':    c.rua    || '',
    'f-comp':   c.comp   || '',
    'f-bairro': c.bairro || '',
    'f-cidade': c.cidade || '',
    'f-uf':     c.uf     || ''
  };
  
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  
  const empSel = document.getElementById('f-emp');
  if (empSel) {
    empSel.innerHTML = '<option value="">— Selecionar —</option>';
    db.empresas.forEach(e => {
      empSel.innerHTML += `<option value="${e.negocio}"${e.negocio === c.negocio ? ' selected' : ''}>${e.empresa}</option>`;
    });
  }
  
  syncCard();
}

function novoCliente() {
  document.getElementById('cli-panel-lista').classList.add('hidden');
  document.getElementById('cli-panel-perfil').classList.remove('hidden');
  
  document.getElementById('f-id').value = '';
  document.getElementById('cli-breadcrumb-nome').textContent = 'Novo Cliente';
  document.getElementById('id-master').textContent = '(novo)';
  document.getElementById('id-pessoal').textContent = '(novo)';
  document.getElementById('id-neg-count').textContent = 'Nenhum negócio';
  document.getElementById('id-neg-list').innerHTML = '';
  document.getElementById('stat-negocios').textContent = '0';
  document.getElementById('stat-status').textContent = 'Ativo';
  document.getElementById('stat-status').className = 'text-xs font-bold text-green-600 uppercase';
  document.getElementById('btn-bloquear').textContent = 'Bloquear';
  
  ['f-nome', 'f-nasc', 'f-tel', 'f-email', 'f-cep', 'f-num', 'f-rua', 'f-comp', 'f-bairro', 'f-cidade'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-uf').value = '';
  
  const db = load();
  const empSel = document.getElementById('f-emp');
  if (empSel) {
    empSel.innerHTML = '<option value="">— Selecionar —</option>';
    db.empresas.forEach(e => {
      empSel.innerHTML += `<option value="${e.negocio}">${e.empresa}</option>`;
    });
  }
  
  syncCard();
}

function syncCard() {
  const nome = document.getElementById('f-nome')?.value || 'Novo Cliente';
  const nasc = document.getElementById('f-nasc')?.value;
  
  document.getElementById('card-nome').textContent = nome;
  document.getElementById('card-avatar').textContent = nome.charAt(0).toUpperCase();
  document.getElementById('card-nasc').textContent = nasc ? nasc.split('-').reverse().join('/') : '--/--/----';
  
  const bdayEl = document.getElementById('card-bday-status');
  if (bdayEl) {
    if (nasc) {
      const days = daysUntilBday(nasc);
      bdayEl.textContent = days === 0 ? 'É HOJE!' : 'Faltam ' + days + ' dias';
    } else {
      bdayEl.textContent = 'Data não informada';
    }
  }
}

function fecharPerfil() {
  document.getElementById('cli-panel-lista').classList.remove('hidden');
  document.getElementById('cli-panel-perfil').classList.add('hidden');
}

function salvarClienteInline() {
  const nome = document.getElementById('f-nome')?.value.trim();
  const nasc = document.getElementById('f-nasc')?.value;
  
  if (!nome) {
    toast('Nome é obrigatório.', 'err');
    return;
  }
  if (!nasc) {
    toast('Data de nascimento é obrigatória.', 'err');
    return;
  }
  
  const db = load();
  const id = document.getElementById('f-id')?.value;
  
  if (!id) {
    // Novo cliente criado pelo admin: master novo, usuario novo, vinculado ao negócio selecionado
    const negocioSel = document.getElementById('f-emp')?.value || null;
    const negocioEmp = negocioSel ? db.empresas.find(e => e.negocio === negocioSel) : null;
    const masterRef  = negocioEmp ? negocioEmp.master : gid('M');

    const novo = {
      usuario:   gid('U'),
      master:    masterRef,
      negocio:   negocioSel || null,
      sugestao:  null,
      perfil_id: gid('P'),
      nome,
      nasc,
      email:    document.getElementById('f-email')?.value.trim() || '',
      telefone: document.getElementById('f-tel')?.value.trim() || '',
      rua:    document.getElementById('f-rua')?.value.trim() || '',
      num:    document.getElementById('f-num')?.value.trim() || '',
      comp:   document.getElementById('f-comp')?.value.trim() || '',
      bairro: document.getElementById('f-bairro')?.value.trim() || '',
      cep:    document.getElementById('f-cep')?.value.trim() || '',
      cidade: document.getElementById('f-cidade')?.value.trim() || '',
      uf:     document.getElementById('f-uf')?.value || '',
      oferta_enviada: false,
      criado_em: new Date().toISOString(),
      status: 'ativo'
    };
    
    db.clientes.unshift(novo);
    save(db);
    toast('Cliente cadastrado!');
    fecharPerfil();
    renderClientes();
    return;
  }
  
  const idx = db.clientes.findIndex(c => c.usuario === id);
  if (idx === -1) return;
  
  db.clientes[idx].nome     = nome;
  db.clientes[idx].nasc     = nasc;
  db.clientes[idx].email    = document.getElementById('f-email')?.value.trim() || '';
  db.clientes[idx].telefone = document.getElementById('f-tel')?.value.trim() || '';
  db.clientes[idx].negocio  = document.getElementById('f-emp')?.value || null;
  db.clientes[idx].rua    = document.getElementById('f-rua')?.value.trim() || '';
  db.clientes[idx].num    = document.getElementById('f-num')?.value.trim() || '';
  db.clientes[idx].comp   = document.getElementById('f-comp')?.value.trim() || '';
  db.clientes[idx].bairro = document.getElementById('f-bairro')?.value.trim() || '';
  db.clientes[idx].cep    = document.getElementById('f-cep')?.value.trim() || '';
  db.clientes[idx].cidade = document.getElementById('f-cidade')?.value.trim() || '';
  db.clientes[idx].uf     = document.getElementById('f-uf')?.value || '';
  
  save(db);
  abrirPerfil(id);
  toast('Alterações salvas!');
}

function toggleBloqueio() {
  const id = document.getElementById('f-id')?.value;
  if (!id) return;
  
  const db = load();
  const idx = db.clientes.findIndex(c => c.usuario === id);
  if (idx === -1) return;
  
  db.clientes[idx].status = db.clientes[idx].status === 'bloqueado' ? 'ativo' : 'bloqueado';
  save(db);
  abrirPerfil(id);
  toast('Status da conta alterado.');
}

function confirmarExclusao() {
  const id = document.getElementById('f-id')?.value;
  if (!id) return;
  
  const db = load();
  const c = db.clientes.find(x => x.usuario === id);
  
  confirmarAcao('Deletar conta', 'Isso removerá permanentemente a conta de "' + (c?.nome || 'cliente') + '" e seus dados. Esta ação não pode ser desfeita.', () => {
    const db2 = load();
    db2.clientes = db2.clientes.filter(x => x.usuario !== id);
    db2.empresas.forEach(e => {
      if (e.usuario === id) {
        e.usuario = '';
        e.status_perfil = 'comunidade';
      }
    });
    save(db2);
    fecharPerfil();
    renderClientes();
    renderDashboard();
    toast('Cliente removido.', 'err');
  });
}

function excluirCliente(id) {
  const db = load();
  db.clientes = db.clientes.filter(c => c.usuario !== id);
  save(db);
  renderClientes();
  renderDashboard();
  toast('Cliente removido.');
}

function toggleEnviado(id, val) {
  const db = load();
  const c = db.clientes.find(x => x.usuario === id);
  if (!c) return;
  c.oferta_enviada = val;
  c.enviado_em = val ? new Date().toISOString() : null;
  save(db);
  renderAniversarios();
  renderDashboard();
  renderClientes();
  toast(val ? 'Oferta marcada como enviada!' : 'Status revertido.');
}
function marcarEnviado(id)    { toggleEnviado(id, true);  }
function desmarcarEnviado(id) { toggleEnviado(id, false); }

function copiarId(elId) {
  const val = document.getElementById(elId)?.textContent?.trim();
  if (!val) return;
  
  navigator.clipboard.writeText(val).then(() => toast('ID copiado!')).catch(() => {
    const el = document.createElement('textarea');
    el.value = val;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    toast('ID copiado!');
  });
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: ANIVERSÁRIOS
// ═══════════════════════════════════════════════════════════════════

function renderAniversarios() {
  const db = load();
  const filter = document.getElementById('filter-bday')?.value || 'today';
  const today = mmdd(new Date());
  
  let list = db.clientes.filter(c => c.nasc);
  
  if (filter === 'today') list = list.filter(c => bdayMMDD(c.nasc) === today);
  else if (filter === 'week') list = list.filter(c => bdayThisWeek(c.nasc));
  else if (filter === 'month') {
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    list = list.filter(c => c.nasc && c.nasc.split('-')[1] === m);
  }
  
  list.sort((a, b) => bdayMMDD(a.nasc).localeCompare(bdayMMDD(b.nasc)));
  
  const tbody = document.getElementById('bday-tbody');
  const empty = document.getElementById('bday-empty');
  
  if (!tbody) return;
  
  if (!list.length) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  
  empty?.classList.add('hidden');
  
  tbody.innerHTML = list.map(c => {
    const emp = db.empresas.find(e => e.negocio === c.negocio);
    const isToday = bdayMMDD(c.nasc) === today;
    
    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">
          <div class="font-semibold">${c.nome}</div>
          <div class="mono text-xs text-gray-400">${c.telefone || c.email || '—'}</div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2 mono text-sm">
            ${fmtDate(c.nasc)}
            ${isToday ? '<span class="badge-aprovado">Hoje!</span>' : ''}
          </div>
        </td>
        <td class="px-4 py-3 text-sm">${emp ? emp.empresa : '<span class="text-gray-400">—</span>'}</td>
        <td class="px-4 py-3 max-w-[180px]">
          ${emp ? `<div class="text-sm font-medium">${emp.oferta_destaque}</div><div class="text-xs text-gray-400">${emp.oferta_tipo}</div>` : '<span class="text-gray-400">—</span>'}
        </td>
        <td class="px-4 py-3">
          ${c.oferta_enviada ? '<span class="badge-aprovado">✓ Enviado</span>' : '<span class="badge-pendente">Pendente</span>'}
        </td>
        <td class="px-4 py-3 text-right">
          ${!c.oferta_enviada
            ? `<button onclick="marcarEnviado('${c.usuario}')" class="text-xs font-semibold bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700">✓ Marcar</button>`
            : `<button onclick="desmarcarEnviado('${c.usuario}')" class="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">↩ Desfazer</button>`}
        </td>
      </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: SUGESTÕES E SOLICITAÇÕES
// ═══════════════════════════════════════════════════════════════════

function renderSugestoes() {
  const db = load();
  let list = (db.empresas || []).filter(e => e.is_sugestao);
  
  if (sugestaoFiltro) list = list.filter(s => s.status === sugestaoFiltro);
  
  const container = document.getElementById('sugestoes-list');
  const empty = document.getElementById('sugestoes-empty');
  
  if (!container) return;
  
  if (!list.length) {
    container.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  
  empty?.classList.add('hidden');
  
  const statusBadge = {
    '01': '<span class="badge-pendente">⏳ Pendente</span>',
    '02': '<span class="badge-aprovado">✓ Aprovado</span>',
    '03': '<span class="badge-recusado">✕ Recusado</span>',
  };
  
  container.innerHTML = list.map(s => {
    const autor = (db.clientes || []).find(c => c.usuario === s.usuario);
    const addrLine = s.rua ? [s.rua + (s.num ? ', ' + s.num : ''), s.bairro, s.cidade + (s.uf ? ' - ' + s.uf : '')].filter(Boolean).join(' | ') : s.endereco;
    
    return `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
        <div class="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-xl">🏢</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="font-bold text-sm">${s.empresa || s.nome || ''}</span>
            <span class="badge-comunidade">💡 Indicação</span>
            ${statusBadge[s.status] || ''}
          </div>
          ${addrLine ? `<p class="text-xs text-gray-400 mb-1">📍 ${addrLine}</p>` : ''}
          ${s.oferta_destaque ? `<p class="text-sm text-blue-600 font-medium">🎁 ${s.oferta_destaque}</p>` : ''}
          <p class="text-xs text-gray-300 mt-2">${fmtDatetime(s.criado_em)}</p>
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          ${s.status === '01' ? `
            <button onclick="aprovarSugestaoRapido('${s.negocio}')" class="text-xs font-bold bg-green-600 hover:bg-green-700 text-white border border-green-700 rounded-lg px-3 py-1.5">✓ Aprovar</button>
            <button onclick="recusarSugestaoRapido('${s.negocio}')" class="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100">✕ Recusar</button>
          ` : ''}
          <button onclick="openSugestaoModal('${s.negocio}')" class="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">✏️ Editar</button>
          <button onclick="confirmar('sugestao','${s.negocio}')" class="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-100">🗑</button>
        </div>
      </div>`;
  }).join('');
}

function _filterTab(btnSel, renderFn, status, btn) {
  document.querySelectorAll(btnSel).forEach(b => b.classList.remove('ring-2', 'ring-offset-1', 'ring-blue-500'));
  if (btn) btn.classList.add('ring-2', 'ring-offset-1', 'ring-blue-500');
  renderFn();
}
function filterSugestoes(status, btn)    { sugestaoFiltro = status; _filterTab('.sug-filter-btn', renderSugestoes,    status, btn); }
function filterSolicitacoes(status, btn) { solFiltro      = status; _filterTab('.sol-filter-btn', renderSolicitacoes, status, btn); }

function renderSolicitacoes() {
  const db = load();
  // Solicitações de dono = empresas cadastradas pelo próprio usuário (com usuario preenchido)
  let list = (db.empresas || []).filter(e => e.usuario);
  
  if (solFiltro) list = list.filter(e => e.status === solFiltro);
  
  const container = document.getElementById('solicitacoes-list');
  const empty = document.getElementById('solicitacoes-empty');
  
  if (!container) return;
  
  if (!list.length) {
    container.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  
  empty?.classList.add('hidden');
  
  const statusBadge = {
    '01': '<span class="badge-pendente">⏳ Pendente</span>',
    '02': '<span class="badge-aprovado">✓ Aprovado</span>',
    '03': '<span class="badge-recusado">✕ Recusado</span>',
  };
  
  container.innerHTML = list.map(s => {
    const autor = (db.clientes || []).find(c => c.usuario === s.usuario);
    const addrLine = s.rua ? [s.rua + (s.num ? ', ' + s.num : ''), s.bairro, s.cidade + (s.uf ? ' - ' + s.uf : '')].filter(Boolean).join(' | ') : '';
    
    return `
      <div class="bg-white rounded-2xl border border-purple-200 shadow-sm p-5 flex items-start gap-4" style="background:linear-gradient(135deg,#faf7ff,#fff)">
        <div class="w-11 h-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-2xl">👑</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="font-bold text-sm">${s.empresa || ''}</span>
            <span class="badge-verificado">👑 Solicitação de Dono</span>
            ${statusBadge[s.status] || ''}
          </div>
          ${addrLine ? `<p class="text-xs text-gray-400 mb-1">📍 ${addrLine}</p>` : ''}
          ${s.oferta_destaque ? `<p class="text-sm text-blue-600 font-medium">🎁 ${s.oferta_destaque}</p>` : ''}
          ${autor ? `
            <div class="mt-3 pt-3 border-t border-purple-100 flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-sm font-bold">${autor.nome.charAt(0).toUpperCase()}</div>
              <div class="min-w-0">
                <p class="font-bold text-sm">${autor.nome}</p>
                <p class="text-xs text-gray-400">${[autor.telefone, autor.email].filter(Boolean).join(' · ') || 'Sem contato'}</p>
              </div>
            </div>
          ` : ''}
          <p class="text-xs text-gray-300 mt-2">${fmtDatetime(s.criado_em)}</p>
        </div>
        ${s.status === '01' ? `
          <div class="flex flex-col gap-2 shrink-0">
            <button onclick="aprovarEmpresaPendente('${s.negocio}')" class="text-xs font-bold bg-green-600 hover:bg-green-700 text-white border border-green-700 rounded-lg px-3 py-1.5">✓ Aprovar</button>
            <button onclick="recusarEmpresaPendente('${s.negocio}')" class="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100">✕ Recusar</button>
            <button onclick="openEmpModal('${s.negocio}')" class="text-xs font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5">✏️ Editar</button>
          </div>
        ` : `
          <div class="flex flex-col gap-2 shrink-0">
            <button onclick="openEmpModal('${s.negocio}')" class="text-xs font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5">✏️ Ver / Editar</button>
            <button onclick="confirmar('empresa','${s.negocio}')" class="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-100">🗑</button>
          </div>
        `}
      </div>`;
  }).join('');
}

function openSugestaoModal(id) {
  // Reset
  ['sug-nome', 'sug-tel', 'sug-segmento', 'sug-email', 'sug-ig', 'sug-site', 'sug-cardapio', 'sug-rua', 'sug-num', 'sug-bairro', 'sug-cep', 'sug-cidade', 'sug-obs', 'sug-oferta-desc', 'sug-oferta-regras'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });
  
  document.getElementById('sug-id').value = '';
  document.getElementById('sug-status').value = '01';
  document.getElementById('sug-aprovado-action')?.classList.add('hidden');
  document.getElementById('sug-criar-empresa').checked = true;
  document.getElementById('sug-is-dono').checked = false;
  document.getElementById('sug-modal-title').textContent = 'Nova Sugestão de Empresa';
  document.getElementById('sug-modal-origem')?.classList.add('hidden');
  document.getElementById('sug-autor-wrap')?.classList.add('hidden');
  buildSched(null, 'sug-');
  
  if (id) {
    const db = load();
    const sug = (db.empresas || []).find(e => e.negocio === id);
    if (!sug) return;
    
    document.getElementById('sug-id').value = sug.negocio;
    document.getElementById('sug-nome').value = sug.empresa || '';
    document.getElementById('sug-tel').value = sug.telefone || '';
    document.getElementById('sug-segmento').value = sug.segmento || '';
    document.getElementById('sug-email').value = sug.email || '';
    document.getElementById('sug-ig').value = sug.ig || '';
    document.getElementById('sug-site').value = sug.site || '';
    document.getElementById('sug-cardapio').value = sug.cardapio || '';
    document.getElementById('sug-rua').value = sug.rua || '';
    document.getElementById('sug-num').value = sug.num || '';
    document.getElementById('sug-bairro').value = sug.bairro || '';
    document.getElementById('sug-cep').value = sug.cep || '';
    document.getElementById('sug-cidade').value = sug.cidade || '';
    document.getElementById('sug-obs').value = sug.obs || '';
    document.getElementById('sug-status').value = sug.status || '01';
    
    document.getElementById('sug-oferta-desc').value = sug.oferta_destaque || '';
    document.getElementById('sug-oferta-regras').value = sug.oferta_regras || '';
    
    if (sug.usuario) {
      const autor = (db.clientes || []).find(c => c.usuario === sug.usuario);
      if (autor) {
        document.getElementById('sug-autor-wrap')?.classList.remove('hidden');
        document.getElementById('sug-autor-avatar').textContent = autor.nome.charAt(0).toUpperCase();
        document.getElementById('sug-autor-nome').textContent = autor.nome || '';
        document.getElementById('sug-autor-contato').textContent = [autor.telefone, autor.email].filter(Boolean).join(' · ') || 'Sem contato';
        document.getElementById('sug-autor-master-id').textContent = autor.master || autor.usuario;
      }
    }
    
    document.getElementById('sug-modal-title').textContent = 'Analisar Indicação';
    document.getElementById('sug-modal-origem').textContent = '💡 Indicação de comunidade';
    document.getElementById('sug-modal-origem')?.classList.remove('hidden');
    
    // Carrega horários no step 3
    buildSched(sug.horarios || null, 'sug-');
    const hhDescEl = document.getElementById('sug-hh-desc');
    if (hhDescEl) hhDescEl.value = sug.hh_desc || '';
    
    toggleSugStatus();
  }
  
  _sgCurrentStep = 1;
  document.querySelectorAll('#modal-sug .n-step').forEach(s => s.classList.remove('active'));
  document.getElementById('sg-step-1')?.classList.add('active');
  document.getElementById('sg-prev-btn')?.classList.add('hidden');
  document.getElementById('sg-next-btn').textContent = 'Próximo →';
  document.getElementById('sg-step-label').textContent = 'Etapa 1 de 5';
  
  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById('sg-dot-' + i);
    if (dot) dot.style.background = i === 1 ? '#3b5bdb' : '#e2e8f0';
  }
  
  openModal('modal-sug');
}

function toggleSugStatus() {
  const s = document.getElementById('sug-status')?.value;
  const isDono = document.getElementById('sug-is-dono')?.checked;
  const wrap = document.getElementById('sug-aprovado-action');
  
  if (!wrap) return;
  
  wrap.classList.toggle('hidden', s !== '02');
  
  if (s === '02') {
    wrap.className = isDono 
      ? 'rounded-xl p-4 border bg-purple-50 border-purple-200'
      : 'rounded-xl p-4 border bg-teal-50 border-teal-200';
    document.getElementById('sug-aprovado-msg').textContent = isDono 
      ? '🛡️ Ao aprovar, a empresa será ativada e vinculada ao ID Master do solicitante.'
      : '🤝 Ao aprovar, a empresa será adicionada como perfil da Comunidade.';
    document.getElementById('sug-criar-empresa-label').textContent = isDono 
      ? 'Sim, ativar perfil e vincular ao dono'
      : 'Sim, adicionar à comunidade';
  }
}

function sgStep(n) {
  if (n === 1 && _sgCurrentStep === 1) {
    const nome = document.getElementById('sug-nome')?.value.trim();
    if (!nome) { toast('O nome da empresa é obrigatório.', 'err'); return; }
  }
  _sgCurrentStep = _wizStep('sg', _sgCurrentStep, 5, salvarSugestao, 'modal-sug', n);
}

function salvarSugestao() {
  const nome = document.getElementById('sug-nome')?.value.trim();
  const oferta_desc = document.getElementById('sug-oferta-desc')?.value.trim();
  
  if (!nome) {
    toast('O nome do local é obrigatório.', 'err');
    return;
  }
  if (!oferta_desc) {
    toast('Descreva a oferta de aniversário.', 'err');
    return;
  }
  
  
  const db = load();
  
  
  const editId = document.getElementById('sug-id')?.value;
  const sugOriginal = editId ? (db.empresas.find(e => e.negocio === editId) || {}) : {};
  
  const getVal = (id, fallback = '') => (document.getElementById(id)?.value.trim() || fallback);
  
  const sug = {
    negocio:      editId || gid('N'),
    master:       sugOriginal.master || gid('M'),  // mantém master existente ou gera novo
    usuario:      sugOriginal.usuario || '',        // sugestão não tem dono
    is_sugestao:  true,
    indicado_por: sugOriginal.indicado_por || '',
    empresa:      nome,
    segmento:     getVal('sug-segmento'),
    telefone:     getVal('sug-tel'),
    email:        getVal('sug-email'),
    ig:           getVal('sug-ig'),
    site:         getVal('sug-site'),
    cardapio:     getVal('sug-cardapio'),
    rua:          getVal('sug-rua'),
    num:          getVal('sug-num'),
    comp:         sugOriginal.comp || '',
    bairro:       getVal('sug-bairro'),
    cep:          getVal('sug-cep'),
    cidade:       getVal('sug-cidade'),
    uf:           getVal('sug-uf') || sugOriginal.uf || '',
    horarios:     collectSched('sug-'),
    hh_desc:      document.getElementById('sug-hh-desc')?.value.trim() || '',
    oferta_tipo:     getVal('sug-oferta-tipo', 'Produto/Brinde Grátis') || sugOriginal.oferta_tipo || '',
    oferta_valida:   getVal('sug-oferta-val', 'No dia do aniversário') || sugOriginal.oferta_valida || '',
    oferta_destaque: oferta_desc,
    oferta_regras:   getVal('sug-oferta-regras'),
    obs:          getVal('sug-obs'),
    status:       document.getElementById('sug-status')?.value || '01',
    status_perfil: 'comunidade',
    criado_em:    sugOriginal.criado_em || new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
  
  if (editId) {
    const i = db.empresas.findIndex(e => e.negocio === editId);
    if (i !== -1) db.empresas[i] = sug;
  } else {
    db.empresas.unshift(sug);
  }
  
  // Sugestão aprovada permanece em empresas (is_sugestao=1, status='02')
  // O admin pode vincular a um usuário depois via /api/empresas/:id/vincular
  
  save(db);
  closeModal('modal-sug');
  toast(editId ? 'Sugestão atualizada!' : 'Sugestão registrada!');

  // Sincroniza com o banco e re-renderiza
  if (window._dbBridgePull) {
    window._dbBridgePull().then(() => { renderSugestoes(); updateSugestoesBadge(); });
  } else {
    renderSugestoes();
    updateSugestoesBadge();
  }
}

// Aprovação rápida de sugestão — muda status para '02' (permanece em empresas)
// Recusa rápida de sugestão
function recusarSugestaoRapido(id) {
  const db = load();
  const sug = (db.empresas || []).find(e => e.negocio === id);
  if (!sug) return;
  sug.status = '03';
  sug.atualizado_em = new Date().toISOString();
  save(db);
  renderSugestoes();
  updateSugestoesBadge();
  toast('Sugestão recusada.');
}

function excluirSugestao(id) {
  const db = load();
  db.empresas = (db.empresas || []).filter(e => e.negocio !== id);
  save(db);

  fetch('/api/empresas/' + id, { method: 'DELETE' }).catch(() => {});

  renderSugestoes();
  updateSugestoesBadge();
  toast('Removido.');
}

function aprovarSolicitacao(id) {
  const db = load();
  const index = (db.empresas || []).findIndex(e => e.negocio === id);
  if (index === -1) return;

  const emp = db.empresas[index];
  emp.status        = '02';
  emp.is_sugestao   = false;  // <- FIX: Move de indicação para empresa real
  emp.status_perfil = 'verificado';
  emp.aprovado_em   = new Date().toISOString();
  emp.atualizado_em = new Date().toISOString();
  
  save(db);
  toast('Aprovado! Movendo para lista oficial... 🤝');

  // Sincroniza com o servidor imediatamente
  fetch('/api/empresas', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emp) 
  })
    .catch(err => console.error('Erro ao sincronizar aprovação:', err))
    .finally(() => {
      const done = () => {
        renderSugestoes();
        updateSugestoesBadge();
      };
      if (window._dbBridgePull) window._dbBridgePull().then(done);
      else done();
    });
}

function recusarSolicitacao(id) {
  const db = load();
  const i = (db.empresas || []).findIndex(e => e.negocio === id);
  if (i !== -1) {
    db.empresas[i].status = '03';
    save(db);
    renderSolicitacoes();
    updateSugestoesBadge();
    toast('Solicitação recusada.');
  }
}

// Aprovar empresa pendente (dono cadastrou negócio → status 01→02)
function aprovarEmpresaPendente(negocioId) {
  const db = load();
  const emp = db.empresas.find(e => e.negocio === negocioId);
  if (!emp) return;
  
  emp.status        = '02';
  emp.status_perfil = 'verificado';
  emp.aprovado_em   = new Date().toISOString();
  
  save(db);
  // Sincroniza com o servidor
  fetch('/api/empresas', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emp) 
  }).catch(() => {});

  renderSolicitacoes();
  updateSugestoesBadge();
  toast('Empresa aprovada! Perfil verificado.');
}

// Recusar empresa pendente (status 01→03)
function recusarEmpresaPendente(negocioId) {
  const db = load();
  const emp = db.empresas.find(e => e.negocio === negocioId);
  if (!emp) return;
  emp.status        = '03';
  emp.atualizado_em = new Date().toISOString();
  save(db);
  
  fetch('/api/empresas', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emp) 
  }).catch(() => {});

  renderSolicitacoes();
  updateSugestoesBadge();
  toast('Empresa recusada.');
}

// Aprovar sugestão com 1 clique (sem abrir modal)
function aprovarSugestaoRapido(id) {
  aprovarSolicitacao(id);
}

// Recusar sugestão com 1 clique
function recusarSugestaoRapido(id) {
  const db = load();
  const i = (db.empresas || []).findIndex(e => e.negocio === id);
  if (i !== -1) {
    db.empresas[i].status        = '03';
    db.empresas[i].atualizado_em = new Date().toISOString();
    save(db);
    renderSugestoes();
    updateSugestoesBadge();
    toast('Sugestão recusada.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONFIRMAÇÃO
// ═══════════════════════════════════════════════════════════════════

function confirmar(tipo, id) {
  const msgs = {
    empresa: 'Remover esta empresa? Clientes vinculados perderão a associação.',
    cliente: 'Remover este cliente?',
    sugestao: 'Remover esta sugestão?',
    usuario: 'Remover este usuário?'
  };
  
  confirmarAcao('Confirmar exclusão', msgs[tipo] || 'Confirmar?', () => {
    switch(tipo) {
      case 'empresa': excluirEmpresa(id); break;
      case 'cliente': excluirCliente(id); break;
      case 'sugestao': excluirSugestao(id); break;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════

function exportarJSON() {
  const db = load();
  const blob = new Blob([JSON.stringify({ ...db, exportado_em: new Date().toISOString(), versao: '2.0' }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'anivcrm-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup exportado!');
}

function importarJSON(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.empresas || !d.clientes) {
        toast('Arquivo inválido.', 'err');
        return;
      }
      save({ empresas: d.empresas || [], clientes: d.clientes || [] });
      
      document.getElementById('import-ok')?.classList.remove('hidden');
      setTimeout(() => document.getElementById('import-ok')?.classList.add('hidden'), 3000);
      
      renderEmpresas();
      renderClientes();
      renderDashboard();
      toast(`Importado: ${d.empresas.length} empresas, ${d.clientes.length} clientes.`);
    } catch {
      toast('Erro ao ler arquivo.', 'err');
    }
  };
  r.readAsText(f);
  ev.target.value = '';
}

function verificarBanco() {
  const db = load();
  const empresas = db.empresas || [];
  const clientes = db.clientes || [];
  const problemas = [];
  
  const empIds = new Set(empresas.map(e => e.negocio));
  const cliIds = new Set(clientes.map(c => c.usuario));
  
  empresas.forEach(e => {
    if (!e.empresa || !e.empresa.trim()) {
      problemas.push({ tipo: 'erro', msg: 'Empresa ID <code>' + e.negocio + '</code> está sem nome.' });
    }
    if (e.usuario && !cliIds.has(e.usuario)) {
      problemas.push({ tipo: 'erro', msg: 'Empresa <strong>' + e.empresa + '</strong> tem usuario inválido.' });
    }
    if (e.status_perfil === 'verificado' && !e.usuario) {
      problemas.push({ tipo: 'aviso', msg: 'Empresa <strong>' + e.empresa + '</strong> está como Verificado mas sem dono.' });
    }
    if (!e.oferta_destaque || !e.oferta_destaque.trim()) {
      problemas.push({ tipo: 'aviso', msg: 'Empresa <strong>' + (e.empresa || e.negocio) + '</strong> não tem oferta.' });
    }
  });
  
  clientes.forEach(c => {
    if (c.negocio && !empIds.has(c.negocio)) {
      problemas.push({ tipo: 'erro', msg: 'Cliente <strong>' + (c.nome || c.usuario) + '</strong> tem negocio inválido.' });
    }
    if (!c.nome || !c.nome.trim()) {
      problemas.push({ tipo: 'erro', msg: 'Cliente ID <code>' + c.usuario + '</code> está sem nome.' });
    }
    if (!c.nasc) {
      problemas.push({ tipo: 'aviso', msg: 'Cliente <strong>' + (c.nome || c.usuario) + '</strong> não tem data de nascimento.' });
    }
  });
  
  const erros = problemas.filter(p => p.tipo === 'erro');
  const avisos = problemas.filter(p => p.tipo === 'aviso');
  const el = document.getElementById('checker-result');
  
  if (!el) return;
  
  if (!problemas.length) {
    el.innerHTML = `
      <div class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <span class="text-2xl">✅</span>
        <div>
          <p class="font-bold text-green-700 text-sm">Banco de dados íntegro!</p>
          <p class="text-xs text-green-600 mt-0.5">${empresas.length} empresas e ${clientes.length} clientes verificados.</p>
        </div>
      </div>`;
    return;
  }
  
  let html = `<div class="space-y-2">
    <div class="flex gap-3 text-sm font-semibold mb-3">
      <span class="text-red-600">${erros.length} erro${erros.length !== 1 ? 's' : ''}</span>
      <span class="text-gray-400">·</span>
      <span class="text-yellow-600">${avisos.length} aviso${avisos.length !== 1 ? 's' : ''}</span>
    </div>`;
  
  erros.forEach(p => {
    html += `<div class="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
      <span class="text-red-500 mt-0.5 shrink-0">✕</span>
      <p class="text-xs text-red-700">${p.msg}</p>
    </div>`;
  });
  
  avisos.forEach(p => {
    html += `<div class="flex items-start gap-2.5 bg-yellow-50 border border-yellow-200 rounded-lg px-3.5 py-2.5">
      <span class="text-yellow-500 mt-0.5 shrink-0">⚠</span>
      <p class="text-xs text-yellow-700">${p.msg}</p>
    </div>`;
  });
  
  html += '</div>';
  el.innerHTML = html;
}

function limparTudo() {
  confirmarAcao('Limpar todos os dados', 'Todos os clientes e empresas serão removidos. Esta ação não pode ser desfeita.', () => {
    save({ empresas: [], clientes: [] });
    renderEmpresas();
    renderClientes();
    renderDashboard();
    toast('Dados removidos.');
  });
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: PERFIL DO ADMINISTRADOR
// ═══════════════════════════════════════════════════════════════════

function loadAdminProfile() {
  try {
    _adminProfile = JSON.parse(localStorage.getItem('anivcrm_admin_profile') || 'null');
  } catch {
    _adminProfile = null;
  }
  
  if (!_adminProfile) {
    _adminProfile = {
      usuario:   gid('U'),
      master:    gid('M'),
      negocio:   null,
      nome: 'Administrador',
      nasc: '',
      email: '',
      telefone: '',
      cidade: '',
      bairro: '',
      uf: ''
    };
    localStorage.setItem('anivcrm_admin_profile', JSON.stringify(_adminProfile));
  }
  
  // Preenche campos
  document.getElementById('admin-f-nome').value = _adminProfile.nome || '';
  document.getElementById('admin-f-nasc').value = _adminProfile.nasc ? formatDateToInput(_adminProfile.nasc) : '';
  document.getElementById('admin-f-tel').value = _adminProfile.telefone || '';
  document.getElementById('admin-f-email').value = _adminProfile.email || '';
  document.getElementById('admin-f-cep').value = _adminProfile.cep || '';
  document.getElementById('admin-f-rua').value = _adminProfile.rua || '';
  document.getElementById('admin-f-num').value = _adminProfile.num || '';
  document.getElementById('admin-f-comp').value = _adminProfile.comp || '';
  document.getElementById('admin-f-bairro').value = _adminProfile.bairro || '';
  document.getElementById('admin-f-cidade').value = _adminProfile.cidade || '';
  document.getElementById('admin-f-uf').value = _adminProfile.uf || '';
  
  // IDs
  document.getElementById('admin-id-master').textContent = _adminProfile.master;
  document.getElementById('admin-id-pessoal').textContent = _adminProfile.usuario;
  document.getElementById('admin-nome-pessoal').textContent = _adminProfile.nome || '';
  
  // Negócios vinculados
  const db = load();
  const negocios = db.empresas.filter(e => e.usuario === _adminProfile.usuario);
  const negEl = document.getElementById('admin-ids-negocio');
  if (negEl) {
    negEl.innerHTML = negocios.length
      ? negocios.map(e => `
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-[10px] font-bold mono border border-purple-500/20">ID_NEGÓCIO</span>
              <span class="mono text-slate-300 text-xs">${e.negocio}</span>
              <span class="text-xs font-medium text-slate-400 truncate">· ${e.empresa}</span>
            </div>
            <button onclick="copiarId('${e.negocio}')" class="text-slate-500 hover:text-white text-xs">📋</button>
          </div>
        `).join('')
      : '<p class="text-xs text-slate-500 italic">Nenhum ID Negócio ainda.</p>';
  }
  
  syncAdminCard();
}

function syncAdminCard() {
  if (!_adminProfile) return;
  
  const nome = document.getElementById('admin-f-nome')?.value || _adminProfile.nome || 'Administrador';
  const nascInput = document.getElementById('admin-f-nasc')?.value;
  const tel = document.getElementById('admin-f-tel')?.value || '';
  const email = document.getElementById('admin-f-email')?.value || '';
  
  document.getElementById('admin-card-avatar').textContent = nome.charAt(0).toUpperCase();
  document.getElementById('admin-card-nome').textContent = nome;
  document.getElementById('admin-card-nasc-label').textContent = nascInput ? '🗓️ ' + nascInput : '—';
  
  // Countdown
  const bdayEl = document.getElementById('admin-card-bday-days');
  if (bdayEl && nascInput) {
    const nascDB = parseDateToDB(nascInput);
    const days = daysUntilBday(nascDB);
    if (days === 0) {
      bdayEl.textContent = '🎉 É HOJE!';
    } else if (days > 0) {
      bdayEl.textContent = 'Faltam ' + days + ' dias';
    } else {
      bdayEl.textContent = '—';
    }
  } else if (bdayEl) {
    bdayEl.textContent = 'Configure sua data';
  }
  
  // Telefone
  const telRow = document.getElementById('admin-card-tel-row');
  if (telRow) {
    if (tel) {
      telRow.classList.remove('hidden');
      telRow.style.display = 'flex';
      document.getElementById('admin-card-tel-val').textContent = tel;
    } else {
      telRow.classList.add('hidden');
    }
  }
  
  // Email
  const emailRow = document.getElementById('admin-card-email-row');
  if (emailRow) {
    if (email) {
      emailRow.classList.remove('hidden');
      emailRow.style.display = 'flex';
      document.getElementById('admin-card-email-val').textContent = email;
    } else {
      emailRow.classList.add('hidden');
    }
  }
  
  // Estatísticas
  const db = load();
  document.getElementById('admin-card-stat-indicacoes').textContent = (db.empresas || []).filter(e => e.is_sugestao && e.indicado_por === _adminProfile.usuario).length;
  document.getElementById('admin-card-stat-negocios').textContent = db.empresas.filter(e => e.usuario === _adminProfile.usuario).length;
}

function adminPStep(n) {
  if (n === 1 && _adminPStep === 1) {
    const nome = document.getElementById('admin-f-nome')?.value.trim();
    const nasc = document.getElementById('admin-f-nasc')?.value.trim();
    if (!nome) { toast('Preencha o nome.', 'err'); return; }
    if (!nasc || nasc.length < 10) { toast('Preencha a data de nascimento.', 'err'); return; }
  }
  _adminPStep = _wizStep('admin-p', _adminPStep, 2, salvarAdminProfile, null, n);
}

function salvarAdminProfile() {
  if (!_adminProfile) return;
  
  const nome = document.getElementById('admin-f-nome')?.value.trim();
  const nascInput = document.getElementById('admin-f-nasc')?.value;
  
  if (!nome) { toast('Nome é obrigatório.', 'err'); return; }
  if (!nascInput) { toast('Data de nascimento é obrigatória.', 'err'); return; }
  
  _adminProfile.nome    = nome;
  _adminProfile.nasc    = nascInput;
  _adminProfile.telefone = document.getElementById('admin-f-tel')?.value.trim() || '';
  _adminProfile.email   = document.getElementById('admin-f-email')?.value.trim() || '';
  _adminProfile.cep = document.getElementById('admin-f-cep')?.value.trim() || '';
  _adminProfile.rua = document.getElementById('admin-f-rua')?.value.trim() || '';
  _adminProfile.num = document.getElementById('admin-f-num')?.value.trim() || '';
  _adminProfile.comp = document.getElementById('admin-f-comp')?.value.trim() || '';
  _adminProfile.bairro = document.getElementById('admin-f-bairro')?.value.trim() || '';
  _adminProfile.cidade = document.getElementById('admin-f-cidade')?.value.trim() || '';
  _adminProfile.uf = document.getElementById('admin-f-uf')?.value || '';
  
  localStorage.setItem('anivcrm_admin_profile', JSON.stringify(_adminProfile));
  
  syncAdminCard();
  toast('Perfil salvo!');
}

function alterarSenhaAdmin() {
  const atual = document.getElementById('admin-senha-atual')?.value;
  const nova = document.getElementById('admin-senha-nova')?.value;
  const conf = document.getElementById('admin-senha-conf')?.value;
  
  if (!atual || !nova || !conf) { toast('Preencha todos os campos.', 'err'); return; }
  if (nova !== conf) { toast('As senhas não coincidem.', 'err'); return; }
  if (nova.length < 6) { toast('A senha deve ter pelo menos 6 caracteres.', 'err'); return; }
  
  document.getElementById('admin-senha-atual').value = '';
  document.getElementById('admin-senha-nova').value = '';
  document.getElementById('admin-senha-conf').value = '';
  
  toast('Senha alterada com sucesso!');
}

function deletarAdmin() {
  confirmarAcao(
    'Deletar minha conta',
    'Esta ação é permanente e removerá seu perfil de administrador.',
    () => {
      localStorage.removeItem('anivcrm_admin_profile');
      _adminProfile = null;
      loadAdminProfile();
      toast('Conta removida.');
    }
  );
}

// ═══════════════════════════════════════════════════════════════════
// APP: HOME (Perfil do Usuário)
// ═══════════════════════════════════════════════════════════════════

function renderHome() {
  if (!currentUser) return;
  
  const greet = document.getElementById('home-greet');
  if (greet) {
    const h = new Date().getHours();
    greet.textContent = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + ', ' + currentUser.nome.split(' ')[0] + '! 👋';
  }
  
  const countdown = document.getElementById('home-countdown');
  if (countdown) {
    const days = daysUntilBday(currentUser.nasc);
    if (days === 0) {
      countdown.innerHTML = '🎉 <strong>É HOJE! Feliz Aniversário!</strong>';
    } else if (days === 1) {
      countdown.textContent = 'Falta apenas 1 dia para o seu aniversário!';
    } else {
      countdown.textContent = `Faltam ${days} dias para o seu aniversário.`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// APP: OFERTAS
// ═══════════════════════════════════════════════════════════════════

function renderOfertas() {
  const db = load();
  const q = (document.getElementById('search-ofertas')?.value || '').toLowerCase().trim();

  // Mostrar/esconder botão de limpar busca
  const btnLimpar = document.getElementById('btn-limpar-busca');
  if (btnLimpar) btnLimpar.classList.toggle('hidden', !q);

  // Todas empresas com oferta cadastrada
  // Só empresas aprovadas (status 02) com oferta cadastrada
  let list = db.empresas.filter(e => e.status === '02' && e.oferta_destaque && e.oferta_destaque.trim() !== '');

  // ── Filtro de texto aprimorado (busca em múltiplos campos) ──────
  if (q) {
    list = list.filter(e =>
      (e.empresa || '').toLowerCase().includes(q) ||
      (e.cidade || '').toLowerCase().includes(q) ||
      (e.bairro || '').toLowerCase().includes(q) ||
      (e.segmento || '').toLowerCase().includes(q) ||
      (e.oferta_destaque || '').toLowerCase().includes(q) ||
      (e.oferta_detalhe || '').toLowerCase().includes(q) ||
      (e.uf || '').toLowerCase().includes(q)
    );
  }

  // ── Filtro por categoria/segmento ───────────────────────────────
  if (catFiltro && catFiltro !== 'todos') {
    const mapCat = {
      restaurante: ['restaurante', 'churrascaria', 'steakhouse', 'buffet', 'bistrô', 'bistro', 'culinária', 'gastronomia'],
      bar:         ['bar', 'boteco', 'pub', 'balada', 'boate', 'cervejaria', 'choperia', 'taberna'],
      cafeteria:   ['café', 'cafe', 'cafeteria', 'padaria', 'confeitaria', 'doceria', 'bakery'],
      lanchonete:  ['lanchonete', 'lanche', 'hamburger', 'hamburguer', 'sanduíche', 'snack', 'fast food', 'fastfood'],
      pizzaria:    ['pizzaria', 'pizza'],
      outros:      [] // tudo que não se encaixa nas categorias acima
    };

    const todasCats = Object.values(mapCat).flat();

    list = list.filter(e => {
      const seg = (e.segmento || '').toLowerCase();
      if (catFiltro === 'outros') {
        // "Outros" = sem segmento OU segmento não reconhecido
        if (!seg) return true;
        return !todasCats.some(keyword => seg.includes(keyword));
      }
      const keywords = mapCat[catFiltro] || [];
      return keywords.some(keyword => seg.includes(keyword));
    });
  }
  
  const grid = document.getElementById('ofertas-grid');
  const empty = document.getElementById('ofertas-empty');
  const label = document.getElementById('ofertas-label');
  
  if (!grid) return;
  
  if (!list.length) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    if (label) label.textContent = 'Nenhum local encontrado.';
    return;
  }
  
  empty?.classList.add('hidden');
  if (label) label.textContent = list.length + ' local(is)';
  
  const diaHoje = diaAtualNome();
  
  // Calcular dias da semana e do mês para filtro HH
  const diasNomesSemana = [];
  const diasNomes = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const hojeDow = new Date().getDay();
  for (let i = 0; i < 7; i++) diasNomesSemana.push(diasNomes[(hojeDow + i) % 7]);
  
  // Aplicar filtro ofertaFiltro baseado em disponibilidade HH
  if (ofertaFiltro === 'hoje') {
    // Prioriza HH hoje, mas mostra todos (ordena HH hoje primeiro)
    list.sort((a, b) => {
      const aHH = a.horarios && a.horarios.some(h => h.hh && !h.fechado && h.dia === diaHoje) ? 1 : 0;
      const bHH = b.horarios && b.horarios.some(h => h.hh && !h.fechado && h.dia === diaHoje) ? 1 : 0;
      if (bHH !== aHH) return bHH - aHH;
      if (b.status_perfil === 'verificado' && a.status_perfil !== 'verificado') return 1;
      if (a.status_perfil === 'verificado' && b.status_perfil !== 'verificado') return -1;
      return 0;
    });
  } else if (ofertaFiltro === 'semana') {
    list.sort((a, b) => {
      const aHH = a.horarios && a.horarios.some(h => h.hh && !h.fechado && diasNomesSemana.includes(h.dia)) ? 1 : 0;
      const bHH = b.horarios && b.horarios.some(h => h.hh && !h.fechado && diasNomesSemana.includes(h.dia)) ? 1 : 0;
      return bHH - aHH;
    });
  } else if (ofertaFiltro === 'mes') {
    // Todos com HH em qualquer dia primeiro
    list.sort((a, b) => {
      const aHH = a.horarios && a.horarios.some(h => h.hh && !h.fechado) ? 1 : 0;
      const bHH = b.horarios && b.horarios.some(h => h.hh && !h.fechado) ? 1 : 0;
      return bHH - aHH;
    });
  }
  // 'todos' = sem filtro adicional, mostra tudo
  
  if (label) label.textContent = list.length + ' local(is)';
  
  grid.innerHTML = list.map(e => {
    const addr = [e.bairro, e.cidade].filter(Boolean).join(', ') || 'Endereço não informado';
    const temHHHoje = e.horarios && e.horarios.some(h => h.hh && !h.fechado && h.dia === diaHoje);
    const temHHQualquer = e.horarios && e.horarios.some(h => h.hh && !h.fechado);
    
    let hhHojeHTML = '';
    if (temHHHoje) {
      // Aberto com HH hoje — destaque verde
      const hDia = e.horarios.find(h => h.hh && !h.fechado && h.dia === diaHoje);
      const slots = (hDia?.hh_slots || []).map(s => s.ini && s.fim ? s.ini + '–' + s.fim : '').filter(Boolean);
      const hhNota = hDia?.hh_nota || hDia?.hh_desc || '';
      hhHojeHTML = `<div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
        <div class="flex items-center gap-2">
          <span class="text-sm">🍺</span>
          <span class="text-sm font-bold text-green-700">Happy Hour Hoje!</span>
          ${slots.length ? `<span class="text-xs text-green-600 ml-1">${slots.join(', ')}</span>` : ''}
        </div>
        ${hhNota ? `<div class="text-xs text-green-700 mt-1 font-medium">${hhNota}</div>` : ''}
      </div>`;
    } else if (temHHQualquer) {
      // Sem HH hoje — mostra só o dia de hoje (fechado ou sem HH)
      const hojeFechado = e.horarios.find(h => h.dia === diaHoje && h.fechado);
      const diaAbrev = diaHoje.replace('-feira', '');
      if (hojeFechado) {
        hhHojeHTML = `<div class="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3 flex items-center gap-2">
          <span class="text-xs">🍺</span>
          <span class="text-xs font-bold text-red-400">${diaAbrev}: Fechado hoje</span>
          <span class="text-xs text-gray-400 ml-auto">ver outros dias →</span>
        </div>`;
      } else {
        // Aberto mas sem HH hoje
        const hojeDia = e.horarios.find(h => h.dia === diaHoje);
        const slots = hojeDia ? (hojeDia.slots || []).map(s => s.ini && s.fim ? s.ini + '–' + s.fim : '').filter(Boolean) : [];
        hhHojeHTML = `<div class="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-center gap-2">
          <span class="text-xs">🍺</span>
          <span class="text-xs font-bold text-amber-700">${diaAbrev}: sem HH hoje</span>
          <span class="text-xs text-gray-400 ml-auto">ver outros dias →</span>
        </div>`;
      }
    }
    
    return `
      <div onclick="openNegDrawer('emp-pub','${e.negocio}')" 
           class="oferta-card rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col cursor-pointer group hover:border-blue-200 hover:shadow-md transition-all">
        <div class="px-4 pt-4 pb-3 border-b border-gray-100">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-bold text-sm group-hover:text-blue-600 transition-colors">${e.empresa}</h3>
            ${e.status_perfil === 'verificado' ? '<span class="badge-verificado">🛡️ Verificado</span>' : '<span class="badge-comunidade">🤝 Comunidade</span>'}
          </div>
          <p class="text-xs text-gray-400 mt-1 truncate">📍 ${addr}</p>
        </div>
        <div class="px-4 py-3 flex-1 flex flex-col gap-2">
          ${hhHojeHTML}
          <div class="flex flex-col gap-1">
            <div class="text-sm font-bold">🎁 ${e.oferta_destaque}</div>
            ${e.oferta_detalhe ? `<div class="text-xs text-gray-500">🎈 ${e.oferta_detalhe}</div>` : ''}
            ${e.oferta_regras ? `<div class="text-xs text-gray-400">⚠️ ${e.oferta_regras}</div>` : ''}
            ${e.oferta_valida ? `<div class="text-xs text-gray-400">🕐 ${e.oferta_valida}</div>` : ''}
          </div>
        </div>
        <div class="px-4 py-2 border-t border-gray-100 flex items-center justify-end">
          <span class="text-xs text-blue-600 font-semibold group-hover:underline">Ver detalhes →</span>
        </div>
      </div>`;
  }).join('');
}

function setOfertaFiltro(val, btn) {
  ofertaFiltro = val;
  document.querySelectorAll('.oferta-filtro-btn').forEach(b => {
    b.classList.remove('text-white');
    b.classList.add('bg-white', 'border', 'border-gray-200', 'text-gray-500');
    b.style.background = '';
    b.style.boxShadow = '';
  });
  
  if (btn) {
    btn.classList.add('text-white');
    btn.classList.remove('bg-white', 'border', 'border-gray-200', 'text-gray-500');
    btn.style.background = 'linear-gradient(90deg,#1d4ed8,#2563eb)';
    btn.style.boxShadow = '0 2px 10px rgba(37,99,235,.35)';
  }
  
  renderOfertas();
}

// Filtro por categoria/segmento
function setCatFiltro(val, btn) {
  catFiltro = val;

  document.querySelectorAll('.cat-filtro-btn').forEach(b => {
    b.classList.remove('text-white');
    b.classList.add('bg-white', 'border', 'border-edge', 'text-ink-muted');
    b.style.background = '';
    b.style.boxShadow = '';
  });

  if (btn) {
    btn.classList.add('text-white');
    btn.classList.remove('bg-white', 'border', 'border-edge', 'text-ink-muted');
    btn.style.background = 'linear-gradient(90deg,#1d4ed8,#2563eb)';
    btn.style.boxShadow = '0 1px 6px rgba(37,99,235,.3)';
  }

  renderOfertas();
}

// Filtro de categoria mobile (dropdown)
function setCatFiltroMob(val) {
  catFiltro = val;

  // Botão Todos mobile: ativo só se val === 'todos'
  const btnTodos = document.getElementById('cat-mob-todos');
  if (btnTodos) {
    if (val === 'todos') {
      btnTodos.classList.add('text-white');
      btnTodos.classList.remove('bg-white', 'border', 'border-edge', 'text-ink-muted');
      btnTodos.style.background = 'linear-gradient(90deg,#1d4ed8,#2563eb)';
      btnTodos.style.boxShadow = '0 1px 6px rgba(37,99,235,.3)';
      // Reseta o dropdown visualmente para Bar (default)
      const dd = document.getElementById('cat-dropdown-mob');
      if (dd) dd.value = 'bar';
    } else {
      btnTodos.classList.remove('text-white');
      btnTodos.classList.add('bg-white', 'border', 'border-edge', 'text-ink-muted');
      btnTodos.style.background = '';
      btnTodos.style.boxShadow = '';
    }
  }

  renderOfertas();
}

// Limpar campo de busca
function limparBuscaOfertas() {
  const input = document.getElementById('search-ofertas');
  if (input) {
    input.value = '';
    input.focus();
  }
  renderOfertas();
}

// ═══════════════════════════════════════════════════════════════════
// APP: NEGÓCIOS
// ═══════════════════════════════════════════════════════════════════

function irParaNegocio(btn) {
  const db = load();
  const temAprovada = db.empresas.some(e => e.usuario === currentUser.usuario && e.status === '02');
  const temPendente = db.empresas.some(e => e.usuario === currentUser.usuario && e.status === '01');
  
  if (!temAprovada && !temPendente) {
    abrirCadastroComoNegocio();
    return;
  }
  
  gotoScreen('negocio', btn);
}

function renderNegocio() {
  if (!currentUser) return;
  
  const db = load();
  const verificados = db.empresas.filter(e => e.usuario === currentUser.usuario && e.status === '02');
  const pendentes   = db.empresas.filter(e => e.usuario === currentUser.usuario && e.status === '01');
  
  document.getElementById('btn-add-negocio')?.classList.toggle('hidden', verificados.length === 0);
  
  const navCount = document.getElementById('nav-neg-count');
  if (verificados.length > 0) {
    navCount.textContent = verificados.length;
    navCount.classList.remove('hidden');
  } else {
    navCount.classList.add('hidden');
  }
  
  const temAlgo = verificados.length > 0 || pendentes.length > 0;
  
  document.getElementById('negocio-empty')?.classList.toggle('hidden', temAlgo);
  document.getElementById('negocio-stats')?.classList.toggle('hidden', !temAlgo);
  document.getElementById('neg-section-verificado')?.classList.toggle('hidden', verificados.length === 0);
  document.getElementById('neg-section-pendente')?.classList.toggle('hidden', pendentes.length === 0);
  
  if (!temAlgo) return;
  
  const statsEl = document.getElementById('negocio-stats');
  if (statsEl) {
    statsEl.className = 'grid grid-cols-3 gap-4 mb-6';
    statsEl.innerHTML = [
      { icon: '🏢', label: 'Negócios Ativos', val: verificados.length, cls: 'border-t-2 border-t-blue-400', ic: 'bg-blue-100 text-blue-600' },
      { icon: '⏳', label: 'Em Análise', val: pendentes.length, cls: 'border-t-2 border-t-yellow-400', ic: 'bg-yellow-100 text-yellow-600' },
      { icon: '🎁', label: 'Ofertas Ativas', val: verificados.filter(e => e.oferta_destaque).length, cls: 'border-t-2 border-t-green-400', ic: 'bg-green-100 text-green-600' }
    ].map(s => `
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm ${s.cls}">
        <div class="w-9 h-9 rounded-xl ${s.ic} flex items-center justify-center text-lg mb-3">${s.icon}</div>
        <div class="text-2xl font-bold">${s.val}</div>
        <div class="text-xs text-gray-400 font-medium">${s.label}</div>
      </div>
    `).join('');
  }
  
  const listVer = document.getElementById('neg-list-verificado');
  if (listVer && verificados.length) {
    document.getElementById('neg-badge-verificado').textContent = verificados.length + (verificados.length === 1 ? ' unidade' : ' unidades');
    listVer.innerHTML = verificados.map(e => {
      const addr = [e.bairro, e.cidade].filter(Boolean).join(', ') || 'Endereço não informado';
      return `
        <div onclick="openNegDrawer('emp','${e.negocio}')" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start justify-between gap-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group">
          <div class="flex items-start gap-4 min-w-0 flex-1">
            <div class="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-2xl">🏢</div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <h3 class="font-bold text-sm">${e.empresa}</h3>
                <span class="badge-verificado">🛡️ Verificado</span>
              </div>
              <p class="text-xs text-gray-400 truncate">📍 ${addr}</p>
              ${e.oferta_destaque ? `<p class="text-xs text-blue-600 font-medium mt-0.5 truncate">🎁 ${e.oferta_destaque}</p>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="event.stopPropagation();openNegocioModal('${e.negocio}')" class="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">✏️ Editar</button>
            <span class="text-gray-400 text-lg group-hover:text-blue-600">›</span>
          </div>
        </div>`;
    }).join('');
  }
  
  const listPend = document.getElementById('neg-list-pendente');
  if (listPend && pendentes.length) {
    document.getElementById('neg-badge-pendente').textContent = pendentes.length + (pendentes.length === 1 ? ' cadastro' : ' cadastros');
    listPend.innerHTML = pendentes.map(s => `
      <div class="bg-white rounded-2xl border border-dashed border-yellow-300 shadow-sm p-5 flex items-center justify-between gap-4" style="background:linear-gradient(135deg,#fffbeb,#fff)">
        <div class="flex items-center gap-4 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center text-2xl">⏳</div>
          <div>
            <h3 class="font-bold text-sm mb-0.5">${s.empresa}</h3>
            <p class="text-xs text-yellow-600 font-medium">Aguardando verificação da equipe</p>
          </div>
        </div>
        <span class="badge-pendente">Em análise</span>
      </div>
    `).join('');
  }
}

function abrirCadastroComoNegocio() {
  _sugModoAtual = 'dono';
  _resetModalSug();
  _setCtxBanner('dono');
  document.getElementById('modal-sug-title').textContent = 'Cadastrar Negócio';
  document.getElementById('modal-sug-subtitle').textContent = 'Nova unidade ou franquia';
  buildSched(null, 's-');
  
  _sCurrentStep = 1;
  document.querySelectorAll('#modal-sug .n-step').forEach(s => s.classList.remove('active'));
  document.getElementById('s-step-1')?.classList.add('active');
  document.getElementById('s-prev-btn')?.classList.add('hidden');
  document.getElementById('s-next-btn').textContent = 'Próximo →';
  document.getElementById('s-step-label').textContent = 'Etapa 1 de 4';
  
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('s-dot-' + i);
    if (dot) dot.style.background = i === 1 ? '#3b5bdb' : '#e2e8f0';
  }
  
  openModal('modal-sug');
}

function _resetModalSug() {
  ['s-nome', 's-segmento', 's-tel', 's-email', 's-ig', 's-site', 's-cardapio', 's-rua', 's-num', 's-comp', 's-bairro', 's-cep', 's-cidade', 's-oferta-desc', 's-oferta-detalhe', 's-oferta-regras'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('s-uf').value = '';
  document.getElementById('s-oferta-tipo').value = 'Produto/Brinde Grátis';
  document.getElementById('s-oferta-val').value = 'No dia do aniversário';
}

function _setCtxBanner(modo) {
  _sugModoAtual = modo;
  const banner = document.getElementById('sug-ctx-banner');
  if (!banner) return;
  
  const titulo = document.getElementById('ctx-banner-titulo');
  const sub    = document.getElementById('ctx-banner-sub');
  
  if (modo === 'dono') {
    banner.className = 'ctx-banner modo-dono';
    if (titulo) titulo.textContent = 'Cadastro como dono do negócio';
    if (sub) sub.textContent = 'Após envio, nossa equipe fará a verificação do perfil';
  } else {
    banner.className = 'ctx-banner modo-cliente';
    if (titulo) titulo.textContent = 'Indicação para a comunidade';
    if (sub) sub.textContent = 'Você está indicando um local que conhece — obrigado!';
  }
}

function sStep(n) {
  // sStep usa 'Enviar ✓' em vez de 'Salvar ✓' no último passo
  if (n === 1 && _sCurrentStep === 4) { enviarSugestao(); return; }
  document.getElementById('s-step-' + _sCurrentStep)?.classList.remove('active');
  _sCurrentStep += n;
  document.getElementById('s-step-' + _sCurrentStep)?.classList.add('active');
  document.getElementById('s-prev-btn')?.classList.toggle('hidden', _sCurrentStep === 1);
  const nb = document.getElementById('s-next-btn');
  if (nb) nb.textContent = _sCurrentStep === 4 ? 'Enviar ✓' : 'Próximo →';
  const lbl = document.getElementById('s-step-label');
  if (lbl) lbl.textContent = 'Etapa ' + _sCurrentStep + ' de 4';
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('s-dot-' + i);
    if (dot) dot.style.background = i <= _sCurrentStep ? '#3b5bdb' : '#e2e8f0';
  }
}

function enviarSugestao() {
  const nome = document.getElementById('s-nome')?.value.trim();
  const oferta_destaque = document.getElementById('s-oferta-desc')?.value.trim();
  
  if (!nome) {
    toast('O nome do local é obrigatório.', 'err');
    return;
  }
  if (!oferta_destaque) {
    toast('Descreva a oferta de aniversário.', 'err');
    return;
  }
  
  const is_dono = _sugModoAtual === 'dono';
  const db = load();
  
  
  const horarios = collectSched('s-');
  const camposComuns = {
    empresa:   nome,
    segmento:  document.getElementById('s-segmento')?.value.trim() || '',
    telefone:  document.getElementById('s-tel')?.value.trim() || '',
    email:     document.getElementById('s-email')?.value.trim() || '',
    ig:        document.getElementById('s-ig')?.value.trim() || '',
    site:      document.getElementById('s-site')?.value.trim() || '',
    cardapio:  document.getElementById('s-cardapio')?.value.trim() || '',
    rua:       document.getElementById('s-rua')?.value.trim() || '',
    num:       document.getElementById('s-num')?.value.trim() || '',
    comp:      document.getElementById('s-comp')?.value.trim() || '',
    bairro:    document.getElementById('s-bairro')?.value.trim() || '',
    cep:       document.getElementById('s-cep')?.value.trim() || '',
    cidade:    document.getElementById('s-cidade')?.value.trim() || '',
    uf:        document.getElementById('s-uf')?.value || '',
    horarios,
    oferta_tipo:     document.getElementById('s-oferta-tipo')?.value || 'Produto/Brinde Grátis',
    oferta_valida:   document.getElementById('s-oferta-val')?.value || 'No dia do aniversário',
    oferta_destaque,
    oferta_detalhe:  document.getElementById('s-oferta-detalhe')?.value.trim() || '',
    oferta_regras:   document.getElementById('s-oferta-regras')?.value.trim() || '',
    status:    '01',
    criado_em: new Date().toISOString(),
  };

  if (is_dono) {
    // Dono: vai direto para tabela empresas com status 01 (pendente)
    const emp = {
      negocio:  gid('N'),              // N-XXXXXX (PK)
      master:   currentUser.master,    // M-XXXXXX do dono
      usuario:  currentUser.usuario,   // U-XXXXXX do dono

      status_perfil: 'comunidade',
      ...camposComuns,
    };
    db.empresas.unshift(emp);
    // Atualiza referência no cliente
    const cli = db.clientes.find(c => c.usuario === currentUser.usuario);
    if (cli && !cli.negocio) cli.negocio = emp.negocio;
    save(db);
    closeModal('modal-sug');
    gotoScreen('negocio');
    toast('Cadastro enviado! Aguarde a verificação.');
  } else {
    // Indicação: vai para tabela empresas com master NOVO (independente do usuário)
    const sug = {
      negocio:      gid('N'),              // N-XXXXXX (PK)
      master:       gid('M'),              // M-XXXXXX NOVO — nunca vinculado ao master do usuário
      usuario:      '',                    // sem dono
      is_sugestao:  true,
      indicado_por: currentUser.usuario,   // quem indicou (para histórico)
      status_perfil: 'comunidade',
      ...camposComuns,
    };
    db.empresas.unshift(sug);
    save(db);
    closeModal('modal-sug');
    gotoScreen('sugestoes');
    toast('Indicação enviada! Obrigado por ajudar a comunidade.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// APP: NEGÓCIO MODAL & DRAWER
// ═══════════════════════════════════════════════════════════════════

function openNegocioModal(id) {
  const db = load();
  const emp = db.empresas.find(e => e.negocio === id && e.usuario === currentUser.usuario);
  if (!emp) return;
  
  document.getElementById('modal-negocio-subtitle').textContent = emp.empresa || '';
  document.getElementById('n-id').value = emp.negocio;
  
  ['rua', 'num', 'comp', 'bairro', 'cep', 'cidade'].forEach(f => {
    const el = document.getElementById('n-' + f);
    if (el) el.value = emp[f] || '';
  });
  // Fields with different names
  const fieldMap = { nome: 'empresa', tel: 'telefone', email: 'email', ig: 'ig', site: 'site', cardapio: 'cardapio', segmento: 'segmento' };
  Object.entries(fieldMap).forEach(([formF, dataF]) => {
    const el = document.getElementById('n-' + formF);
    if (el) el.value = emp[dataF] || '';
  });
  
  document.getElementById('n-uf').value = emp.uf || '';
  document.getElementById('n-oferta-tipo').value = emp.oferta_tipo || 'Produto/Brinde Grátis';
  document.getElementById('n-oferta-val').value = emp.oferta_valida || 'No dia do aniversário';
  document.getElementById('n-oferta-desc').value = emp.oferta_destaque || '';
  document.getElementById('n-oferta-detalhe').value = emp.oferta_detalhe || '';
  document.getElementById('n-oferta-regras').value = emp.oferta_regras || '';
  
  buildSched(emp.horarios || null, 'n-');
  
  _nCurrentStep = 1;
  document.querySelectorAll('.n-step').forEach(s => s.classList.remove('active'));
  document.getElementById('n-step-1')?.classList.add('active');
  document.getElementById('n-prev-btn')?.classList.add('hidden');
  document.getElementById('n-next-btn').textContent = 'Próximo →';
  document.getElementById('n-step-label').textContent = 'Etapa 1 de 4';
  
  for (let i=1; i<=4; i++) {
    const dot = document.getElementById('n-dot-' + i);
    if (dot) dot.style.background = i === 1 ? '#3b5bdb' : '#e2e8f0';
  }
  
  openModal('modal-negocio');
}

function nStep(n) {
  _nCurrentStep = _wizStep('n', _nCurrentStep, 4, salvarNegocio, null, n);
}

function salvarNegocio() {
  const id = document.getElementById('n-id')?.value;
  const nome = document.getElementById('n-nome')?.value.trim();
  const oferta_destaque = document.getElementById('n-oferta-desc')?.value.trim();
  
  if (!nome) {
    toast('O nome do local é obrigatório.', 'err');
    return;
  }
  if (!oferta_destaque) {
    toast('Descreva a oferta de aniversário.', 'err');
    return;
  }
  
  const db = load();
  const index = db.empresas.findIndex(e => e.negocio === id && e.usuario === currentUser.usuario);
  if (index === -1) return;
  
  db.empresas[index].empresa         = nome;
  db.empresas[index].segmento        = document.getElementById('n-segmento')?.value.trim() || '';
  db.empresas[index].telefone        = document.getElementById('n-tel')?.value.trim() || '';
  db.empresas[index].email           = document.getElementById('n-email')?.value.trim() || '';
  db.empresas[index].ig              = document.getElementById('n-ig')?.value.trim() || '';
  db.empresas[index].site            = document.getElementById('n-site')?.value.trim() || '';
  db.empresas[index].cardapio        = document.getElementById('n-cardapio')?.value.trim() || '';
  db.empresas[index].rua             = document.getElementById('n-rua')?.value.trim() || '';
  db.empresas[index].num             = document.getElementById('n-num')?.value.trim() || '';
  db.empresas[index].comp            = document.getElementById('n-comp')?.value.trim() || '';
  db.empresas[index].bairro          = document.getElementById('n-bairro')?.value.trim() || '';
  db.empresas[index].cep             = document.getElementById('n-cep')?.value.trim() || '';
  db.empresas[index].cidade          = document.getElementById('n-cidade')?.value.trim() || '';
  db.empresas[index].uf              = document.getElementById('n-uf')?.value || '';
  db.empresas[index].horarios        = collectSched('n-');
  db.empresas[index].oferta_tipo     = document.getElementById('n-oferta-tipo')?.value || 'Produto/Brinde Grátis';
  db.empresas[index].oferta_valida   = document.getElementById('n-oferta-val')?.value || 'No dia do aniversário';
  db.empresas[index].oferta_destaque = oferta_destaque;
  db.empresas[index].oferta_detalhe  = document.getElementById('n-oferta-detalhe')?.value.trim() || '';
  db.empresas[index].oferta_regras   = document.getElementById('n-oferta-regras')?.value.trim() || '';
  
  save(db);
  closeModal('modal-negocio');
  renderNegocio();
  toast('Informações do negócio atualizadas!');
}

function openNegDrawer(tipo, id) {
  const db = load();
  let data = null;
  let isDono = false;
  
  if (tipo === 'emp') {
    data = db.empresas.find(e => e.negocio === id);
    isDono = data && data.usuario === currentUser?.usuario;
  } else if (tipo === 'emp-pub') {
    data = db.empresas.find(e => e.negocio === id);
    isDono = data && !!currentUser && data.usuario === currentUser.usuario;
  } else if (tipo === 'colab-sug') {
    data = db.empresas.find(e => e.sugestao === id) || db.empresas.find(e => e.negocio === id);
    if (!data) {
      const sug = (db.empresas || []).find(e => e.negocio === id);
      if (sug) {
        data = {
          negocio:        sug.sugestao,
          empresa:        sug.empresa,
          segmento:       sug.segmento || '',
          telefone:       sug.telefone || '',
          email:          sug.email || '',
          ig:             sug.ig || '',
          site:           sug.site || '',
          cardapio:       sug.cardapio || '',
          rua:            sug.rua || '',
          num:            sug.num || '',
          comp:           sug.comp || '',
          bairro:         sug.bairro || '',
          cidade:         sug.cidade || '',
          uf:             sug.uf || '',
          oferta_tipo:     sug.oferta_tipo || '',
          oferta_destaque: sug.oferta_destaque || '',
          oferta_detalhe:  sug.oferta_detalhe || '',
          oferta_regras:   sug.oferta_regras || '',
          oferta_valida:   sug.oferta_valida || '',
          hh_desc:         sug.hh_desc || '',
          status_perfil:   sug.status === '02' ? 'comunidade' : 'pendente',
          horarios:        sug.horarios || [],
        };
      }
    }
  }
  
  if (!data) return;
  
  // Header
  const header = document.getElementById('neg-drawer-header');
  if (header) {
    if (isDono) {
      header.style.background = 'linear-gradient(135deg,#eff6ff,#dbeafe)';
      header.style.borderBottom = '2px solid #bfdbfe';
    } else {
      const isVerif = data.status_perfil === 'verificado';
      header.style.background = isVerif ? 'linear-gradient(135deg,#eff6ff,#f5f3ff)' : 'linear-gradient(135deg,#f8fafc,#f0fdf4)';
      header.style.borderBottom = isVerif ? '2px solid #bfdbfe' : '2px solid #d1fae5';
    }
  }
  
  // Badge
  const badgeEl = document.getElementById('neg-drawer-badge');
  if (badgeEl) {
    if (isDono) {
      badgeEl.textContent = '⚙️ Meu Negócio';
      badgeEl.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:10.5px;font-weight:700;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;';
    } else if (data.status_perfil === 'verificado') {
      badgeEl.textContent = '✅ Verificado';
      badgeEl.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:10.5px;font-weight:700;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;';
    } else {
      badgeEl.textContent = '🌱 Comunidade';
      badgeEl.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:10.5px;font-weight:700;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;';
    }
  }
  
  document.getElementById('neg-drawer-nome').textContent = data.empresa || data.nome || '—';
  document.getElementById('neg-drawer-seg').textContent = data.segmento || '';
  
  const addrParts = [data.rua, data.num, data.bairro, data.cidade, data.uf].filter(Boolean);
  const addrEl = document.getElementById('neg-drawer-addr');
  if (addrEl) {
    const spans = addrEl.querySelectorAll('span');
    if (spans[1]) spans[1].textContent = addrParts.join(', ') || 'Endereço não informado';
  }
  
  document.getElementById('neg-drawer-oferta-tipo').textContent = data.oferta_tipo || 'Oferta';
  document.getElementById('neg-drawer-oferta-desc').textContent = data.oferta_destaque || '—';
  document.getElementById('neg-drawer-oferta-detalhe').textContent = data.oferta_detalhe || '';
  document.getElementById('neg-drawer-oferta-detalhe-wrap').style.display = data.oferta_detalhe ? 'block' : 'none';
  document.getElementById('neg-drawer-oferta-regras').textContent = data.oferta_regras ? '⚠️ ' + data.oferta_regras : '';
  document.getElementById('neg-drawer-oferta-regras-wrap').style.display = data.oferta_regras ? 'block' : 'none';
  document.getElementById('neg-drawer-oferta-val').textContent = data.oferta_valida ? '🕐 ' + data.oferta_valida : '';
  document.getElementById('neg-drawer-oferta-val').style.display = data.oferta_valida ? 'inline-flex' : 'none';
  
  document.getElementById('neg-drawer-tel').style.display = data.telefone ? 'flex' : 'none';
  if (data.telefone) document.querySelector('#neg-drawer-tel span:last-child').textContent = data.telefone;
  
  document.getElementById('neg-drawer-email').style.display = data.email ? 'flex' : 'none';
  if (data.email) document.querySelector('#neg-drawer-email span:last-child').textContent = data.email;
  
  document.getElementById('neg-drawer-ig').style.display = data.ig ? 'flex' : 'none';
  if (data.ig) {
    document.querySelector('#neg-drawer-ig a').textContent = '@' + data.ig;
    document.querySelector('#neg-drawer-ig a').href = 'https://instagram.com/' + data.ig;
  }
  
  document.getElementById('neg-drawer-site').style.display = data.site ? 'flex' : 'none';
  if (data.site) {
    document.querySelector('#neg-drawer-site a').textContent = data.site;
    document.querySelector('#neg-drawer-site a').href = data.site;
  }
  
  document.getElementById('neg-drawer-cardapio').style.display = data.cardapio ? 'flex' : 'none';
  if (data.cardapio) {
    document.querySelector('#neg-drawer-cardapio a').textContent = data.cardapio;
    document.querySelector('#neg-drawer-cardapio a').href = data.cardapio;
  }
  
  document.getElementById('neg-drawer-no-contato').style.display = (data.tel || data.email || data.ig || data.site || data.cardapio) ? 'none' : 'block';
  
  // Horários
  if (data.horarios && data.horarios.length) {
    document.getElementById('neg-drawer-hh-wrap')?.classList.remove('hidden');
    const diasNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaHojeNome = diasNomes[new Date().getDay()];
    
    document.getElementById('neg-drawer-horarios-body').innerHTML = data.horarios.map(h => {
      const diaAbr = h.dia ? h.dia.substring(0, 3) : '?';
      const isHoje = h.dia === diaHojeNome;
      const slots = (h.slots || []).map(s => s.ini && s.fim ? s.ini + '–' + s.fim : '').filter(Boolean);
      const hasHH = h.hh && h.hh_slots && h.hh_slots.some(s => s.ini && s.fim);
      const hhSlots = hasHH ? h.hh_slots.map(s => s.ini && s.fim ? s.ini + '–' + s.fim : '').filter(Boolean) : '';
      
      if (h.fechado) {
        return `<tr style="background:#fef2f2"><td style="padding:6px 10px;font-size:12px;color:#f87171">${diaAbr}</td><td style="padding:6px 10px;font-size:12px;color:#f87171">Fechado</td><td style="padding:6px 10px"></td><td style="padding:6px 10px"></td></tr>`;
      }
      
      return `<tr style="${isHoje ? 'background:#f0fdf4' : hasHH ? 'background:#fefce8' : ''}">
        <td style="padding:6px 10px;font-size:12px;font-weight:${isHoje ? '600' : '400'}">${diaAbr}</td>
        <td style="padding:6px 10px;font-size:12px">${slots.join(', ') || '—'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#16a34a">${hhSlots || '—'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#64748b">${h.hh_nota || h.hh_desc || ''}</td>
      </tr>`;
    }).join('');
  } else {
    document.getElementById('neg-drawer-hh-wrap')?.classList.add('hidden');
  }
  
  // Recursos e Facilidades
  const recGrid = document.getElementById('neg-drawer-recursos-grid');
  if (recGrid) {
    const list = [
      { id: 'estacionamento', label: 'Estacionamento', icon: '🚗' },
      { id: 'brinquedoteca',  label: 'Brinquedoteca',  icon: '🧸' },
      { id: 'comida_vegana',  label: 'Comida Vegana',  icon: '🌱' },
      { id: 'cadeirinha',      label: 'Cadeirinha',     icon: '🪑' },
      { id: 'delivery',       label: 'Delivery',       icon: '🛵' }
    ];
    
    recGrid.innerHTML = list.map(item => {
      const has = !!data[item.id];
      const statusIcon = has ? 'check_circle' : 'cancel';
      const statusColor = has ? '#16a34a' : '#ef4444';
      
      return `
        <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50">
          <span style="font-size:16px;">${item.icon}</span>
          <span style="font-size:11.5px;font-weight:400;color:#334155;flex:1;">${item.label}</span>
          <span class="material-symbols-outlined" style="font-size:16px;font-variation-settings:'FILL' 1;color:${statusColor}">${statusIcon}</span>
        </div>
      `;
    }).join('');
  }
  
  // Ações
  document.getElementById('neg-drawer-action')?.classList.toggle('hidden', !isDono);
  if (isDono) {
    document.getElementById('neg-drawer-edit-btn').onclick = () => {
      closeNegDrawer();
      openNegocioModal(id);
    };
  }
  
  document.getElementById('neg-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  const box = document.getElementById('neg-drawer')?.querySelector('.modal-box');
  if (box) box.scrollTop = 0;
}

function closeNegDrawer() {
  document.getElementById('neg-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════════
// APP: PERFIL DO USUÁRIO
// ═══════════════════════════════════════════════════════════════════

function renderPerfil() {
  if (!currentUser) return;
  
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  
  setVal('p-nome',   currentUser.nome);
  setVal('p-nasc',   formatDateToInput(currentUser.nasc));
  setVal('p-tel',    currentUser.telefone);
  setVal('p-email',  currentUser.email);
  setVal('p-cep',    currentUser.cep);
  setVal('p-rua',    currentUser.rua);
  setVal('p-num',    currentUser.num);
  setVal('p-comp',   currentUser.comp);
  setVal('p-bairro', currentUser.bairro);
  setVal('p-cidade', currentUser.cidade);
  if (document.getElementById('p-uf')) document.getElementById('p-uf').value = currentUser.uf || '';
  
  document.getElementById('perfil-id-master').textContent  = currentUser.master  || currentUser.usuario;
  document.getElementById('perfil-id-pessoal').textContent = currentUser.usuario;
  const nomePessoalEl = document.getElementById('perfil-nome-pessoal');
  if (nomePessoalEl) nomePessoalEl.textContent = '';
  
  const db = load();
  const negocios = db.empresas.filter(e => e.usuario === currentUser.usuario);
  
  const negEl = document.getElementById('perfil-ids-negocio');
  if (negEl) {
    negEl.innerHTML = negocios.length
      ? negocios.map(e => `
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded mono shrink-0">NEGÓCIO</span>
              <span class="mono text-[11px] text-gray-400 truncate">${e.negocio}</span>
              <span class="text-[11px] font-medium text-gray-600 truncate">· ${e.empresa}</span>
            </div>
            <button onclick="copiarId('${e.negocio}')" class="shrink-0 text-[11px] text-gray-400 hover:text-primary border border-gray-200 hover:border-primary rounded px-2 py-0.5 transition-colors">📋</button>
          </div>
        `).join('')
      : '<p class="text-[11px] text-gray-400 italic">Nenhum ID Negócio ainda.</p>';
  }
  
  atualizarCard();
}

function atualizarCard() {
  if (!currentUser) return;
  
  const nome = document.getElementById('p-nome')?.value || currentUser.nome || 'Usuário';
  const nasc = document.getElementById('p-nasc')?.value || formatDateToInput(currentUser.nasc) || '';
  const tel = document.getElementById('p-tel')?.value || '';
  const email = document.getElementById('p-email')?.value || '';
  
  document.getElementById('card-avatar').textContent = nome.charAt(0).toUpperCase();
  document.getElementById('card-nome').textContent = nome;
  document.getElementById('card-nasc-label').textContent = nasc ? '🗓️ ' + nasc : '—';
  
  const nascDB = parseDateToDB(nasc);
  const days = daysUntilBday(nascDB);
  const bdayEl = document.getElementById('card-bday-days');
  if (bdayEl) {
    if (days === 0) {
      bdayEl.textContent = '🎉 É HOJE!';
    } else if (days > 0) {
      bdayEl.textContent = 'Faltam ' + days + ' dias';
    } else {
      bdayEl.textContent = '—';
    }
  }
  
  const telRow = document.getElementById('card-tel-row');
  if (telRow) {
    if (tel) {
      telRow.classList.remove('hidden');
      telRow.style.display = 'flex';
      document.getElementById('card-tel-val').textContent = tel;
    } else {
      telRow.classList.add('hidden');
    }
  }
  
  const emailRow = document.getElementById('card-email-row');
  if (emailRow) {
    if (email) {
      emailRow.classList.remove('hidden');
      emailRow.style.display = 'flex';
      document.getElementById('card-email-val').textContent = email;
    } else {
      emailRow.classList.add('hidden');
    }
  }
  
  const db = load();
  document.getElementById('card-stat-indicacoes').textContent = (db.empresas || []).filter(e => e.is_sugestao && e.indicado_por === currentUser.usuario).length;
  document.getElementById('card-stat-negocios').textContent = db.empresas.filter(e => e.usuario === currentUser.usuario).length;
  
  const navCount = document.getElementById('nav-neg-count');
  const negs = db.empresas.filter(e => e.usuario === currentUser.usuario).length;
  if (navCount) {
    if (negs > 0) {
      navCount.textContent = negs;
      navCount.classList.remove('hidden');
    } else {
      navCount.classList.add('hidden');
    }
  }
}

function pStep(n) {
  if (n === 1 && _pCurrentStep === 1) {
    const nome = document.getElementById('p-nome')?.value.trim();
    const nasc = document.getElementById('p-nasc')?.value.trim();
    if (!nome) { toast('Preencha o nome completo.', 'err'); return; }
    if (!nasc || nasc.length < 10) { toast('Preencha a data de nascimento.', 'err'); return; }
  }
  _pCurrentStep = _wizStep('p', _pCurrentStep, 2, salvarPerfil, null, n);
}

function salvarPerfil() {
  if (!currentUser) return;
  
  const nome = document.getElementById('p-nome')?.value.trim();
  const nascInput = document.getElementById('p-nasc')?.value;
  
  if (!nome || !nascInput) {
    toast('Nome e Data de Nascimento são obrigatórios!', 'err');
    return;
  }
  
  if (!isValidDate(nascInput)) {
    toast('Data de nascimento inválida. Use DD/MM/AAAA', 'err');
    return;
  }
  
  const db = load();
  const index = db.clientes.findIndex(c => c.usuario === currentUser.usuario);
  if (index === -1) return;
  
  db.clientes[index].nome     = nome;
  db.clientes[index].nasc     = parseDateToDB(nascInput);
  db.clientes[index].telefone = document.getElementById('p-tel')?.value.trim() || '';
  db.clientes[index].email    = document.getElementById('p-email')?.value.trim() || '';
  db.clientes[index].cep      = document.getElementById('p-cep')?.value.trim() || '';
  db.clientes[index].rua      = document.getElementById('p-rua')?.value.trim() || '';
  db.clientes[index].num      = document.getElementById('p-num')?.value.trim() || '';
  db.clientes[index].comp     = document.getElementById('p-comp')?.value.trim() || '';
  db.clientes[index].bairro   = document.getElementById('p-bairro')?.value.trim() || '';
  db.clientes[index].cidade   = document.getElementById('p-cidade')?.value.trim() || '';
  db.clientes[index].uf       = document.getElementById('p-uf')?.value || '';
  
  save(db);
  currentUser = db.clientes[index];
  distCache = {};
  userLat = null;
  userLng = null;
  
  updateHeader();
  atualizarCard();
  toast('Perfil atualizado!');
}

function alterarSenhaUsuario() {
  const atual = document.getElementById('p-senha-atual')?.value;
  const nova = document.getElementById('p-senha-nova')?.value;
  const conf = document.getElementById('p-senha-conf')?.value;
  
  if (!atual || !nova || !conf) { toast('Preencha todos os campos.', 'err'); return; }
  if (nova !== conf) { toast('As senhas não coincidem.', 'err'); return; }
  if (nova.length < 6) { toast('A senha deve ter pelo menos 6 caracteres.', 'err'); return; }
  
  document.getElementById('p-senha-atual').value = '';
  document.getElementById('p-senha-nova').value = '';
  document.getElementById('p-senha-conf').value = '';
  
  toast('Senha alterada com sucesso!');
}

function deletarContaUsuario() {
  if (!currentUser) return;
  const db = load();
  db.clientes = db.clientes.filter(c => c.usuario !== currentUser.usuario);
  db.empresas = db.empresas.filter(e => e.usuario !== currentUser.usuario);
  save(db);
  localStorage.removeItem(AUTH_KEY);
  toast('Conta deletada. Até logo!');
  setTimeout(() => window.location.reload(), 1500);
}

// ═══════════════════════════════════════════════════════════════════
// APP: SUGESTÕES DO USUÁRIO
// ═══════════════════════════════════════════════════════════════════

function openSugestaoModalApp() {
  _sugModoAtual = 'cliente';
  _resetModalSug();
  _setCtxBanner('cliente');
  document.getElementById('modal-sug-title').textContent = 'Indicar Estabelecimento';
  document.getElementById('modal-sug-subtitle').textContent = 'Preencha o que souber';
  buildSched(null, 's-');
  
  _sCurrentStep = 1;
  document.querySelectorAll('#modal-sug .n-step').forEach(s => s.classList.remove('active'));
  document.getElementById('s-step-1')?.classList.add('active');
  document.getElementById('s-prev-btn')?.classList.add('hidden');
  document.getElementById('s-next-btn').textContent = 'Próximo →';
  document.getElementById('s-step-label').textContent = 'Etapa 1 de 4';
  
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('s-dot-' + i);
    if (dot) dot.style.background = i === 1 ? '#3b5bdb' : '#e2e8f0';
  }
  
  openModal('modal-sug');
}

function renderSugestoesApp() {
  if (!currentUser) return;
  
  const db = load();
  const list = (db.empresas || []).filter(e => e.is_sugestao && e.indicado_por === currentUser.usuario);
  
  const colab    = list.filter(s => s.status === '02');
  const pendente = list.filter(s => s.status === '01');
  const recusado = list.filter(s => s.status === '03');
  
  document.getElementById('sugestoes-empty')?.classList.toggle('hidden', list.length > 0);
  
  const renderSection = (sectionId, listId, badgeId, items, cardFn) => {
    const section = document.getElementById(sectionId);
    const listEl  = document.getElementById(listId);
    const badge   = document.getElementById(badgeId);
    
    if (!items.length) {
      section?.classList.add('hidden');
      return;
    }
    
    section?.classList.remove('hidden');
    if (badge) badge.textContent = items.length + ' local' + (items.length > 1 ? 'is' : '');
    if (listEl) listEl.innerHTML = items.map(cardFn).join('');
  };
  
  renderSection('sug-section-colab', 'sug-list-colab', 'sug-badge-colab', colab, s => {
    const db2 = load();
    const emp = db2.empresas.find(e => e.negocio === s.negocio);
    const horarios = (emp ? emp.horarios : s.horarios) || [];
    const diaHojeNome = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][new Date().getDay()];
    
    const hhDias    = horarios.filter(h => h.hh && !h.fechado);
    const hhHoje    = horarios.find(h => h.hh && !h.fechado && h.dia === diaHojeNome);
    const hhHojeSlots = hhHoje ? (hhHoje.hh_slots || []).map(sl => sl.ini && sl.fim ? sl.ini + '–' + sl.fim : '').filter(Boolean) : [];
    const hojeH     = horarios.find(h => h.dia === diaHojeNome);
    const hojeSlots = hojeH && !hojeH.fechado ? (hojeH.slots || []).map(sl => sl.ini && sl.fim ? sl.ini + '–' + sl.fim : '').filter(Boolean) : [];
    
    const enderecoLine = [s.rua ? (s.rua + (s.num ? ', ' + s.num : '')) : '', s.bairro, s.cidade + (s.uf ? ' - ' + s.uf : '')].filter(Boolean).join(' · ');
    const hh_desc = (emp ? emp.hh_desc : s.hh_desc) || '';
    
    return `
    <div onclick="openNegDrawer('colab-sug','${s.negocio}')" class="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-teal-400 transition-all">
      <div class="p-4 flex items-start justify-between gap-4">
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <div class="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-lg shrink-0">🤝</div>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-sm">${s.empresa}${s.segmento ? ' <span class="font-normal text-gray-400 text-xs">· ' + s.segmento + '</span>' : ''}</p>
            ${enderecoLine ? `<p class="text-xs text-gray-400 mt-0.5 truncate">📍 ${enderecoLine}</p>` : ''}
            <p class="text-xs text-blue-600 font-medium mt-1 truncate">🎁 ${s.oferta_destaque || '—'}</p>
            ${s.oferta_valida ? `<p class="text-xs text-gray-400">🕐 ${s.oferta_valida}</p>` : ''}
          </div>
        </div>
        <span class="badge-aprovado shrink-0 mt-0.5">✓ Aprovado</span>
      </div>
      ${(hojeH || hhDias.length) ? `
      <div class="border-t border-gray-100 px-4 py-2.5 flex flex-wrap gap-3">
        ${hojeH ? `
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-gray-500">📅 Hoje:</span>
            <span class="text-xs text-gray-700">${hojeH.fechado ? 'Fechado' : (hojeSlots.join(', ') || 'Sem horário')}</span>
          </div>` : ''}
        ${hhHoje ? `
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-green-700">🍺 HH:</span>
            <span class="text-xs text-green-700">${hhHojeSlots.length ? hhHojeSlots.join(', ') : 'Sim'}</span>
            ${hh_desc ? `<span class="text-xs text-green-600 font-medium">${hh_desc}</span>` : ''}
          </div>` : (hhDias.length && !hhHoje ? `
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-amber-600">🍺 HH:</span>
            <span class="text-xs text-amber-600">${hhDias.map(h => h.dia.replace('-feira','').substring(0,3)).join(', ')}</span>
          </div>` : '')}
      </div>` : ''}
    </div>`;
  });
  
  renderSection('sug-section-pendente', 'sug-list-pendente', 'sug-badge-pendente', pendente, s => `
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-lg shrink-0">💡</div>
        <div class="min-w-0">
          <p class="font-bold text-sm truncate">${s.empresa}</p>
          <p class="text-xs text-gray-300 mt-0.5">Enviado em ${fmtDate(s.criado_em.split('T')[0])}</p>
        </div>
      </div>
      <span class="badge-pendente shrink-0">⏳ Em análise</span>
    </div>
  `);
  
  renderSection('sug-section-recusado', 'sug-list-recusado', 'sug-badge-recusado', recusado, s => `
    <div class="bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-center justify-between gap-4 opacity-70">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-lg shrink-0">💡</div>
        <div class="min-w-0">
          <p class="font-bold text-sm truncate">${s.empresa}</p>
          <p class="text-xs text-gray-300 mt-0.5">Enviado em ${fmtDate(s.criado_em.split('T')[0])}</p>
        </div>
      </div>
      <span class="badge-recusado shrink-0">✕ Não aprovado</span>
    </div>
  `);
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO FINAL
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const isAdmin = document.getElementById('screen-dashboard');
  const isApp = document.getElementById('screen-home');
  
  if (isAdmin) {
    // Admin também exige login
    if (!requireAuth()) return;
    initAdmin();
  } else if (isApp) {
    checkAuth(); // checkAuth chama requireAuth() internamente
  }
});

// ═══════════════════════════════════════════════════════
// EXPORTAÇÃO GLOBAL (necessário para onclick no HTML)
// ═══════════════════════════════════════════════════════

window.gotoScreen = gotoScreen;
window.openModal = openModal;
window.closeModal = closeModal;
window.toast = toast;
window.maskPhone = maskPhone;
window.maskDate = maskDate;
window.maskCEP = maskCEP;
window.maskCPF = maskCPF;
window.confirmarAcao = confirmarAcao;
window.confirmar = confirmar;
window.sair = sair;
window.copiarId = copiarId;

// Admin
window.switchEmpTab = switchEmpTab;
window.openEmpModal = openEmpModal;
window.eStep = eStep;
window.salvarEmpresa = salvarEmpresa;
window.renderEmpresas = renderEmpresas;
window.buscarDonoEmp = buscarDonoEmp;
window.selecionarDonoEmp = selecionarDonoEmp;
window.updateOfertaPreview = updateOfertaPreview;
window.addSlot = addSlot;
window.removeSlot = removeSlot;
window.addHHSlot = addHHSlot;
window.removeHHSlot = removeHHSlot;
window.toggleFechado = toggleFechado;
window.toggleHHDia = toggleHHDia;
window.updateHHDescVis = updateHHDescVis;

window.novoCliente = novoCliente;
window.abrirPerfil = abrirPerfil;
window.fecharPerfil = fecharPerfil;
window.salvarClienteInline = salvarClienteInline;
window.syncCard = syncCard;
window.toggleBloqueio = toggleBloqueio;
window.confirmarExclusao = confirmarExclusao;

window.filterSugestoes = filterSugestoes;
window.filterSolicitacoes = filterSolicitacoes;
window.openSugestaoModal = openSugestaoModal;
window.sgStep = sgStep;
window.toggleSugStatus = toggleSugStatus;
window.aprovarSolicitacao = aprovarSolicitacao;
window.recusarSolicitacao = recusarSolicitacao;
window.aprovarEmpresaPendente = aprovarEmpresaPendente;
window.recusarEmpresaPendente = recusarEmpresaPendente;
window.aprovarSugestaoRapido = aprovarSugestaoRapido;
window.recusarSugestaoRapido = recusarSugestaoRapido;
window.aprovarSugestaoRapido = aprovarSugestaoRapido;
window.recusarSugestaoRapido = recusarSugestaoRapido;

window.exportarJSON = exportarJSON;
window.importarJSON = importarJSON;
window.verificarBanco = verificarBanco;
window.limparTudo = limparTudo;

window.loadAdminProfile = loadAdminProfile;
window.syncAdminCard = syncAdminCard;
window.adminPStep = adminPStep;
window.salvarAdminProfile = salvarAdminProfile;
window.alterarSenhaAdmin = alterarSenhaAdmin;
window.deletarAdmin = deletarAdmin;

// App
window.registrarUsuario = registrarUsuario;
window.renderHome = renderHome;
window.renderOfertas = renderOfertas;
window.setOfertaFiltro = setOfertaFiltro;
window.setCatFiltro = setCatFiltro;
window.setCatFiltroMob = setCatFiltroMob;

// Inicializa dropdown mobile com "bar" selecionado
document.addEventListener('DOMContentLoaded', function() {
  const dd = document.getElementById('cat-dropdown-mob');
  if (dd) { dd.value = 'bar'; setCatFiltroMob('bar'); }
});
window.limparBuscaOfertas = limparBuscaOfertas;
window.irParaNegocio = irParaNegocio;
window.abrirCadastroComoNegocio = abrirCadastroComoNegocio;
window.openSugestaoModalApp = openSugestaoModalApp;
window.renderSugestoesApp = renderSugestoesApp;
window.sStep = sStep;
window.enviarSugestao = enviarSugestao;
window.openNegocioModal = openNegocioModal;
window.nStep = nStep;
window.salvarNegocio = salvarNegocio;
window.openNegDrawer = openNegDrawer;
window.closeNegDrawer = closeNegDrawer;
window.renderPerfil = renderPerfil;
window.atualizarCard = atualizarCard;
window.pStep = pStep;
window.salvarPerfil = salvarPerfil;
window.alterarSenhaUsuario = alterarSenhaUsuario;
window.deletarContaUsuario = deletarContaUsuario;

// Validação compartilhada (também usada em acessos.html via scripts.js)
window.requireAuth        = requireAuth;
window.isValidEmail       = isValidEmail;
window.hashSenha          = hashSenha;
window.maskNome           = maskNome;
window.validarNomeBlur    = validarNomeBlur;
window.isValidDateStrict  = isValidDateStrict;
window.dateErrorMsg       = dateErrorMsg;
window.maskDateStrict     = maskDateStrict;
window.validarDataBlur    = validarDataBlur;
window.validarTelBlur     = validarTelBlur;
window.buscarCEP          = buscarCEP;
window.DDDS_VALIDOS       = DDDS_VALIDOS;