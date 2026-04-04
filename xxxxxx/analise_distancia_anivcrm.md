# Analise Completa: Sistema de Distancia Ponto A a Ponto B — AnivCRM / AnivApp

---

## 1. Visao Geral do Sistema

O **AnivCRM** e um CRM de aniversarios composto por dois modulos HTML standalone (sem backend — tudo roda no navegador com `localStorage`):

| Arquivo | Papel | Usa distancia? |
|---|---|---|
| `cliente_admin.html` | Painel administrativo (gerencia empresas, clientes, ofertas) | Nao diretamente |
| `cliente_perfil.html` | Area do cliente/usuario final (descobre ofertas proximas) | **SIM — todo o motor de distancia esta aqui** |

O calculo de distancia e usado para mostrar ao usuario quais empresas/restaurantes estao perto dele, ordenando por proximidade e filtrando por raio em km.

---

## 2. Como Funciona o Calculo de Distancia — Passo a Passo

### 2.1 Obtencao do Ponto A (Localizacao do Usuario)

O sistema usa **3 estrategias em cascata** para obter a posicao do usuario:

#### Estrategia 1: GPS do Navegador (mais precisa)
```javascript
navigator.geolocation.getCurrentPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    userCityMode = false;  // indica que e GPS real
}, errorCallback, { timeout: 8000, maximumAge: 300000 });
```
- Usa a API nativa `navigator.geolocation`
- Timeout de 8 segundos
- Cache de 5 minutos (`maximumAge: 300000ms`)
- Se funcionar, marca `userCityMode = false` (alta precisao)

#### Estrategia 2: Geocodificacao por Endereco Cadastrado (fallback)
Se o GPS falhar ou for negado, o sistema usa o endereco que o usuario cadastrou no perfil:

