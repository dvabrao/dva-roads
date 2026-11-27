// ════════════════════════════════════════════════════════════════
//  DVA Roads — servidor (Cloudflare Worker, plano gratuito)
//  · Guarda a chave da IA (variável secreta GEMINI_KEY ou ANTHROPIC_KEY)
//  · Só atende apps com licença válida (mesma chave pública do app)
//  · POST /ia/verificar  { chave, modulo, imagem(base64 jpeg), texto, contexto }
//      → { conforme, resumo, itens:[{elemento, situacao, problema, norma, recomendacao, gravidade}], limites }
//  · POST /nuvem/sessao, /nuvem/foto — o app envia sessões e fotos (banco D1, binding "DB")
//  · POST /ia/diagramar { chave, imagem, texto } → leitura da placa para o módulo de diagramação
//  · Cópia automática no Google Drive (segredos GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET; conexão pelo painel do administrador)
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
    db.prepare(`CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT)`),
  ]);
  // colunas novas (bancos antigos): usuário que levantou e controle da cópia no Drive
  for (const q of ['ALTER TABLE sessoes ADD COLUMN usuario TEXT', 'ALTER TABLE sessoes ADD COLUMN drive INTEGER', 'ALTER TABLE fotos ADD COLUMN drive TEXT']) {
    try { await db.prepare(q).run(); } catch (e) { /* já existe */ }
  }
  esquemaOk = true;
}
const semDB = () => json({ erro: 'Banco de dados do servidor ainda não configurado.' }, 503);

async function nuvemSessao(env, b, ctx) {
  const s = b.sessao || {};
  const lic = await licenca(b.chave, s.modulo); if (!lic) return json({ erro: 'Licença inválida ou vencida para este módulo.' }, 403);
  if (!s.id) return json({ erro: 'Sessão sem identificação.' }, 400);
  const eventos = JSON.stringify(s.eventos || []), trajeto = JSON.stringify(s.trajeto || []);
  if (eventos.length + trajeto.length > 1_800_000) return json({ erro: 'Sessão grande demais para enviar de uma vez.' }, 413);
  const meta = Object.assign({}, s); delete meta.eventos; delete meta.trajeto;
  const p = s.params || {};
  await env.DB.prepare(`INSERT INTO sessoes (cliente,id,modulo,nome,rodovia,tipo,orgao,ini,fim,atualizado,nitens,meta,eventos,trajeto,usuario)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(cliente,id) DO UPDATE SET modulo=excluded.modulo, nome=excluded.nome, rodovia=excluded.rodovia,
    tipo=excluded.tipo, orgao=excluded.orgao, ini=excluded.ini, fim=excluded.fim, atualizado=excluded.atualizado, nitens=excluded.nitens,
    meta=excluded.meta, eventos=excluded.eventos, trajeto=excluded.trajeto, usuario=excluded.usuario`).bind(
    lic.c, s.id, s.modulo || '', s.nome || '', s.rodovia || '', p.tipo || '', p.orgao || '', s.ini || 0, s.fim || null,
    Date.now(), (s.eventos || []).length, JSON.stringify(meta), eventos, trajeto, lic.u || '').run();
  if (ctx && await driveLigado(env)) {
    // cria a pasta da sessão já (as fotos chegam logo depois); o resto da cópia segue em segundo plano
    try { const tok = await tokenDrive(env); if (tok) await dirSessao(env, tok, lic.c, { id: s.id, nome: s.nome, ini: s.ini }); } catch (e) {}
    ctx.waitUntil(driveSessao(env, lic.c, s.id).catch(e => erroDrive(env, e)));
  }
  const r = await env.DB.prepare('SELECT nome FROM fotos WHERE cliente=? AND sessao=?').bind(lic.c, s.id).all();
  const tem = new Set((r.results || []).map(x => x.nome));
  const todas = [].concat(...(s.eventos || []).map(e => e.fotos || []));
  return json({ ok: true, cliente: lic.c, faltam: todas.filter(f => !tem.has(f)) });
}
async function nuvemFoto(env, b, ctx) {
  const lic = await licenca(b.chave, b.modulo); if (!lic) return json({ erro: 'Licença inválida.' }, 403);
  if (!b.b64 || b.b64.length > 1_500_000) return json({ erro: 'Foto inválida ou grande demais.' }, 413);
  const bin = Uint8Array.from(atob(b.b64), c => c.charCodeAt(0));
  await env.DB.prepare('INSERT INTO fotos (cliente,sessao,nome,img) VALUES (?,?,?,?) ON CONFLICT(cliente,sessao,nome) DO UPDATE SET img=excluded.img')
    .bind(lic.c, String(b.sessao), String(b.nome), bin).run();
  if (ctx && await driveLigado(env)) ctx.waitUntil(driveFoto(env, lic.c, String(b.sessao), String(b.nome)).catch(e => erroDrive(env, e)));
  return json({ ok: true });
}
// ── cópia automática no Google Drive ─────────────────────────────
//  O administrador conecta uma vez pelo painel (login Google). O servidor guarda só a autorização
//  (escopo drive.file: o servidor só enxerga o que ele mesmo criou) e copia, a cada envio do app:
//  "DVA Roads - Banco de dados / <cliente> / <módulo> - <rodovia>" (planilha Google) e
//  "… / <cliente> / Sessões / <data> <sessão> /" (sessao.json + fotos).
const DRV = 'https://www.googleapis.com/drive/v3', UPL = 'https://www.googleapis.com/upload/drive/v3';
const PASTA = 'application/vnd.google-apps.folder', PLANILHA = 'application/vnd.google-apps.spreadsheet';
const driveConfig = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
async function cfgGet(env, k) { const r = await env.DB.prepare('SELECT v FROM config WHERE k=?').bind(k).first(); return r ? r.v : null; }
async function cfgSet(env, k, v) {
  if (v == null) await env.DB.prepare('DELETE FROM config WHERE k=?').bind(k).run();
  else await env.DB.prepare('INSERT OR REPLACE INTO config VALUES (?,?)').bind(k, String(v)).run();
}
async function driveLigado(env) { return driveConfig(env) && !!(await cfgGet(env, 'drive_refresh')); }
async function erroDrive(env, e) { try { await cfgSet(env, 'drive_erro', JSON.stringify({ t: Date.now(), msg: String(e && e.message || e).slice(0, 300) })); } catch (x) {} }

