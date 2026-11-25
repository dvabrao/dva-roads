// ════════════════════════════════════════════════════════════════
//  DVA Roads — envio ao painel web (servidor DVA Roads)
//  Manda a sessão (registros + trajeto) e as fotos que ainda não estão
//  no servidor. Pode reenviar quantas vezes quiser: o servidor substitui.
// ════════════════════════════════════════════════════════════════
const Nuvem = (function () {
  const MAXF = 1280, QF = 0.75;
  const painelUrl = () => IA.url() + '/painel';

  function reduz(b64) {
    return new Promise((ok) => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, MAXF / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        ok(cv.toDataURL('image/jpeg', QF).split(',')[1]);
      };
      im.onerror = () => ok(b64);
      im.src = 'data:image/jpeg;base64,' + b64;
    });
  }
  function pacote(s) {
    const m = Core.M(s);
    const eventos = s.eventos.map(ev => Object.assign({}, ev, { codigo: Core.codigo(s, ev), posicao: posTxt(s, ev) },
      m && m.paraNuvem ? m.paraNuvem(s, ev) : {}));
    // trajeto: no máximo ~4000 pontos
    const tr = s.track || []; const passo = Math.max(1, Math.ceil(tr.length / 4000));
    const trajeto = tr.filter((p, i) => i % passo === 0 || i === tr.length - 1).map(p => [p[0], p[1]]);
    const meta = {}; ['id', 'modulo', 'nome', 'rodovia', 'ini', 'fim', 'params', 'k0', 's0', 'dir', 'modo', 'estSize', 'dist'].forEach(k => meta[k] = s[k]);
    return Object.assign(meta, { eventos, trajeto });
  }
  function status(t) { const e = $('nv-st'); if (e) e.innerHTML = t; }

  async function enviar(pasta) {
    const a = Core.S(); const s = a && a.pasta === pasta ? a : Core.loadSession(pasta);
    if (!s) { toast('Sessão não encontrada'); return; }
    const chave = License.raw(s.modulo);
    UI.modal('☁️ Painel web', `<p class="help" style="font-size:13px">${esc(s.nome)}</p><div id="nv-st" style="font-size:14px;font-weight:600;margin:12px 0">⏳ Enviando registros…</div>
      <div id="nv-fim"></div>`);
    if (!chave) { status('⚠️ Este módulo não tem licença ativa no aparelho.'); return; }
    let r;
    try {
      const resp = await fetch(IA.url() + '/nuvem/sessao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave, sessao: pacote(s) }) });
      r = await resp.json(); if (!resp.ok) throw new Error(r.erro || 'Servidor respondeu ' + resp.status);
    } catch (e) { status('⚠️ ' + esc(/fetch|network/i.test(e.message) ? 'Sem conexão com o servidor. Tente de novo com internet.' : e.message)); return; }
    const faltam = r.faltam || []; let ok = 0, erro = 0;
    for (let i = 0; i < faltam.length; i++) {
      status(`📷 Enviando fotos… ${i + 1} de ${faltam.length}`);
      const b = Store.readB64(Core.dirOf(s) + '/fotos/' + faltam[i]); if (!b) { erro++; continue; }
      try {
        const resp = await fetch(IA.url() + '/nuvem/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave, modulo: s.modulo, sessao: s.id, nome: faltam[i], b64: await reduz(b) }) });
        if (resp.ok) ok++; else erro++;
      } catch (e) { erro++; }
    }
    s.nuvem = { t: Date.now() };
    if (a && a.pasta === s.pasta) Core.persist(s, false);
    else { const c = Object.assign({}, s); delete c.track; Store.writeJSON(Core.dirOf(s) + '/sessao.json', c); }
    status(erro ? `⚠️ Registros enviados; ${erro} foto(s) não foram. Toque em enviar de novo para completar.` : `✅ Enviado: ${s.eventos.length} registros${faltam.length ? ' e ' + ok + ' foto(s)' : ''}.`);
    $('nv-fim').innerHTML = `<p class="help" style="font-size:12.5px">Para ver no computador, abra <b>${esc(painelUrl().replace(/^https?:\/\//, ''))}</b> e entre com a chave de licença.</p>
      <button class="btn-full gray" style="margin-top:8px" onclick="UI.closeModal()">Fechar</button>`;
    buzz(60);
  }
  return { enviar, painelUrl };
})();
