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
    const linhas = (P.linhas || []).filter(l => (l.texto || '').trim() || l.seta || l.escudo || (l.dist || '').trim());
    if (!linhas.length) linhas.push({ texto: 'Texto', h: cl.hPadrao });
    const R = linhas.map(l => {
      const h = +l.h || cl.hPadrao, sTx = serieDe(l.texto || '', l.serie);
      const tw = (l.texto || '').trim() ? larguraTexto(l.texto, sTx, h) : 0;
      const dist = (l.dist || '').trim(); const dw = dist ? larguraTexto(dist, 'EM', h) : 0;
      const st = l.seta ? seta(l.seta, h) : null; const esc = l.escudo ? escudo(l.escudo, h) : null;
      if (l.escudo && !esc) avisos.push('Escudo “' + l.escudo + '” não reconhecido (use SP 330 ou BR 050).');
      const partes = [st ? st.w : 0, esc ? esc.w : 0, tw, dw].filter(v => v > 0);
      const w = partes.reduce((a, b) => a + b, 0) + Math.max(0, partes.length - 1) * h;
      const rh = Math.max(h, st ? st.h : 0, esc ? esc.h : 0);
      return { l, h, sTx, tw, dist, dw, st, esc, w, rh };
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
    R.forEach((r, i) => {
      const xl = C + 0.75 * r.h, xr = L - C - 0.75 * r.h;
      const temD = r.st && /D/.test(r.l.seta) && r.l.seta !== 'F', temE = r.st && !temD;
      const cy = y + r.rh / 2; const yTxt = cy - r.h / 2;
      let x;
      if (r.dist) x = xl; else if (temD) x = xr - r.w; else if (temE) x = xl; else x = (L - r.w) / 2;
      if (temE) { cam.tinta.push(...mover(r.st.paths, x, cy - r.st.h / 2)); x += r.st.w + r.h; }
      if (r.esc) { cam.escF.push(...mover(r.esc.fundo, x, cy - r.esc.h / 2)); cam.escB.push(...mover(r.esc.borda, x, cy - r.esc.h / 2), ...mover(r.esc.tx, x, cy - r.esc.h / 2)); x += r.esc.w + r.h; }
      if (r.tw) { cam.tinta.push(...contornosTexto(r.l.texto, r.sTx, r.h, x, yTxt)); x += r.tw + r.h; }
      if (r.dist) cam.tinta.push(...contornosTexto(r.dist, 'EM', r.h, temD ? xr - r.st.w - r.h - r.dw : xr - r.dw, yTxt));
      if (temD) cam.tinta.push(...mover(r.st.paths, xr - r.st.w, cy - r.st.h / 2));
      y += r.rh;
      if (i < R.length - 1) {
        if (r.l.tarja) { y += 0.75 * r.h + extraV / 2; cam.orla.push(rrect(C, y, L - 2 * C, cl.orla, 0)); y += cl.orla + 0.75 * R[i + 1].h + extraV / 2; }
        else y += 0.75 * Math.max(r.h, R[i + 1].h) + extraV;
      }
    });
    return {
      L, H, calc, avisos,
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
  function placaCatalogo(P) {
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
    const tinta = [];
    // conteúdo centralizado na área interna; alinhamento de cada item na direção transversal
    const ix0 = C + mg, iy0 = C + mg, iw = L - 2 * (C + mg), ih = H - 2 * (C + mg);
    let x = ix0 + (linha ? (iw - Wi) / 2 : 0), y = iy0 + (linha ? 0 : (ih - Hi) / 2);
    its.forEach(i => {
      const al = i.it.alinh || 'centro';
      const px = linha ? x : ix0 + (al === 'inicio' ? 0 : al === 'fim' ? iw - i.w : (iw - i.w) / 2);
      const py = linha ? iy0 + (al === 'inicio' ? 0 : al === 'fim' ? ih - i.h : (ih - i.h) / 2) : y;
      if (i.pc) i.pc.camadas.forEach(c => cams.push({ nome: 'SINAL_' + c.cor.toUpperCase(), cor: c.cor, paths: mover(c.paths, px, py) }));
      else if (i.st) tinta.push(...mover(i.st.paths, px, py));
      else tinta.push(...contornosTexto(i.tx, i.sr, i.h, px, py));
      if (linha) x += i.w + gap; else y += i.h + gap;
    });
    if (tinta.length) cams.push({ nome: 'TEXTO_SETAS', cor: es.tinta, paths: tinta });
    return { L, H, calc, avisos, camadas: cams };
  }

  function desenhar(P) { return P.tipo === 'placa' ? placaCatalogo(P) : P.tipo === 'composta' ? placaComposta(P) : placaTexto(P); }

  // ── exportação ────────────────────────────────────────────────
  const dPath = (paths, k, f) => paths.map(p => 'M' + p.map(([x, y]) => (x * k).toFixed(f) + ' ' + (y * k).toFixed(f)).join('L') + 'Z').join('');
  function svg(d, opt) {
    opt = opt || {}; const k = 1;
    const corpo = d.camadas.map(c => `<path fill="${CORES[c.cor] || c.cor}" fill-rule="evenodd" d="${dPath(c.paths, k, 1)}"/>`).join('');
    const pad = opt.margem || 0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${d.L + 2 * pad} ${d.H + 2 * pad}"${opt.w ? ` width="${opt.w}" height="${opt.w * (d.H + 2 * pad) / (d.L + 2 * pad)}"` : ''}>${corpo}</svg>`;
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
  /** PDF vetorial de uma página no tamanho da placa (escala 1:1 até 5 m; acima disso, reduz) */
  function pdf(d, titulo) {
    const mm = 72 / 25.4; let k = mm; const maxPt = 14400;
    if (Math.max(d.L, d.H) * k > maxPt) k = maxPt / Math.max(d.L, d.H);
    const W = d.L * k, H = d.H * k;
    let cs = '';
    d.camadas.forEach(c => {
      const hex = (CORES[c.cor] || '#000000').slice(1); const rgb = [0, 2, 4].map(i => (parseInt(hex.substr(i, 2), 16) / 255).toFixed(3)).join(' ');
      cs += rgb + ' rg\n';
      c.paths.forEach(p => { p.forEach(([x, y], i) => { cs += (x * k).toFixed(2) + ' ' + (H - y * k).toFixed(2) + (i ? ' l\n' : ' m\n'); }); cs += 'h\n'; });
      cs += 'f*\n';
    });
    const objs = [];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Contents 4 0 R /Resources << >> >>`);
    objs.push(`<< /Length ${cs.length} >>\nstream\n${cs}endstream`);
    objs.push(`<< /Title (${String(titulo || 'Placa').replace(/[()\\]/g, '').replace(/[^\x20-\x7e]/g, '')}) /Producer (DVA Roads - DVABRAO SERVICOS LTDA) >>`);
    let out = '%PDF-1.4\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return btoa(out);
  }
  /** DXF R12 (AC1009), mm, uma camada por elemento, contornos como polilinhas fechadas */
  function dxf(d) {
    const L = []; const g = (c, v) => L.push(String(c), String(v));
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4);
    g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(9, '$EXTMAX'); g(10, d.L.toFixed(1)); g(20, d.H.toFixed(1)); g(0, 'ENDSEC');
    const lay = []; d.camadas.forEach(c => { if (!lay.some(l => l.nome === c.nome)) lay.push(c); });
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, lay.length);
    lay.forEach(c => { g(0, 'LAYER'); g(2, c.nome); g(70, 0); g(62, ACI[c.cor] || 7); g(6, 'CONTINUOUS'); });
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    d.camadas.forEach(c => c.paths.forEach(p => {
      g(0, 'POLYLINE'); g(8, c.nome); g(66, 1); g(70, 1); g(10, 0); g(20, 0); g(30, 0);
      p.forEach(([x, y]) => { g(0, 'VERTEX'); g(8, c.nome); g(10, x.toFixed(2)); g(20, (d.H - y).toFixed(2)); g(30, 0); });
      g(0, 'SEQEND'); g(8, c.nome);
    }));
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }
  /** WMF "placeable" (Aldus) com polígonos preenchidos (modo alternado) */
  function wmf(d) {
    const maxD = Math.max(d.L, d.H); const upi = Math.min(1440, Math.floor(32000 * 25.4 / maxD)); const k = upi / 25.4;
    const recs = []; // cada registro: array de words (uint16)
    const rec = (fn, params) => recs.push([0, 0, fn, ...params]); // tamanho preenchido depois
    const s16 = (v) => (Math.round(v) & 0xffff);
    const W = Math.round(d.L * k), H = Math.round(d.H * k);
    rec(0x020B, [0, 0]);              // SetWindowOrg (y, x)
    rec(0x020C, [s16(H), s16(W)]);    // SetWindowExt (y, x)
    rec(0x0106, [1]);                 // SetPolyFillMode ALTERNATE
    rec(0x02FA, [5, 0, 0, 0, 0]);     // CreatePenIndirect PS_NULL → objeto 0
    rec(0x012D, [0]);                 // SelectObject pen
    let obj = 1;
    d.camadas.forEach(c => {
      const hex = (CORES[c.cor] || '#000000').slice(1); const r = parseInt(hex.substr(0, 2), 16), gg = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
      rec(0x02FC, [0, r | (gg << 8), b, 0]); // CreateBrushIndirect BS_SOLID, COLORREF
      rec(0x012D, [obj]);                    // SelectObject brush
      // PolyPolygon em blocos (registro máx. ~ 65k words)
      let bloco = [];
      const flush = () => { if (!bloco.length) return; const cont = bloco.map(p => p.length); const pts = [].concat(...bloco.map(p => [].concat(...p.map(([x, y]) => [s16(x * k), s16(y * k)])))); rec(0x0538, [bloco.length, ...cont, ...pts]); bloco = []; };
      let n = 0; c.paths.forEach(p => { if (n + p.length * 2 > 30000) { flush(); n = 0; } bloco.push(p); n += p.length * 2 + 1; }); flush();
      rec(0x01F0, [obj]);                    // DeleteObject (libera o índice para o próximo)
    });
    rec(0x01F0, [0]);
    recs.push([3, 0, 0]);                    // fim
    recs.forEach(r => { const sz = r.length; r[0] = sz & 0xffff; r[1] = sz >>> 16; });
    const total = recs.reduce((a, r) => a + r.length, 0); const maxRec = Math.max(...recs.map(r => r.length));
    const words = [];
    // cabeçalho Aldus (22 bytes = 11 words)
    const ald = [0xCDD7, 0x9AC6, 0, 0, 0, s16(W), s16(H), upi, 0, 0];
    let chk = 0; ald.forEach(w => chk ^= w); ald.push(chk); words.push(...ald);
    // cabeçalho WMF (9 words)
    words.push(1, 9, 0x0300, (total + 9) & 0xffff, (total + 9) >>> 16, 2, maxRec & 0xffff, maxRec >>> 16, 0);
    recs.forEach(r => words.push(...r));
    const u8 = new Uint8Array(words.length * 2);
    words.forEach((w, i) => { u8[2 * i] = w & 0xff; u8[2 * i + 1] = (w >> 8) & 0xff; });
    let bin = ''; for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(bin);
  }

  return { carregarFonte, desenhar, svg, jpg, pdf, dxf, wmf, ESQUEMAS, CLASSES, CORES, TAMANHOS, larguraTexto, serieDe };
})();
