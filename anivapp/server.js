'use strict';
const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, 'dados.db');
let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  console.log(`[DB] Conectado: ${dbPath}`);
} catch (err) {
  console.error('[DB] Erro:', err.message);
  process.exit(1);
}

// Schema Completo
db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      usuario TEXT PRIMARY KEY, master TEXT, negocio TEXT, sugestao TEXT, nome TEXT, nasc TEXT,
      telefone TEXT, email TEXT, senha_hash TEXT, cep TEXT, rua TEXT, num TEXT, comp TEXT,
      bairro TEXT, cidade TEXT, uf TEXT, status TEXT DEFAULT 'ativo', perfil_id TEXT,
      oferta_enviada INTEGER DEFAULT 0, enviado_em TEXT, criado_em TEXT
    );
    CREATE TABLE IF NOT EXISTS empresas (
      negocio TEXT PRIMARY KEY, master TEXT, usuario TEXT DEFAULT '', is_sugestao INTEGER DEFAULT 0,
      indicado_por TEXT, sugestao TEXT, origem_sug_id TEXT, status_conta TEXT DEFAULT 'ativa',
      empresa TEXT, segmento TEXT, telefone TEXT, email TEXT, ig TEXT,
      site TEXT, cardapio TEXT, rua TEXT, num TEXT, comp TEXT, bairro TEXT, cep TEXT, cidade TEXT, uf TEXT,
      lat REAL, lng REAL, obs TEXT, oferta_tipo TEXT, oferta_valida TEXT, oferta_destaque TEXT,
      oferta_detalhe TEXT, oferta_regras TEXT, hh_desc TEXT, horarios TEXT,
      estacionamento INTEGER DEFAULT 0, brinquedoteca INTEGER DEFAULT 0,
      comida_vegana INTEGER DEFAULT 0, cadeirinha INTEGER DEFAULT 0, delivery INTEGER DEFAULT 0,
      status TEXT DEFAULT '01', status_perfil TEXT DEFAULT 'comunidade',
      aprovado_em TEXT, atualizado_em TEXT, criado_em TEXT
    );
`);

// ── Migração automática — garante que todas as colunas existam em bancos antigos ──
// Se uma coluna já existe o erro "duplicate column" é silenciado.
const empresasCols = [
  'sugestao TEXT', 'origem_sug_id TEXT', 'status_conta TEXT'
];
const clientesCols = [
  // coloque aqui futuras colunas novas de clientes
];

function migrateColumns(table, colDefs) {
  colDefs.forEach(colDef => {
    const col = colDef.split(' ')[0];
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${colDef}`).run();
      console.log(`[DB] Migração: ${table}.${col} adicionada`);
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.warn(`[DB] ALTER ${table}.${col}:`, e.message);
      }
    }
  });
}

migrateColumns('empresas', empresasCols);
migrateColumns('clientes', clientesCols);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const all = (sql, p = []) => db.prepare(sql).all(...p);
const one = (sql, p = []) => db.prepare(sql).get(...p);
const run = (sql, p = []) => db.prepare(sql).run(...p);

/**
 * Converte qualquer valor para um tipo aceito pelo SQLite3:
 *   boolean   → 0 / 1
 *   object    → JSON string (ex: array de horários que escapou)
 *   undefined → null
 *   o resto   → inalterado (number, string, bigint, buffer, null)
 */
function sanitize(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) {
      out[k] = null;
    } else if (typeof v === 'boolean') {
      out[k] = v ? 1 : 0;
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function insertRow(table, rawObj) {
  const obj = sanitize(rawObj);
  const keys = Object.keys(obj);
  run(
    `INSERT OR REPLACE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    Object.values(obj)
  );
}

function updateRow(table, pkField, pkValue, rawObj) {
  const obj = sanitize(rawObj);
  // Remove a PK do SET para não tentar sobrescrever
  const entries = Object.entries(obj).filter(([k]) => k !== pkField);
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  run(`UPDATE ${table} SET ${sets} WHERE ${pkField} = ?`, [...vals, pkValue]);
}

// ── Stats para o Launcher ──────────────────────────────────────────
app.get('/api/stats', (_, res) => {
  try {
    const c = one('SELECT count(*) as count FROM clientes').count;
    const e = one('SELECT count(*) as count FROM empresas WHERE is_sugestao = 0').count;
    const s = one('SELECT count(*) as count FROM empresas WHERE is_sugestao = 1').count;
    res.json({ clientes: c, empresas: e, sugestoes: s });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Bulk Export/Import ─────────────────────────────────────────────
app.get('/api/bulk-export', (_, res) => {
  try {
    res.json({
      clientes: all('SELECT * FROM clientes'),
      empresas: all('SELECT * FROM empresas')
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bulk-import', (req, res) => {
  const { clientes, empresas } = req.body;
  try {
    db.transaction(() => {
      run('DELETE FROM clientes');
      run('DELETE FROM empresas');
      if (Array.isArray(clientes)) clientes.forEach(c => insertRow('clientes', c));
      if (Array.isArray(empresas)) empresas.forEach(e => insertRow('empresas', e));
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('[bulk-import] erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CRUD Clientes ──────────────────────────────────────────────────
app.get('/api/clientes', (_, res) => {
  try { res.json(all('SELECT * FROM clientes ORDER BY nome')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/clientes/:id', (req, res) => {
  try { res.json(one('SELECT * FROM clientes WHERE usuario=?', [req.params.id]) || {}); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', (req, res) => {
  try {
    insertRow('clientes', req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/clientes] erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clientes/:id', (req, res) => {
  try {
    const exists = one('SELECT 1 FROM clientes WHERE usuario=?', [req.params.id]);
    if (!exists) {
      insertRow('clientes', { ...req.body, usuario: req.params.id });
    } else {
      updateRow('clientes', 'usuario', req.params.id, req.body);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/clientes] erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clientes/:id', (req, res) => {
  try {
    run('DELETE FROM clientes WHERE usuario=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CRUD Empresas ──────────────────────────────────────────────────
app.get('/api/empresas', (_, res) => {
  try { res.json(all('SELECT * FROM empresas ORDER BY empresa')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/empresas/:id', (req, res) => {
  try { res.json(one('SELECT * FROM empresas WHERE negocio=?', [req.params.id]) || {}); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/empresas', (req, res) => {
  try {
    insertRow('empresas', req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/empresas] erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/empresas/:id', (req, res) => {
  try {
    const exists = one('SELECT 1 FROM empresas WHERE negocio=?', [req.params.id]);
    if (!exists) {
      insertRow('empresas', { ...req.body, negocio: req.params.id });
    } else {
      updateRow('empresas', 'negocio', req.params.id, req.body);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/empresas] erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/empresas/:id', (req, res) => {
  try {
    run('DELETE FROM empresas WHERE negocio=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Reset ──────────────────────────────────────────────────────────
app.post('/api/reset', (_, res) => {
  try {
    db.transaction(() => { run('DELETE FROM clientes'); run('DELETE FROM empresas'); })();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Páginas ────────────────────────────────────────────────────────
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'perfil.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/launcher', (_, res) => res.sendFile(path.join(__dirname, 'launcher.html')));

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));