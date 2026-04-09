'use strict';
const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, 'dados.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Rotas API simplificadas para o deploy
app.get('/api/stats', (req, res) => {
    const c = db.prepare('SELECT count(*) as count FROM clientes').get().count;
    const e = db.prepare('SELECT count(*) as count FROM empresas WHERE is_sugestao = 0').get().count;
    const s = db.prepare('SELECT count(*) as count FROM empresas WHERE is_sugestao = 1').get().count;
    res.json({ clientes: c, empresas: e, sugestoes: s });
});

app.get('/api/bulk-export', (req, res) => {
    res.json({
        clientes: db.prepare('SELECT * FROM clientes').all(),
        empresas: db.prepare('SELECT * FROM empresas').all()
    });
});

app.post('/api/clientes', (req, res) => {
    const keys = Object.keys(req.body);
    const sql = `INSERT OR REPLACE INTO clientes (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    db.prepare(sql).run(Object.values(req.body));
    res.json({ ok: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'perfil.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/launcher', (req, res) => res.sendFile(path.join(__dirname, 'launcher.html')));

app.listen(PORT, () => console.log('Servidor rodando na porta ' + PORT));
