const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('data.db');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(__dirname + '/schema.sql', 'utf8'));

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-este-segredo',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 }
}));
app.use(express.static(__dirname + '/public'));

const exigeLogin = (req, res, next) =>
  req.session.uid ? next() : res.status(401).json({ erro: 'Faça login para continuar.' });

app.post('/api/registro', (req, res) => {
  const { nome = '', senha = '' } = req.body;
  if (!/^\w{3,20}$/.test(nome)) return res.status(400).json({ erro: 'Nome: 3 a 20 letras, números ou _.' });
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha precisa ter 6 caracteres ou mais.' });
  try {
    const r = db.prepare('INSERT INTO usuarios (nome, senha_hash) VALUES (?, ?)')
      .run(nome, bcrypt.hashSync(senha, 10));
    req.session.uid = r.lastInsertRowid;
    req.session.nome = nome;
    res.json({ nome });
  } catch {
    res.status(409).json({ erro: 'Esse nome já está em uso.' });
  }
});

app.post('/api/login', (req, res) => {
  const { nome = '', senha = '' } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE nome = ?').get(nome);
  if (!u || !bcrypt.compareSync(senha, u.senha_hash))
    return res.status(401).json({ erro: 'Nome ou senha incorretos.' });
  req.session.uid = u.id;
  req.session.nome = u.nome;
  res.json({ nome: u.nome });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/eu', (req, res) => res.json({ nome: req.session.nome || null }));

app.get('/api/comentarios', (req, res) => {
  const uid = req.session.uid || 0;
  const linhas = db.prepare(
    `SELECT id, texto, criado_em, (usuario_id = ?) AS meu
     FROM comentarios ORDER BY criado_em DESC, id DESC LIMIT 100`
  ).all(uid);
  res.json(linhas.map(l => ({ ...l, meu: !!l.meu })));
});

app.post('/api/comentarios', exigeLogin, (req, res) => {
  const texto = String(req.body.texto || '').trim();
  if (!texto || texto.length > 500) return res.status(400).json({ erro: 'Escreva de 1 a 500 caracteres.' });
  db.prepare('INSERT INTO comentarios (usuario_id, texto) VALUES (?, ?)').run(req.session.uid, texto);
  res.json({ ok: true });
});

app.delete('/api/comentarios/:id', exigeLogin, (req, res) => {
  const r = db.prepare('DELETE FROM comentarios WHERE id = ? AND usuario_id = ?')
    .run(req.params.id, req.session.uid);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ erro: 'Comentário não encontrado.' });
});

app.listen(3000, () => console.log('Rodando em http://localhost:3000'));
