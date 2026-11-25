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
const PAINEL = "<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>DVA Roads · Painel</title>\n<link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\">\n<style>\n:root{--navy:#111D3D;--y:#FFD740;--bg:#F1F4F8;--card:#fff;--b:#DDE3EC;--sub:#5B6B82;--t:#18233F}\n*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--t);font-size:14px}\nheader{background:var(--navy);color:#fff;padding:12px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}\nheader h1{margin:0;font-size:18px;letter-spacing:.5px}header h1 b{color:var(--y)}header .cli{font-size:12px;opacity:.8}\nheader .sp{flex:1}header button{background:transparent;color:#fff;border:1px solid #ffffff55;border-radius:8px;padding:6px 12px;cursor:pointer}\nmain{max-width:1400px;margin:0 auto;padding:16px}\n.card{background:var(--card);border:1px solid var(--b);border-radius:14px;padding:14px;margin-bottom:14px}\n.lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--sub);margin-bottom:4px}\nselect,input{font:inherit;padding:8px 10px;border:1px solid var(--b);border-radius:9px;background:#fff;min-width:0;width:100%}\n.filtros{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}\n.btn{background:var(--navy);color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:14px}\n.btn.y{background:var(--y);color:var(--navy)}.btn.g{background:#E9EEF5;color:var(--navy)}\n.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}\n.kpis{display:flex;gap:10px;flex-wrap:wrap}.kpi{flex:1;min-width:120px;border-radius:12px;padding:10px 12px;background:#F7F9FC;border:1px solid var(--b);cursor:pointer}\n.kpi.on{outline:3px solid var(--y)}.kpi .n{font-size:24px;font-weight:800}.kpi .t{font-size:12px;color:var(--sub)}\n#mapa{height:420px;border-radius:12px}\n.grid2{display:grid;grid-template-columns:1fr;gap:14px}\ntable{width:100%;border-collapse:collapse;font-size:13px}th{position:sticky;top:0;background:#F7F9FC;text-align:left;font-size:11px;text-transform:uppercase;color:var(--sub);padding:8px;border-bottom:1px solid var(--b);cursor:pointer;white-space:nowrap}\ntd{padding:7px 8px;border-bottom:1px solid #EEF1F5;vertical-align:middle}tr:hover td{background:#FFFBEA;cursor:pointer}\n.tw{max-height:560px;overflow:auto;border:1px solid var(--b);border-radius:12px}\n.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}\n.fig{width:30px;height:30px;object-fit:contain;vertical-align:middle}\n.ses{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;max-height:240px;overflow:auto}\n.ses label{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--b);border-radius:10px;padding:8px;font-size:12.5px;cursor:pointer}\n.ses label small{color:var(--sub)}\n#login{max-width:420px;margin:60px auto}\n.modal{position:fixed;inset:0;background:#0009;display:none;align-items:center;justify-content:center;padding:14px;z-index:2000}\n.modal .box{background:#fff;border-radius:16px;max-width:760px;width:100%;max-height:92vh;overflow:auto;padding:18px}\n.modal img.ft{width:100%;border-radius:10px;margin-top:8px}\n.muted{color:var(--sub);font-size:12px}\n@media(min-width:1000px){.grid2{grid-template-columns:1fr 1fr}#mapa{height:560px}}\n</style>\n</head>\n<body>\n<header><h1>DVA <b>ROADS</b> · Painel</h1><span class=\"cli\" id=\"h-cli\"></span><span class=\"sp\"></span><button id=\"b-sair\" style=\"display:none\" onclick=\"sair()\">Sair</button></header>\n<main>\n<div id=\"login\" class=\"card\">\n  <div class=\"lbl\">Chave de acesso</div>\n  <p class=\"muted\">Use a mesma chave de licença do app DVA Roads. Cada cliente vê só os próprios levantamentos.</p>\n  <input id=\"k\" placeholder=\"DVAR1.…\" autocomplete=\"off\">\n  <div class=\"row\" style=\"margin-top:10px\"><button class=\"btn y\" onclick=\"entrar()\">Entrar</button><span id=\"l-msg\" class=\"muted\"></span></div>\n  <p class=\"muted\" style=\"margin-top:14px\">DVABRAO SERVIÇOS LTDA · dvabrao@gmail.com</p>\n</div>\n\n<div id=\"app\" style=\"display:none\">\n  <div class=\"card\">\n    <div class=\"filtros\">\n      <div id=\"f-cli-w\" style=\"display:none\"><div class=\"lbl\">Cliente</div><select id=\"f-cli\" onchange=\"filtraSessoes()\"></select></div>\n      <div><div class=\"lbl\">Módulo</div><select id=\"f-mod\" onchange=\"filtraSessoes()\"></select></div>\n      <div><div class=\"lbl\">Rodovia</div><select id=\"f-rod\" onchange=\"filtraSessoes()\"></select></div>\n      <div><div class=\"lbl\">Órgão / concessionária</div><select id=\"f-org\" onchange=\"filtraSessoes()\"></select></div>\n      <div><div class=\"lbl\">Tipo de levantamento</div><select id=\"f-tipo\" onchange=\"filtraSessoes()\"></select></div>\n    </div>\n    <div class=\"row\" style=\"margin:12px 0 8px\"><div class=\"lbl\" style=\"margin:0\">Sessões</div><span class=\"muted\" id=\"s-cont\"></span><span style=\"flex:1\"></span>\n      <button class=\"btn g\" onclick=\"marcar(true)\">Todas</button><button class=\"btn g\" onclick=\"marcar(false)\">Nenhuma</button><button class=\"btn\" onclick=\"carregar()\">Mostrar</button></div>\n    <div class=\"ses\" id=\"ses\"></div>\n  </div>\n\n  <div id=\"res\" style=\"display:none\">\n    <div class=\"card\"><div class=\"row\" style=\"margin-bottom:10px\"><div class=\"lbl\" style=\"margin:0\">Estado de conservação</div><span class=\"muted\">(toque para filtrar)</span></div><div class=\"kpis\" id=\"kpis\"></div></div>\n    <div class=\"card\"><div class=\"filtros\">\n      <div><div class=\"lbl\">Tipo de item</div><select id=\"f-cat\" onchange=\"aplica()\"></select></div>\n      <div><div class=\"lbl\">Lado</div><select id=\"f-lado\" onchange=\"aplica()\"></select></div>\n      <div><div class=\"lbl\">Buscar</div><input id=\"f-busca\" placeholder=\"código, nome, obs...\" oninput=\"aplica()\"></div>\n      <div style=\"display:flex;align-items:flex-end;gap:8px\"><button class=\"btn y\" style=\"flex:1\" onclick=\"excel()\">⬇ Excel</button></div>\n    </div></div>\n    <div class=\"grid2\">\n      <div class=\"card\"><div id=\"mapa\"></div></div>\n      <div class=\"card\"><div class=\"row\" style=\"margin-bottom:8px\"><div class=\"lbl\" style=\"margin:0\">Itens</div><span class=\"muted\" id=\"t-cont\"></span></div>\n        <div class=\"tw\"><table><thead><tr>\n          <th onclick=\"ordena('codigo')\">Cód.</th><th onclick=\"ordena('km')\">Posição</th><th onclick=\"ordena('item')\">Item</th><th onclick=\"ordena('lado')\">Lado</th><th onclick=\"ordena('estado')\">Estado</th><th>📷</th>\n        </tr></thead><tbody id=\"tb\"></tbody></table></div></div>\n    </div>\n  </div>\n</div>\n</main>\n<div class=\"modal\" id=\"modal\" onclick=\"if(event.target===this)this.style.display='none'\"><div class=\"box\" id=\"mbox\"></div></div>\n\n<script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script>\n<script src=\"https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js\"></script>\n<script>\nconst COR = { 'Bom': '#2E7D32', 'Regular': '#F9A825', 'Danificada': '#EF6C00', 'Ausente': '#C62828', 'Desbotada / sem retrorrefletância': '#8D6E63',\n  'Torta / desalinhada': '#6D4C41', 'Encoberta (vegetação)': '#558B2F', 'Pichada / vandalizada': '#7B1FA2' };\nconst MOD = { mz: 'Marco Zero', slir: 'SLIR', sh: 'Sinalização Horizontal', sv: 'Sinalização Vertical' };\nconst FIG = 'https://raw.githubusercontent.com/dvabrao/dva-roads/main/web/img/placas/';\nconst $ = id => document.getElementById(id);\nconst esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));\nlet chave = '', info = null, sessoes = [], rows = [], vis = [], fEstado = '', ord = { k: 'km', d: 1 }, mapa, camada, trilhas;\ntry { chave = localStorage.getItem('dvar_chave') || ''; } catch (e) {}\n\nasync function post(rota, corpo) {\n  const r = await fetch('/api/' + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ chave }, corpo || {})) });\n  if (rota === 'foto') { if (!r.ok) throw new Error('foto'); return r.blob(); }\n  const d = await r.json(); if (!r.ok) throw new Error(d.erro || r.status); return d;\n}\nasync function entrar() {\n  if ($('k').value.trim()) chave = $('k').value.trim();\n  $('l-msg').textContent = 'Verificando…';\n  try { info = await post('login'); } catch (e) { $('l-msg').textContent = '⚠️ ' + e.message; return; }\n  try { localStorage.setItem('dvar_chave', chave); } catch (e) {}\n  $('login').style.display = 'none'; $('app').style.display = 'block'; $('b-sair').style.display = '';\n  $('h-cli').textContent = info.cliente + (info.validade ? ' · licença até ' + info.validade.split('-').reverse().join('/') : '');\n  const d = await post('sessoes'); sessoes = d.sessoes;\n  if (info.admin) $('f-cli-w').style.display = '';\n  opcoes(); filtraSessoes();\n}\nfunction sair() { try { localStorage.removeItem('dvar_chave'); } catch (e) {} location.reload(); }\nfunction opts(id, vals, todos) { const v = $(id).value; $(id).innerHTML = `<option value=\"\">${todos}</option>` + [...new Set(vals.filter(Boolean))].sort().map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join(''); }\nfunction opcoes() {\n  opts('f-cli', sessoes.map(s => s.cliente), 'Todos'); opts('f-mod', sessoes.map(s => MOD[s.modulo] || s.modulo), 'Todos');\n  opts('f-rod', sessoes.map(s => s.rodovia), 'Todas'); opts('f-org', sessoes.map(s => s.orgao), 'Todos'); opts('f-tipo', sessoes.map(s => s.tipo), 'Todos');\n}\nfunction sessoesFiltradas() {\n  const c = $('f-cli').value, m = $('f-mod').value, r = $('f-rod').value, o = $('f-org').value, t = $('f-tipo').value;\n  return sessoes.filter(s => (!c || s.cliente === c) && (!m || (MOD[s.modulo] || s.modulo) === m) && (!r || s.rodovia === r) && (!o || s.orgao === o) && (!t || s.tipo === t));\n}\nconst dt = (t) => t ? new Date(t).toLocaleDateString('pt-BR') : '';\nfunction filtraSessoes() {\n  const l = sessoesFiltradas();\n  $('s-cont').textContent = l.length + ' de ' + sessoes.length;\n  $('ses').innerHTML = l.map(s => `<label><input type=\"checkbox\" value=\"${esc(s.id)}\" checked style=\"width:auto\">\n    <span><b>${esc(s.nome)}</b><br><small>${esc([MOD[s.modulo] || s.modulo, s.rodovia, s.tipo, s.orgao].filter(Boolean).join(' · '))}<br>${dt(s.ini)} · ${s.nitens || 0} registros${info.admin ? ' · ' + esc(s.cliente) : ''}</small></span></label>`).join('')\n    || '<span class=\"muted\">Nenhuma sessão enviada ainda. No app: Exportar → ☁️ Enviar ao painel web.</span>';\n}\nfunction marcar(v) { document.querySelectorAll('#ses input').forEach(i => i.checked = v); }\nconst GRUPO = { placa: 'Placa', seg: 'Defensa / barreira', disp: 'Dispositivo', ia: 'Verificação por IA', ponto: 'Ponto' };\n\nasync function carregar() {\n  const ids = [...document.querySelectorAll('#ses input:checked')].map(i => i.value);\n  if (!ids.length) { alert('Marque ao menos uma sessão.'); return; }\n  const d = await post('dados', { ids, trajeto: true, cliente: $('f-cli').value || undefined });\n  rows = []; const tr = [];\n  d.sessoes.forEach(s => {\n    if (s.trajeto && s.trajeto.length) tr.push(s.trajeto.map(p => [p[0], p[1]]));\n    (s.eventos || []).forEach(ev => {\n      const dd = ev.dados || {};\n      rows.push({ cliente: s.cliente, sid: s.id, sessao: s.nome, rodovia: s.rodovia, orgao: s.orgao, tipoLev: s.tipo,\n        codigo: ev.codigo || '', posicao: ev.posicao || '', km: ev.km, est: ev.est, item: ev.item || ev.rotulo || '', cat: ev.categoria || GRUPO[ev.grupo] || ev.grupo || '',\n        lado: ev.ladoTxt || '', estado: dd.estado || '', obs: ev.obs || '', detalhes: ev.detalhes || '', fotos: ev.fotos || [], lat: ev.lat, lon: ev.lon, t: ev.t, fig: ev.figura || '' });\n    });\n  });\n  trilhas = tr; fEstado = '';\n  opts('f-cat', rows.map(r => r.cat), 'Todos'); opts('f-lado', rows.map(r => r.lado), 'Todos');\n  $('res').style.display = 'block'; aplica();\n}\nfunction aplica() {\n  const c = $('f-cat').value, l = $('f-lado').value, q = $('f-busca').value.trim().toLowerCase();\n  const base = rows.filter(r => (!c || r.cat === c) && (!l || r.lado === l) && (!q || [r.codigo, r.item, r.obs, r.detalhes, r.sessao].join(' ').toLowerCase().includes(q)));\n  const cont = {}; base.forEach(r => { if (r.estado) cont[r.estado] = (cont[r.estado] || 0) + 1; });\n  $('kpis').innerHTML = `<div class=\"kpi ${fEstado ? '' : 'on'}\" onclick=\"fEstado='';aplica()\"><div class=\"n\">${base.length}</div><div class=\"t\">Todos</div></div>` +\n    Object.keys(cont).sort((a, b) => cont[b] - cont[a]).map(e => `<div class=\"kpi ${fEstado === e ? 'on' : ''}\" onclick=\"fEstado='${esc(e)}';aplica()\"><div class=\"n\" style=\"color:${COR[e] || '#333'}\">${cont[e]}</div><div class=\"t\"><span class=\"dot\" style=\"background:${COR[e] || '#999'}\"></span>${esc(e)}</div></div>`).join('');\n  vis = base.filter(r => !fEstado || r.estado === fEstado);\n  vis.sort((a, b) => { const x = a[ord.k], y = b[ord.k]; return (x == null ? 1e12 : x) > (y == null ? 1e12 : y) ? ord.d : -ord.d; });\n  $('t-cont').textContent = vis.length + ' itens';\n  $('tb').innerHTML = vis.map((r, i) => `<tr onclick=\"detalhe(${i})\"><td><b>${esc(r.codigo)}</b></td><td style=\"white-space:nowrap\">${esc(r.posicao)}</td>\n    <td>${r.fig ? `<img class=\"fig\" src=\"${FIG + r.fig}.png\" onerror=\"this.remove()\"> ` : ''}${esc(r.item)}<br><span class=\"muted\">${esc(r.cat)}${info.admin && !$('f-cli').value ? ' · ' + esc(r.cliente) : ''}</span></td>\n    <td>${esc(r.lado)}</td><td>${r.estado ? `<span class=\"dot\" style=\"background:${COR[r.estado] || '#999'}\"></span>${esc(r.estado)}` : ''}</td><td>${r.fotos.length || ''}</td></tr>`).join('');\n  desenhaMapa();\n}\nfunction ordena(k) { ord = { k, d: ord.k === k ? -ord.d : 1 }; aplica(); }\nfunction desenhaMapa() {\n  if (!mapa) { mapa = L.map('mapa'); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa); }\n  if (camada) camada.remove(); camada = L.layerGroup().addTo(mapa);\n  (trilhas || []).forEach(t => L.polyline(t, { color: '#111D3D', weight: 3, opacity: .5 }).addTo(camada));\n  const pts = [];\n  vis.forEach((r, i) => { if (r.lat == null) return; pts.push([r.lat, r.lon]);\n    L.circleMarker([r.lat, r.lon], { radius: 7, color: '#fff', weight: 2, fillColor: COR[r.estado] || '#1565C0', fillOpacity: 1 })\n      .bindTooltip(esc(r.codigo + ' · ' + r.item)).on('click', () => detalhe(i)).addTo(camada); });\n  if (pts.length) mapa.fitBounds(pts, { padding: [30, 30], maxZoom: 17 }); else mapa.setView([-21.17, -47.81], 8);\n}\nasync function detalhe(i) {\n  const r = vis[i];\n  $('mbox').innerHTML = `<div class=\"row\"><h3 style=\"margin:0;flex:1\">${r.fig ? `<img class=\"fig\" style=\"width:44px;height:44px\" src=\"${FIG + r.fig}.png\" onerror=\"this.remove()\"> ` : ''}${esc(r.codigo)} · ${esc(r.item)}</h3><button class=\"btn g\" onclick=\"$('modal').style.display='none'\">✕</button></div>\n    <p><b>${esc(r.posicao)}</b><br>${esc([r.cat, r.lado && 'Lado ' + r.lado, r.estado].filter(Boolean).join(' · '))}<br>\n    ${r.detalhes ? esc(r.detalhes) + '<br>' : ''}${r.obs ? 'Obs.: ' + esc(r.obs) + '<br>' : ''}\n    <span class=\"muted\">${esc(r.sessao)} · ${esc(r.rodovia || '')} · ${r.t ? new Date(r.t).toLocaleString('pt-BR') : ''}${r.lat != null ? ` · <a target=\"_blank\" href=\"https://www.google.com/maps?q=${r.lat},${r.lon}\">ver no Google Maps</a>` : ''}</span></p>\n    <div id=\"m-fotos\">${r.fotos.length ? 'Carregando fotos…' : '<span class=\"muted\">Sem fotos</span>'}</div>`;\n  $('modal').style.display = 'flex';\n  const out = [];\n  for (const f of r.fotos) {\n    try { const b = await post('foto', { sessao: r.sid, nome: f, cliente: r.cliente }); out.push(`<img class=\"ft\" src=\"${URL.createObjectURL(b)}\">`); }\n    catch (e) { out.push(`<p class=\"muted\">${esc(f)}: ainda não enviada</p>`); }\n  }\n  if (r.fotos.length) $('m-fotos').innerHTML = out.join('');\n}\nfunction excel() {\n  const dados = vis.map(r => ({ 'Cliente': r.cliente, 'Sessão': r.sessao, 'Rodovia': r.rodovia, 'Órgão': r.orgao, 'Tipo de levantamento': r.tipoLev,\n    'Código': r.codigo, 'Posição': r.posicao, 'Km': r.km != null ? +(+r.km).toFixed(3) : '', 'Tipo de item': r.cat, 'Item': r.item, 'Lado': r.lado, 'Estado': r.estado,\n    'Detalhes': r.detalhes, 'Observação': r.obs, 'Fotos': r.fotos.length, 'Latitude': r.lat, 'Longitude': r.lon, 'Data': r.t ? new Date(r.t).toLocaleString('pt-BR') : '' }));\n  if (!info.admin) dados.forEach(d => delete d['Cliente']);\n  const ws = XLSX.utils.json_to_sheet(dados); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Inventário');\n  XLSX.writeFile(wb, 'DVA_Roads_inventario_' + new Date().toISOString().slice(0, 10) + '.xlsx');\n}\nif (chave) { $('k').value = ''; entrar(); }\n$('k').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });\n</script>\n</body>\n</html>\n";
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
Caso contrário (indicação/orientação de destino, serviços, educativa, turística, obras), use tipo "texto":
- "esquema": verde (localidades), azul (rodovias/apoio operacional), marrom (turístico), branco (educativa), amarelo, laranja (obras);
- "classe": "0" (pista dupla/expressa, placas grandes), "Ib" ou "II" (pista simples) — estime;
- "linhas": de cima para baixo, até 5; cada linha com "texto" exatamente como escrito (respeite maiúsculas e acentos),
  "seta" (E esquerda, IE inclinada à esquerda, F em frente, ID inclinada à direita, D direita, ou vazio),
  "dist" (ex.: "12 km", "500 m", ou vazio), "escudo" (ex.: "SP 330", "BR 050", ou vazio) e "tarja" (true se houver linha divisória abaixo dela).
Responda SOMENTE com JSON:
{"tipo":"texto|placa","codigo":"","valor":"","complementar":"","esquema":"","classe":"","linhas":[{"texto":"","seta":"","dist":"","escudo":"","tarja":false}],"observacoes":"o que não deu para ler"}`;
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
