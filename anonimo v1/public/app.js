const $ = s => document.querySelector(s);
let usuario = null;
let modoCadastro = false;

async function api(url, metodo = 'GET', corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || 'Algo deu errado.');
  return dados;
}

function desenharConta() {
  const c = $('#conta');
  c.textContent = '';
  if (usuario) {
    c.append(`Olá, ${usuario} `);
    const b = document.createElement('button');
    b.className = 'link';
    b.textContent = 'Sair';
    b.onclick = async () => { await api('/api/logout', 'POST'); usuario = null; iniciar(); };
    c.append(b);
  }
  $('#auth').hidden = !!usuario;
  $('#novo').hidden = !usuario;
}

async function carregar() {
  const lista = $('#lista');
  const itens = await api('/api/comentarios');
  lista.textContent = '';
  if (!itens.length) {
    lista.innerHTML = '<p class="vazio">Ainda não há comentários. Escreva o primeiro.</p>';
    return;
  }
  for (const c of itens) {
    const d = document.createElement('article');
    d.className = 'comentario';
    const p = document.createElement('p');
    p.textContent = c.texto; // textContent evita XSS
    const meta = document.createElement('div');
    meta.className = 'meta';
    const data = document.createElement('span');
    data.textContent = 'Anônimo · ' + new Date(c.criado_em.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
    meta.append(data);
    if (c.meu) {
      const x = document.createElement('button');
      x.textContent = 'Apagar';
      x.onclick = async () => { await api('/api/comentarios/' + c.id, 'DELETE'); carregar(); };
      meta.append(x);
    }
    d.append(p, meta);
    lista.append(d);
  }
}

$('#auth-troca').onclick = () => {
  modoCadastro = !modoCadastro;
  $('#auth-titulo').textContent = $('#auth-btn').textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  $('#auth-troca').textContent = modoCadastro ? 'Já tenho conta' : 'Criar uma conta';
  $('#auth-erro').textContent = '';
};

$('#form-auth').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const r = await api(modoCadastro ? '/api/registro' : '/api/login', 'POST',
      { nome: f.get('nome'), senha: f.get('senha') });
    usuario = r.nome;
    e.target.reset();
    iniciar();
  } catch (err) { $('#auth-erro').textContent = err.message; }
};

$('#form-comentario').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/comentarios', 'POST', { texto: new FormData(e.target).get('texto') });
    e.target.reset();
    carregar();
  } catch (err) { alert(err.message); }
};

async function iniciar() {
  if (usuario === null) usuario = (await api('/api/eu')).nome;
  desenharConta();
  carregar();
}
iniciar();