```javascript
async function resolverLocalizacaoUsuario() {
    if (userLat !== null) return;  // ja tem posicao
    const cidade = currentUser && currentUser.cidade;
    const uf = currentUser && currentUser.uf;
    const cep = currentUser && currentUser.cep ? currentUser.cep.replace(/\D/g, '') : '';

    const tentativas = [];
    if (cep.length === 8) tentativas.push(cep);
    if (cidade && uf) tentativas.push(cidade + ', ' + uf + ', Brasil');
    if (cidade) tentativas.push(cidade + ', Brasil');

    // Tenta cada query na API Nominatim (OpenStreetMap)
    for (const q of tentativas) {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=br&q=${encodeURIComponent(q)}`,
            { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
        );
        const data = await res.json();
        if (data && data.length) {
            const best = data.reduce((a, b) =>
                parseFloat(b.importance) > parseFloat(a.importance) ? b : a
            );
            userLat = parseFloat(best.lat);
            userLng = parseFloat(best.lon);
            userCityMode = true;  // precisao menor (nivel cidade)
            return;
        }
    }
}
```
- Usa a API **Nominatim (OpenStreetMap)** — gratuita, sem chave de API
- Tenta primeiro pelo CEP, depois cidade+UF, depois so cidade
- Escolhe o resultado com maior `importance` (relevancia)
- Marca `userCityMode = true` (precisao de nivel de cidade)

#### Estrategia 3: Sem localizacao
Se nenhuma funcionar, `userLat` permanece `null` e as distancias nao sao calculadas.

### 2.2 Obtencao do Ponto B (Localizacao da Empresa)

A funcao `geocodeEmpresa()` obtem as coordenadas de cada empresa:

```javascript
async function geocodeEmpresa(e) {
    // Se ja tem lat/lng armazenados, retorna direto
    if (e.lat && e.lng) return { lat: e.lat, lng: e.lng };

    const tentativas = [];
    if (cep.length === 8) tentativas.push(cep);
    if (e.rua && e.cidade && e.uf)
        tentativas.push([e.rua + (e.num ? ' ' + e.num : ''), e.cidade, e.uf].join(', '));
    if (e.bairro && e.cidade && e.uf)
        tentativas.push([e.bairro, e.cidade, e.uf].join(', '));
    if (e.cidade && e.uf) tentativas.push(e.cidade + ', ' + e.uf + ', Brasil');
    if (e.cidade) tentativas.push(e.cidade + ', Brasil');

    // Mesma logica: tenta Nominatim com cada query
    for (const q of tentativas) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?...&q=${encodeURIComponent(q)}`);
        // ...retorna coordenadas do melhor resultado
    }
    return null;
}
```

**Ordem de tentativa (do mais preciso ao menos):**
1. CEP da empresa
2. Rua + numero + cidade + UF
3. Bairro + cidade + UF
4. Cidade + UF
5. So cidade

### 2.3 Calculo da Distancia — Formula de Haversine

A funcao central que calcula a distancia entre dois pontos no planeta:

```javascript
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;  // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180)
            * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

**O que e a Formula de Haversine?**
- Calcula a distancia em **linha reta** (geodesica) entre dois pontos na superficie de uma esfera
- Usa o raio da Terra (6.371 km)
- Retorna a distancia em **quilometros**
- Precisao: excelente para distancias curtas/medias (erro < 0.5%)
- **NAO** calcula rota de estrada — e distancia "em linha reta"

### 2.4 Funcao de Calculo de Distancia por Empresa

```javascript
async function calcDistEmpresa(e) {
    if (!userLat || !userLng) return null;       // sem posicao do usuario
    if (distCache[e.id] !== undefined) return distCache[e.id];  // cache
    const coords = await geocodeEmpresa(e);
    if (!coords) { distCache[e.id] = null; return null; }
    const d = haversine(userLat, userLng, coords.lat, coords.lng);
    distCache[e.id] = Math.round(d * 10) / 10;  // arredonda 1 casa decimal
    return distCache[e.id];
}
```

### 2.5 Formatacao da Distancia para Exibicao

```javascript
function fmtDist(d) {
    if (d === null || d === undefined) return '';
    if (d < 1) return Math.round(d * 1000) + ' m';    // Ex: 800 m
    return d.toFixed(1).replace('.', ',') + ' km';      // Ex: 3,2 km
}
```
- Menos de 1 km: mostra em metros (ex: "800 m")
- 1 km ou mais: mostra em km com 1 decimal (ex: "12,5 km")

---

## 3. Sistema de Filtro por Raio

### 3.1 Interface do Filtro

O usuario pode escolher o raio de busca atraves de um dropdown:

| Opcao | Valor | Descricao |
|---|---|---|
| Todos | 0 km | Sem filtro de distancia |
| Bem perto | 5 km | |
| Proximo | 15 km | |
| **Padrao** | **30 km** | Valor inicial |
| Regiao | 50 km | |
| Personalizado | N km | Campo numerico livre |

### 3.2 Logica de Filtragem

```javascript
// Dentro de renderOfertas():
if (raioKm > 0)
    list = list.filter(e =>
        distMap[e.id] === null  // se nao calculou distancia, inclui
        || distMap[e.id] <= raioKm  // se esta dentro do raio
    );
```

**Regra importante:** empresas sem coordenadas (distancia `null`) **NAO sao excluidas** — elas aparecem mesmo com filtro ativo, pois a falta de localizacao nao deve penalizar a empresa.

### 3.3 Ordenacao (Scoring)

```javascript
const score = e => {
    let s = 0;
    if (comHHHoje(e)) s += 100;           // Happy Hour hoje: +100
    if (e.status_perfil === 'verificado') s += 10;  // Perfil verificado: +10
    const d = distMap[e.id];
    if (d !== null && d !== undefined)
        s += Math.max(0, 50 - d);          // Mais perto = mais pontos (max +50)
    return s;
};
list.sort((a, b) => score(b) - score(a));
```

A pontuacao combina:
1. **Proximidade** (0 a 50 pontos — inversamente proporcional a distancia)
2. **Happy Hour ativo hoje** (+100 pontos)
3. **Perfil verificado** (+10 pontos)

---

## 4. Sistema de Cache (Performance)

O sistema usa **3 niveis de cache** para evitar chamadas repetidas a API:

| Cache | Onde | O que armazena | Duracao |
|---|---|---|---|
| `geoCache` | Variavel JS (memoria) | Coordenadas geocodificadas | Sessao atual |
| `localStorage` | Navegador | Coordenadas geocodificadas | Permanente (ate limpar dados) |
| `distCache` | Variavel JS (memoria) | Distancias calculadas | Sessao atual |

**Fluxo de cache:**
1. Verifica `geoCache` (memoria) → se tem, usa
2. Verifica `localStorage` → se tem, usa e popula `geoCache`
3. Faz request a Nominatim → salva em ambos os caches

---

## 5. Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| **HTML5 Geolocation API** | Obter GPS do usuario |
| **Nominatim (OpenStreetMap)** | Geocodificacao (endereco → lat/lng) — API gratuita |
| **Formula de Haversine** | Calculo matematico da distancia |
| **ViaCEP API** | Autopreenchimento de endereco por CEP |
| **localStorage** | Armazenamento de dados e cache |
| **Tailwind CSS (CDN)** | Estilizacao da interface |
| **JavaScript Vanilla** | Toda a logica — sem frameworks |

---

## 6. Regras Reutilizaveis — Como Aplicar em Outro Programa

### REGRA 1: Obter Coordenadas do Ponto A (Usuario)

```javascript
// 1. Tente GPS primeiro (mais preciso)
function obterLocalizacao() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                precisao: 'gps'
            }),
            err => reject(err),
            { timeout: 10000, maximumAge: 300000 }
        );
    });
}

