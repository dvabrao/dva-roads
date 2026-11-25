// ════════════════════════════════════════════════════════════════
//  DVA Roads — servidor (Cloudflare Worker, plano gratuito)
//  · Guarda a chave da IA (variável secreta GEMINI_KEY ou ANTHROPIC_KEY)
//  · Só atende apps com licença válida (mesma chave pública do app)
//  · POST /ia/verificar  { chave, modulo, imagem(base64 jpeg), texto, contexto }
//      → { conforme, resumo, itens:[{elemento, situacao, problema, norma, recomendacao, gravidade}], limites }
//  · POST /nuvem/sessao, /nuvem/foto — o app envia sessões e fotos (banco D1, binding "DB")
//  · POST /ia/diagramar { chave, imagem, texto } → leitura da placa para o módulo de diagramação
//  · GET  /painel — painel web do inventário (login pela chave de licença; cada cliente vê só o que é dele)
//  Variáveis: PROVEDOR = "gemini" (padrão) | "claude"
//             GEMINI_MODELO (opcional; se ocupado tenta outros modelos gratuitos) · CLAUDE_MODELO (padrão claude-haiku-5-5)
// ════════════════════════════════════════════════════════════════
const PUB = { kty: 'EC', crv: 'P-256', x: 'kvyvNzzQgU2JkaglthbI_WrM1q2eYGW1BFvl25mWbEA', y: '2fvhpRcQTeLAPENlOgBaIAW-PPzSxkk3Rh0x3h1vY_w' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const PAINEL = '__PAINEL__';
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS) });

const b64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };
const bytes = (s) => Uint8Array.from(atob(b64u(s)), c => c.charCodeAt(0));

async function licenca(raw, modulo) {
  const p = String(raw || '').replace(/\s+/g, '').split('.');
  if (p.length !== 3 || p[0] !== 'DVAR1') return null;
  const key = await crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
  if (!ok) return null;
  const d = JSON.parse(decodeURIComponent(escape(atob(b64u(p[1])))));
  if (d.v && d.v < new Date().toISOString().slice(0, 10)) return null;
  if (modulo && !(d.m || []).some(m => m === '*' || m === modulo)) return null;
  d.admin = /\(administrador\)/i.test(d.c || '');
  return d;
}

const NORMAS = `Referências (use a que se aplicar e cite volume e item quando souber):
- CTB (Lei 9.503/97) e resoluções do CONTRAN.
- Manual Brasileiro de Sinalização de Trânsito (MBST/CONTRAN): Vol. I Regulamentação, Vol. II Advertência, Vol. III Indicação,
  Vol. IV Sinalização Horizontal, Vol. V Semafórica, Vol. VI Dispositivos Auxiliares, Vol. VII Temporária, Vol. VIII Cicloviária.
- DER-SP: Manual de Sinalização Rodoviária (V.I Projeto, V.II Confecção dos Sinais, V.III Obras, Conservação e Emergência),
  ET-DE-L00-008 Defensas Metálicas.
- ABNT: NBR 14636 e 17038 (tachas), NBR 14723 (retrorrefletividade SH), NBR 16184 (microesferas), NBR 6971 (defensas), NBR 14885 (barreiras).`;

function prompt(b) {
  return `Você é engenheiro especialista em sinalização viária e segurança rodoviária no Brasil.
Analise a FOTO tirada em campo e a DESCRIÇÃO do técnico e verifique se a sinalização horizontal, vertical e os dispositivos
de segurança visíveis estão de acordo com as normas brasileiras.

${NORMAS}

Contexto do levantamento (app DVA Roads, módulo ${b.modulo || '-'}): ${JSON.stringify(b.contexto || {})}
Descrição do técnico: """${String(b.texto || '').slice(0, 2000)}"""

Regras:
- Avalie só o que dá para ver na foto ou o que o técnico descreveu. Não invente medidas.
- Se algo não puder ser verificado pela foto (ex.: distância, retrorrefletância), diga em "limites".
- Para cada elemento: o que é, situação, problema (se houver), a norma que se aplica, a recomendação e a gravidade.
- Escreva em português do Brasil, frases curtas e objetivas.

Responda SOMENTE com JSON neste formato:
{"conforme":"sim|nao|parcial|indeterminado","resumo":"1 a 2 frases",
 "itens":[{"elemento":"","situacao":"","problema":"","norma":"","recomendacao":"","gravidade":"baixa|media|alta"}],
 "limites":"o que não foi possível avaliar"}`;
}

