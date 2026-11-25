// ════════════════════════════════════════════════════════════════
//  DVA Roads — servidor (Cloudflare Worker, plano gratuito)
//  · Guarda a chave da IA (variável secreta GEMINI_KEY ou ANTHROPIC_KEY)
//  · Só atende apps com licença válida (mesma chave pública do app)
//  · POST /ia/verificar  { chave, modulo, imagem(base64 jpeg), texto, contexto }
//      → { conforme, resumo, itens:[{elemento, situacao, problema, norma, recomendacao, gravidade}], limites }
//  Variáveis: PROVEDOR = "gemini" (padrão) | "claude"
//             GEMINI_MODELO (padrão gemini-flash-lite-latest) · CLAUDE_MODELO (padrão claude-haiku-5-5)
// ════════════════════════════════════════════════════════════════
const PUB = { kty: 'EC', crv: 'P-256', x: 'kvyvNzzQgU2JkaglthbI_WrM1q2eYGW1BFvl25mWbEA', y: '2fvhpRcQTeLAPENlOgBaIAW-PPzSxkk3Rh0x3h1vY_w' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
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
  if (!(d.m || []).some(m => m === '*' || m === modulo)) return null;
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

function extraiJSON(t) {
  t = String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  return JSON.parse(i >= 0 ? t.slice(i, j + 1) : t);
}

async function gemini(env, b) {
  const modelo = env.GEMINI_MODELO || 'gemini-flash-lite-latest';
  const parts = [{ text: prompt(b) }];
  if (b.imagem) parts.push({ inline_data: { mime_type: 'image/jpeg', data: b.imagem } });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || ('Gemini respondeu ' + r.status));
  const txt = (((d.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
  return Object.assign(extraiJSON(txt), { modelo });
}

async function claude(env, b) {
  const modelo = env.CLAUDE_MODELO || 'claude-haiku-5-5';
  const content = [];
  if (b.imagem) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b.imagem } });
  content.push({ type: 'text', text: prompt(b) });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: modelo, max_tokens: 1500, messages: [{ role: 'user', content }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || ('Claude respondeu ' + r.status));
  return Object.assign(extraiJSON((d.content || []).map(c => c.text || '').join('')), { modelo });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/status') {
      const prov = (env.PROVEDOR || 'gemini').toLowerCase();
      return json({ ok: true, servico: 'DVA Roads', provedor: prov, iaConfigurada: prov === 'claude' ? !!env.ANTHROPIC_KEY : !!env.GEMINI_KEY });
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
    return json({ erro: 'Rota não encontrada.' }, 404);
  },
};