// 2. Fallback: geocodificar endereco cadastrado
async function geocodificarEndereco(endereco) {
    // endereco = "Rua X, 123, Goiania, GO"
    const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(endereco)}`
    );
    const data = await res.json();
    if (data.length) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), precisao: 'endereco' };
    }
    return null;
}
```

### REGRA 2: Formula de Haversine (copiar e colar)

```javascript
/**
 * Calcula distancia em km entre dois pontos (lat/lng)
 * @param {number} lat1 - Latitude do ponto A
 * @param {number} lng1 - Longitude do ponto A
 * @param {number} lat2 - Latitude do ponto B
 * @param {number} lng2 - Longitude do ponto B
 * @returns {number} Distancia em quilometros
 */
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180)
            * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### REGRA 3: Filtro por Raio

```javascript
function filtrarPorRaio(itens, userLat, userLng, raioKm) {
    return itens.filter(item => {
        if (!item.lat || !item.lng) return true; // sem coordenada = inclui
        const dist = haversine(userLat, userLng, item.lat, item.lng);
        item._distancia = Math.round(dist * 10) / 10;
        return raioKm === 0 || dist <= raioKm;
    });
}
```

### REGRA 4: Formatacao Amigavel

```javascript
function formatarDistancia(km) {
    if (km === null || km === undefined) return 'Distancia indisponivel';
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1).replace('.', ',') + ' km';
}
```

### REGRA 5: Cache Inteligente

```javascript
const cacheGeo = {};

async function geocodeComCache(chave, queryFn) {
    // 1. Memoria
    if (cacheGeo[chave]) return cacheGeo[chave];

    // 2. localStorage
    try {
        const stored = JSON.parse(localStorage.getItem('geo_' + chave));
        if (stored) { cacheGeo[chave] = stored; return stored; }
    } catch {}

    // 3. API
    const coords = await queryFn();
    if (coords) {
        cacheGeo[chave] = coords;
        try { localStorage.setItem('geo_' + chave, JSON.stringify(coords)); } catch {}
    }
    return coords;
}
```

### REGRA 6: Ordenacao por Proximidade + Relevancia

```javascript
function calcularScore(item, distancia) {
    let score = 0;
    // Proximidade: quanto mais perto, mais pontos (max 50)
    if (distancia !== null) score += Math.max(0, 50 - distancia);
    // Adicione seus proprios criterios:
    if (item.destaque) score += 100;
    if (item.verificado) score += 10;
    return score;
}

itens.sort((a, b) => calcularScore(b, b._distancia) - calcularScore(a, a._distancia));
```

---

## 7. Exemplo Completo Minimo — Pronto para Usar

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Busca por Proximidade</title>
</head>
<body>
<h1>Locais Proximos</h1>
<select id="raio" onchange="buscar()">
    <option value="0">Todos</option>
    <option value="5">5 km</option>
    <option value="15">15 km</option>
    <option value="30" selected>30 km</option>
    <option value="50">50 km</option>
</select>
<button onclick="pedirGPS()">Usar minha localizacao</button>
<div id="resultados"></div>

<script>
let userLat = null, userLng = null;

// Seus dados (normalmente viria de API/banco)
const locais = [
    { nome: "Restaurante A", lat: -16.6869, lng: -49.2648 },
    { nome: "Bar B", lat: -16.7020, lng: -49.2550 },
    { nome: "Cafe C", lat: -16.6700, lng: -49.2400 },
];

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180)
            * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pedirGPS() {
    navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        buscar();
    });
}

function buscar() {
    const raio = parseInt(document.getElementById('raio').value);
    let resultado = locais.map(l => {
        const dist = userLat ? haversine(userLat, userLng, l.lat, l.lng) : null;
        return { ...l, distancia: dist ? Math.round(dist * 10) / 10 : null };
    });

    if (raio > 0 && userLat) {
        resultado = resultado.filter(l => l.distancia === null || l.distancia <= raio);
    }

    resultado.sort((a, b) => (a.distancia || 9999) - (b.distancia || 9999));

    document.getElementById('resultados').innerHTML = resultado.map(l =>
        `<p><strong>${l.nome}</strong> — ${l.distancia !== null ? l.distancia + ' km' : 'Distancia indisponivel'}</p>`
    ).join('');
}

buscar();
</script>
</body>
</html>
```

