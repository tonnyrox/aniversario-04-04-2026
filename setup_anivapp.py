# -*- coding: utf-8 -*-
"""
setup_anivapp.py — AnivCRM
1. Cria pasta anivapp/ ao lado deste script
2. Copia os arquivos html/css/js para dentro
3. Injeta db-bridge.js antes do scripts.js no perfil.html e admin.html
4. Gera server.js e package.json
5. Roda npm install
6. Sobe o servidor
"""

import sys, shutil, subprocess, json
from pathlib import Path

BASE = Path(__file__).parent.resolve()
OUT  = BASE / "anivapp"
SEP  = "=" * 55

def step(n, t): print(f"\n{SEP}\n   PASSO {n} — {t}\n{SEP}")
def ok(m):   print(f"[OK]  {m}")
def warn(m): print(f"[!!]  {m}")
def write(p, c): p.write_text(c, encoding="utf-8")

# ── 1. Pasta ──────────────────────────────────────────────────────────────────
step(1, "Criando pasta anivapp/")
OUT.mkdir(exist_ok=True)
ok(f"Pasta: {OUT}")

# ── 2. Copiar arquivos ────────────────────────────────────────────────────────
step(2, "Copiando arquivos")
for fname in ["perfil.html","admin.html","launcher.html","styles.css","scripts.js","db-bridge.js"]:
    src = BASE / fname
    if src.exists():
        shutil.copy2(src, OUT / fname); ok(f"Copiado: {fname}")
    else:
        warn(f"Nao encontrado (pulando): {fname}")

# ── 3. Injetar db-bridge.js nos HTMLs ─────────────────────────────────────────
step(3, "Injetando db-bridge.js nos HTMLs")
TAG_INJECT  = '<script src="db-bridge.js"></script>\n'
TAG_SCRIPTS = '<script src="scripts.js">'
for fname in ["perfil.html", "admin.html"]:
    fp = OUT / fname
    if not fp.exists(): warn(f"{fname} nao encontrado"); continue
    html = fp.read_text(encoding="utf-8")
    if "db-bridge.js" in html: ok(f"{fname} ja tem db-bridge.js"); continue
    if TAG_SCRIPTS in html:
        write(fp, html.replace(TAG_SCRIPTS, TAG_INJECT + TAG_SCRIPTS))
        ok(f"db-bridge.js injetado em {fname}")
    else:
        warn(f"<script src=\"scripts.js\"> nao encontrado em {fname}")

# ── 4. package.json ───────────────────────────────────────────────────────────
step(4, "Criando package.json")
pkg = {"name":"anivapp","version":"1.0.0","main":"server.js",
       "scripts":{"start":"node server.js","dev":"npx nodemon server.js"},
       "dependencies":{"express":"^4.18.2","better-sqlite3":"^9.4.3","cors":"^2.8.5"}}
write(OUT / "package.json", json.dumps(pkg, indent=2, ensure_ascii=False))
ok("package.json criado")

# ── 5. server.js ──────────────────────────────────────────────────────────────
step(5, "Criando server.js")