async function tokenDrive(env) {
  const a = JSON.parse((await cfgGet(env, 'drive_access')) || 'null');
  if (a && a.exp > Date.now() + 60000) return a.tok;
  const rt = await cfgGet(env, 'drive_refresh'); if (!rt) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }) });
  const d = await r.json();
  if (!r.ok) {
    if (d.error === 'invalid_grant') await cfgSet(env, 'drive_refresh', null);   // autorização revogada: precisa conectar de novo
    throw new Error('Google: ' + (d.error_description || d.error || r.status));
  }
  await cfgSet(env, 'drive_access', JSON.stringify({ tok: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 }));
  return d.access_token;
}
async function gd(tok, metodo, url, corpo, tipo) {
  const r = await fetch(url, { method: metodo, headers: Object.assign({ Authorization: 'Bearer ' + tok }, tipo ? { 'Content-Type': tipo } : {}), body: corpo });
  if (!r.ok) { const e = new Error('Drive ' + r.status + ': ' + (await r.text()).slice(0, 200)); e.status = r.status; throw e; }
  return r.status === 204 ? {} : r.json();
}
// envia arquivo novo (id vazio) ou substitui o conteúdo de um existente
function enviaArq(tok, meta, dados, tipo, id) {
  const b = 'dvar' + crypto.randomUUID().replace(/-/g, '');
  const corpo = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${tipo}\r\n\r\n`, dados, `\r\n--${b}--`]);
  return gd(tok, id ? 'PATCH' : 'POST', `${UPL}/files${id ? '/' + id : ''}?uploadType=multipart&fields=id`, corpo, 'multipart/related; boundary=' + b);
}
const nomeSeguro = (t) => String(t || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'sem nome';
async function pasta(env, tok, ck, nome, pai) {
  const id = await cfgGet(env, ck); if (id) return id;
  const q = `name='${nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType='${PASTA}' and trashed=false and '${pai || 'root'}' in parents`;
  const l = await gd(tok, 'GET', `${DRV}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
  const nova = l.files && l.files[0] ? l.files[0].id
    : (await gd(tok, 'POST', `${DRV}/files?fields=id`, JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai || 'root'] }), 'application/json')).id;
  await cfgSet(env, ck, nova); return nova;
}
async function dirCliente(env, tok, cli) {
  const raiz = await pasta(env, tok, 'dir:raiz', 'DVA Roads - Banco de dados', null);
  return pasta(env, tok, 'dir:cli:' + cli, nomeSeguro(cli), raiz);
}
async function dirSessao(env, tok, cli, s) {
  const c = await dirCliente(env, tok, cli);
  const ss = await pasta(env, tok, 'dir:sess:' + cli, 'Sessões', c);
  const data = s.ini ? new Date(s.ini - 3 * 3600e3).toISOString().slice(0, 10) + ' ' : '';
  return pasta(env, tok, 'dir:ses:' + cli + '/' + s.id, nomeSeguro(data + (s.nome || s.id)), ss);
}
// pasta/arquivo apagado no Drive: esquece os endereços guardados e refaz
async function semCache(env) { await env.DB.prepare("DELETE FROM config WHERE k LIKE 'dir:%' OR k LIKE 'arq:%' OR k LIKE 'plan:%'").run(); }
async function comRefazer(env, f) { try { return await f(); } catch (e) { if (e.status !== 404) throw e; await semCache(env); return f(); } }

const MODN = { mz: 'Marco Zero', slir: 'SLIR', sh: 'Sinalização Horizontal', sv: 'Sinalização Vertical' };
const GRUPON = { placa: 'Placa', seg: 'Defensa / barreira', disp: 'Dispositivo', ia: 'Verificação por IA', ponto: 'Ponto' };
const COLS = ['Sessão', 'Técnico', 'Tipo de levantamento', 'Órgão', 'Código', 'Posição', 'Km', 'Tipo de item', 'Item', 'Lado', 'Estado',
  'Detalhes', 'Observação', 'Fotos', 'Pasta das fotos', 'Latitude', 'Longitude', 'Data'];
const numBR = (n, d) => n == null || n === '' || isNaN(+n) ? '' : (+n).toFixed(d).replace('.', ',');
function campo(v) { v = v == null ? '' : String(v); if (/^[=+@]/.test(v)) v = ' ' + v; return '"' + v.replace(/"/g, '""') + '"'; }
function linhaCSV(s, ev, dir) {
  const dd = ev.dados || {};
  return [s.nome, s.usuario || '', s.tipo, s.orgao, ev.codigo || '', ev.posicao || '', numBR(ev.km, 3), ev.categoria || GRUPON[ev.grupo] || ev.grupo || '',
    ev.item || ev.rotulo || '', ev.ladoTxt || '', dd.estado || '', ev.detalhes || '', ev.obs || '', (ev.fotos || []).length || '',
    (ev.fotos || []).length && dir ? 'https://drive.google.com/drive/folders/' + dir : '', numBR(ev.lat, 7), numBR(ev.lon, 7),
    ev.t ? new Date(ev.t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''];
}
async function drivePlanilha(env, tok, cli, modulo, rodovia) {
  const r = await env.DB.prepare('SELECT id,nome,tipo,orgao,ini,usuario,eventos FROM sessoes WHERE cliente=? AND modulo=? AND rodovia=? ORDER BY ini')
    .bind(cli, modulo || '', rodovia || '').all();
  const pre = 'dir:ses:' + cli + '/', dirs = {};
  ((await env.DB.prepare('SELECT k,v FROM config WHERE k LIKE ?').bind(pre + '%').all()).results || []).forEach(x => { dirs[x.k.slice(pre.length)] = x.v; });
  const lin = [COLS.map(campo).join(',')];
  for (const s of r.results || []) for (const ev of JSON.parse(s.eventos || '[]')) lin.push(linhaCSV(s, ev, dirs[s.id]).map(campo).join(','));
  const csv = lin.join('\r\n'), nome = `${MODN[modulo] || modulo || 'Levantamento'} - ${rodovia || 'Sem rodovia'}`;
  const ck = 'plan:' + cli + '/' + modulo + '/' + rodovia; const id = await cfgGet(env, ck);
  if (id) {
    try { await enviaArq(tok, { name: nome }, csv, 'text/csv', id); return; }
    catch (e) {
      if (e.status !== 400 && e.status !== 404) throw e;
      if (e.status === 400) try { await gd(tok, 'PATCH', `${DRV}/files/${id}`, JSON.stringify({ trashed: true }), 'application/json'); } catch (x) {}
    }
  }
  const c = await dirCliente(env, tok, cli);
  const novo = await enviaArq(tok, { name: nome, mimeType: PLANILHA, parents: [c] }, csv, 'text/csv');
  await cfgSet(env, ck, novo.id);
}
async function driveSessao(env, cli, id) {
  const tok = await tokenDrive(env); if (!tok) return;
  const s = await env.DB.prepare('SELECT * FROM sessoes WHERE cliente=? AND id=?').bind(cli, id).first(); if (!s) return;
  await comRefazer(env, async () => {
    const dir = await dirSessao(env, tok, cli, s);
    const ck = 'arq:ses:' + cli + '/' + id, fid = await cfgGet(env, ck);
    const conteudo = JSON.stringify({ cliente: cli, usuario: s.usuario || '', sessao: JSON.parse(s.meta || '{}'), eventos: JSON.parse(s.eventos || '[]'), trajeto: JSON.parse(s.trajeto || '[]') });
    const r = await enviaArq(tok, fid ? { name: 'sessao.json' } : { name: 'sessao.json', parents: [dir] }, conteudo, 'application/json', fid);
    await cfgSet(env, ck, r.id);
    await drivePlanilha(env, tok, cli, s.modulo, s.rodovia);
  });
  await env.DB.prepare('UPDATE sessoes SET drive=? WHERE cliente=? AND id=?').bind(Date.now(), cli, id).run();
}
async function driveFoto(env, cli, sessao, nome) {
  const tok = await tokenDrive(env); if (!tok) return;
  const f = await env.DB.prepare('SELECT img,drive FROM fotos WHERE cliente=? AND sessao=? AND nome=?').bind(cli, sessao, nome).first(); if (!f) return;
  const s = await env.DB.prepare('SELECT id,nome,ini FROM sessoes WHERE cliente=? AND id=?').bind(cli, sessao).first(); if (!s) return;
  const img = new Uint8Array(f.img);
  let r;
  try { r = f.drive ? await enviaArq(tok, {}, img, 'image/jpeg', f.drive) : null; } catch (e) { if (e.status !== 404) throw e; }
  if (!r) r = await comRefazer(env, async () => enviaArq(tok, { name: nome, parents: [await dirSessao(env, tok, cli, s)] }, img, 'image/jpeg'));
  await env.DB.prepare('UPDATE fotos SET drive=? WHERE cliente=? AND sessao=? AND nome=?').bind(r.id, cli, sessao, nome).run();
}
async function pendentesDrive(env) {
  const a = await env.DB.prepare('SELECT COUNT(*) n FROM sessoes WHERE drive IS NULL OR drive < atualizado').first();
  const b = await env.DB.prepare('SELECT COUNT(*) n FROM fotos WHERE drive IS NULL').first();
  return { sessoes: a ? a.n : 0, fotos: b ? b.n : 0 };
}
async function apiDrive(env, rota, b, url) {
  if (!driveConfig(env)) return json({ configurado: false, erro: 'Faltam os segredos GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Cloudflare.' }, rota === 'drive-status' ? 200 : 400);
  if (rota === 'drive-status') {
    return json({ configurado: true, conectado: !!(await cfgGet(env, 'drive_refresh')), conta: await cfgGet(env, 'drive_conta'),
      raiz: await cfgGet(env, 'dir:raiz'), erro: JSON.parse((await cfgGet(env, 'drive_erro')) || 'null'), pendentes: await pendentesDrive(env) });
  }
  if (rota === 'drive-link') {
    const st = crypto.randomUUID(); await cfgSet(env, 'drive_state', JSON.stringify({ st, exp: Date.now() + 15 * 60e3 }));
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + '/drive/retorno', response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', state: st });
    return json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q });
  }
  if (rota === 'drive-desconectar') {
    const rt = await cfgGet(env, 'drive_refresh');
    if (rt) try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(rt), { method: 'POST' }); } catch (e) {}
    for (const k of ['drive_refresh', 'drive_access', 'drive_conta', 'drive_erro']) await cfgSet(env, k, null);
    return json({ ok: true });
  }
  if (rota === 'drive-sincronizar') {
    // um pedaço por vez (limites do plano gratuito): o painel chama de novo até acabar
    const tok = await tokenDrive(env); if (!tok) return json({ erro: 'Drive não conectado.' }, 400);
    if (b.tudo) { await env.DB.prepare('UPDATE sessoes SET drive=NULL').run(); }
    const s = await env.DB.prepare('SELECT cliente,id FROM sessoes WHERE drive IS NULL OR drive < atualizado ORDER BY ini LIMIT 1').first();
    if (s) await driveSessao(env, s.cliente, s.id);
    else {
      const f = await env.DB.prepare('SELECT cliente,sessao,nome FROM fotos WHERE drive IS NULL LIMIT 12').all();
      for (const x of f.results || []) await driveFoto(env, x.cliente, x.sessao, x.nome);
    }
    await cfgSet(env, 'drive_erro', null);
    return json({ ok: true, pendentes: await pendentesDrive(env) });
  }
  return json({ erro: 'Rota não encontrada.' }, 404);
}
async function driveRetorno(env, url) {
  const pg = (t, ok) => new Response(`<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>DVA Roads · Google Drive</title><body style="font-family:Segoe UI,Roboto,Arial;background:#F1F4F8;margin:0;padding:40px 16px">
    <div style="max-width:460px;margin:auto;background:#fff;border-radius:16px;padding:22px;border:1px solid #DDE3EC">
    <h2 style="margin-top:0;color:#111D3D">${ok ? '✅' : '⚠️'} Google Drive</h2><p style="font-size:15px">${t}</p>
    <p><a href="/painel" style="background:#FFD740;color:#111D3D;padding:10px 16px;border-radius:10px;font-weight:700;text-decoration:none">Voltar ao painel</a></p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (!driveConfig(env)) return pg('O servidor ainda não tem os segredos do Google.', false);
  if (url.searchParams.get('error')) return pg('A autorização não foi concedida (' + url.searchParams.get('error').replace(/[<>&"]/g, '') + ').', false);
  const st = JSON.parse((await cfgGet(env, 'drive_state')) || 'null');
  if (!st || st.st !== url.searchParams.get('state') || st.exp < Date.now()) return pg('Link vencido. Volte ao painel e toque em "Conectar Google Drive" de novo.', false);
  await cfgSet(env, 'drive_state', null);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: url.searchParams.get('code') || '', client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + '/drive/retorno', grant_type: 'authorization_code' }) });
  const d = await r.json();
  if (!r.ok || !d.refresh_token) return pg('O Google não devolveu a autorização (' + String(d.error_description || d.error || 'sem refresh token').replace(/[<>&"]/g, '') + '). Tente de novo.', false);
  await cfgSet(env, 'drive_refresh', d.refresh_token);
  await cfgSet(env, 'drive_access', JSON.stringify({ tok: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 }));
  await cfgSet(env, 'drive_erro', null);
  let conta = '';
  try { const u = await gd(d.access_token, 'GET', `${DRV}/about?fields=user(emailAddress)`); conta = u.user && u.user.emailAddress || ''; await cfgSet(env, 'drive_conta', conta); } catch (e) {}
  await semCache(env);
  return pg(`Conectado${conta ? ' à conta <b>' + conta.replace(/[<>&"]/g, '') + '</b>' : ''}. No painel, toque em <b>Copiar tudo para o Drive</b> para levar o que já foi enviado. Os próximos envios do app serão copiados sozinhos.`, true);
}

// painel: o administrador vê todos os clientes; os demais só os próprios dados
// chave com "usuário" (técnico) e sem "gestor": vê só o que ele mesmo levantou
const soDele = (lic) => !lic.admin && !!lic.u && !lic.g;
async function api(env, rota, b, url) {
  const lic = await licenca(b.chave); if (!lic) return json({ erro: 'Chave inválida ou vencida.' }, 403);
  const cli = lic.admin ? (b.cliente || null) : lic.c;
  const filtro = (pref) => { const w = [], v = []; if (cli) { w.push(pref + 'cliente=?'); v.push(cli); } if (soDele(lic)) { w.push(pref + 'usuario=?'); v.push(lic.u); } return { w, v }; };
  if (rota === 'login') return json({ cliente: lic.c, usuario: lic.u || '', gestor: !!lic.g, admin: lic.admin, modulos: lic.m, validade: lic.v });
  if (rota.startsWith('drive-')) return lic.admin ? apiDrive(env, rota, b, url) : json({ erro: 'Só o administrador.' }, 403);
  if (rota === 'sessoes') {
    const f = filtro('');
    const q = `SELECT cliente,id,modulo,nome,rodovia,tipo,orgao,ini,fim,atualizado,nitens,usuario FROM sessoes ${f.w.length ? 'WHERE ' + f.w.join(' AND ') : ''} ORDER BY ini DESC`;
    const r = await env.DB.prepare(q).bind(...f.v).all();
    return json({ sessoes: r.results || [] });
  }
  if (rota === 'dados') {
    const ids = (b.ids || []).slice(0, 200); if (!ids.length) return json({ sessoes: [] });
    const marks = ids.map(() => '?').join(','); const f = filtro(' AND ');
    const q = `SELECT cliente,id,modulo,nome,rodovia,tipo,orgao,ini,fim,usuario,meta,eventos,trajeto FROM sessoes WHERE id IN (${marks})${f.w.join('')}`;
    const r = await env.DB.prepare(q).bind(...ids, ...f.v).all();
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
    if (soDele(lic)) { const x = await env.DB.prepare('SELECT usuario FROM sessoes WHERE cliente=? AND id=?').bind(c, b.id).first(); if (!x || x.usuario !== lic.u) return json({ erro: 'Sessão de outro técnico.' }, 403); }
    await env.DB.batch([env.DB.prepare('DELETE FROM sessoes WHERE cliente=? AND id=?').bind(c, b.id), env.DB.prepare('DELETE FROM fotos WHERE cliente=? AND sessao=?').bind(c, b.id)]);
    return json({ ok: true });
  }
  return json({ erro: 'Rota não encontrada.' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/status') {
      const prov = (env.PROVEDOR || 'gemini').toLowerCase();
      return json({ ok: true, servico: 'DVA Roads', provedor: prov, iaConfigurada: prov === 'claude' ? !!env.ANTHROPIC_KEY : !!env.GEMINI_KEY, banco: !!env.DB, drive: driveConfig(env) });
    }
    if (url.pathname === '/painel' || url.pathname === '/painel/') return new Response(PAINEL, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (url.pathname.startsWith('/nuvem/') || url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
      if (!env.DB) return semDB();
      let b; try { b = await req.json(); } catch (e) { return json({ erro: 'Pedido inválido.' }, 400); }
      try {
        await esquema(env.DB);
        if (url.pathname === '/nuvem/sessao') return await nuvemSessao(env, b, ctx);
        if (url.pathname === '/nuvem/foto') return await nuvemFoto(env, b, ctx);
        return await api(env, url.pathname.slice(5), b, url);
      } catch (e) { return json({ erro: 'Erro no servidor: ' + e.message }, 500); }
    }
    if (url.pathname === '/drive/retorno') {
      if (!env.DB) return semDB();
      await esquema(env.DB);
      return driveRetorno(env, url);
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