---

## 8. Precisao e Limitacoes

| Aspecto | Detalhe |
|---|---|
| **Formula Haversine** | Precisao excelente (erro < 0.3% para distancias ate 100 km). A Terra nao e uma esfera perfeita, mas o erro e desprezivel para uso comercial |
| **GPS do navegador** | Precisao de 5-20 metros em smartphones, 50-100m em desktops |
| **Geocodificacao por CEP** | Precisao de nivel de bairro (~1-3 km de erro) |
| **Geocodificacao por cidade** | Precisao de nivel de cidade (~5-20 km de erro, aponta para o centro) |
| **Distancia em linha reta** | NAO e distancia de estrada. Um local a 5 km em linha reta pode estar a 8 km por estrada |
| **API Nominatim** | Gratuita mas com rate limit (1 req/segundo). Para producao com muito trafego, considere usar Google Maps, Mapbox, ou hospedar sua propria instancia do Nominatim |

### Tabela de Precisao por Metodo

| Metodo | Erro tipico | Quando usar |
|---|---|---|
| GPS do navegador | 5-100m | Sempre que possivel |
| Endereco completo (rua + numero) | 50-200m | Cadastro completo |
| CEP | 1-3 km | Bom fallback |
| Cidade + UF | 5-20 km | Ultimo recurso |

---

## 9. APIs Alternativas para Producao

Se voce precisa de mais precisao ou volume:

| API | Geocodificacao | Distancia rota | Preco |
|---|---|---|---|
| **Nominatim (OSM)** | Sim | Nao | Gratuito (rate limited) |
| **Google Maps Geocoding** | Sim | Sim (Directions API) | Pago (~$5/1000 reqs) |
| **Mapbox** | Sim | Sim | Freemium (100k/mes gratis) |
| **HERE Maps** | Sim | Sim | Freemium (250k/mes gratis) |
| **OpenRouteService** | Sim | Sim | Gratuito (2500 reqs/dia) |
| **ViaCEP** | So CEP→endereco | Nao | Gratuito |

---

## 10. Checklist para Implementar em Qualquer Projeto

- [ ] **1. Definir fontes de localizacao do usuario**
  - GPS (alta precisao)
  - Endereco cadastrado → geocodificar com Nominatim ou Google
  - IP geolocation (baixa precisao, ultimo recurso)

- [ ] **2. Definir fontes de localizacao dos destinos**
  - Coordenadas pre-salvas no banco (melhor performance)
  - Geocodificacao sob demanda com cache

- [ ] **3. Implementar a formula Haversine** (copie a funcao acima)

- [ ] **4. Implementar cache**
  - Em memoria para a sessao
  - Em localStorage/banco para persistencia
  - Invalidar cache quando o endereco muda

- [ ] **5. Implementar filtro de raio**
  - Dropdown com opcoes pre-definidas
  - Campo personalizado
  - Incluir itens sem coordenadas (nao penalizar)

- [ ] **6. Implementar ordenacao**
  - Combinar proximidade com outros criterios de relevancia

- [ ] **7. Exibir distancia formatada**
  - < 1 km: mostrar em metros
  - >= 1 km: mostrar em km com 1 decimal

- [ ] **8. Feedback visual ao usuario**
  - Indicar se esta usando GPS ou endereco aproximado
  - Banner quando a localizacao e imprecisa
  - Botao para ativar GPS manualmente

---

*Documento gerado a partir da analise dos arquivos `cliente_admin.html` e `cliente_perfil.html` do sistema AnivCRM/AnivApp.*
