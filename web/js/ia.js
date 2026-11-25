// ════════════════════════════════════════════════════════════════
//  DVA Roads — verificação por IA (foto + descrição → conformidade)
//  O app manda a foto, a descrição (pode ser ditada pelo 🎤 do teclado)
//  e o contexto ao servidor DVA Roads, que consulta a IA.
//  A chave da IA fica só no servidor. Sem internet, a verificação fica
//  pendente e pode ser reenviada depois.
// ════════════════════════════════════════════════════════════════
const IA = (function () {
  const URL_PADRAO = 'https://dva-roads.dvabrao.workers.dev';
  let frozen = null, foto = null, editId = null;
  const url = () => (settings.iaUrl || URL_PADRAO).replace(/\/+$/, '');
  const COR = { sim: '#2E7D32', parcial: '#F9A825', nao: '#C62828', indeterminado: '#607D8B' };
  const TXT = { sim: 'Conforme', parcial: 'Parcialmente conforme', nao: 'Não conforme', indeterminado: 'Não foi possível avaliar' };

  function contexto(s, ev) {
    const m = Core.M(s);
    return { modulo: m ? m.nome : s.modulo, rodovia: s.rodovia, posicao: posTxt(s, ev), sentido: ev.dir === 'D' ? 'decrescente' : 'crescente',
      coordenadas: ev.lat != null ? ev.lat.toFixed(6) + ', ' + ev.lon.toFixed(6) : null, parametros: s.params || {} };
  }
  function htmlResultado(r) {
    if (!r) return '';
    if (r.erro) return `<div class="goto-res" style="display:block;border-color:#C62828;color:#C62828">⚠️ ${esc(r.erro)}</div>`;
    const c = COR[r.conforme] || COR.indeterminado;
    return `<div style="border:2px solid ${c};border-radius:12px;padding:10px 12px;margin-top:10px">
      <div style="font-weight:800;color:${c};font-size:15px">${TXT[r.conforme] || 'Resultado'}</div>
      <div style="font-size:13px;margin:4px 0 6px">${esc(r.resumo || '')}</div>
      ${(r.itens || []).map(i => `<div style="border-top:1px solid var(--border);padding:6px 0;font-size:12.5px;line-height:1.45">
        <b>${esc(i.elemento || '')}</b>${i.gravidade ? ` <span style="font-size:10px;font-weight:800;text-transform:uppercase;color:${i.gravidade === 'alta' ? '#C62828' : i.gravidade === 'media' ? '#EF6C00' : '#607D8B'}">${esc(i.gravidade)}</span>` : ''}<br>
        ${i.situacao ? esc(i.situacao) + '<br>' : ''}${i.problema ? '❗ ' + esc(i.problema) + '<br>' : ''}${i.recomendacao ? '✅ ' + esc(i.recomendacao) + '<br>' : ''}
        ${i.norma ? `<span style="color:var(--sub)">📘 ${esc(i.norma)}</span>` : ''}</div>`).join('')}
      ${r.limites ? `<div style="font-size:11.5px;color:var(--sub);margin-top:6px">Limites: ${esc(r.limites)}</div>` : ''}
      <div style="font-size:10.5px;color:var(--sub);margin-top:6px">Análise automática (${esc(r.modelo || 'IA')}). Confira antes de usar em laudo.</div></div>`;
  }
  function renderFoto() {
    const s = Core.S(); const b = $('ia-cam'); if (!b) return;
    b.className = 'btn-cam' + (foto ? ' has' : ''); b.textContent = foto ? '📷 Trocar foto' : '📷 Tirar foto do local';
    $('ia-prev').innerHTML = foto ? `<img class="photo-prev" src="${Photo.src(s, foto)}">` : '';
  }
  function abrir(ev) {
    const s = Core.S(); if (!s) return;
    editId = ev ? ev.id : null; frozen = ev || Core.pos(s); foto = ev && ev.fotos[0] ? ev.fotos[0] : null;
    const r = ev && ev.dados ? ev.dados.resultado : null;
    UI.modal('🤖 Verificação por IA', `
      <div class="preview-fmt" style="margin-bottom:10px">${esc(posTxt(s, frozen) + ' · ' + fmtCoord(frozen.lat, frozen.lon))}</div>
      <div class="field"><button class="btn-cam" id="ia-cam" onclick="IA.foto()">📷 Tirar foto do local</button><div id="ia-prev"></div></div>
      <div class="field"><label>Descrição do local</label><textarea class="inp" id="ia-txt" rows="4" placeholder="Toque no 🎤 do teclado e fale: o que está vendo, o que acha que está errado...">${esc(ev ? ev.obs : '')}</textarea></div>
      <button class="btn-full" id="ia-go" onclick="IA.enviar()">🤖 Verificar se está conforme a norma</button>
      <div id="ia-res">${htmlResultado(r)}</div>`);
    renderFoto();
  }
  async function enviar() {
    const s = Core.S(); if (!s) return;
    const texto = val('ia-txt').trim();
    if (!foto && !texto) { toast('Tire uma foto ou descreva o local'); return; }
    const m = Core.M(s); const chave = License.raw(s.modulo);
    let ev = editId ? s.eventos.find(e => e.id === editId) : null;
    if (!ev) { ev = Core.addEvent({ grupo: 'ia', cod: 'IA', rotulo: 'Verificação por IA · pendente', obs: texto, fotos: foto ? [foto] : [], dados: { pendente: true } }, frozen); editId = ev.id; }
    else { ev.obs = texto; ev.fotos = foto ? [foto] : []; }
    const btn = $('ia-go'); btn.disabled = true; btn.textContent = '⏳ Analisando...';
    let r;
    try {
      const resp = await fetch(url() + '/ia/verificar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, modulo: s.modulo, texto, imagem: foto ? Store.readB64(Core.dirOf(s) + '/fotos/' + foto) : null, contexto: contexto(s, ev) }) });
      r = await resp.json();
      if (!resp.ok && !r.erro) r = { erro: 'Servidor respondeu ' + resp.status };
    } catch (e) { r = { erro: 'Sem conexão com o servidor. A verificação ficou salva como pendente; tente de novo com internet.' }; }
    if (r.erro) { ev.dados = { pendente: true, ultimoErro: r.erro }; ev.rotulo = 'Verificação por IA · pendente'; }
    else { ev.dados = { resultado: r }; ev.rotulo = 'Verificação por IA · ' + (TXT[r.conforme] || 'resultado'); }
    Core.updateEvent(ev);
    if ($('ia-res')) { $('ia-res').innerHTML = htmlResultado(r); btn.disabled = false; btn.textContent = r.erro ? '🔄 Tentar de novo' : '🔄 Verificar de novo'; }
    if (!r.erro) { buzz(60); toast('🤖 ' + (TXT[r.conforme] || 'Análise pronta')); }
  }
  async function tirarFoto() {
    const s = Core.S(); if (!s) return;
    const ref = editId ? s.eventos.find(e => e.id === editId) : Object.assign({}, frozen, { seq: (s.seq || 0) + 1, fotos: [] });
    const name = await Photo.capture(s, Object.assign({}, ref, { fotos: foto ? [foto] : [] }), Photo.linhasPadrao(s, frozen, 'Verificação de sinalização', [val('ia-txt').trim().slice(0, 60)]));
    if (name) { foto = name; renderFoto(); }
  }
  /** Seção do relatório com as verificações */
  function relatorio(s) {
    const evs = s.eventos.filter(e => e.grupo === 'ia');
    if (!evs.length) return '';
    return '<h2>Verificações por IA</h2>' + evs.map(ev => {
      const r = (ev.dados || {}).resultado;
      return `<table style="margin-bottom:8px"><tbody><tr><td style="width:22%"><b>${Core.codigo(s, ev)}</b><br>${esc(posTxt(s, ev))}</td><td>
        ${r ? `<b style="color:${COR[r.conforme] || '#333'}">${TXT[r.conforme] || ''}</b> — ${esc(r.resumo || '')}
          ${(r.itens || []).map(i => `<br>• <b>${esc(i.elemento || '')}</b>${i.problema ? ': ' + esc(i.problema) : ''}${i.recomendacao ? ' → ' + esc(i.recomendacao) : ''}${i.norma ? ' <i>(' + esc(i.norma) + ')</i>' : ''}`).join('')}`
          : '<i>Pendente (sem resposta do servidor)</i>'}
        ${ev.obs ? `<br><span style="color:#555">Descrição: ${esc(ev.obs)}</span>` : ''}</td></tr></tbody></table>`;
    }).join('') + '<p style="font-size:9.5px;color:#666">Análises geradas automaticamente por IA a partir da foto e da descrição; devem ser conferidas pelo responsável técnico.</p>';
  }
  return { abrir, enviar, foto: tirarFoto, relatorio, url, URL_PADRAO,
    editar(id) { const s = Core.S(); const ev = s && s.eventos.find(e => e.id === id); if (ev) abrir(ev); } };
})();
