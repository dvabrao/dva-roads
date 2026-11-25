// ════════════════════════════════════════════════════════════════
//  DVA Roads — fotos com legenda gravada na imagem
//  As fotos vão para Sessoes/<sessão>/fotos/ — sem limite de quantidade.
// ════════════════════════════════════════════════════════════════
const Photo = (function () {
  const MAX = 1600, Q = 0.82;

  function pick() {
    return new Promise(resolve => {
      const inp = $('cam-in');
      inp.value = '';
      inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
      inp.click();
    });
  }
  function loadImg(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      im.onerror = ko; im.src = url;
    });
  }
  /** Desenha a caixa de legenda no canto inferior direito (mesmo visual do SLIR) */
  function legenda(ctx, w, h, lines) {
    const fs = Math.max(18, Math.round(Math.min(w, h) / 36)), lh = fs * 1.4, padH = fs * 0.7, padV = fs * 0.5, bw = Math.round(fs / 4);
    let maxW = 0;
    lines.forEach(l => { ctx.font = (l.bold ? 'bold ' : '') + fs + 'px ' + (l.mono ? 'monospace' : "'Segoe UI',Arial,sans-serif"); maxW = Math.max(maxW, ctx.measureText(l.text).width); });
    const boxW = Math.min(maxW + padH * 2 + bw, w - 24), boxH = lines.length * lh + padV * 2;
    const x = w - boxW - 12, y = h - boxH - 12;
    ctx.fillStyle = 'rgba(17,29,61,0.88)'; ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = '#FFD740'; ctx.fillRect(x, y, bw, boxH);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    lines.forEach((l, i) => {
      ctx.font = (l.bold ? 'bold ' : '') + fs + 'px ' + (l.mono ? 'monospace' : "'Segoe UI',Arial,sans-serif");
      ctx.fillStyle = l.color || '#FFFFFF';
      ctx.fillText(l.text, x + boxW - padH, y + padV + lh * i + lh / 2, boxW - padH * 2 - bw);
    });
  }
  /** Linhas padrão da legenda para um registro */
  function linhasPadrao(s, ev, titulo, extras) {
    const L = [{ text: 'DVA ROADS · ' + APP.empresa.toUpperCase(), bold: true, color: '#FFD740' }];
    if (titulo) L.push({ text: String(titulo).toUpperCase().slice(0, 48), bold: true });
    const pt = [];
    if (s.rodovia) pt.push(s.rodovia);
    if (ev.km != null) pt.push('KM ' + fmtKm(ev.km));
    if (ev.est != null) pt.push('EST ' + fmtEst(ev.est, s));
    pt.push(ev.dir === 'D' ? '▼ Decrescente' : '▲ Crescente');
    L.push({ text: pt.join(' · ') });
    (extras || []).forEach(t => t && L.push({ text: String(t).slice(0, 60), color: '#E0E0E0' }));
    if (ev.lat != null) L.push({ text: ev.lat.toFixed(6) + ', ' + ev.lon.toFixed(6), mono: true });
    L.push({ text: new Date(ev.t || Date.now()).toLocaleString('pt-BR') });
    return L;
  }
  /**
   * Abre a câmera, grava a foto com legenda na pasta da sessão.
   * Retorna o nome do arquivo (ex.: "P004_1.jpg") ou null se cancelado.
   */
  async function capture(s, ev, lines) {
    const file = await pick(); if (!file) return null;
    const im = await loadImg(file);
    const k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0, w, h);
    legenda(ctx, w, h, lines);
    const b64 = cv.toDataURL('image/jpeg', Q).split(',')[1];
    const n = (ev.fotos || []).length + 1;
    const name = Core.codigo(s, ev) + '_' + n + '.jpg';
    if (!Store.writeB64(Core.dirOf(s) + '/fotos/' + name, b64)) { toast('⚠️ Não foi possível gravar a foto'); return null; }
    return name;
  }
  function src(s, name) { const b = Store.readB64(Core.dirOf(s) + '/fotos/' + name); return b ? 'data:image/jpeg;base64,' + b : ''; }
  return { capture, src, linhasPadrao };
})();
