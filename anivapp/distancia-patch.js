/**
 * distancia-patch.js — AnivApp v2
 * - Endereço completo no card: "📍 12 km · Av. T-7, 921, St. Bueno, Goiânia, GO"
 * - Verde quando distância disponível, cinza quando não
 * - Barra de filtro por raio (Todos / 5 km / 15 km / 30 km / 50 km)
 * - Banner de status GPS
 * Carregado APÓS scripts.js, sem alterar os originais.
 */
(function () {
  'use strict';

  const NOMINATIM   = 'https://nominatim.openstreetmap.org/search';
  const GEO_CACHE_K = 'anivcrm_geocache_v2';
  const STORAGE_KEY = 'anivcrm_v2';

  const UFS_BRASIL = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins'
  };

  // Cache geocodificação
  let _geo = {};
  try { _geo = JSON.parse(localStorage.getItem(GEO_CACHE_K) || '{}'); } catch (_) {}
  function saveGeoCache() {
    try { localStorage.setItem(GEO_CACHE_K, JSON.stringify(_geo)); } catch (_) {}
  }

  // Estado global
  window.userLat      = null;
  window.userLng      = null;
  window.distCache    = {};
  window.raioKm       = 30;
  window.estadoFiltro = null;
  window.estadoFiltroInit = false;

  let _gpsAtivo       = false;
  let _geoFallback    = false;
  let _geoInitDone    = false;
  let _geoInitPromise = null;

  // Haversine
  function haversine(lat1, lng1, lat2, lng2) {
    const R  = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dN = (lng2 - lng1) * Math.PI / 180;
    const a  = Math.sin(dL / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dN / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Geocodificação via Nominatim
  async function geocode(query) {
    const key = query.trim().toLowerCase();
    if (_geo[key]) return _geo[key];
    try {
      const url = NOMINATIM + '?q=' + encodeURIComponent(query) + '&format=json&limit=1&countrycodes=br';
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
      const arr = await res.json();
      if (!arr.length) return null;
      const r = { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
      _geo[key] = r;
      saveGeoCache();
      return r;
    } catch (_) { return null; }
  }

  // Monta query de geocodificação
  function buildQuery(obj) {
    const cep = (obj.cep || '').replace(/\D/g, '');
    if (cep.length >= 8) return cep;
    const parts = [obj.rua, obj.num, obj.bairro, obj.cidade, obj.uf].filter(Boolean);
    if (parts.length >= 2) return parts.join(', ') + ', Brasil';
    const cidade = [obj.cidade, obj.uf].filter(Boolean).join(', ');
    return cidade ? cidade + ', Brasil' : null;
  }

  // Endereço formatado para o card: "Rua X, 123, Bairro, Cidade, UF"
  function formatAddr(e) {
    const parts = [];
    if (e.rua)    parts.push(e.rua + (e.num ? ', ' + e.num : ''));
    if (e.bairro) parts.push(e.bairro);
    if (e.cidade) parts.push(e.cidade);
    if (e.uf)     parts.push(e.uf);
    return parts.join(', ') || 'Endereço não informado';
  }

  // Distância formatada
  function fmtDist(km) {
    return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km';
  }

  // Coordenadas de empresa (com cache)
  async function coordsEmpresa(e) {
    const ck = e.negocio || e.empresa;
    if (window.distCache[ck]) return window.distCache[ck];
    const q = buildQuery(e);
    if (!q) return null;
    const r = await geocode(q);
    if (r) window.distCache[ck] = r;
    return r;
  }

  // Obtém localização do usuário
  function initGeo() {
    if (_geoInitPromise) return _geoInitPromise;
    _geoInitPromise = (async () => {
      // 1. GPS nativo
      const gps = await new Promise(res => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          ()  => res(null),
          { timeout: 8000, maximumAge: 60000 }
        );
      });
      if (gps) {
        window.userLat = gps.lat;
        window.userLng = gps.lng;
        _gpsAtivo    = true;
        _geoInitDone = true;
        return;
      }
      // 2. Endereço do usuário logado
      const u = window.currentUser;
      if (u) {
        const queries = [buildQuery(u), ([u.cidade, u.uf].filter(Boolean).join(', ') || null)];
        for (const q of queries) {
          if (!q) continue;
          const r = await geocode(q);
          if (r) {
            window.userLat = r.lat;
            window.userLng = r.lng;
            _geoFallback = true;
            _geoInitDone = true;
            return;
          }
        }
      }
      _geoInitDone = true;
    })();
    return _geoInitPromise;
  }

  // ════════════════════════════════════════════════════════════
  // OVERRIDE renderOfertas
  // ════════════════════════════════════════════════════════════
  const _renderOrig = window.renderOfertas;

  window.renderOfertas = function () {
    garantirFiltroRaio();
    _renderOrig();              // render base síncrono
    atualizarBanner();
    initGeo().then(() => {
      atualizarBanner();
      enriquecerCards();
    });
  };

  // Enriquece todos os cards com endereço completo + distância
  async function enriquecerCards() {
    const grid = document.getElementById('ofertas-grid');
    if (!grid) return;

    const db     = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"empresas":[]}');
    const empMap = {};
    (db.empresas || []).forEach(e => { if (e.negocio) empMap[e.negocio] = e; });

    const cards = Array.from(grid.querySelectorAll('.oferta-card'));
    if (!cards.length) return;

    // Coleta empresas únicas dos cards
    const empresasCards = cards.map(card => {
      const neg = extrairNegocio(card);
      return neg ? empMap[neg] : null;
    });

    // Pré-calcula distâncias em paralelo
    const distMap = {};
    if (window.userLat) {
      const uniq = [...new Map(
        empresasCards.filter(Boolean).map(e => [e.negocio, e])
      ).values()];
      const chunks = [];
      for (let i = 0; i < uniq.length; i += 6) chunks.push(uniq.slice(i, i + 6));
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async e => {
          const c = await coordsEmpresa(e);
          if (c) distMap[e.negocio] = haversine(window.userLat, window.userLng, c.lat, c.lng);
        }));
      }
    }

    // Aplica filtro de raio + atualiza linha 📍
    let visiveis = 0;
    cards.forEach((card, i) => {
      const emp = empresasCards[i];
      if (!emp) return;

      const km = distMap[emp.negocio];

      // Filtro de raio
      if (window.raioKm > 0 && km !== undefined && km > window.raioKm) {
        card.style.display = 'none';
        return;
      }
      
      // Filtro de Estado (TRAVA DE SEGURANÇA SEMPRE ATIVA)
      if (window.estadoFiltro && window.estadoFiltro !== 'BR') {
        if (emp.uf !== window.estadoFiltro) {
          card.style.display = 'none';
          return;
        }
      }

      card.style.display = '';
      visiveis++;

      // Atualiza linha 📍 com endereço completo + distância
      atualizarLinhaEndereco(card, emp, km);
    });

    // Label de contagem
    if (window.raioKm > 0) {
      const label = document.getElementById('ofertas-label');
      if (label) label.textContent = visiveis + ' local(is)';
      const empty = document.getElementById('ofertas-empty');
      if (visiveis === 0 && cards.length) empty?.classList.remove('hidden');
    }
  }

  // Extrai id de negócio do onclick do card
  function extrairNegocio(card) {
    if (card.dataset.negocio) return card.dataset.negocio;
    const oc = card.getAttribute('onclick') || '';
    const m  = oc.match(/openNegDrawer\(['"][^'"]+['"],\s*['"]([^'"]+)['"]\)/);
    return m ? m[1] : null;
  }

  // Atualiza a linha 📍 do card
  function atualizarLinhaEndereco(card, emp, km) {
    // Encontra o <p> com 📍 (criado pelo scripts.js original)
    let p = card.querySelector('p.dist-linha');
    if (!p) {
      p = Array.from(card.querySelectorAll('p')).find(el => el.textContent.trim().startsWith('📍'));
      if (p) p.classList.add('dist-linha');
    }
    if (!p) return;

    const addr = formatAddr(emp);

    if (km !== undefined) {
      // Verde: distância + endereço completo
      p.className = 'dist-linha text-xs mt-1 truncate';
      p.style.cssText = 'color:#059669;font-weight:600;';
      p.innerHTML = '📍 <span style="color:#059669;font-weight:700;">' + fmtDist(km)
                  + '</span> · <span style="color:#6b7280;font-weight:400;">' + addr + '</span>';
    } else {
      // Cinza: só endereço completo
      p.className = 'dist-linha text-xs mt-1 truncate';
      p.style.cssText = '';
      p.innerHTML = '📍 <span style="color:#9ca3af;">' + addr + '</span>';
    }
  }

  // Banner de status
  function atualizarBanner() {
    let el = document.getElementById('dist-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dist-banner';
      el.style.display = 'none';
      const grid = document.getElementById('ofertas-grid');
      if (grid) grid.parentNode.insertBefore(el, grid);
    }
  }

  // Ativar GPS manualmente
  window._distAtivarGPS = async function () {
    window.userLat   = null;
    window.userLng   = null;
    window.distCache = {};
    _gpsAtivo        = false;
    _geoFallback     = false;
    _geoInitDone     = false;
    _geoInitPromise  = null;
    window.renderOfertas();
  };

  // Helper para ler a UF do usuário logado diretamente do banco local
  function getLogadoUf() {
    try {
      const db = JSON.parse(localStorage.getItem('anivcrm_v2') || '{"clientes":[]}');
      const uid = localStorage.getItem('anivcrm_logged_user');
      const c = db.clientes.find(x => x.usuario === uid);
      return c ? c.uf : null;
    } catch(e) {
      return null;
    }
  }

  // Barra filtro de raio
  function garantirFiltroRaio() {
    const ext = document.getElementById('raio-filtro-bar');
    if (ext) ext.remove();

    const bar = document.createElement('div');
    bar.id = 'raio-filtro-bar';
    bar.style.cssText = 'margin-bottom:12px;width:100%;';
    
    if (!window.estadoFiltroInit) {
      const ufAt = getLogadoUf();
      if (ufAt) {
        window.estadoFiltro = ufAt;
        window.estadoFiltroInit = true;
      } else {
        window.estadoFiltro = 'BR';
      }
    }
    
    const distOpts = [
      { v: 0,  l: '🗺️ Todos' },
      { v: 15, l: '📍 15 km' },
      { v: 30, l: '📍 30 km' }
    ];

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px;flex-wrap:nowrap;align-items:center;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:2px;';
    btnGroup.className = 'no-scrollbar'; // Classe utilitária se existir, mas o cssText já resolve o básico

    // 1) Select de Estado
    const wrapState = document.createElement('div');
    // Usando flex-shrink:0 e min-width para garantir que o estado apareça bem na linha única
    wrapState.style.cssText = 'position:relative; flex-shrink:0; width:110px;';
    
    const selState = document.createElement('select');
    selState.style.cssText = 'width:100%;height:36px;border-radius:12px;border:1.5px solid #e2e8f0;padding:0 24px 0 10px;font-size:13px;font-weight:600;background:#fff;appearance:none;cursor:pointer;color:#334155;font-family:Inter,sans-serif;';
    
    const optBr = document.createElement('option');
    optBr.value = 'BR';
    optBr.textContent = '🗺️ Todos';
    selState.appendChild(optBr);

    for (const uf in UFS_BRASIL) {
        const o = document.createElement('option');
        o.value = uf;
        o.textContent = `🗺️ ${uf}`;
        selState.appendChild(o);
    }
    selState.value = window.estadoFiltro || 'BR';

    const arrowS = document.createElement('span');
    arrowS.textContent = '▼';
    arrowS.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:9px;color:#94a3b8;pointer-events:none;';

    selState.addEventListener('change', function() {
        window.estadoFiltroInit = true;
        window.estadoFiltro = selState.value;
        // Ao mudar de Estado ou para Brasil, a distância muda automaticamente para "Todos" (raio 0)
        // para que a pessoa consiga enxergar todos os locais daquele estado remoto ou do país.
        window.raioKm = 0;
        window.renderOfertas();
    });

    wrapState.appendChild(selState);
    wrapState.appendChild(arrowS);
    btnGroup.appendChild(wrapState);

    // 2) Grupo de Botões de Distância
    distOpts.forEach(function(opt) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent  = opt.l;
      btn.dataset.raio = opt.v;
      btn.className    = 'oferta-filtro-btn shrink-0';
      if (opt.v === window.raioKm) {
        btn.classList.add('text-white');
        btn.style.background = 'linear-gradient(90deg,#1d4ed8,#2563eb)';
      }
      btn.addEventListener('click', function() {
        window.raioKm = opt.v;
        window.renderOfertas();
      });
      btnGroup.appendChild(btn);
    });

    bar.appendChild(btnGroup);

    // Mudar ponto de inserção para o topo dos filtros de forma responsiva
    const mobSection = document.querySelector('.md\\:hidden.flex.flex-col.gap-2.mb-3');
    const dskSection = document.querySelector('.hidden.md\\:block');
    
    if (window.innerWidth < 768 && mobSection) {
      mobSection.prepend(bar);
    } else if (dskSection) {
      bar.style.marginBottom = '8px'; // Margem extra no desktop
      dskSection.prepend(bar);
    } else {
      const label = document.getElementById('ofertas-label');
      if (label) label.parentNode.insertBefore(bar, label);
    }
  }

  // Hook gotoScreen
  const _origGoto = window.gotoScreen;
  if (typeof _origGoto === 'function') {
    window.gotoScreen = function(screen, btn) {
      _origGoto(screen, btn);
      if (screen === 'ofertas') {
        initGeo().then(function() { atualizarBanner(); enriquecerCards(); });
      }
    };
  }

  // Hook openNegDrawer para enriquecer o drawer com a distância
  const _origOpenDrawer = window.openNegDrawer;
  if (typeof _origOpenDrawer === 'function') {
    window.openNegDrawer = function(tipo, id) {
      _origOpenDrawer(tipo, id); 

      const distWrapper = document.getElementById('neg-drawer-dist-wrapper');
      const distEl      = document.getElementById('neg-drawer-dist');
      const dotEl       = document.getElementById('neg-drawer-dot');
      
      if (!distEl) return;

      // Estado inicial controlado (reseta estados anteriores)
      distEl.textContent = '';
      if (distWrapper) distWrapper.style.display = 'none';
      if (dotEl)       dotEl.style.display       = 'none';

      if (!window.userLat) return;

      const db = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"empresas":[]}');
      const data = db.empresas.find(e => e.negocio === id || e.sugestao === id);
      if (!data) return;

      coordsEmpresa(data).then(coords => {
        if (coords) {
          const km = haversine(window.userLat, window.userLng, coords.lat, coords.lng);
          distEl.textContent = fmtDist(km);
          distEl.style.color = '#16a34a';
          distEl.style.fontWeight = '700';
          if (distWrapper) distWrapper.style.display = 'flex';
          if (dotEl)       dotEl.style.display       = 'inline';
        }
      });
    };
  }

  // Observa mudanças no grid
  function observarGrid() {
    const grid = document.getElementById('ofertas-grid');
    if (!grid) return;
    let _t = null;
    new MutationObserver(function() {
      clearTimeout(_t);
      _t = setTimeout(function() { if (_geoInitDone) enriquecerCards(); }, 80);
    }).observe(grid, { childList: true });
  }

  // Boot
  function boot() {
    observarGrid();
    setTimeout(function() {
      initGeo().then(function() { 
        if (!window.estadoFiltroInit && window.currentUser && window.currentUser.uf) {
           window.estadoFiltro = window.currentUser.uf;
           window.estadoFiltroInit = true;
        }
        garantirFiltroRaio(); // Força atualização visual da barra de filtro
        atualizarBanner(); 
        enriquecerCards(); 
      });
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