// leitura de placa para o módulo de diagramação
function promptDiagramar(b) {
  return `Você é projetista de sinalização viária no Brasil (DER-SP e CONTRAN). Leia a PLACA da foto e descreva-a para ser redesenhada.
Observação do técnico: """${String(b.texto || '').slice(0, 500)}"""

Se for placa de REGULAMENTAÇÃO (R-...) ou ADVERTÊNCIA (A-...) do Manual Brasileiro de Sinalização de Trânsito, use tipo "placa" e informe o código
(ex.: "R-19", "A-2a"); para R-19 informe a velocidade em "valor"; se houver placa complementar embaixo (ex.: "A 300 m"), coloque o texto em "complementar".
Se for placa RETANGULAR que contém um sinal de regulamentação ou advertência desenhado dentro (ex.: losango da lombada A-18) junto com seta(s)
e/ou texto, use tipo "composta": "pictograma" com o código do sinal, "setas" com as direções na ordem da esquerda para a direita
(E, IE, F, ID, D, BE inclinada para baixo à esquerda, B para baixo, BD inclinada para baixo à direita), "linhas" com textos, "esquema" (amarelo, branco...)
e "arranjo" ("linha" se os elementos estão lado a lado, "coluna" se um embaixo do outro).
Caso contrário (indicação/orientação de destino, serviços, educativa, turística, obras), use tipo "texto":
- "esquema": verde (localidades), azul (rodovias/apoio operacional), marrom (turístico), branco (educativa), amarelo, laranja (obras);
- "classe": "0" (pista dupla/expressa, placas grandes), "Ib" ou "II" (pista simples) — estime;
- "linhas": de cima para baixo, até 5; cada linha com "texto" exatamente como escrito (respeite maiúsculas e acentos),
  "seta" (E esquerda, IE inclinada à esquerda, F em frente, ID inclinada à direita, D direita, ou vazio),
  "dist" (ex.: "12 km", "500 m", ou vazio), "escudo" (ex.: "SP 330", "BR 050", ou vazio) e "tarja" (true se houver linha divisória abaixo dela).
Responda SOMENTE com JSON:
{"tipo":"texto|placa|composta","codigo":"","pictograma":"","setas":[],"arranjo":"linha","valor":"","complementar":"","esquema":"","classe":"","linhas":[{"texto":"","seta":"","dist":"","escudo":"","tarja":false}],"observacoes":"o que não deu para ler"}`;
}

function extraiJSON(t) {
  t = String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  return JSON.parse(i >= 0 ? t.slice(i, j + 1) : t);
}

// modelos gratuitos tentados em ordem quando um está sobrecarregado
const GEMINI_RESERVA = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
const espera = (ms) => new Promise(r => setTimeout(r, ms));

async function geminiUm(env, b, modelo) {
  const parts = [{ text: b._prompt || prompt(b) }];
  if (b.imagem) parts.push({ inline_data: { mime_type: 'image/jpeg', data: b.imagem } });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
  });
  const d = await r.json();
  if (!r.ok) { const e = new Error((d.error && d.error.message) || ('Gemini respondeu ' + r.status)); e.status = r.status; throw e; }
  const txt = (((d.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
  return Object.assign(extraiJSON(txt), { modelo });
}

async function gemini(env, b) {
  const lista = [env.GEMINI_MODELO].concat(GEMINI_RESERVA).filter((m, i, a) => m && a.indexOf(m) === i);
  let ultimo;
  for (const modelo of lista) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try { return await geminiUm(env, b, modelo); }
      catch (e) {
        ultimo = e;
        // 429/500/503 = ocupado ou limite: espera e tenta de novo / próximo modelo; 404 = modelo não existe: próximo
        if (e.status === 404 || e.status === 400 || e.status === 403) break;
        if (![429, 500, 503].includes(e.status)) throw e;
        await espera(1500);
      }
    }
  }
  throw ultimo;
}

