// ════════════════════════════════════════════════════════════════
//  DVA Placas — importação de desenhos (DXF, WMF, SVG)
//  Resultado: { L0, H0, camadas:[{nome, cor:'#rrggbb', paths}] } em mm,
//  origem no canto superior esquerdo, y para baixo (mesmo padrão do motor).
//  Cada hachura/polígono vira uma camada própria (ordem de pintura preservada).
// ════════════════════════════════════════════════════════════════
const DGImporta = (function () {
  const hex2 = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
  const rgbHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  // cores ACI do AutoCAD (aproximação: 1–9 exatas, 10–249 pela roda de cores, 250–255 cinzas)
  function aci(n) {
    const base = { 1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#808080', 9: '#C0C0C0' };
    if (base[n]) return base[n];
    if (n >= 250) return rgbHex(...Array(3).fill([51, 91, 132, 173, 214, 255][n - 250]));
    if (n >= 10 && n <= 249) {
      const hue = Math.floor((n - 10) / 10) * 15, k = (n - 10) % 10; const v = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][k], s = k % 2 ? 0.5 : 1;
      const f = (m) => { const kk = (m + hue / 60) % 6; return v - v * s * Math.max(0, Math.min(kk, 4 - kk, 1)); };
      return rgbHex(f(5) * 255, f(3) * 255, f(1) * 255);
    }
    return '#000000';
  }
  function normaliza(camadas, avisos) {
    camadas = camadas.filter(c => c.paths.length);
    if (!camadas.length) throw new Error('Nenhuma área preenchida encontrada no arquivo.');
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    camadas.forEach(c => c.paths.forEach(p => p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); })));
    let L0 = x1 - x0, H0 = y1 - y0;
    let k = 1; if (Math.max(L0, H0) < 20) { k = 1000; (avisos || []).push('Desenho em metros: convertido para mm.'); }
    camadas = camadas.map(c => ({ nome: c.nome, cor: c.cor, paths: c.paths.map(p => p.map(([x, y]) => [Math.round((x - x0) * k * 100) / 100, Math.round((y - y0) * k * 100) / 100])) }));
    return { L0: Math.round(L0 * k * 10) / 10, H0: Math.round(H0 * k * 10) / 10, camadas, avisos: avisos || [] };
  }
  const arco = (cx, cy, r, a0, a1, ccw) => { // graus
    if (!ccw) { const t = a0; a0 = a1; a1 = t; }
    while (a1 <= a0) a1 += 360; const n = Math.max(6, Math.ceil((a1 - a0) / 8)); const out = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return ccw ? out : out.reverse();
  };
  const bulge = (p, q, b) => { // trecho curvo de polilinha
    if (!b) return [];
    const th = 4 * Math.atan(b), dx = q[0] - p[0], dy = q[1] - p[1], c = Math.hypot(dx, dy); if (!c) return [];
    const r = c / (2 * Math.sin(th / 2)), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, hh = r * Math.cos(th / 2);
    const nx = -dy / c, ny = dx / c, cx = mx + nx * hh, cy = my + ny * hh;
    const a0 = Math.atan2(p[1] - cy, p[0] - cx), n = Math.max(4, Math.ceil(Math.abs(th) / 0.15)); const out = [];
    for (let i = 1; i < n; i++) { const a = a0 + th * i / n; out.push([cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a)]); }
    return out;
  };

  // ── DXF ──────────────────────────────────────────────────────
  function dxf(texto) {
    const ln = texto.split(/\r?\n/); const P = [];
    for (let i = 0; i + 1 < ln.length; i += 2) P.push([parseInt(ln[i].trim(), 10), ln[i + 1].replace(/\s+$/, '')]);
    const avisos = []; const layers = {}; const blocks = {}; const ents = [];
    let i = 0, sec = null, blk = null;
    const lerEnt = () => { const e = { t: P[i][1], g: [] }; i++; while (i < P.length && P[i][0] !== 0) { e.g.push(P[i]); i++; } return e; };
    while (i < P.length) {
      const [c, v] = P[i];
      if (c === 0 && v === 'SECTION') { sec = P[i + 1] && P[i + 1][1]; i += 2; continue; }
      if (c === 0 && v === 'ENDSEC') { sec = null; i++; continue; }
      if (c === 0 && v === 'EOF') break;
      if (c === 0 && sec === 'TABLES' && v === 'LAYER') { const e = lerEnt(); const nm = (e.g.find(x => x[0] === 2) || [])[1]; if (nm) { const tc = e.g.find(x => x[0] === 420), ac = e.g.find(x => x[0] === 62); layers[nm] = tc ? '#' + ('00000' + (+tc[1]).toString(16)).slice(-6) : aci(Math.abs(+(ac ? ac[1] : 7))); } continue; }
      if (c === 0 && sec === 'BLOCKS') {
        if (v === 'BLOCK') { const e = lerEnt(); blk = { nome: (e.g.find(x => x[0] === 2) || [])[1], bx: +((e.g.find(x => x[0] === 10) || [0, 0])[1]), by: +((e.g.find(x => x[0] === 20) || [0, 0])[1]), ents: [] }; blocks[blk.nome] = blk; continue; }
        if (v === 'ENDBLK') { blk = null; lerEnt(); continue; }
        if (blk) { blk.ents.push(lerEnt()); continue; }
      }
      if (c === 0 && sec === 'ENTITIES') { ents.push(lerEnt()); continue; }
      i++;
    }
    const preench = ents.some(e => e.t === 'HATCH' || e.t === 'SOLID') || Object.values(blocks).some(b => b.ents.some(e => e.t === 'HATCH' || e.t === 'SOLID'));
    if (!preench) avisos.push('Arquivo só com contornos: as figuras fechadas foram preenchidas com a cor de cada linha.');
    const camadas = [];
    const corDe = (e, pai) => {
      const tc = e.g.find(x => x[0] === 420); if (tc) return '#' + ('00000' + (+tc[1]).toString(16)).slice(-6);
      const ac = e.g.find(x => x[0] === 62); const lay = (e.g.find(x => x[0] === 8) || [0, '0'])[1];
      if (ac && +ac[1] === 0 && pai) return pai; if (ac && +ac[1] !== 256) return aci(Math.abs(+ac[1]));
      return layers[lay] || '#000000';
    };
    const emit = (e, paths, tf, pai) => { if (!paths.length) return; camadas.push({ nome: (e.g.find(x => x[0] === 8) || [0, '0'])[1], cor: corDe(e, pai), paths: paths.map(p => p.map(tf)) }); };
    function hatch(e) {
      const g = e.g; let k = g.findIndex(x => x[0] === 91); if (k < 0) return [];
      const n = +g[k][1]; k++; const paths = [];
      const num = () => +g[k++][1];
      for (let p = 0; p < n && k < g.length; p++) {
        while (k < g.length && g[k][0] !== 92) k++; const fl = +g[k++][1];
        if (fl & 2) {
          let hasB = 0, nv = 0; while (k < g.length && g[k][0] !== 10) { if (g[k][0] === 72) hasB = +g[k][1]; if (g[k][0] === 93) nv = +g[k][1]; k++; }
          const pts = [], bs = [];
          for (let v = 0; v < nv; v++) { const x = num(), y = num(); let b = 0; if (hasB && g[k] && g[k][0] === 42) b = num(); pts.push([x, y]); bs.push(b); }
          const out = []; pts.forEach((q, j) => { out.push(q); out.push(...bulge(q, pts[(j + 1) % pts.length], bs[j])); }); paths.push(out);
        } else {
          while (k < g.length && g[k][0] !== 93) k++; const ne = +g[k++][1]; const out = [];
          for (let ed = 0; ed < ne && k < g.length; ed++) {
            while (k < g.length && g[k][0] !== 72) k++; const t = +g[k++][1];
            const val = (code) => { while (k < g.length && g[k][0] !== code) k++; return +g[k++][1]; };
            if (t === 1) { const x1 = val(10), y1 = val(20), x2 = val(11), y2 = val(21); if (!out.length) out.push([x1, y1]); out.push([x2, y2]); }
            else if (t === 2) { const cx = val(10), cy = val(20), r = val(40), a0 = val(50), a1 = val(51), ccw = val(73); out.push(...arco(cx, cy, r, a0, a1, ccw)); }
            else if (t === 3) { const cx = val(10), cy = val(20), mx = val(11), my = val(21), ra = val(40), a0 = val(50), a1 = val(51), ccw = val(73); const R = Math.hypot(mx, my), rot = Math.atan2(my, mx);
              arco(0, 0, 1, a0, a1, ccw).forEach(([u, w]) => { const x = u * R, y = w * R * ra; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }); }
            else if (t === 4) { const deg = val(94); val(73); val(74); const nk = val(95), nc = val(96); for (let q = 0; q < nk; q++) val(40); const cp = []; for (let q = 0; q < nc; q++) cp.push([val(10), val(20)]); while (g[k] && g[k][0] === 42) k++; if (g[k] && g[k][0] === 97) {}
              // B-spline aproximada pelo polígono de controle suavizado (Chaikin)
              let pts = cp; for (let it = 0; it < 3; it++) { const nn = [pts[0]]; for (let q = 0; q < pts.length - 1; q++) { const a = pts[q], b = pts[q + 1]; nn.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } nn.push(pts[pts.length - 1]); pts = nn; }
              out.push(...pts); void deg; }
          }
          if (out.length > 2) paths.push(out);
        }
        // pula referências a contornos de origem
        while (k < g.length && g[k][0] !== 92 && g[k][0] !== 75) k++;
      }
      return paths;
    }
    function forma(e) {
      const g = e.g; const v = (c) => { const x = g.find(q => q[0] === c); return x ? +x[1] : 0; };
      if (e.t === 'HATCH') return hatch(e);
      if (e.t === 'SOLID' || e.t === '3DFACE') { const p = [[v(10), v(20)], [v(11), v(21)], [v(13), v(23)], [v(12), v(22)]]; return [e.t === 'SOLID' ? p : [p[0], p[1], p[3], p[2]]]; }
      if (preench) return [];
      if (e.t === 'LWPOLYLINE') { const closed = v(70) & 1; if (!closed) return []; const pts = [], bs = []; g.forEach(q => { if (q[0] === 10) { pts.push([+q[1], 0]); bs.push(0); } else if (q[0] === 20) pts[pts.length - 1][1] = +q[1]; else if (q[0] === 42) bs[bs.length - 1] = +q[1]; });
        const out = []; pts.forEach((q, j) => { out.push(q); out.push(...bulge(q, pts[(j + 1) % pts.length], bs[j])); }); return [out]; }
      if (e.t === 'CIRCLE') return [arco(v(10), v(20), v(40), 0, 360, 1)];
      if (e.t === 'ELLIPSE') { const cx = v(10), cy = v(20), mx = v(11), my = v(21), ra = v(40); const R = Math.hypot(mx, my), rot = Math.atan2(my, mx); return [arco(0, 0, 1, 0, 360, 1).map(([u, w]) => { const x = u * R, y = w * R * ra; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; })]; }
      return [];
    }
    function percorre(lista, tf, pai, prof) {
      lista.forEach(e => {
        if (e.t === 'INSERT') {
          if (prof > 6) return; const g = e.g; const v = (c, d0) => { const x = g.find(q => q[0] === c); return x ? +x[1] : d0; };
          const b = blocks[(g.find(q => q[0] === 2) || [])[1]]; if (!b) return;
          const ix = v(10, 0), iy = v(20, 0), sx = v(41, 1), sy = v(42, 1), rot = v(50, 0) * Math.PI / 180, cs = Math.cos(rot), sn = Math.sin(rot);
          const t2 = ([x, y]) => { const X = (x - b.bx) * sx, Y = (y - b.by) * sy; return tf([ix + X * cs - Y * sn, iy + X * sn + Y * cs]); };
          percorre(b.ents, t2, corDe(e, pai), prof + 1); return;
        }
        try { emit(e, forma(e), tf, pai); } catch (err) { /* entidade ignorada */ }
      });
    }
    percorre(ents, ([x, y]) => [x, -y], null, 0);   // DXF tem y para cima
    return normaliza(camadas, avisos);
  }

  // ── WMF (com ou sem cabeçalho "placeable"; ex.: CorelDRAW) ──
  function wmf(buf) {
    const dv = new DataView(buf); let p = 0; let upi = 0; const avisos = [];
    if (dv.getUint32(0, true) === 0x9AC6CDD7) { upi = dv.getUint16(14, true); p = 22; }
    const hdrWords = dv.getUint16(p + 2, true); p += hdrWords * 2;
    const objs = []; let brush = null; let fillMode = 1; const camadas = []; let frameMM = null, win = null;
    const novo = (o) => { let k = objs.findIndex(x => x === undefined); if (k < 0) { k = objs.length; objs.push(o); } else objs[k] = o; };
    const s16 = (o) => dv.getInt16(o, true), u16 = (o) => dv.getUint16(o, true);
    while (p + 6 <= buf.byteLength) {
      const size = dv.getUint32(p, true), fn = u16(p + 4), a = p + 6; if (size < 3) break;
      if (fn === 0x0000) break;
      // CorelDRAW embute um EMF em comentários "WMFC": o cabeçalho traz o tamanho real (rclFrame, em 0,01 mm)
      if (fn === 0x0626 && !frameMM && u16(a) === 0x000F && dv.getUint32(a + 4, true) === 0x43464D57) {
        const e = a + 4 + 34; if (dv.getUint32(e, true) === 1) { const l = dv.getInt32(e + 24, true), t = dv.getInt32(e + 28, true), r = dv.getInt32(e + 32, true), b = dv.getInt32(e + 36, true); frameMM = [(r - l) / 100, (b - t) / 100]; }
      }
      if (fn === 0x020C) win = [Math.abs(s16(a + 2)), Math.abs(s16(a))];
      if (fn === 0x02FC) { const st = u16(a), r = dv.getUint8(a + 2), g = dv.getUint8(a + 3), b = dv.getUint8(a + 4); novo({ k: 'brush', cor: st === 1 ? null : rgbHex(r, g, b) }); }
      else if (fn === 0x02FA || fn === 0x02FB || fn === 0x00F7 || fn === 0x06FF || fn === 0x0142 || fn === 0x01F9) novo({ k: 'outro' });
      else if (fn === 0x012D) { const o = objs[u16(a)]; if (o && o.k === 'brush') brush = o.cor; }
      else if (fn === 0x01F0) { objs[u16(a)] = undefined; }
      else if (fn === 0x0106) fillMode = u16(a);
      else if (fn === 0x0324 && brush) { const n = u16(a); const pts = []; for (let i = 0; i < n; i++) pts.push([s16(a + 2 + i * 4), s16(a + 4 + i * 4)]); camadas.push({ nome: 'WMF', cor: brush, paths: [pts] }); }
      else if (fn === 0x0538 && brush) { const np = u16(a); const cnt = []; for (let i = 0; i < np; i++) cnt.push(u16(a + 2 + i * 2)); let q = a + 2 + np * 2; const paths = [];
        cnt.forEach(n => { const pts = []; for (let i = 0; i < n; i++) { pts.push([s16(q), s16(q + 2)]); q += 4; } paths.push(pts); }); camadas.push({ nome: 'WMF', cor: brush, paths }); }
      else if (fn === 0x041B && brush) { const b = s16(a), r = s16(a + 2), t = s16(a + 4), l = s16(a + 6); camadas.push({ nome: 'WMF', cor: brush, paths: [[[l, t], [r, t], [r, b], [l, b]]] }); }
      else if (fn === 0x0418 && brush) { const b = s16(a), r = s16(a + 2), t = s16(a + 4), l = s16(a + 6); const cx = (l + r) / 2, cy = (t + b) / 2; camadas.push({ nome: 'WMF', cor: brush, paths: [arco(0, 0, 1, 0, 360, 1).map(([u, w]) => [cx + u * (r - l) / 2, cy + w * (b - t) / 2])] }); }
      p += size * 2;
    }
    void fillMode;
    let k = upi ? 25.4 / upi : 1;
    const r = normaliza(camadas.map(c => ({ nome: c.nome, cor: c.cor, paths: c.paths.map(pp => pp.map(([x, y]) => [x * k, y * k])) })), avisos);
    if (!upi) { r.semEscala = true; r.avisos.push('WMF sem escala física: informe a largura real da placa.'); }
    return r;
  }

  // ── SVG ──────────────────────────────────────────────────────
  function caminho(d) {
    const tk = String(d).match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || []; let i = 0;
    const out = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', px = 0, py = 0;
    const n = () => +tk[i++]; const ehNum = () => i < tk.length && !/[a-z]/i.test(tk[i]);
    const add = (X, Y) => { cur.push([X, Y]); x = X; y = Y; };
    const cub = (x1, y1, x2, y2, X, Y) => { for (let t = 1; t <= 8; t++) { const u = t / 8, a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), e = u ** 3; cur.push([a * x + b * x1 + c * x2 + e * X, a * y + b * y1 + c * y2 + e * Y]); } px = x2; py = y2; x = X; y = Y; };
    while (i < tk.length) {
      if (/[a-z]/i.test(tk[i])) cmd = tk[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(); const ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'M') { if (cur && cur.length > 2) out.push(cur); cur = []; const X = n() + ox, Y = n() + oy; add(X, Y); sx = X; sy = Y; cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') add(n() + ox, n() + oy);
      else if (C === 'H') add(n() + ox, y);
      else if (C === 'V') add(x, n() + oy);
      else if (C === 'C') { const a = n() + ox, b = n() + oy, c = n() + ox, d2 = n() + oy, e = n() + ox, f = n() + oy; cub(a, b, c, d2, e, f); }
      else if (C === 'S') { const c = n() + ox, d2 = n() + oy, e = n() + ox, f = n() + oy; cub(2 * x - px, 2 * y - py, c, d2, e, f); }
      else if (C === 'Q') { const a = n() + ox, b = n() + oy, e = n() + ox, f = n() + oy; cub(x + 2 / 3 * (a - x), y + 2 / 3 * (b - y), e + 2 / 3 * (a - e), f + 2 / 3 * (b - f), e, f); px = a; py = b; }
      else if (C === 'T') { const a = 2 * x - px, b = 2 * y - py, e = n() + ox, f = n() + oy; cub(x + 2 / 3 * (a - x), y + 2 / 3 * (b - y), e + 2 / 3 * (a - e), f + 2 / 3 * (b - f), e, f); px = a; py = b; }
      else if (C === 'A') { n(); n(); n(); n(); n(); add(n() + ox, n() + oy); }   // arco: aproximado pela corda
      else if (C === 'Z') { if (cur && cur.length > 2) out.push(cur); cur = [[sx, sy]]; x = sx; y = sy; }
      else i++;
      if (!ehNum() && i < tk.length && !/[a-z]/i.test(tk[i])) i++;
    }
    if (cur && cur.length > 2) out.push(cur);
    return out;
  }
  function svg(texto) {
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;overflow:hidden';
    host.innerHTML = texto.replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/i, ''); document.body.appendChild(host);
    const root = host.querySelector('svg'); if (!root) { host.remove(); throw new Error('SVG inválido.'); }
    const camadas = []; const avisos = [];
    // escala para mm: width/height com unidade, senão px a 96 dpi
    const un = (v) => { const m = String(v || '').match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/); if (!m) return null; return +m[1] * ({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 }[m[2] || 'px']); };
    const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    let k = 25.4 / 96; const wmm = un(root.getAttribute('width')); if (wmm && vb.length === 4 && vb[2]) k = wmm / vb[2];
    root.querySelectorAll('path,polygon,polyline,rect,circle,ellipse').forEach(el => {
      const cs = getComputedStyle(el); const fill = cs.fill; if (!fill || fill === 'none' || /url\(/.test(fill)) return;
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.fillOpacity === 0) return;
      const m = fill.match(/\d+(\.\d+)?/g); if (!m) return; const cor = rgbHex(+m[0], +m[1], +m[2]);
      let paths = [];
      const t = el.tagName.toLowerCase(); const a = (n) => +el.getAttribute(n) || 0;
      if (t === 'path') paths = caminho(el.getAttribute('d'));
      else if (t === 'polygon' || t === 'polyline') { const nn = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); const pts = []; for (let i = 0; i + 1 < nn.length; i += 2) pts.push([nn[i], nn[i + 1]]); paths = [pts]; }
      else if (t === 'rect') { const x = a('x'), y = a('y'), w = a('width'), h = a('height'); paths = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]]; }
      else if (t === 'circle') paths = [arco(a('cx'), a('cy'), a('r'), 0, 360, 1)];
      else if (t === 'ellipse') paths = [arco(0, 0, 1, 0, 360, 1).map(([u, w]) => [a('cx') + u * a('rx'), a('cy') + w * a('ry')])];
      const M = el.getCTM && el.getCTM(), R = root.getCTM && root.getCTM();
      let tf = (q) => q;
      if (M && R) { const inv = R.inverse().multiply(M); tf = ([x, y]) => [inv.a * x + inv.c * y + inv.e, inv.b * x + inv.d * y + inv.f]; }
      camadas.push({ nome: 'SVG', cor, paths: paths.map(p => p.map(q => { const [x, y] = tf(q); return [x * k, y * k]; })) });
    });
    host.remove();
    return normaliza(camadas, avisos);
  }

  /** abre um File (DXF, WMF, SVG) e devolve o desenho */
  async function arquivo(file) {
    const nome = file.name || ''; const ext = (nome.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer(); const u8 = new Uint8Array(buf.slice(0, 64));
    const ehWmf = (u8[0] === 0xD7 && u8[1] === 0xCD) || (u8[0] === 1 && u8[1] === 0 && u8[2] === 9 && u8[3] === 0);
    const txt = () => new TextDecoder('latin1').decode(buf);
    // decide pelo conteúdo (arquivos com a extensão trocada também abrem)
    if (ehWmf) return Object.assign(wmf(buf), { formato: 'WMF' });
    const t = txt(); const ini = t.slice(0, 400);
    if (/<svg[\s>]/i.test(t.slice(0, 5000))) return Object.assign(svg(new TextDecoder('utf-8').decode(buf)), { formato: 'SVG' });
    if (/^\s*0\s*[\r\n]+\s*SECTION/m.test(ini) || ext === 'dxf') return Object.assign(dxf(t), { formato: 'DXF' });
    if (ext === 'emf') throw new Error('EMF ainda não é lido; salve como WMF ou DXF.');
    throw new Error('Formato não reconhecido. Use DXF, WMF ou SVG.');
  }
  return { dxf, wmf, svg, arquivo };
})();