server_js = r"""'use strict';
const express  = require('express');
const path     = require('path');
const cors     = require('cors');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;
const db   = new Database(path.join(__dirname, 'dados.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id             TEXT PRIMARY KEY,
    nome           TEXT DEFAULT '',
    segmento       TEXT DEFAULT '',
    tel            TEXT DEFAULT '',
    email          TEXT DEFAULT '',
    ig             TEXT DEFAULT '',
    site           TEXT DEFAULT '',
    cardapio       TEXT DEFAULT '',
    rua            TEXT DEFAULT '',
    num            TEXT DEFAULT '',
    comp           TEXT DEFAULT '',
    bairro         TEXT DEFAULT '',
    cep            TEXT DEFAULT '',
    cidade         TEXT DEFAULT '',
    uf             TEXT DEFAULT '',
    lat            REAL,
    lng            REAL,
    status         TEXT DEFAULT 'ativa',
    status_perfil  TEXT DEFAULT 'comunidade',
    dono_id        TEXT DEFAULT '',
    origem_sug_id  TEXT DEFAULT '',
    origem         TEXT DEFAULT '',
    oferta_tipo    TEXT DEFAULT '',
    oferta_val     TEXT DEFAULT '',
    oferta_desc    TEXT DEFAULT '',
    oferta_detalhe TEXT DEFAULT '',
    oferta_regras  TEXT DEFAULT '',
    hh_desc        TEXT DEFAULT '',
    horarios       TEXT,
    aprovado_em    TEXT DEFAULT '',
    criado_em      TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS clientes (
    id             TEXT PRIMARY KEY,
    nome           TEXT DEFAULT '',
    nasc           TEXT DEFAULT '',
    email          TEXT DEFAULT '',
    tel            TEXT DEFAULT '',
    emp_id         TEXT,
    rua            TEXT DEFAULT '',
    num            TEXT DEFAULT '',
    comp           TEXT DEFAULT '',
    bairro         TEXT DEFAULT '',
    cep            TEXT DEFAULT '',
    cidade         TEXT DEFAULT '',
    uf             TEXT DEFAULT '',
    oferta_enviada INTEGER DEFAULT 0,
    enviado_em     TEXT DEFAULT '',
    perfil_id      TEXT DEFAULT '',
    master_id      TEXT DEFAULT '',
    status         TEXT DEFAULT 'ativo',
    criado_em      TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sugestoes (
    id            TEXT PRIMARY KEY,
    autor_id      TEXT DEFAULT '',
    nome          TEXT DEFAULT '',
    segmento      TEXT DEFAULT '',
    tel           TEXT DEFAULT '',
    email         TEXT DEFAULT '',
    ig            TEXT DEFAULT '',
    site          TEXT DEFAULT '',
    cardapio      TEXT DEFAULT '',
    rua           TEXT DEFAULT '',
    num           TEXT DEFAULT '',
    comp          TEXT DEFAULT '',
    bairro        TEXT DEFAULT '',
    cep           TEXT DEFAULT '',
    cidade        TEXT DEFAULT '',
    uf            TEXT DEFAULT '',
    obs           TEXT DEFAULT '',
    oferta_tipo   TEXT DEFAULT '',
    oferta_val    TEXT DEFAULT '',
    oferta_desc   TEXT DEFAULT '',
    oferta_regras TEXT DEFAULT '',
    hh_desc       TEXT DEFAULT '',
    horarios      TEXT,
    status        TEXT DEFAULT 'pendente',
    is_dono       INTEGER DEFAULT 0,
    endereco      TEXT DEFAULT '',
    atualizado_em TEXT DEFAULT '',
    criado_em     TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cli_emp   ON clientes(emp_id);
  CREATE INDEX IF NOT EXISTS idx_cli_nasc  ON clientes(nasc);
  CREATE INDEX IF NOT EXISTS idx_sug_autor ON sugestoes(autor_id);
  CREATE INDEX IF NOT EXISTS idx_emp_dono  ON empresas(dono_id);
`);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const all = (sql, p=[]) => db.prepare(sql).all(...p);
const one = (sql, p=[]) => db.prepare(sql).get(...p);
const run = (sql, p=[]) => db.prepare(sql).run(...p);

// Serializa arrays/objetos para TEXT antes de gravar
function prepEmp(d) {
  return {
    ...d,
    horarios: d.horarios ? (typeof d.horarios === 'string' ? d.horarios : JSON.stringify(d.horarios)) : null,
    lat: d.lat||null, lng: d.lng||null,
    dono_id: d.dono_id||'', status: d.status||'ativa',
    status_perfil: d.status_perfil||'comunidade',
    criado_em: d.criado_em||new Date().toISOString()
  };
}
function prepSug(d) {
  return {
    ...d,
    horarios: d.horarios ? (typeof d.horarios === 'string' ? d.horarios : JSON.stringify(d.horarios)) : null,
    is_dono: d.is_dono ? 1 : 0,
    status: d.status||'pendente',
    criado_em: d.criado_em||new Date().toISOString()
  };
}
// Deserializa TEXT para array ao ler
function parseEmp(e) {
  if (!e) return e;
  try { if (e.horarios) e.horarios = JSON.parse(e.horarios); } catch {}
  return e;
}
function parseSug(s) {
  if (!s) return s;
  try { if (s.horarios) s.horarios = JSON.parse(s.horarios); } catch {}
  s.is_dono = !!s.is_dono;
  return s;
}

// ── EMPRESAS ──────────────────────────────────────────────────────────────────
app.get('/api/empresas', (_, res) =>
  res.json(all('SELECT * FROM empresas ORDER BY nome').map(parseEmp)));

app.get('/api/empresas/:id', (req, res) => {
  const r = parseEmp(one('SELECT * FROM empresas WHERE id=?', [req.params.id]));
  r ? res.json(r) : res.status(404).json({error:'nao encontrado'});
});

app.post('/api/empresas', (req, res) => {
  const d = prepEmp(req.body);
  run(`INSERT OR REPLACE INTO empresas
    (id,nome,segmento,tel,email,ig,site,cardapio,rua,num,comp,bairro,cep,cidade,uf,
     lat,lng,status,status_perfil,dono_id,origem_sug_id,origem,
     oferta_tipo,oferta_val,oferta_desc,oferta_detalhe,oferta_regras,
     hh_desc,horarios,aprovado_em,criado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id,d.nome||'',d.segmento||'',d.tel||'',d.email||'',d.ig||'',d.site||'',
     d.cardapio||'',d.rua||'',d.num||'',d.comp||'',d.bairro||'',d.cep||'',
     d.cidade||'',d.uf||'',d.lat,d.lng,d.status,d.status_perfil,d.dono_id,
     d.origem_sug_id||'',d.origem||'',d.oferta_tipo||'',d.oferta_val||'',
     d.oferta_desc||'',d.oferta_detalhe||'',d.oferta_regras||'',d.hh_desc||'',
     d.horarios,d.aprovado_em||'',d.criado_em]);
  res.json({ok:true});
});

app.put('/api/empresas/:id', (req, res) => {
  const d = prepEmp(req.body);
  run(`UPDATE empresas SET nome=?,segmento=?,tel=?,email=?,ig=?,site=?,cardapio=?,
    rua=?,num=?,comp=?,bairro=?,cep=?,cidade=?,uf=?,lat=?,lng=?,status=?,
    status_perfil=?,dono_id=?,origem_sug_id=?,origem=?,oferta_tipo=?,oferta_val=?,
    oferta_desc=?,oferta_detalhe=?,oferta_regras=?,hh_desc=?,horarios=?,aprovado_em=?
    WHERE id=?`,
    [d.nome||'',d.segmento||'',d.tel||'',d.email||'',d.ig||'',d.site||'',
     d.cardapio||'',d.rua||'',d.num||'',d.comp||'',d.bairro||'',d.cep||'',
     d.cidade||'',d.uf||'',d.lat,d.lng,d.status,d.status_perfil,d.dono_id,
     d.origem_sug_id||'',d.origem||'',d.oferta_tipo||'',d.oferta_val||'',
     d.oferta_desc||'',d.oferta_detalhe||'',d.oferta_regras||'',d.hh_desc||'',
     d.horarios,d.aprovado_em||'',req.params.id]);
  res.json({ok:true});
});

app.delete('/api/empresas/:id', (req, res) => {
  run('DELETE FROM empresas WHERE id=?', [req.params.id]);
  res.json({ok:true});
});

// ── CLIENTES ──────────────────────────────────────────────────────────────────
app.get('/api/clientes', (_, res) =>
  res.json(all('SELECT * FROM clientes ORDER BY nome')));

app.get('/api/clientes/:id', (req, res) => {
  const r = one('SELECT * FROM clientes WHERE id=?', [req.params.id]);
  r ? res.json(r) : res.status(404).json({error:'nao encontrado'});
});

app.post('/api/clientes', (req, res) => {
  const d = req.body;
  run(`INSERT OR REPLACE INTO clientes
    (id,nome,nasc,email,tel,emp_id,rua,num,comp,bairro,cep,cidade,uf,
     oferta_enviada,enviado_em,perfil_id,master_id,status,criado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id,d.nome||'',d.nasc||'',d.email||'',d.tel||'',d.emp_id||null,
     d.rua||'',d.num||'',d.comp||'',d.bairro||'',d.cep||'',d.cidade||'',d.uf||'',
     d.oferta_enviada?1:0,d.enviado_em||'',d.perfil_id||'',d.master_id||'',
     d.status||'ativo',d.criado_em||new Date().toISOString()]);
  res.json({ok:true});
});

app.put('/api/clientes/:id', (req, res) => {
  const d = req.body;
  run(`UPDATE clientes SET nome=?,nasc=?,email=?,tel=?,emp_id=?,rua=?,num=?,comp=?,
    bairro=?,cep=?,cidade=?,uf=?,oferta_enviada=?,enviado_em=?,status=? WHERE id=?`,
    [d.nome||'',d.nasc||'',d.email||'',d.tel||'',d.emp_id||null,
     d.rua||'',d.num||'',d.comp||'',d.bairro||'',d.cep||'',d.cidade||'',d.uf||'',
     d.oferta_enviada?1:0,d.enviado_em||'',d.status||'ativo',req.params.id]);
  res.json({ok:true});
});

app.delete('/api/clientes/:id', (req, res) => {
  run('DELETE FROM clientes WHERE id=?', [req.params.id]);
  res.json({ok:true});
});

// ── SUGESTOES ─────────────────────────────────────────────────────────────────
app.get('/api/sugestoes', (_, res) =>
  res.json(all('SELECT * FROM sugestoes ORDER BY criado_em DESC').map(parseSug)));

app.post('/api/sugestoes', (req, res) => {
  const d = prepSug(req.body);
  run(`INSERT OR REPLACE INTO sugestoes
    (id,autor_id,nome,segmento,tel,email,ig,site,cardapio,rua,num,comp,bairro,cep,
     cidade,uf,obs,oferta_tipo,oferta_val,oferta_desc,oferta_regras,hh_desc,
     horarios,status,is_dono,endereco,atualizado_em,criado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id,d.autor_id||'',d.nome||'',d.segmento||'',d.tel||'',d.email||'',
     d.ig||'',d.site||'',d.cardapio||'',d.rua||'',d.num||'',d.comp||'',
     d.bairro||'',d.cep||'',d.cidade||'',d.uf||'',d.obs||'',d.oferta_tipo||'',
     d.oferta_val||'',d.oferta_desc||'',d.oferta_regras||'',d.hh_desc||'',
     d.horarios,d.status,d.is_dono,d.endereco||'',d.atualizado_em||'',d.criado_em]);
  res.json({ok:true});
});

app.put('/api/sugestoes/:id', (req, res) => {
  const d = prepSug(req.body);
  run(`UPDATE sugestoes SET autor_id=?,nome=?,segmento=?,tel=?,email=?,ig=?,site=?,
    cardapio=?,rua=?,num=?,comp=?,bairro=?,cep=?,cidade=?,uf=?,obs=?,oferta_tipo=?,
    oferta_val=?,oferta_desc=?,oferta_regras=?,hh_desc=?,horarios=?,status=?,
    is_dono=?,atualizado_em=? WHERE id=?`,
    [d.autor_id||'',d.nome||'',d.segmento||'',d.tel||'',d.email||'',d.ig||'',
     d.site||'',d.cardapio||'',d.rua||'',d.num||'',d.comp||'',d.bairro||'',
     d.cep||'',d.cidade||'',d.uf||'',d.obs||'',d.oferta_tipo||'',d.oferta_val||'',
     d.oferta_desc||'',d.oferta_regras||'',d.hh_desc||'',d.horarios,d.status,
     d.is_dono,d.atualizado_em||'',req.params.id]);
  res.json({ok:true});
});

app.delete('/api/sugestoes/:id', (req, res) => {
  run('DELETE FROM sugestoes WHERE id=?', [req.params.id]);
  res.json({ok:true});
});

// ── BULK ──────────────────────────────────────────────────────────────────────
app.get('/api/bulk-export', (_, res) => res.json({
  empresas:  all('SELECT * FROM empresas').map(parseEmp),
  clientes:  all('SELECT * FROM clientes'),
  sugestoes: all('SELECT * FROM sugestoes').map(parseSug)
}));

app.post('/api/bulk-import', (req, res) => {
  const { empresas=[], clientes=[], sugestoes=[] } = req.body;
  db.transaction(() => {
    for (const d of empresas) {
      const p = prepEmp(d);
      run(`INSERT OR REPLACE INTO empresas
        (id,nome,segmento,tel,email,ig,site,cardapio,rua,num,comp,bairro,cep,cidade,uf,
         lat,lng,status,status_perfil,dono_id,origem_sug_id,origem,
         oferta_tipo,oferta_val,oferta_desc,oferta_detalhe,oferta_regras,
         hh_desc,horarios,aprovado_em,criado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.id,p.nome||'',p.segmento||'',p.tel||'',p.email||'',p.ig||'',p.site||'',
         p.cardapio||'',p.rua||'',p.num||'',p.comp||'',p.bairro||'',p.cep||'',
         p.cidade||'',p.uf||'',p.lat,p.lng,p.status,p.status_perfil,p.dono_id,
         p.origem_sug_id||'',p.origem||'',p.oferta_tipo||'',p.oferta_val||'',
         p.oferta_desc||'',p.oferta_detalhe||'',p.oferta_regras||'',p.hh_desc||'',
         p.horarios,p.aprovado_em||'',p.criado_em]);
    }
    for (const d of clientes) {
      run(`INSERT OR REPLACE INTO clientes
        (id,nome,nasc,email,tel,emp_id,rua,num,comp,bairro,cep,cidade,uf,
         oferta_enviada,enviado_em,perfil_id,master_id,status,criado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [d.id,d.nome||'',d.nasc||'',d.email||'',d.tel||'',d.emp_id||null,
         d.rua||'',d.num||'',d.comp||'',d.bairro||'',d.cep||'',d.cidade||'',d.uf||'',
         d.oferta_enviada?1:0,d.enviado_em||'',d.perfil_id||'',d.master_id||'',
         d.status||'ativo',d.criado_em||new Date().toISOString()]);
    }
    for (const d of sugestoes) {
      const p = prepSug(d);
      run(`INSERT OR REPLACE INTO sugestoes
        (id,autor_id,nome,segmento,tel,email,ig,site,cardapio,rua,num,comp,bairro,cep,
         cidade,uf,obs,oferta_tipo,oferta_val,oferta_desc,oferta_regras,hh_desc,
         horarios,status,is_dono,endereco,atualizado_em,criado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.id,p.autor_id||'',p.nome||'',p.segmento||'',p.tel||'',p.email||'',
         p.ig||'',p.site||'',p.cardapio||'',p.rua||'',p.num||'',p.comp||'',
         p.bairro||'',p.cep||'',p.cidade||'',p.uf||'',p.obs||'',p.oferta_tipo||'',
         p.oferta_val||'',p.oferta_desc||'',p.oferta_regras||'',p.hh_desc||'',
         p.horarios,p.status,p.is_dono,p.endereco||'',p.atualizado_em||'',p.criado_em]);
    }
  })();
  res.json({ok:true, empresas:empresas.length, clientes:clientes.length, sugestoes:sugestoes.length});
});

app.post('/api/reset', (req, res) => {
  try {
    console.log('--- RESETTING DATABASE ---');
    db.transaction(() => {
      db.prepare('DELETE FROM empresas').run();
      db.prepare('DELETE FROM clientes').run();
      db.prepare('DELETE FROM sugestoes').run();
    })();
    res.json({ok:true});
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({error: err.message});
  }
});

app.get('/api/stats', (_, res) => res.json({
  empresas:  one('SELECT COUNT(*) as n FROM empresas').n,
  clientes:  one('SELECT COUNT(*) as n FROM clientes').n,
  sugestoes: one('SELECT COUNT(*) as n FROM sugestoes').n
}));

// ── Rotas curtas ──────────────────────────────────────────────────────────────
app.get('/',         (_, res) => res.sendFile(path.join(__dirname, 'perfil.html')));
app.get('/admin',    (_, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/launcher', (_, res) => res.sendFile(path.join(__dirname, 'launcher.html')));

app.listen(PORT, () => {
  console.log(`\n  AnivCRM: http://localhost:${PORT}`);
  console.log(`  Admin:   http://localhost:${PORT}/admin`);
  console.log(`  Banco:   dados.db\n`);
});
"""