async function claude(env, b) {
  const modelo = env.CLAUDE_MODELO || 'claude-haiku-5-5';
  const content = [];
  if (b.imagem) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b.imagem } });
  content.push({ type: 'text', text: b._prompt || prompt(b) });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: modelo, max_tokens: 1500, messages: [{ role: 'user', content }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || ('Claude respondeu ' + r.status));
  return Object.assign(extraiJSON((d.content || []).map(c => c.text || '').join('')), { modelo });
}

// ── banco (Cloudflare D1) ─────────────────────────────────────────
let esquemaOk = false;
async function esquema(db) {
  if (esquemaOk) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS sessoes (cliente TEXT NOT NULL, id TEXT NOT NULL, modulo TEXT, nome TEXT, rodovia TEXT,
      tipo TEXT, orgao TEXT, ini INTEGER, fim INTEGER, atualizado INTEGER, nitens INTEGER, meta TEXT, eventos TEXT, trajeto TEXT,
      PRIMARY KEY (cliente, id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS fotos (cliente TEXT NOT NULL, sessao TEXT NOT NULL, nome TEXT NOT NULL, img BLOB,
      PRIMARY KEY (cliente, sessao, nome))`),
  ]);
  esquemaOk = true;
}
const semDB = () => json({ erro: 'Banco de dados do servidor ainda não configurado.' }, 503);

async function nuvemSessao(env, b) {
  const s = b.sessao || {};
  const lic = await licenca(b.chave, s.modulo); if (!lic) return json({ erro: 'Licença inválida ou vencida para este módulo.' }, 403);
  if (!s.id) return json({ erro: 'Sessão sem identificação.' }, 400);
  const eventos = JSON.stringify(s.eventos || []), trajeto = JSON.stringify(s.trajeto || []);
  if (eventos.length + trajeto.length > 1_800_000) return json({ erro: 'Sessão grande demais para enviar de uma vez.' }, 413);
  const meta = Object.assign({}, s); delete meta.eventos; delete meta.trajeto;
  const p = s.params || {};
  await env.DB.prepare(`INSERT OR REPLACE INTO sessoes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    lic.c, s.id, s.modulo || '', s.nome || '', s.rodovia || '', p.tipo || '', p.orgao || '', s.ini || 0, s.fim || null,
    Date.now(), (s.eventos || []).length, JSON.stringify(meta), eventos, trajeto).run();
  const r = await env.DB.prepare('SELECT nome FROM fotos WHERE cliente=? AND sessao=?').bind(lic.c, s.id).all();
  const tem = new Set((r.results || []).map(x => x.nome));
  const todas = [].concat(...(s.eventos || []).map(e => e.fotos || []));
  return json({ ok: true, cliente: lic.c, faltam: todas.filter(f => !tem.has(f)) });
}
async function nuvemFoto(env, b) {
  const lic = await licenca(b.chave, b.modulo); if (!lic) return json({ erro: 'Licença inválida.' }, 403);
  if (!b.b64 || b.b64.length > 1_500_000) return json({ erro: 'Foto inválida ou grande demais.' }, 413);
  const bin = Uint8Array.from(atob(b.b64), c => c.charCodeAt(0));
  await env.DB.prepare('INSERT OR REPLACE INTO fotos VALUES (?,?,?,?)').bind(lic.c, String(b.sessao), String(b.nome), bin).run();
  return json({ ok: true });
}
// painel: o administrador vê todos os clientes; os demais só os próprios dados
async function api(env, rota, b) {
  const lic = await licenca(b.chave); if (!lic) return json({ erro: 'Chave inválida ou vencida.' }, 403);
  const cli = lic.admin ? (b.cliente || null) : lic.c;
  if (rota === 'login') return json({ cliente: lic.c, admin: lic.admin, modulos: lic.m, validade: lic.v });
  if (rota === 'sessoes') {
    const q = `SELECT cliente,id,modulo,nome,rodovia,tipo,orgao,ini,fim,atualizado,nitens FROM sessoes ${cli ? 'WHERE cliente=?' : ''} ORDER BY ini DESC`;
    const r = await (cli ? env.DB.prepare(q).bind(cli) : env.DB.prepare(q)).all();
    return json({ sessoes: r.results || [] });
  }
  if (rota === 'dados') {
    const ids = (b.ids || []).slice(0, 200); if (!ids.length) return json({ sessoes: [] });
    const marks = ids.map(() => '?').join(',');
    const q = `SELECT cliente,id,modulo,nome,rodovia,tipo,orgao,ini,fim,meta,eventos,trajeto FROM sessoes WHERE id IN (${marks})${cli ? ' AND cliente=?' : ''}`;
    const r = await env.DB.prepare(q).bind(...ids, ...(cli ? [cli] : [])).all();
    return json({ sessoes: (r.results || []).map(x => Object.assign(x, { meta: JSON.parse(x.meta || '{}'), eventos: JSON.parse(x.eventos || '[]'), trajeto: b.trajeto ? JSON.parse(x.trajeto || '[]') : [] })) });
  }
  if (rota === 'foto') {
    const c = lic.admin ? b.cliente : lic.c;
    const r = await env.DB.prepare('SELECT img FROM fotos WHERE cliente=? AND sessao=? AND nome=?').bind(c, String(b.sessao), String(b.nome)).first();
    if (!r) return json({ erro: 'Foto não enviada.' }, 404);
    return new Response(new Uint8Array(r.img), { headers: Object.assign({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' }, CORS) });
  }
  if (rota === 'excluir') {
    const c = lic.admin ? b.cliente : lic.c;
    await env.DB.batch([env.DB.prepare('DELETE FROM sessoes WHERE cliente=? AND id=?').bind(c, b.id), env.DB.prepare('DELETE FROM fotos WHERE cliente=? AND sessao=?').bind(c, b.id)]);
    return json({ ok: true });
  }
  return json({ erro: 'Rota não encontrada.' }, 404);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/status') {
      const prov = (env.PROVEDOR || 'gemini').toLowerCase();
      return json({ ok: true, servico: 'DVA Roads', provedor: prov, iaConfigurada: prov === 'claude' ? !!env.ANTHROPIC_KEY : !!env.GEMINI_KEY, banco: !!env.DB });
    }
    if (url.pathname === '/painel' || url.pathname === '/painel/') return new Response(PAINEL, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (url.pathname.startsWith('/nuvem/') || url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
      if (!env.DB) return semDB();
      let b; try { b = await req.json(); } catch (e) { return json({ erro: 'Pedido inválido.' }, 400); }
      try {
        await esquema(env.DB);
        if (url.pathname === '/nuvem/sessao') return await nuvemSessao(env, b);
        if (url.pathname === '/nuvem/foto') return await nuvemFoto(env, b);
        return await api(env, url.pathname.slice(5), b);
      } catch (e) { return json({ erro: 'Erro no servidor: ' + e.message }, 500); }
    }
    if (url.pathname === '/ia/verificar' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch (e) { return json({ erro: 'Pedido inválido.' }, 400); }
      if (!(await licenca(b.chave, b.modulo))) return json({ erro: 'Licença inválida ou vencida para este módulo.' }, 403);
      if (b.imagem && b.imagem.length > 4_000_000) return json({ erro: 'Foto grande demais.' }, 413);
      try {
        const prov = (env.PROVEDOR || 'gemini').toLowerCase();
        const r = prov === 'claude' ? await claude(env, b) : await gemini(env, b);
        return json(r);
      } catch (e) { return json({ erro: 'A IA não respondeu: ' + e.message }, 502); }
    }
    if (url.pathname === '/ia/diagramar' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch (e) { return json({ erro: 'Pedido inválido.' }, 400); }
      if (!(await licenca(b.chave, 'dg'))) return json({ erro: 'Licença inválida ou vencida para a Diagramação.' }, 403);
      if (!b.imagem || b.imagem.length > 4_000_000) return json({ erro: 'Foto ausente ou grande demais.' }, 413);
      b._prompt = promptDiagramar(b);
      try {
        const prov = (env.PROVEDOR || 'gemini').toLowerCase();
        return json(prov === 'claude' ? await claude(env, b) : await gemini(env, b));
      } catch (e) { return json({ erro: 'A IA não respondeu: ' + e.message }, 502); }
    }
    return json({ erro: 'Rota não encontrada.' }, 404);
  },
};
