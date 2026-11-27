// ════════════════════════════════════════════════════════════════
//  DVA Roads — SV · Diagramação: motor de desenho das placas
//  Tudo em milímetros, origem no canto superior esquerdo da placa.
//  Regras: DER-SP, Manual de Sinalização Rodoviária, Vol. II (2006),
//  item D (dimensionamento dos sinais de indicação), C.3 (setas, escudos,
//  orlas) e A.2/B.2 (dimensões das placas de regulamentação e advertência).
//  Saída: desenho = { L, H, camadas:[{cor, nome, paths:[[[x,y],...],...]}] }
//  (preenchimento par-ímpar: furos de letras e orlas saem certos em
//  SVG, PDF, WMF; no DXF cada contorno vira uma polilinha fechada).
// ════════════════════════════════════════════════════════════════
const DGMotor = (function () {
  const CORES = { verde: '#006B3F', azul: '#0B4EA2', marrom: '#6B4423', branco: '#FFFFFF', preto: '#1A1A1A',
    amarelo: '#FFCC00', laranja: '#F47920', vermelho: '#D01C1F' };
  // ACI do AutoCAD para o DXF
  const ACI = { verde: 94, azul: 5, marrom: 34, branco: 7, preto: 250, amarelo: 2, laranja: 30, vermelho: 1 };
  const col = (c) => CORES[c] || (String(c || '').startsWith('#') ? c : '#000000');
  const hexRGB = (h) => { h = col(h).slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const ACIT = { 1: [255, 0, 0], 2: [255, 255, 0], 3: [0, 255, 0], 4: [0, 255, 255], 5: [0, 0, 255], 6: [255, 0, 255], 7: [255, 255, 255], 8: [128, 128, 128], 9: [192, 192, 192], 30: [255, 127, 0], 34: [153, 76, 0], 94: [0, 127, 0], 250: [51, 51, 51], 252: [130, 130, 130], 40: [255, 191, 0] };
  const aciDe = (rgb) => { let best = 7, bd = 1e9; Object.entries(ACIT).forEach(([k, v]) => { const dd = (v[0] - rgb[0]) ** 2 + (v[1] - rgb[1]) ** 2 + (v[2] - rgb[2]) ** 2; if (dd < bd) { bd = dd; best = +k; } }); return best; };
  const NOMES_COR = { verde: 'Verde', azul: 'Azul', marrom: 'Marrom', branco: 'Branco', preto: 'Preto', amarelo: 'Amarelo', laranja: 'Laranja', vermelho: 'Vermelho' };
  const nomeCor = (c) => NOMES_COR[c] || String(c).toUpperCase();
  const ESQUEMAS = {
    verde: { n: 'Orientação · verde (localidades)', fundo: 'verde', tinta: 'branco' },
    azul: { n: 'Orientação · azul (rodovias) / apoio', fundo: 'azul', tinta: 'branco' },
    marrom: { n: 'Atrativo turístico · marrom', fundo: 'marrom', tinta: 'branco' },
    branco: { n: 'Educativa / complementar · branco', fundo: 'branco', tinta: 'preto' },
    amarelo: { n: 'Complementar de advertência · amarelo', fundo: 'amarelo', tinta: 'preto' },
    laranja: { n: 'Obras · laranja', fundo: 'laranja', tinta: 'preto' },
  };
  // D.1.3.1 orla (a) e afastamento da borda (b); D.1.1 modulação
  const CLASSES = {
    '0': { n: 'Classe 0 e Ia', orla: 30, afast: 20, modH: 500, modV: 500, cantos: 0, hPadrao: 300 },
    'Ib': { n: 'Classe Ib', orla: 20, afast: 10, modH: 250, modV: 200, cantos: 60, hPadrao: 250 },
    'II': { n: 'Classes II, III e IV', orla: 20, afast: 10, modH: 250, modV: 200, cantos: 60, hPadrao: 200 },
  };
  // D.3 — alfabetos séries D e E(M), h = 100 mm: [esq, largura, dir]
  const SERIE_D = { A: [3, 85, 3], B: [12, 68, 5], C: [10, 68, 10], D: [12, 68, 10], E: [12, 62, 5], F: [12, 62, 3], G: [10, 68, 10], H: [12, 68, 12], I: [12, 16, 12],
    J: [3, 64, 12], K: [12, 70, 5], L: [12, 62, 3], M: [12, 78, 12], N: [12, 68, 12], O: [10, 71, 10], P: [12, 68, 3], Q: [10, 71, 10], R: [12, 68, 5], S: [5, 68, 5],
    T: [3, 62, 3], U: [12, 68, 12], V: [3, 76, 3], W: [3, 89, 3], X: [5, 68, 5], Y: [3, 86, 3], Z: [5, 68, 5],
    1: [10, 25, 12], 2: [10, 68, 10], 3: [18, 68, 10], 4: [2, 75, 12], 5: [10, 68, 10], 6: [10, 68, 10], 7: [7, 68, 7], 8: [10, 68, 10], 9: [10, 68, 10], 0: [10, 71, 10],
    '.': [4, 18, 4], ';': [4, 18, 4], ',': [4, 18, 4], '"': [4, 18, 4], '(': [10, 33, 4], ')': [4, 33, 10], '-': [3, 35, 3], '/': [0, 103, 0] };
  const SERIE_EM = { A: [4, 101, 4], B: [14, 81, 8], C: [10, 81, 8], D: [14, 81, 10], E: [14, 74, 7], F: [14, 74, 7], G: [10, 81, 10], H: [14, 81, 14], I: [14, 20, 14],
    J: [4, 76, 14], K: [14, 82, 2], L: [14, 74, 2], M: [14, 93, 14], N: [14, 81, 14], O: [10, 84, 10], P: [14, 81, 4], Q: [10, 84, 10], R: [14, 81, 7], S: [11, 81, 11],
    T: [4, 74, 4], U: [14, 81, 14], V: [4, 92, 4], W: [4, 106, 4], X: [7, 87, 7], Y: [4, 101, 4], Z: [7, 81, 7],
    a: [11, 66, 20], b: [20, 66, 11], c: [11, 66, 11], d: [11, 66, 20], e: [11, 66, 11], f: [10, 42, 11], g: [11, 66, 20], h: [20, 66, 20], i: [20, 20, 20], j: [2, 37, 20],
    k: [20, 66, 11], l: [20, 20, 20], m: [20, 110, 20], n: [20, 66, 20], o: [11, 68, 11], p: [20, 66, 11], q: [11, 66, 20], r: [20, 50, 4], s: [9, 66, 11], t: [9, 52, 12],
    u: [20, 66, 20], v: [9, 77, 9], w: [9, 102, 9], x: [11, 80, 11], y: [9, 85, 9], z: [12, 68, 12],
    1: [12, 30, 14], 2: [11, 81, 11], 3: [5, 81, 10], 4: [3, 93, 14], 5: [11, 81, 11], 6: [10, 81, 10], 7: [6, 81, 10], 8: [10, 81, 10], 9: [10, 81, 10], 0: [10, 84, 10],
    '.': [4, 20, 4], ';': [4, 20, 4], ',': [4, 20, 4], '"': [14, 57, 14], '(': [10, 38, 4], ')': [4, 38, 10], '-': [3, 35, 3], '/': [0, 107, 0] };

  let fonte = null;
  async function carregarFonte() {
    if (fonte) return fonte;
    const r = await fetch('fonts/overpass-600.woff'); const buf = await r.arrayBuffer();
    fonte = opentype.parse(buf); return fonte;
  }
  const base = (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '') || ch;
  const serieDe = (txt, s) => s && s !== 'auto' ? s : (/[a-zà-ú]/.test(txt) || /^\d/.test(txt) ? 'EM' : 'D');
  function medidas(ch, serie) {
    const b = base(ch), T = serie === 'D' ? SERIE_D : SERIE_EM;
    if (T[b]) return T[b];
    if (serie === 'D' && SERIE_EM[b]) return SERIE_EM[b].map(v => Math.round(v * 0.85));
    return null;
  }

  // ── geometria básica ──────────────────────────────────────────
  function rrect(x, y, w, h, r) {
    if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    r = Math.min(r, w / 2, h / 2); const p = []; const N = 8;
    const arc = (cx, cy, a0) => { for (let i = 0; i <= N; i++) { const a = a0 + (Math.PI / 2) * i / N; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
    return p;
  }
  const xf = (paths, fn) => paths.map(p => p.map(fn));
  const mover = (paths, dx, dy) => xf(paths, ([x, y]) => [x + dx, y + dy]);

  // ── texto → contornos (série D / E(M) sobre a fonte Overpass) ──
  function flatten(cmds) {
    const out = []; let cur = null, x0 = 0, y0 = 0; const N = 6;
    cmds.forEach(c => {
      if (c.type === 'M') { if (cur && cur.length > 2) out.push(cur); cur = [[c.x, c.y]]; x0 = c.x; y0 = c.y; }
      else if (c.type === 'L') { cur.push([c.x, c.y]); x0 = c.x; y0 = c.y; }
      else if (c.type === 'Q') { for (let i = 1; i <= N; i++) { const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t; cur.push([a * x0 + b * c.x1 + d * c.x, a * y0 + b * c.y1 + d * c.y]); } x0 = c.x; y0 = c.y; }
      else if (c.type === 'C') { for (let i = 1; i <= N; i++) { const t = i / N, a = (1 - t) ** 3, b = 3 * t * (1 - t) ** 2, d = 3 * t * t * (1 - t), e = t ** 3; cur.push([a * x0 + b * c.x1 + d * c.x2 + e * c.x, a * y0 + b * c.y1 + d * c.y2 + e * c.y]); } x0 = c.x; y0 = c.y; }
      else if (c.type === 'Z') { if (cur && cur.length > 2) out.push(cur); cur = null; }
    });
    if (cur && cur.length > 2) out.push(cur);
    return out;
  }
  /** largura total (mm) de um texto na série e altura dadas; palavras separadas por h (D.1.5) */
  function larguraTexto(txt, serie, h) {
    const f = fonte; let w = 0; const pal = String(txt).trim().split(/\s+/).filter(Boolean);
    pal.forEach((p, i) => {
      if (i) w += h;
      for (const ch of p) {
        const m = medidas(ch, serie);
        if (m) w += (m[0] + m[1] + m[2]) * h / 100;
        else if (f) { const g = f.charToGlyph(ch); w += g.advanceWidth * h / f.tables.os2.sCapHeight; }
        else w += 0.8 * h;
      }
    });
    return w;
  }
  /** contornos do texto; (x, yTopo) = canto superior esquerdo da maiúscula */
  function contornosTexto(txt, serie, h, x, yTopo) {
    const f = fonte; const cap = f.tables.os2.sCapHeight, s = h / cap; const out = []; let cx = x;
    const pal = String(txt).trim().split(/\s+/).filter(Boolean);
    pal.forEach((p, i) => {
      if (i) cx += h;
      for (const ch of p) {
        const g = f.charToGlyph(ch), gb = f.charToGlyph(base(ch));
        const bb = gb.getBoundingBox(); const m = medidas(ch, serie);
        let sx = s, larg, esq = 0;
        if (m && bb.x2 > bb.x1) { sx = (m[1] * h / 100) / ((bb.x2 - bb.x1) * 1); esq = m[0] * h / 100; larg = (m[0] + m[1] + m[2]) * h / 100; }
        else { larg = g.advanceWidth * s; esq = 0; }
        const path = g.getPath(0, 0, f.unitsPerEm); // unidades da fonte, y para baixo, linha de base em 0
        const ox = m ? cx + esq - bb.x1 * sx : cx;
        flatten(path.commands).forEach(pl => out.push(pl.map(([px, py]) => [ox + px * sx, yTopo + h + py * s])));
        cx += larg;
      }
    });
    return out;
  }

  // ── setas DER tipo SO1 (C.3.2): proporções da tabela, em função de h ──
  function setaPoly(h) {
    const a = 1.4 * h, b = 0.88 * h, c = 0.4 * h, d = 0.48 * h, e = 0.12 * h, f = 1.56 * h;
    // apontando para cima, base no (0,0), y para cima
    return [[0, f], [a / 2, f - b], [d / 2, f - b + e], [d / 2, 0], [-d / 2, 0], [-d / 2, f - b + e], [-a / 2, f - b]];
  }
  const ANG = { F: 0, D: -90, E: 90, ID: -45, IE: 45, B: 180, BD: -135, BE: 135 };
  function seta(dir, h) {
    const ang = (ANG[dir] || 0) * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
    let p = setaPoly(h).map(([x, y]) => [x * cs - y * sn, -(x * sn + y * cs)]); // gira e inverte y (tela)
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    p = p.map(([x, y]) => [x - x0, y - y0]);
    return { w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, paths: [p] };
  }

  // ── escudos (C.3.3): estadual pentágono; federal brasão ──
  function escudo(cod, h) {
    const m = String(cod || '').toUpperCase().replace(/\s+/g, '').match(/^(SP|SPA|SPI|SPM|BR)-?(\d+)(\/?\d*)$/);
    if (!m) return null;
    const sig = m[1], num = m[2] + (m[3] || '');
    const tres = num.length >= 3;
    const a = 2.1 * h * (tres ? 1.25 : 1), c = 1.713 * h * (tres ? 1.25 : 1), e = 1.133 * h, f = 0.6 * h;
    const W = a, H = e + f; const i = h / 15, j = h / 30;
    const fundo = [], borda = [], tx = [];
    if (sig === 'BR') {
      const pts = []; const N = 12;
      pts.push([0, 0.12 * H], [W * 0.5, 0], [W, 0.12 * H], [W, 0.55 * H]);
      for (let k = 1; k < N; k++) { const t = k / N; pts.push([W - W * 0.5 * Math.sin(t * Math.PI / 2), 0.55 * H + 0.45 * H * Math.sin(t * Math.PI / 2) * 1]); }
      pts.push([W / 2, H]);
      for (let k = N - 1; k > 0; k--) { const t = k / N; pts.push([W * 0.5 * Math.sin(t * Math.PI / 2), 0.55 * H + 0.45 * H * Math.sin(t * Math.PI / 2)]); }
      pts.push([0, 0.55 * H]);
      fundo.push(pts);
      const k2 = 1 - 2 * i / W, cx = W / 2, cy = H / 2;
      const ext = pts.map(([x, y]) => [cx + (x - cx) * k2, cy + (y - cy) * (1 - 2 * i / H)]);
      const int = pts.map(([x, y]) => [cx + (x - cx) * (k2 - 2 * j / W), cy + (y - cy) * (1 - 2 * (i + j) / H)]);
      borda.push(ext, int);
    } else {
      const pent = (k) => [[W / 2, k], [W - k * 1.05, f + k * 0.3], [W / 2 + c / 2 - k * 0.6, H - k], [W / 2 - c / 2 + k * 0.6, H - k], [k * 1.05, f + k * 0.3]];
      fundo.push(pent(0)); borda.push(pent(i), pent(i + j));
    }
    const h1 = h / 3, h2 = 2 * h / 3;
    const w1 = larguraTexto(sig, 'D', h1), w2 = larguraTexto(num, 'D', h2);
    tx.push(...contornosTexto(sig, 'D', h1, W / 2 - w1 / 2, f * 0.62));
    tx.push(...contornosTexto(num, 'D', h2, W / 2 - w2 / 2, f * 0.62 + h1 + 0.15 * h));
    return { w: W, h: H, fundo, borda, tx };
  }

  // ── placa de texto (indicação, educativa, obras, complementar) ──
  function placaTexto(P) {
    const cl = CLASSES[P.classe] || CLASSES.II, es = ESQUEMAS[P.esquema] || ESQUEMAS.verde;
    const C = cl.orla + cl.afast, avisos = [];
    const linhas = (P.linhas || []).filter(l => (l.texto || '').trim() || l.seta || l.escudo || (l.dist || '').trim() || (l.img && l.img.src));
    if (!linhas.length) linhas.push({ texto: 'Texto', h: cl.hPadrao });
    const R = linhas.map(l => {
      const h = +l.h || cl.hPadrao, sTx = serieDe(l.texto || '', l.serie);
      const tw = (l.texto || '').trim() ? larguraTexto(l.texto, sTx, h) : 0;
      const dist = (l.dist || '').trim(); const dw = dist ? larguraTexto(dist, 'EM', h) : 0;
      const st = l.seta ? seta(l.seta, h) : null; const esc = l.escudo ? escudo(l.escudo, h) : null;
      if (l.escudo && !esc) avisos.push('Escudo “' + l.escudo + '” não reconhecido (use SP 330 ou BR 050).');
      // imagem/logo no início da linha: altura = fator × h da letra
      const im = l.img && l.img.src ? { ...l.img, h: (+l.img.k || 1.5) * h } : null; if (im) im.w = im.h * (im.ar || 1);
      const partes = [st ? st.w : 0, im ? im.w : 0, esc ? esc.w : 0, tw, dw].filter(v => v > 0);
      const w = partes.reduce((a, b) => a + b, 0) + Math.max(0, partes.length - 1) * h;
      const rh = Math.max(h, st ? st.h : 0, esc ? esc.h : 0, im ? im.h : 0);
      return { l, h, sTx, tw, dist, dw, st, esc, im, w, rh };
    });
    let Wi = Math.max(...R.map(r => r.w + 1.5 * r.h));
    let Hi = 0.75 * R[0].h + 0.75 * R[R.length - 1].h + R.reduce((a, r) => a + r.rh, 0);
    for (let i = 0; i < R.length - 1; i++) Hi += R[i].l.tarja ? 0.75 * R[i].h + cl.orla + 0.75 * R[i + 1].h : 0.75 * Math.max(R[i].h, R[i + 1].h);
    let L = Wi + 2 * C, H = Hi + 2 * C;
    const calc = { L: Math.round(L), H: Math.round(H) };
    if (P.modular !== false) { L = Math.ceil(L / cl.modH - 1e-6) * cl.modH; H = Math.ceil(H / cl.modV - 1e-6) * cl.modV; }
    if (+P.L) { if (+P.L < calc.L) avisos.push('Largura informada menor que a necessária (' + calc.L + ' mm).'); L = +P.L; }
    if (+P.H) { if (+P.H < calc.H) avisos.push('Altura informada menor que a necessária (' + calc.H + ' mm).'); H = +P.H; }
    // sobra vertical distribuída nos espaços
    const nGaps = R.length + 1, extraV = Math.max(0, (H - 2 * C) - Hi) / nGaps;
    const cam = { fundo: [], orla: [], tinta: [], escF: [], escB: [] };
    cam.fundo.push(rrect(0, 0, L, H, cl.cantos));
    cam.orla.push(rrect(cl.afast, cl.afast, L - 2 * cl.afast, H - 2 * cl.afast, 50), rrect(C, C, L - 2 * C, H - 2 * C, Math.max(5, 50 - cl.orla)));
    let y = C + 0.75 * R[0].h + extraV;
    const info = { orla: cl.orla, afast: cl.afast, cantos: cl.cantos, raioOrla: 50, rows: [], tarjas: [], tinta: es.tinta, fundo: es.fundo };
    const imagens = [];
    R.forEach((r, i) => {
      const xl = C + 0.75 * r.h, xr = L - C - 0.75 * r.h;
      const temD = r.st && /D/.test(r.l.seta) && r.l.seta !== 'F', temE = r.st && !temD;
      const cy = y + r.rh / 2; const yTxt = cy - r.h / 2;
      let x;
      if (r.dist) x = xl; else if (temD) x = xr - r.w; else if (temE) x = xl; else x = (L - r.w) / 2;
      const el = []; const rowTop = y;
      if (temE) { cam.tinta.push(...mover(r.st.paths, x, cy - r.st.h / 2)); el.push({ tipo: 'Seta', x, w: r.st.w, y: cy - r.st.h / 2, h: r.st.h }); x += r.st.w + r.h; }
      if (r.im) { imagens.push({ x, y: cy - r.im.h / 2, w: r.im.w, h: r.im.h, src: r.im.src, iw: r.im.iw, ih: r.im.ih, nome: r.im.nome || 'Imagem' }); el.push({ tipo: 'Imagem', x, w: r.im.w, y: cy - r.im.h / 2, h: r.im.h }); x += r.im.w + r.h; }
      if (r.esc) { cam.escF.push(...mover(r.esc.fundo, x, cy - r.esc.h / 2)); cam.escB.push(...mover(r.esc.borda, x, cy - r.esc.h / 2), ...mover(r.esc.tx, x, cy - r.esc.h / 2)); el.push({ tipo: 'Escudo', x, w: r.esc.w, y: cy - r.esc.h / 2, h: r.esc.h }); x += r.esc.w + r.h; }
      if (r.tw) { cam.tinta.push(...contornosTexto(r.l.texto, r.sTx, r.h, x, yTxt)); el.push({ tipo: 'Texto', x, w: r.tw, y: yTxt, h: r.h, txt: r.l.texto, serie: r.sTx, hl: r.h }); x += r.tw + r.h; }
      if (r.dist) { const xd = temD ? xr - r.st.w - r.h - r.dw : xr - r.dw; cam.tinta.push(...contornosTexto(r.dist, 'EM', r.h, xd, yTxt)); el.push({ tipo: 'Texto', x: xd, w: r.dw, y: yTxt, h: r.h, txt: r.dist, serie: 'EM', hl: r.h }); }
      if (temD) { cam.tinta.push(...mover(r.st.paths, xr - r.st.w, cy - r.st.h / 2)); el.push({ tipo: 'Seta', x: xr - r.st.w, w: r.st.w, y: cy - r.st.h / 2, h: r.st.h }); }
      el.sort((a, b) => a.x - b.x); info.rows.push({ y: rowTop, h: r.rh, el });
      y += r.rh;
      if (i < R.length - 1) {
        if (r.l.tarja) { y += 0.75 * r.h + extraV / 2; cam.orla.push(rrect(C, y, L - 2 * C, cl.orla, 0)); info.tarjas.push({ y, h: cl.orla }); y += cl.orla + 0.75 * R[i + 1].h + extraV / 2; }
        else y += 0.75 * Math.max(r.h, R[i + 1].h) + extraV;
      }
    });
    return {
      L, H, calc, avisos, info, imagens,
      camadas: [
        { nome: 'FUNDO', cor: es.fundo, paths: cam.fundo },
        { nome: 'ORLA_TARJA', cor: es.tinta, paths: cam.orla },
        { nome: 'ESCUDO', cor: 'branco', paths: cam.escF },
        { nome: 'ESCUDO_TEXTO', cor: 'preto', paths: cam.escB },
        { nome: 'TEXTO_SETAS', cor: es.tinta, paths: cam.tinta },
      ].filter(c => c.paths.length),
    };
  }

  // ── placas do catálogo (R e A) com pictograma vetorial do DER ──
  const TAMANHOS = { I: 800, II: 1000, III: 1200 };

  // ── dispositivos auxiliares (DER-SP V.II, seção F): marcador de alinhamento MA e marcadores de perigo MP-1/2/3 ──
  const DISPOSITIVOS = { 'MA-D': 'Marcador de alinhamento · seta à direita', 'MA-E': 'Marcador de alinhamento · seta à esquerda',
    'MA-N': 'Marcador de alinhamento · numerado', 'MP-1': 'Marcador de perigo MP-1', 'MP-2': 'Marcador de perigo MP-2', 'MP-3': 'Marcador de perigo MP-3 (em V)' };
  // recorta polígono convexo por retângulo (Sutherland–Hodgman)
  function recorta(poly, x0, y0, x1, y1) {
    const lados = [[p => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
      [p => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
      [p => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
      [p => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
    let out = poly;
    for (const [dentro, corta] of lados) {
      const inp = out; out = [];
      for (let i = 0; i < inp.length; i++) {
        const a = inp[i], b = inp[(i + 1) % inp.length];
        if (dentro(b)) { if (!dentro(a)) out.push(corta(a, b)); out.push(b); } else if (dentro(a)) out.push(corta(a, b));
      }
      if (!out.length) break;
    }
    return out.length >= 3 ? out : null;
  }
  function dispositivo(P) {
    const c = P.codigo, cams = [], avisos = [];
    if (/^MA/.test(c)) {
      const W = 500, H = 600;
      if (c === 'MA-N') {
        cams.push({ nome: 'FUNDO', cor: 'amarelo', paths: [rrect(0, 0, W, H, 20)] });
        const t = String(P.valor || '10'), h = 250, w = larguraTexto(t, 'D', h);
        cams.push({ nome: 'TEXTO', cor: 'preto', paths: contornosTexto(t, 'D', h, W / 2 - w / 2, 175) });
        if (w > W - 60) avisos.push('Número largo demais para a placa.');
      } else {
        cams.push({ nome: 'FUNDO', cor: 'preto', paths: [rrect(0, 0, W, H, 20)] });
        let ch = [[40, 40], [260, 40], [460, 300], [260, 560], [40, 560], [240, 300]];
        if (c === 'MA-E') ch = ch.map(([x, y]) => [W - x, y]).reverse();
        cams.push({ nome: 'SIMBOLO', cor: 'amarelo', paths: [ch] });
      }
      return { L: W, H, calc: { L: W, H }, avisos, camadas: cams };
    }
    // MP: classes 0 e I (Tipo II/III) 0,50 × 1,50 m; classes II, III e IV (Tipo I) 0,30 × 0,80 m; faixas de 0,10 m a 45°
    const grande = P.tipoTam && P.tipoTam !== 'I';
    const W = grande ? 500 : 300, H = grande ? 1500 : 800, f = 100 * Math.SQRT2, pretas = [];
    if (c === 'MP-3') {
      // faixas em V (ponta para baixo): u = y + |x − W/2|; cada metade é um paralelogramo convexo
      for (let u = -W; u < H + W; u += 2 * f) {
        for (const lado of [-1, 1]) {
          const x0 = W / 2, x1 = lado < 0 ? 0 : W, d = W / 2;
          const poly = [[x0, u], [x0, u + f], [x1, u + f - d], [x1, u - d]];
          const r = recorta(lado < 0 ? poly : poly.slice().reverse(), Math.min(x0, x1), 0, Math.max(x0, x1), H); if (r) pretas.push(r);
        }
      }
    } else {
      // MP-1: faixas "/" (x + y = cte), canto inferior direito preto; MP-2 espelhado
      for (let k = W + H; k > -2 * f; k -= 2 * f) {
        const poly = [[k - H - f, H], [k - H, H], [k, 0], [k - f, 0]];
        const r = recorta(poly, 0, 0, W, H); if (r) pretas.push(c === 'MP-2' ? r.map(([x, y]) => [W - x, y]).reverse() : r);
      }
    }
    cams.push({ nome: 'FUNDO', cor: 'amarelo', paths: [rrect(0, 0, W, H, 0)] });
    cams.push({ nome: 'FAIXAS', cor: 'preto', paths: pretas });
    return { L: W, H, calc: { L: W, H }, avisos, camadas: cams };
  }

  function placaCatalogo(P) {
    if (DISPOSITIVOS[P.codigo]) return dispositivo(P);
    const pic = (window.DG_PICTOS || {})[P.codigo]; const avisos = [];
    if (!pic) return { L: 800, H: 800, avisos: ['Sem desenho vetorial para ' + P.codigo + '.'], camadas: [] };
    // R: diâmetro (ou largura do octógono / lado do triângulo); A: lado do quadrado girado 45° (diagonal = lado × √2)
    let S = TAMANHOS[P.tipoTam] || +P.tam || 800;
    if (/^A-26/.test(P.codigo)) S *= 1.2; else if (/^A-/.test(P.codigo)) S *= Math.SQRT2;
    let cams = pic.c.map(c => ({ nome: c.cor.toUpperCase(), cor: c.cor, paths: xf(c.paths, ([x, y]) => [x * S, y * S]) }));
    const W = pic.w * S, Hs = pic.h * S;
    if (P.codigo === 'R-19' && P.valor) {
      // troca o número da velocidade: remove a camada preta e escreve o valor (série D) + km/h
      cams = cams.filter(c => c.cor !== 'preto');
      const hN = 0.3 * S, wN = larguraTexto(P.valor, 'D', hN);
      const hK = 0.075 * S, wK = larguraTexto('km/h', 'EM', hK);
      cams.push({ nome: 'TEXTO', cor: 'preto', paths: [...contornosTexto(P.valor, 'D', hN, W / 2 - wN / 2, Hs * 0.3), ...contornosTexto('km/h', 'EM', hK, W / 2 - wK / 2, Hs * 0.68)] });
    }
    let L = W, H = Hs;
    if ((P.compl || '').trim()) {
      const opc = { esquema: /^A/.test(P.codigo) ? 'amarelo' : 'branco', classe: 'II', modular: false,
        linhas: P.compl.split('\n').map(t => ({ texto: t, h: Math.round(S * 0.15 / 10) * 10 || 100 })) };
      let cp = placaTexto(opc);
      if (cp.calc.L <= W) cp = placaTexto(Object.assign(opc, { L: Math.round(W) }));   // mesma largura da placa
      const gap = 50, dx = Math.max(0, (W - cp.L) / 2), dxS = Math.max(0, (cp.L - W) / 2);
      cams = cams.map(c => ({ ...c, paths: mover(c.paths, dxS, 0) }));
      cp.camadas.forEach(c => cams.push({ ...c, nome: 'COMPL_' + c.nome, paths: mover(c.paths, dx, Hs + gap) }));
      L = Math.max(W, cp.L); H = Hs + gap + cp.H; avisos.push(...cp.avisos);
    }
    return { L, H, calc: { L: Math.round(L), H: Math.round(H) }, avisos, camadas: cams };
  }

  // ── placa composta retangular: sinal R/A + setas + textos (ex.: lombada com seta ↘) ──
  function pictoEm(cod, h) {
    const sau = (window.DG_SAU || {})[cod];
    if (sau) {
      // pictograma de serviço: quadro branco h × h com o símbolo a 80% (padrão DER)
      const m = 0.1 * h, k = 0.8 * h / Math.max(sau.w, sau.h), ox = m + (0.8 * h - sau.w * k) / 2, oy = m + (0.8 * h - sau.h * k) / 2;
      return { w: h, h, camadas: [{ cor: 'branco', paths: [rrect(0, 0, h, h, 0)] }].concat(sau.c.map(c => ({ cor: c.cor, paths: xf(c.paths, ([x, y]) => [ox + x * k, oy + y * k]) }))) };
    }
    const pic = (window.DG_PICTOS || {})[cod]; if (!pic) return null;
    const S = h / pic.h;
    return { w: pic.w * S, h: pic.h * S, camadas: pic.c.map(c => ({ cor: c.cor, paths: xf(c.paths, ([x, y]) => [x * S, y * S]) })) };
  }
  function placaComposta(P) {
    const cl = CLASSES[P.classe] || CLASSES.II, es = ESQUEMAS[P.esquema] || ESQUEMAS.amarelo, avisos = [];
    const C = cl.orla + cl.afast;
    const its = (P.itens || []).map(it => {
      const h = +it.h || 200;
      if (it.k === 'picto') { const pc = pictoEm(it.codigo, h); if (!pc) { avisos.push('Sinal ' + (it.codigo || '?') + ' sem desenho.'); return null; } return { it, w: pc.w, h: pc.h, u: 0.2 * h, pc }; }
      if (it.k === 'seta') { const st = seta(it.dir || 'BD', h); return { it, w: st.w, h: st.h, u: h, st }; }
      if (it.k === 'img') { if (!it.src) return null; return { it, w: h * (it.ar || 1), h, u: 0.2 * h, img: true }; }
      const tx = (it.texto || '').trim(); if (!tx) return null;
      const sr = serieDe(tx, it.serie); return { it, w: larguraTexto(tx, sr, h), h, u: h, sr, tx };
    }).filter(Boolean);
    if (!its.length) return { L: 800, H: 400, avisos: ['Acrescente um sinal, seta ou texto.'], camadas: [] };
    const u = Math.max(...its.map(i => i.u)), gap = +P.gap || u, mg = 0.75 * u;
    const linha = (P.arranjo || 'linha') === 'linha';
    const Wi = linha ? its.reduce((a, i) => a + i.w, 0) + gap * (its.length - 1) : Math.max(...its.map(i => i.w));
    const Hi = linha ? Math.max(...its.map(i => i.h)) : its.reduce((a, i) => a + i.h, 0) + gap * (its.length - 1);
    let L = Wi + 2 * (mg + C), H = Hi + 2 * (mg + C); const calc = { L: Math.round(L), H: Math.round(H) };
    if (P.modular) { L = Math.ceil(L / cl.modH - 1e-6) * cl.modH; H = Math.ceil(H / cl.modV - 1e-6) * cl.modV; }
    if (+P.L) { if (+P.L < calc.L) avisos.push('Largura informada menor que a necessária (' + calc.L + ' mm).'); L = +P.L; }
    if (+P.H) { if (+P.H < calc.H) avisos.push('Altura informada menor que a necessária (' + calc.H + ' mm).'); H = +P.H; }
    const cams = [{ nome: 'FUNDO', cor: es.fundo, paths: [rrect(0, 0, L, H, 50)] },
      { nome: 'ORLA', cor: es.tinta, paths: [rrect(cl.afast, cl.afast, L - 2 * cl.afast, H - 2 * cl.afast, 50 - cl.afast), rrect(C, C, L - 2 * C, H - 2 * C, Math.max(5, 50 - C))] }];
    const tinta = [], imagens = [], el = [];
    // conteúdo centralizado na área interna; alinhamento de cada item na direção transversal
    const ix0 = C + mg, iy0 = C + mg, iw = L - 2 * (C + mg), ih = H - 2 * (C + mg);
    let x = ix0 + (linha ? (iw - Wi) / 2 : 0), y = iy0 + (linha ? 0 : (ih - Hi) / 2);
    its.forEach(i => {
      const al = i.it.alinh || 'centro';
      const px = linha ? x : ix0 + (al === 'inicio' ? 0 : al === 'fim' ? iw - i.w : (iw - i.w) / 2);
      const py = linha ? iy0 + (al === 'inicio' ? 0 : al === 'fim' ? ih - i.h : (ih - i.h) / 2) : y;
      if (i.pc) { i.pc.camadas.forEach(c => cams.push({ nome: 'SINAL_' + c.cor.toUpperCase(), cor: c.cor, paths: mover(c.paths, px, py) })); el.push({ tipo: 'Sinal ' + i.it.codigo, x: px, y: py, w: i.w, h: i.h }); }
      else if (i.st) { tinta.push(...mover(i.st.paths, px, py)); el.push({ tipo: 'Seta', x: px, y: py, w: i.w, h: i.h }); }
      else if (i.img) { imagens.push({ x: px, y: py, w: i.w, h: i.h, src: i.it.src, iw: i.it.iw, ih: i.it.ih, nome: i.it.nome || 'Imagem' }); el.push({ tipo: 'Imagem', x: px, y: py, w: i.w, h: i.h }); }
      else { tinta.push(...contornosTexto(i.tx, i.sr, i.h, px, py)); el.push({ tipo: 'Texto', x: px, y: py, w: i.w, h: i.h, txt: i.tx, serie: i.sr, hl: i.h }); }
      if (linha) x += i.w + gap; else y += i.h + gap;
    });
    if (tinta.length) cams.push({ nome: 'TEXTO_SETAS', cor: es.tinta, paths: tinta });
    // prancha: em linha = uma faixa com todos; em coluna = uma faixa por elemento
    const rows = linha ? [{ y: Math.min(...el.map(e => e.y)), h: Math.max(...el.map(e => e.y + e.h)) - Math.min(...el.map(e => e.y)), el }] : el.map(e => ({ y: e.y, h: e.h, el: [e] }));
    return { L, H, calc, avisos, camadas: cams, imagens, info: { orla: cl.orla, afast: cl.afast, cantos: 50, raioOrla: 50, rows, tarjas: [], tinta: es.tinta, fundo: es.fundo } };
  }

  // ── desenho importado (DXF, WMF, SVG): escala e troca de cores ──
  function placaImportada(P) {
    const k = +P.L && P.L0 ? +P.L / P.L0 : 1; const W = P.L0 * k, H = P.H0 * k;
    return { L: W, H, calc: { L: Math.round(W), H: Math.round(H) }, avisos: [],
      camadas: (P.camadas || []).map(c => ({ nome: c.nome || 'IMPORTADO', cor: (P.cores && P.cores[c.cor]) || c.cor, paths: xf(c.paths, ([x, y]) => [x * k, y * k]) })) };
  }
  function desenhar(P) { return P.tipo === 'placa' ? placaCatalogo(P) : P.tipo === 'composta' ? placaComposta(P) : P.tipo === 'importado' ? placaImportada(P) : placaTexto(P); }

  // ── exportação ────────────────────────────────────────────────
  const dPath = (paths, k, f) => paths.map(p => 'M' + p.map(([x, y]) => (x * k).toFixed(f) + ' ' + (y * k).toFixed(f)).join('L') + 'Z').join('');
  function svg(d, opt) {
    opt = opt || {};
    const corpo = d.camadas.map(c => `<path fill="${col(c.cor)}" fill-rule="evenodd" d="${dPath(c.paths, 1, 1)}"/>`).join('')
      + (d.imagens || []).map(im => `<image href="${im.src}" x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}" preserveAspectRatio="none"/>`).join('');
    const pad = opt.margem || 0;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-pad} ${-pad} ${d.L + 2 * pad} ${d.H + 2 * pad}"${opt.w ? ` width="${opt.w}" height="${opt.w * (d.H + 2 * pad) / (d.L + 2 * pad)}"` : ''}>${corpo}</svg>`;
  }
  function jpg(d, maxPx) {
    return new Promise((ok, ko) => {
      const k = (maxPx || 3000) / Math.max(d.L, d.H), w = Math.round(d.L * k), h = Math.round(d.H * k);
      const im = new Image();
      im.onload = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h); ok(cv.toDataURL('image/jpeg', 0.92).split(',')[1]); };
      im.onerror = ko;
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(d, { w }));
    });
  }

  // ── escritor de PDF (vetorial, Helvetica, imagens JPEG) ──
  function PDF() {
    const pages = [], imgs = []; let cur = null;
    const enc = (t) => String(t).replace(/[^\x20-\xff]/g, '?').replace(/[\\()]/g, '\\$&');
    return {
      page(wmm, hmm) { cur = { w: wmm * 72 / 25.4, h: hmm * 72 / 25.4, hmm, ops: [] }; pages.push(cur); return this; },
      k: 72 / 25.4,
      X(x) { return (x * this.k).toFixed(2); }, Y(y) { return ((cur.hmm - y) * this.k).toFixed(2); },
      fill(c) { const [r, g, b] = hexRGB(c); cur.ops.push((r / 255).toFixed(3) + ' ' + (g / 255).toFixed(3) + ' ' + (b / 255).toFixed(3) + ' rg'); return this; },
      stroke(c, w) { const [r, g, b] = hexRGB(c); cur.ops.push((r / 255).toFixed(3) + ' ' + (g / 255).toFixed(3) + ' ' + (b / 255).toFixed(3) + ' RG ' + ((w || 0.2) * this.k).toFixed(2) + ' w'); return this; },
      paths(paths, ox, oy, sc, modo) { paths.forEach(p => { p.forEach(([x, y], i) => cur.ops.push(this.X(ox + x * sc) + ' ' + this.Y(oy + y * sc) + (i ? ' l' : ' m'))); cur.ops.push('h'); }); cur.ops.push(modo || 'f*'); return this; },
      rect(x, y, w, h, modo) { cur.ops.push(this.X(x) + ' ' + this.Y(y + h) + ' ' + (w * this.k).toFixed(2) + ' ' + (h * this.k).toFixed(2) + ' re ' + (modo || 'S')); return this; },
      line(x1, y1, x2, y2) { cur.ops.push(this.X(x1) + ' ' + this.Y(y1) + ' m ' + this.X(x2) + ' ' + this.Y(y2) + ' l S'); return this; },
      text(x, y, t, sz, opt) {
        opt = opt || {}; sz = sz || 3; const pt = sz * this.k; let xx = x;
        const wtxt = String(t).length * pt * 0.5 / this.k;           // largura aproximada (Helvetica)
        if (opt.al === 'c') xx = x - wtxt / 2; else if (opt.al === 'd') xx = x - wtxt;
        cur.ops.push(`BT /${opt.b ? 'F2' : 'F1'} ${pt.toFixed(2)} Tf ${this.X(xx)} ${this.Y(y)} Td (${enc(t)}) Tj ET`); return this;
      },
      image(src, iw, ih, x, y, w, h) {
        const b64 = String(src).split(',')[1] || ''; const n = imgs.length; imgs.push({ b64, iw, ih });
        cur.ops.push(`q ${(w * this.k).toFixed(2)} 0 0 ${(h * this.k).toFixed(2)} ${this.X(x)} ${this.Y(y + h)} cm /Im${n} Do Q`); return this;
      },
      raw(op) { cur.ops.push(op); return this; },
      b64() {
        const objs = []; const add = (o) => { objs.push(o); return objs.length; };
        const cat = add(null), pagesN = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        const imN = imgs.map(im => add({ img: im }));
        const xo = imN.length ? '/XObject << ' + imN.map((n, i) => `/Im${i} ${n} 0 R`).join(' ') + ' >>' : '';
        const kids = pages.map(pg => { const cs = pg.ops.join('\n'); const c = add(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`); return add(`<< /Type /Page /Parent ${pagesN} 0 R /MediaBox [0 0 ${pg.w.toFixed(2)} ${pg.h.toFixed(2)}] /Contents ${c} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> ${xo} >> >>`); });
        objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesN} 0 R >>`; objs[pagesN - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        const info = add('<< /Producer (DVA Placas - DVABRAO SERVICOS LTDA) >>');
        let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offs = [];
        objs.forEach((o, i) => {
          offs.push(out.length);
          if (o && o.img) { const bin = atob(o.img.b64); out += `${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${o.img.iw} /Height ${o.img.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n${bin}\nendstream\nendobj\n`; }
          else out += `${i + 1} 0 obj\n${o}\nendobj\n`;
        });
        const xref = out.length;
        out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
        out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
        return btoa(out);
      },
    };
  }
  /** desenha a placa dentro de uma caixa (mm) da página */
  function placaNaPagina(doc, d, x, y, w, h) {
    const sc = Math.min(w / d.L, h / d.H); const ox = x + (w - d.L * sc) / 2, oy = y + (h - d.H * sc) / 2;
    d.camadas.forEach(c => { doc.fill(col(c.cor)); doc.paths(c.paths, ox, oy, sc, 'f*'); });
    (d.imagens || []).forEach(im => { if (im.iw) doc.image(im.src, im.iw, im.ih, ox + im.x * sc, oy + im.y * sc, im.w * sc, im.h * sc); });
    return { ox, oy, sc };
  }
  /** PDF em escala 1:1 (até 5 m), para impressão em plotter */
  function pdf(d, titulo) {
    const doc = PDF(); let W = d.L, H = d.H; const lim = 5080; const f = Math.max(W, H) > lim ? lim / Math.max(W, H) : 1;
    doc.page(W * f, H * f); placaNaPagina(doc, d, 0, 0, W * f, H * f); return doc.b64();
  }

  // ── prancha de projeto (padrão Placa Pro): placa, status, cotas, cores, contornos e tabela de letras ──
  const LETRAS = 'abcdefghijklmnopqrstuvwxyz';
  function prancha(d, P, meta) {
    meta = meta || {}; const doc = PDF(); doc.page(210, 297);
    const azul = '#111D3D', cinza = '#555555';
    const cab = (pg) => { doc.fill(azul).text(10, 10, 'DVABRAO SERVIÇOS LTDA · DVA Placas', 3, { b: 1 }).fill(cinza).text(200, 10, (meta.nome || '') + (pg ? ' · folha ' + pg : ''), 2.6, { al: 'd' }); doc.stroke('#BBBBBB', 0.2).line(10, 12, 200, 12); };
    cab(1);
    // placa colorida
    const pp = placaNaPagina(doc, d, 10, 18, 90, 95); const yb = Math.max(pp.oy + d.H * pp.sc, 50);
    doc.fill('#000000').text(10, yb + 8, 'Status: ' + (P.status || 'Implementar'), 3.4, { b: 1 }).text(10, yb + 14, 'Dimensões: ' + nf2(d.L / 1000) + ' x ' + nf2(d.H / 1000) + ' m', 3.4, { b: 1 });
    if (meta.local) doc.fill(cinza).text(10, yb + 19, meta.local, 2.6);
    let y0 = yb + 24;
    const info = d.info;
    if (info && info.rows && info.rows.length) {
      // cotas
      const box = { x: 118, y: 22, w: 78, h: Math.max(30, Math.min(88, yb - 26)) }; const sc = Math.min(box.w / d.L, box.h / d.H); const ox = box.x + (box.w - d.L * sc) / 2, oy = box.y + (box.h - d.H * sc) / 2;
      const X = (v) => ox + v * sc, Y = (v) => oy + v * sc;
      doc.stroke('#000000', 0.25).rect(X(0), Y(0), d.L * sc, d.H * sc);
      const C = info.orla + info.afast; doc.stroke('#000000', 0.15).rect(X(info.afast), Y(info.afast), (d.L - 2 * info.afast) * sc, (d.H - 2 * info.afast) * sc).rect(X(C), Y(C), (d.L - 2 * C) * sc, (d.H - 2 * C) * sc);
      info.tarjas.forEach(t => doc.rect(X(C), Y(t.y), (d.L - 2 * C) * sc, t.h * sc));
      info.rows.forEach(r => r.el.forEach(e => doc.stroke('#1565C0', 0.15).rect(X(e.x), Y(e.y), e.w * sc, e.h * sc)));
      const mapa = {}; const tabela = [];
      const letra = (v) => { v = Math.round(v); if (v <= 0) return null; if (!mapa[v]) { mapa[v] = LETRAS[tabela.length % 26] + (tabela.length >= 26 ? Math.floor(tabela.length / 26) : ''); tabela.push([mapa[v], v]); } return mapa[v]; };
      const cadeiaH = (cortes, yy, acima) => { cortes = [...new Set(cortes.map(v => Math.round(v)))].sort((a, b) => a - b); doc.stroke('#C62828', 0.12);
        for (let i = 0; i < cortes.length - 1; i++) { const a = cortes[i], b = cortes[i + 1]; const l = letra(b - a); if (!l) continue; doc.line(X(a), yy, X(b), yy).line(X(a), yy - 0.8, X(a), yy + 0.8).line(X(b), yy - 0.8, X(b), yy + 0.8); doc.fill('#C62828').text((X(a) + X(b)) / 2, yy + (acima ? -0.8 : 2.4), l, 2.2, { al: 'c' }); } };
      const cadeiaV = (cortes, xx) => { cortes = [...new Set(cortes.map(v => Math.round(v)))].sort((a, b) => a - b); doc.stroke('#C62828', 0.12);
        for (let i = 0; i < cortes.length - 1; i++) { const a = cortes[i], b = cortes[i + 1]; const l = letra(b - a); if (!l) continue; doc.line(xx, Y(a), xx, Y(b)).line(xx - 0.8, Y(a), xx + 0.8, Y(a)).line(xx - 0.8, Y(b), xx + 0.8, Y(b)); doc.fill('#C62828').text(xx - 1.2, (Y(a) + Y(b)) / 2 + 0.8, l, 2.2, { al: 'd' }); } };
      info.rows.forEach((r, i) => {
        const c = [0, d.L]; r.el.forEach(e => c.push(e.x, e.x + e.w));
        const yy = i === 0 ? Y(0) - 2 : i === info.rows.length - 1 ? Y(d.H) + 2 : Y(r.y) - 0.6;
        cadeiaH(c, yy, i === 0 || (i > 0 && i < info.rows.length - 1));
      });
      const cv = [0, d.H]; info.rows.forEach(r => cv.push(r.y, r.y + r.h)); info.tarjas.forEach(t => cv.push(t.y, t.y + t.h));
      cadeiaV(cv, X(0) - 2);
      // tabela de cotas
      const yt = box.y + box.h + 10;
      doc.fill('#000000').text(118, yt, 'Cotas (mm)', 3, { b: 1 });
      tabela.forEach(([l, v], i) => doc.text(118 + (i % 4) * 20, yt + 5 + Math.floor(i / 4) * 4.2, l + ' = ' + v, 2.7));
      y0 = Math.max(y0, yt + 8 + Math.ceil(tabela.length / 4) * 4.2);
    }
    // cores das partes
    doc.fill(azul).text(10, y0 + 4, 'Cores', 3.2, { b: 1 }); let yc = y0 + 9;
    const NOME_CAM = (n) => /^FUNDO/.test(n) ? 'Fundo' : /ORLA/.test(n) ? 'Orla e tarjas' : /ESCUDO_TEXTO/.test(n) ? 'Texto do escudo' : /ESCUDO/.test(n) ? 'Escudo' : /TEXTO|SETA/.test(n) ? 'Legenda e setas' : /^COMPL_/.test(n) ? 'Complementar · ' + NOME_CAM(n.slice(6)) : /^SINAL/.test(n) ? 'Sinal' : 'Elemento';
    const vistos = {};
    d.camadas.forEach(c => { const k = NOME_CAM(c.nome) + '|' + c.cor; if (vistos[k]) return; vistos[k] = 1;
      doc.fill(col(c.cor)).rect(10, yc - 2.6, 5, 3, 'f'); doc.stroke('#000000', 0.1).rect(10, yc - 2.6, 5, 3); doc.fill('#000000').text(17, yc, NOME_CAM(c.nome) + ': ' + nomeCor(c.cor), 2.8); yc += 4.4; });
    (d.imagens || []).forEach(im => { doc.fill('#000000').text(17, yc, 'Imagem: ' + im.nome + ' (' + Math.round(im.w) + ' × ' + Math.round(im.h) + ' mm)', 2.8); yc += 4.4; });
    // contornos (canto da placa)
    if (info) {
      const cx = 118, cy = y0 + 4; doc.fill(azul).text(cx, cy, 'Contornos', 3.2, { b: 1 });
      const s2 = 0.32, bx = cx + 6, by = cy + 5, a = info.afast, o = info.orla, rr = info.raioOrla || 50;
      doc.stroke('#000000', 0.2).line(bx, by, bx + 70 * s2 + 40, by).line(bx, by, bx, by + 70 * s2 + 20);
      doc.stroke('#000000', 0.25);
      const arc = (r0, off) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = Math.PI + (Math.PI / 2) * i / 10; pts.push([bx + (off + r0) * s2 + r0 * s2 * Math.cos(t), by + (off + r0) * s2 + r0 * s2 * Math.sin(t)]); } return pts; };
      [[rr, a], [Math.max(5, rr - o), a + o]].forEach(([r0, off]) => { const pts = arc(r0, off); for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); doc.line(pts[pts.length - 1][0], pts[pts.length - 1][1], bx + 70 * s2 + 40, pts[pts.length - 1][1]); doc.line(pts[0][0], pts[0][1], pts[0][0], by + 70 * s2 + 20); });
      doc.fill('#000000').text(bx + 70 * s2 + 42, by + a * s2 + 1, 'afastamento ' + a, 2.4).text(bx + 70 * s2 + 42, by + (a + o) * s2 + 3, 'orla ' + o, 2.4).text(bx + 2, by + 70 * s2 + 24, 'raio da orla ' + rr + ' mm · cantos da placa ' + (info.cantos ? 'R ' + info.cantos : 'vivos'), 2.4);
      yc = Math.max(yc, by + 70 * s2 + 28);
    }
    // tabela de letras de cada texto
    let yy = yc + 6; let folha = 1;
    const textos = info ? [].concat(...info.rows.map(r => r.el.filter(e => e.tipo === 'Texto'))) : [];
    textos.forEach((e, ix) => {
      if (yy > 262) { doc.page(210, 297); folha++; cab(folha); yy = 20; }
      const cor = nomeCor(info.tinta);
      doc.fill(azul).text(10, yy, `Texto ${ix + 1}: "${e.txt}"`, 3, { b: 1 });
      doc.fill('#000000').text(10, yy + 4.5, `Fonte: Série ${e.serie === 'EM' ? 'E(M)' : 'D'}   Altura: ${Math.round(e.hl)} mm   Cor: ${cor}   Largura: ${Math.round(e.w)} mm`, 2.8);
      // caixas
      const itens = []; let prev = null;
      for (const ch of String(e.txt)) {
        if (ch === ' ') { itens.push({ c: '', w: e.hl, esp: 0 }); prev = null; continue; }
        const m = medidas(ch, e.serie) || [0, 70, 0]; const f = e.hl / 100;
        itens.push({ c: ch, w: m[1] * f, esp: prev ? Math.round((prev[2] + m[0]) * f) : null }); prev = m;
      }
      const soma = itens.reduce((a2, i) => a2 + i.w, 0); const gap = 1.2; const k = Math.min(0.12, (190 - gap * itens.length) / Math.max(1, soma));
      let x = 10; const yb = yy + 9, hb = 8;
      itens.forEach((it, j) => {
        const w = it.w * k;
        if (j && itens[j].esp != null) { doc.fill('#C62828').text(x - 0.6, yb + hb + 3.6, String(itens[j].esp), 2, { al: 'c' }); }
        doc.stroke('#000000', 0.15).rect(x, yb, w, hb); doc.fill('#000000').text(x + w / 2, yb + hb - 2.2, it.c || '·', 4, { al: 'c', b: 1 }).fill('#1565C0').text(x + w / 2, yb - 1, String(Math.round(it.w)), 2, { al: 'c' });
        x += w + gap;
      });
      yy = yb + hb + 9;
    });
    doc.fill(cinza).text(10, 290, 'Diagramação conforme DER-SP, Manual de Sinalização Rodoviária, Vol. II. Larguras das letras em mm (azul) e espaços entre letras (vermelho).', 2.3);
    return doc.b64();
  }
  const nf2 = (v) => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');

  /** DXF AutoCAD 2004 (AC1018), mm: hachuras preenchidas com cor real (como os arquivos do Placa Pro) + contornos na camada CONTORNO */
  function dxf(d) {
    let h = 0x1000; const H = () => (h++).toString(16).toUpperCase();
    const L = []; const g = (c, v) => { L.push(String(c).padStart(3, ' ')); L.push(String(v)); };
    const camada = (nome) => { const n = String(nome || '').toUpperCase().replace(/^COMPL_/, ''); if (/^FUNDO/.test(n)) return 'FUNDO'; if (/ORLA|TARJA/.test(n)) return 'ORLA_TARJA'; if (/ESCUDO/.test(n)) return 'ESCUDO'; if (/TEXTO|SETA/.test(n)) return 'TEXTO_SETAS'; if (/IMAGEM/.test(n)) return 'IMAGEM'; if (/IMPORT/.test(n)) return 'IMPORTADO'; return 'SINAL'; };
    const pt = (x, y) => { g(10, x.toFixed(2)); g(20, (d.H - y).toFixed(2)); };
    d.camadas.forEach(c => {
      if (!c.paths.length) return;
      const rgb = hexRGB(c.cor), tc = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2], lay = camada(c.nome);
      g(0, 'HATCH'); g(5, H()); g(330, '17'); g(100, 'AcDbEntity'); g(8, lay); g(62, aciDe(rgb)); g(420, tc); g(100, 'AcDbHatch');
      g(10, '0.0'); g(20, '0.0'); g(30, '0.0'); g(210, '0.0'); g(220, '0.0'); g(230, '1.0'); g(2, 'SOLID'); g(70, 1); g(71, 0); g(91, c.paths.length);
      c.paths.forEach(p => { g(92, 3); g(72, 0); g(73, 1); g(93, p.length); p.forEach(([x, y]) => pt(x, y)); g(97, 0); });
      g(75, 0); g(76, 1); g(98, 0);
      c.paths.forEach(p => { g(0, 'LWPOLYLINE'); g(5, H()); g(330, '17'); g(100, 'AcDbEntity'); g(8, 'CONTORNO'); g(100, 'AcDbPolyline'); g(90, p.length); g(70, 1); p.forEach(([x, y]) => pt(x, y)); });
    });
    (d.imagens || []).forEach(im => {
      g(0, 'LWPOLYLINE'); g(5, H()); g(330, '17'); g(100, 'AcDbEntity'); g(8, 'IMAGEM'); g(100, 'AcDbPolyline'); g(90, 4); g(70, 1);
      [[im.x, im.y], [im.x + im.w, im.y], [im.x + im.w, im.y + im.h], [im.x, im.y + im.h]].forEach(([x, y]) => pt(x, y));
      g(0, 'TEXT'); g(5, H()); g(330, '17'); g(100, 'AcDbEntity'); g(8, 'IMAGEM'); g(100, 'AcDbText'); g(10, (im.x + im.w * 0.08).toFixed(2)); g(20, (d.H - im.y - im.h / 2).toFixed(2)); g(30, '0.0'); g(40, (Math.min(im.h, im.w) / 6).toFixed(2)); g(1, 'LOGO: ' + String(im.nome || 'imagem').replace(/[^\x20-\x7e]/g, '')); g(100, 'AcDbText');
    });
    return window.DG_DXF_TPL.replace('__ENTIDADES__', L.join('\n') + '\n').replace('__HANDSEED__', H())
      .replace('__XMIN__', '0.0').replace('__YMIN__', '0.0').replace('__XMAX__', d.L.toFixed(1)).replace('__YMAX__', d.H.toFixed(1));
  }
  /** WMF "placeable" (Aldus) com polígonos preenchidos (modo alternado) — abre no CorelDRAW */
  function wmf(d) {
    const maxD = Math.max(d.L, d.H); const upi = Math.min(1440, Math.floor(32000 * 25.4 / maxD)); const k = upi / 25.4;
    const recs = []; const rec = (fn, params) => recs.push([0, 0, fn, ...params]); const s16 = (v) => (Math.round(v) & 0xffff);
    const W = Math.round(d.L * k), H = Math.round(d.H * k);
    rec(0x020B, [0, 0]); rec(0x020C, [s16(H), s16(W)]); rec(0x0106, [1]); rec(0x02FA, [5, 0, 0, 0, 0]); rec(0x012D, [0]);
    const poli = (paths, rgb) => {
      rec(0x02FC, [0, rgb[0] | (rgb[1] << 8), rgb[2], 0]); rec(0x012D, [1]);
      let bloco = []; const flush = () => { if (!bloco.length) return; const cont = bloco.map(p => p.length); const pts = [].concat(...bloco.map(p => [].concat(...p.map(([x, y]) => [s16(x * k), s16(y * k)])))); rec(0x0538, [bloco.length, ...cont, ...pts]); bloco = []; };
      let n = 0; paths.forEach(p => { if (n + p.length * 2 > 30000) { flush(); n = 0; } bloco.push(p); n += p.length * 2 + 1; }); flush();
      rec(0x01F0, [1]);
    };
    d.camadas.forEach(c => poli(c.paths, hexRGB(c.cor)));
    (d.imagens || []).forEach(im => { const e = Math.max(2, Math.min(im.w, im.h) * 0.02); poli([[[im.x, im.y], [im.x + im.w, im.y], [im.x + im.w, im.y + im.h], [im.x, im.y + im.h]], [[im.x + e, im.y + e], [im.x + im.w - e, im.y + e], [im.x + im.w - e, im.y + im.h - e], [im.x + e, im.y + im.h - e]]], [120, 120, 120]); });
    rec(0x01F0, [0]); recs.push([3, 0, 0]);
    recs.forEach(r => { const sz = r.length; r[0] = sz & 0xffff; r[1] = sz >>> 16; });
    const total = recs.reduce((a, r) => a + r.length, 0); const maxRec = Math.max(...recs.map(r => r.length));
    const words = []; const ald = [0xCDD7, 0x9AC6, 0, 0, 0, s16(W), s16(H), upi, 0, 0]; let chk = 0; ald.forEach(w => chk ^= w); ald.push(chk); words.push(...ald);
    words.push(1, 9, 0x0300, (total + 9) & 0xffff, (total + 9) >>> 16, 2, maxRec & 0xffff, maxRec >>> 16, 0);
    recs.forEach(r => words.push(...r));
    const u8 = new Uint8Array(words.length * 2); words.forEach((w, i) => { u8[2 * i] = w & 0xff; u8[2 * i + 1] = (w >> 8) & 0xff; });
    let bin = ''; for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(bin);
  }

  return { carregarFonte, desenhar, svg, jpg, pdf, prancha, dxf, wmf, hexRGB, col, ESQUEMAS, CLASSES, CORES, TAMANHOS, DISPOSITIVOS, larguraTexto, serieDe };
})();