write(OUT / "server.js", server_js)
ok("server.js criado")

# ── 6. .gitignore ─────────────────────────────────────────────────────────────
step(6, "Criando .gitignore")
write(OUT / ".gitignore", "node_modules/\ndados.db\n*.db-shm\n*.db-wal\n")
ok(".gitignore criado")

# ── 7. npm install ────────────────────────────────────────────────────────────
step(7, "Rodando npm install")
try:
    r = subprocess.run(["npm","install"], cwd=str(OUT), shell=(sys.platform=="win32"))
    ok("npm install concluido!") if r.returncode == 0 else warn("npm install falhou")
except FileNotFoundError:
    warn("Node.js nao encontrado. Instale em https://nodejs.org"); sys.exit(1)

print(f"""
{SEP}
   PRONTO!  {OUT}

   cd anivapp && node server.js

   http://localhost:3000           -> perfil
   http://localhost:3000/admin     -> admin
   http://localhost:3000/launcher  -> launcher
{SEP}
""")

resp = input("Iniciar servidor agora? [S/n]: ").strip().lower()
if resp in ("","s","sim","y","yes"):
    print("\n  Iniciando... (Ctrl+C para parar)\n")
    subprocess.run(["node","server.js"], cwd=str(OUT), shell=(sys.platform=="win32"))
