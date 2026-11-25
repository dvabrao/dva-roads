// ════════════════════════════════════════════════════════════════
//  Módulo SH — Sinalização horizontal (levantamento da pintura)
//  Cada toque registra uma mudança na posição travada do toque.
//  O tipo de eixo vale até o próximo toque: cada par vira um segmento.
//  Nomenclatura: Manual Brasileiro de Sinalização de Trânsito, Vol. IV (CONTRAN).
// ════════════════════════════════════════════════════════════════
(function () {
  // grupo: trecho | eixo (estado) | fa (abre/fecha por lado) | bordo | zeb | tachas | pontual
  const B = [
    { g: 'trecho', cod: 'INI_TRECHO', r: 'Início do trecho', l: 'Início trecho', k: 'trecho' },
    { g: 'trecho', cod: 'FIM_TRECHO', r: 'Fim do trecho', l: 'Fim trecho', k: 'fim' },
    { g: 'eixo', cod: 'LFO-2', r: 'Eixo seccionado (LFO-2)', l: 'Seccionada', c: 'LFO-2' },
    { g: 'eixo', cod: 'LFO-1', r: 'Eixo contínuo simples (LFO-1)', l: 'Contínua', c: 'LFO-1' },
    { g: 'eixo', cod: 'LFO-3', r: 'Eixo dupla contínua (LFO-3)', l: 'Dupla contínua', c: 'LFO-3' },
    { g: 'eixo', cod: 'LFO-4E', r: 'Eixo misto, contínua à esquerda (LFO-4)', l: 'Mista esq.', c: 'LFO-4' },
    { g: 'eixo', cod: 'LFO-4D', r: 'Eixo misto, contínua à direita (LFO-4)', l: 'Mista dir.', c: 'LFO-4' },
    { g: 'eixo', cod: 'LFO-5', r: 'Eixo dupla seccionada', l: 'Dupla secc.' },
    { g: 'eixo', cod: 'SEM', r: 'Eixo sem pintura', l: 'Sem pintura' },
    { g: 'fa', cod: 'FA_INI_E', r: 'Início faixa adicional à esquerda', l: 'Início f. adic.', c: 'esquerda', lado: 'E', abre: true },
    { g: 'fa', cod: 'FA_INI_D', r: 'Início faixa adicional à direita', l: 'Início f. adic.', c: 'direita', lado: 'D', abre: true },
    { g: 'fa', cod: 'FA_FIM_E', r: 'Término faixa adicional à esquerda', l: 'Fim f. adic.', c: 'esquerda', lado: 'E' },
    { g: 'fa', cod: 'FA_FIM_D', r: 'Término faixa adicional à direita', l: 'Fim f. adic.', c: 'direita', lado: 'D' },
    { g: 'bordo', cod: 'BO_AUS', r: 'Bordo ausente (início)', l: 'Bordo ausente', abre: true },
    { g: 'bordo', cod: 'BO_RET', r: 'Bordo retomado', l: 'Bordo retomado' },
    { g: 'zeb', cod: 'ZEB_INI', r: 'Início de zebrado', l: 'Zebrado início', abre: true },
    { g: 'zeb', cod: 'ZEB_FIM', r: 'Fim de zebrado', l: 'Zebrado fim' },
    { g: 'tachas', cod: 'TA_INI', r: 'Início de tachas', l: 'Tachas início', abre: true },
    { g: 'tachas', cod: 'TA_FIM', r: 'Fim de tachas', l: 'Tachas fim' },
    { g: 'pontual', cod: 'FX_PED', r: 'Faixa de pedestres', l: 'Faixa pedestres' },
    { g: 'pontual', cod: 'LRE', r: 'Linha de retenção', l: 'Linha retenção' },
    { g: 'pontual', cod: 'DESG', r: 'Pintura desgastada', l: 'Desgastada' },
  ];
  const BY = {}; B.forEach(b => BY[b.cod] = b);
  const COR = { 'LFO-1': '#E6A800', 'LFO-2': '#F5C500', 'LFO-3': '#D84315', 'LFO-4E': '#8E24AA', 'LFO-4D': '#3949AB', 'LFO-5': '#00897B', 'SEM': '#9E9E9E' };
  const MATERIAIS = ['Tinta acrílica base solvente', 'Tinta base água', 'Termoplástico por aspersão', 'Termoplástico por extrusão', 'Termoplástico pré-formado', 'Plástico a frio', 'Não identificado'];

  // ── estado atual a partir da sequência de registros ─────────
  function estado(s) {
    const e = { trecho: false, eixo: null, fa: { E: false, D: false }, bordo: false, zeb: false, tachas: false };
    s.eventos.forEach(ev => {
      const b = BY[ev.cod]; if (!b) return;
      if (b.g === 'trecho') e.trecho = b.cod === 'INI_TRECHO';
      else if (b.g === 'eixo') e.eixo = b.cod;
      else if (b.g === 'fa') e.fa[b.lado] = !!b.abre;
      else if (b.g === 'bordo') e.bordo = !!b.abre;
      else if (b.g === 'zeb') e.zeb = !!b.abre;
      else if (b.g === 'tachas') e.tachas = !!b.abre;
    });
    return e;
  }
  // posição (km/est) no fim da sessão ou agora
  function fimPos(s) { const o = s.fim ? s.offFim : Core.off(s); return Object.assign({ d: s.dist, off: o }, Core.posValues(s, o)); }

  /** Segmentos contínuos: eixo por tipo, faixas adicionais, bordo ausente, zebrado, tachas */
  function segmentos(s) {
    const segs = []; const aberto = {}; let eixo = null; const fim = fimPos(s);
    const fecha = (key, ev, extra) => { const a = aberto[key]; if (!a) return; segs.push(Object.assign({ ini: a.ev, fim: ev, d1: a.ev.d, d2: ev.d, len: Math.abs(ev.d - a.ev.d) }, a.info, extra)); delete aberto[key]; };
    s.eventos.forEach(ev => {
      const b = BY[ev.cod]; if (!b) return;
      if (b.g === 'eixo' || (b.g === 'trecho' && b.cod === 'FIM_TRECHO')) {
        if (eixo) fecha('eixo', ev);
        eixo = b.g === 'eixo' ? b.cod : null;
        if (eixo) aberto.eixo = { ev, info: { tipo: 'eixo', cod: eixo } };
      }
      if (b.cod === 'FIM_TRECHO') { ['faE', 'faD', 'bordo', 'zeb', 'tachas'].forEach(k => fecha(k, ev)); return; }
      if (b.g === 'fa') { const k = 'fa' + b.lado; if (b.abre) { fecha(k, ev); aberto[k] = { ev, info: { tipo: 'fa', cod: 'FA_' + b.lado, lado: b.lado } }; } else fecha(k, ev); }
      if (['bordo', 'zeb', 'tachas'].includes(b.g)) { if (b.abre) { fecha(b.g, ev); aberto[b.g] = { ev, info: { tipo: b.g, cod: b.cod } }; } else fecha(b.g, ev); }
    });
    Object.keys(aberto).forEach(k => fecha(k, fim, { aberto: true }));
    return segs;
  }
  function quantitativos(s) {
    const q = {};
    segmentos(s).forEach(g => {
      const nome = g.tipo === 'eixo' ? BY[g.cod].r : g.tipo === 'fa' ? 'Faixa adicional à ' + (g.lado === 'E' ? 'esquerda' : 'direita')
        : g.tipo === 'bordo' ? 'Bordo ausente' : g.tipo === 'zeb' ? 'Zebrado' : 'Tachas';
      q[nome] = q[nome] || { m: 0, n: 0, cor: g.tipo === 'eixo' ? COR[g.cod] : null }; q[nome].m += g.len; q[nome].n++;
    });
    return q;
  }

  // ── abertura da sessão: parâmetros da pintura ───────────────
  function sel(id, opts, v) { return `<select class="inp" id="${id}">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
  function inp(id, v, ph) { return `<input class="inp" id="${id}" inputmode="decimal" value="${v != null ? esc(v) : ''}" placeholder="${ph || ''}">`; }
  const f = (lbl, html) => `<div class="field"><label>${lbl}</label>${html}</div>`;

  const M = {
    id: 'sh', nome: 'Sinalização Horizontal', sub: 'Pintura com um toque, KML e croqui', icone: '〰️', prefixo: 'S',
    titulo: (ev) => ev.rotulo,
    iconeEvento: () => '',
    camposAbertura(u) {
      u = u || {};
      return `<div class="fsec">Pista</div><div class="fgrid">
          ${f('Pista', sel('sh-pista', ['Simples', 'Dupla'], u.pista || 'Simples'))}
          ${f('Faixas por sentido', inp('sh-faixas', u.faixas || '1'))}</div>
        <div class="fsec">Eixo</div><div class="fgrid">
          ${f('Largura (cm)', inp('sh-ex-l', u.eixoLarg, 'ex.: 10'))}${f('Cor', sel('sh-ex-c', ['Amarela', 'Branca'], u.eixoCor || 'Amarela'))}
          ${f('Traço (m)', inp('sh-ex-t', u.eixoTraco, 'ex.: 4'))}${f('Espaço (m)', inp('sh-ex-e', u.eixoEsp, 'ex.: 12'))}</div>
        <div class="fsec">Bordos</div><div class="fgrid">
          ${f('Largura (cm)', inp('sh-bo-l', u.bordoLarg, 'ex.: 10'))}${f('Cor', sel('sh-bo-c', ['Branca', 'Amarela'], u.bordoCor || 'Branca'))}
          ${f('Lados', sel('sh-bo-s', ['Ambos', 'Só direito', 'Só esquerdo'], u.bordoLados || 'Ambos'))}</div>
        <div class="fsec">Divisão de faixas (mesmo sentido)</div><div class="fgrid">
          ${f('Largura (cm)', inp('sh-df-l', u.divLarg))}${f('Traço / espaço (m)', `<input class="inp" id="sh-df-c" value="${esc(u.divCad || '')}" placeholder="ex.: 4/12">`)}</div>
        <div class="fsec">Material e tachas</div>
          ${f('Material', sel('sh-mat', MATERIAIS, u.material || MATERIAIS[0]))}
          <div class="fgrid">${f('Tachas', sel('sh-ta', ['Não há', 'Monodirecional', 'Bidirecional'], u.tachas || 'Não há'))}${f('Espaçamento (m)', inp('sh-ta-e', u.tachasEsp))}</div>
        <div class="fsec">Estado e croqui</div><div class="fgrid">
          ${f('Estado geral', sel('sh-est', ['Bom', 'Regular', 'Ruim'], u.estado || 'Bom'))}
          ${f('Croqui: metros por linha', sel('sh-cq', ['250', '500', '1000'], String(u.croqui || '500')))}</div>
        <p class="help">As larguras e o material são deste levantamento. Nomenclatura das linhas conforme o Manual Brasileiro de Sinalização de Trânsito, Vol. IV (CONTRAN).</p>`;
    },
    lerAbertura() {
      const n = (id) => { const v = num(id); return isNaN(v) ? null : v; };
      return {
        pista: val('sh-pista'), faixas: n('sh-faixas') || 1,
        eixoLarg: n('sh-ex-l'), eixoCor: val('sh-ex-c'), eixoTraco: n('sh-ex-t'), eixoEsp: n('sh-ex-e'),
        bordoLarg: n('sh-bo-l'), bordoCor: val('sh-bo-c'), bordoLados: val('sh-bo-s'),
        divLarg: n('sh-df-l'), divCad: val('sh-df-c').trim(),
        material: val('sh-mat'), tachas: val('sh-ta'), tachasEsp: n('sh-ta-e'), estado: val('sh-est'), croqui: parseInt(val('sh-cq')) || 500,
      };
    },

    // ── painel com os botões de um toque ──────────────────────
    painel() {
      const btn = (cod, extraCls) => {
        const b = BY[cod];
        return `<button class="sh-btn ${b.k || ''} ${extraCls || ''}" id="shb-${cod}" data-cod="${cod}">${ICONS.get(cod)}<span>${esc(b.l)}</span>${b.c ? `<small>${esc(b.c)}</small>` : ''}</button>`;
      };
      const grp = (t, cods, c2) => `<div class="sh-grp"><div class="sh-grp-t">${t}</div><div class="sh-grid"${c2 ? ' style="grid-template-columns:1fr 1fr"' : ''}>${cods.map(c => btn(c)).join('')}</div></div>`;
      return `<div class="card">
        <div class="sh-state" id="sh-state"></div>
        <div class="sh-undo"><button class="btn-sm g" onclick="SH.desfazer()">↶ Desfazer último</button><button class="btn-sm n" onclick="SH.detalhe()">📷 Foto / obs. no último</button></div>
        ${grp('Trecho', ['INI_TRECHO', 'FIM_TRECHO'], 1)}
        ${grp('Eixo', ['LFO-2', 'LFO-1', 'LFO-3', 'LFO-4E', 'LFO-4D', 'LFO-5', 'SEM'])}
        ${grp('Faixa adicional', ['FA_INI_E', 'FA_INI_D', 'FA_FIM_E', 'FA_FIM_D'], 1)}
        ${grp('Bordo, zebrado e tachas', ['BO_AUS', 'BO_RET', 'ZEB_INI', 'ZEB_FIM', 'TA_INI', 'TA_FIM'])}
        ${grp('Pontuais', ['FX_PED', 'LRE', 'DESG'])}
        <p class="help" style="text-align:center">Toque = registra na hora · toque longo = registra e abre foto e observação</p>
      </div>`;
    },
    montar(s) {
      document.querySelectorAll('.sh-btn').forEach(el => {
        let t = null, longo = false;
        const down = (e) => { e.preventDefault(); longo = false; t = setTimeout(() => { longo = true; SH.toque(el.dataset.cod, true); }, 650); };
        const up = (e) => { e.preventDefault(); if (t) { clearTimeout(t); t = null; } if (!longo) SH.toque(el.dataset.cod, false); };
        const cancel = () => { if (t) { clearTimeout(t); t = null; } };
        el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointerleave', cancel);
        el.addEventListener('contextmenu', e => e.preventDefault());
      });
      M.atualizar(s);
    },
    atualizar(s) {
      if (!$('sh-state')) return;
      const e = estado(s);
      B.forEach(b => {
        const el = $('shb-' + b.cod); if (!el) return;
        let on = false;
        if (b.g === 'trecho') on = b.cod === 'INI_TRECHO' && e.trecho;
        else if (b.g === 'eixo') on = e.eixo === b.cod;
        else if (b.g === 'fa') on = b.abre && e.fa[b.lado];
        else if (b.abre) on = e[b.g];
        el.classList.toggle('on', !!on);
      });
      const fa = ['E', 'D'].filter(x => e.fa[x]).map(x => x === 'E' ? 'esq.' : 'dir.');
      $('sh-state').innerHTML = `Trecho: <b>${e.trecho ? 'aberto' : 'fechado'}</b> · Eixo: <b>${e.eixo ? BY[e.eixo].l : '—'}</b>`
        + (fa.length ? ` · Faixa adic.: <b>${fa.join(' e ')}</b>` : '') + (e.bordo ? ' · <b>bordo ausente</b>' : '')
        + (e.zeb ? ' · <b>zebrado</b>' : '') + (e.tachas ? ' · <b>tachas</b>' : '');
    },

    // ── relatório ────────────────────────────────────────────
    relatorio(s, ctx) {
      const p = s.params || {};
      const v = (x, u) => x == null || x === '' ? '—' : (typeof x === 'number' ? nf(x, x % 1 ? 2 : 0) : esc(x)) + (u || '');
      const params = `<h2>Parâmetros do levantamento</h2><table><tbody>
        <tr><td><b>Pista</b></td><td>${v(p.pista)} · ${v(p.faixas)} faixa(s) por sentido</td><td><b>Material</b></td><td>${v(p.material)}</td></tr>
        <tr><td><b>Eixo</b></td><td>${v(p.eixoLarg, ' cm')} · ${v(p.eixoCor)} · traço ${v(p.eixoTraco, ' m')} / espaço ${v(p.eixoEsp, ' m')}</td><td><b>Tachas</b></td><td>${v(p.tachas)}${p.tachasEsp ? ' · a cada ' + v(p.tachasEsp, ' m') : ''}</td></tr>
        <tr><td><b>Bordos</b></td><td>${v(p.bordoLarg, ' cm')} · ${v(p.bordoCor)} · ${v(p.bordoLados)}</td><td><b>Estado geral</b></td><td>${v(p.estado)}</td></tr>
        <tr><td><b>Divisão de faixas</b></td><td>${v(p.divLarg, ' cm')} · ${v(p.divCad)}</td><td><b>Referência</b></td><td>MBST Vol. IV (CONTRAN)</td></tr>
      </tbody></table>`;
      const q = quantitativos(s);
      const quant = `<h2>Quantitativos</h2><table><thead><tr><th>Elemento</th><th class="r">Extensão (m)</th><th class="r">Trechos</th></tr></thead><tbody>
        ${Object.keys(q).map(k => `<tr><td>${q[k].cor ? `<span style="display:inline-block;width:10px;height:10px;background:${q[k].cor};margin-right:6px"></span>` : ''}${esc(k)}</td><td class="r">${nf(q[k].m, 1)}</td><td class="r">${q[k].n}</td></tr>`).join('') || '<tr><td colspan="3" class="c">Sem segmentos registrados.</td></tr>'}
      </tbody></table>`;
      const segs = segmentos(s).filter(g => g.tipo === 'eixo');
      const lista = `<h2>Segmentos do eixo</h2><table><thead><tr><th>Tipo</th><th>Início</th><th>Fim</th><th class="r">Extensão (m)</th></tr></thead><tbody>
        ${segs.map(g => `<tr><td>${esc(BY[g.cod].r)}</td><td class="nw">${esc(posTxt(s, g.ini))}</td><td class="nw">${esc(posTxt(s, g.fim))}${g.aberto ? ' (aberto)' : ''}</td><td class="r">${nf(g.len, 1)}</td></tr>`).join('') || '<tr><td colspan="4" class="c">—</td></tr>'}</tbody></table>`;
      return params + quant + `<h2>Croqui linear</h2><div class="croqui">${croqui(s)}</div>` + lista + '<h2>Registros</h2>' + ctx.tabelaPadrao();
    },

    // ── KML ──────────────────────────────────────────────────
    kmlEstilos(s, kc) {
      return Object.keys(COR).map(c => `<Style id="sh-${c}"><LineStyle><color>${kc(COR[c])}</color><width>${c === 'LFO-3' ? 7 : 5}</width></LineStyle></Style>`).join('\n')
        + `<Style id="sh-fa"><LineStyle><color>${kc('#1E88E5', 'cc')}</color><width>9</width></LineStyle></Style>`
        + `<Style id="sh-bordo"><LineStyle><color>${kc('#E53935')}</color><width>6</width></LineStyle></Style>`
        + `<Style id="sh-zeb"><LineStyle><color>${kc('#FDD835', 'aa')}</color><width>10</width></LineStyle></Style>`
        + `<Style id="sh-tachas"><LineStyle><color>${kc('#FF7043')}</color><width>3</width></LineStyle></Style>`;
    },
    kmlExtra(s, h) {
      const segs = segmentos(s); const fold = (nome, arr) => arr.length ? `<Folder><name>${nome}</name>\n${arr.join('\n')}</Folder>\n` : '';
      const pm = (g, nome, style) => {
        const c = h.trechoTrack(s, g.d1, g.d2); if (!c) return '';
        return `<Placemark><name>${esc(nome)} · ${nf(g.len, 0)} m</name><description>${esc(posTxt(s, g.ini) + ' → ' + posTxt(s, g.fim))}</description><styleUrl>#${style}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${c}</coordinates></LineString></Placemark>`;
      };
      return fold('Eixo', segs.filter(g => g.tipo === 'eixo').map(g => pm(g, BY[g.cod].r, 'sh-' + g.cod)))
        + fold('Faixas adicionais', segs.filter(g => g.tipo === 'fa').map(g => pm(g, 'Faixa adicional ' + (g.lado === 'E' ? 'esquerda' : 'direita'), 'sh-fa')))
        + fold('Bordo ausente', segs.filter(g => g.tipo === 'bordo').map(g => pm(g, 'Bordo ausente', 'sh-bordo')))
        + fold('Zebrado', segs.filter(g => g.tipo === 'zeb').map(g => pm(g, 'Zebrado', 'sh-zeb')))
        + fold('Tachas', segs.filter(g => g.tipo === 'tachas').map(g => pm(g, 'Tachas', 'sh-tachas')));
    },
  };

  // ── croqui linear (SVG) ─────────────────────────────────────
  //  x = distância percorrida; esquerda do motorista = parte de cima.
  function croqui(s) {
    const p = s.params || {}; const L = p.croqui || 500; const W = 1000, X0 = 70, RH = 132;
    const evs = s.eventos; const fim = fimPos(s);
    const dIni = evs.length ? Math.min(0, ...evs.map(e => e.d)) : 0;
    const dFim = Math.max(fim.d, ...evs.map(e => e.d), dIni + 50);
    const rows = Math.max(1, Math.ceil((dFim - dIni) / L));
    const segs = segmentos(s);
    // off por distância (para escrever km/estaca na régua)
    const pts = s.track.filter(t => t[3] != null).map(t => [t[3], t[2]]).concat(evs.map(e => [e.d, e.off])).sort((a, b) => a[0] - b[0]);
    const offAt = (d) => {
      if (!pts.length) return s.dir === 'C' ? d : -d;
      let i = pts.findIndex(q => q[0] >= d); if (i < 0) i = pts.length - 1; if (i === 0) return pts[0][1] + (s.dir === 'C' ? 1 : -1) * (d - pts[0][0]);
      const a = pts[i - 1], b = pts[i]; return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]);
    };
    const lbl = (d) => { const o = offAt(d); return s.modo === 'est' ? 'Est ' + fmtEst(s.s0 + o, s) : 'km ' + fmtKm(s.k0 + o); };
    const pxm = W / L;
    const out = [];
    for (let r = 0; r < rows; r++) {
      const a = dIni + r * L, b = a + L; const y0 = 0;  // cada linha é um SVG próprio
      const xs = (d) => X0 + (Math.max(a, Math.min(b, d)) - a) * pxm;
      const g = [];
      g.push(`<text x="4" y="${y0 + 64}" font-size="11" fill="#333" font-family="Arial">${esc(lbl(a))}</text>`);
      g.push(`<rect x="${X0}" y="${y0 + 44}" width="${W}" height="40" fill="#5A5F66"/>`);
      // faixas adicionais
      segs.filter(q => q.tipo === 'fa' && q.d2 > a && q.d1 < b).forEach(q => {
        const x1 = xs(Math.min(q.d1, q.d2)), x2 = xs(Math.max(q.d1, q.d2)); const yy = q.lado === 'E' ? y0 + 26 : y0 + 84;
        g.push(`<rect x="${x1}" y="${yy}" width="${x2 - x1}" height="18" fill="#5A5F66"/><line x1="${x1}" y1="${q.lado === 'E' ? y0 + 44 : y0 + 84}" x2="${x2}" y2="${q.lado === 'E' ? y0 + 44 : y0 + 84}" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 6"/>`);
        g.push(`<line x1="${x1}" y1="${q.lado === 'E' ? y0 + 27 : y0 + 101}" x2="${x2}" y2="${q.lado === 'E' ? y0 + 27 : y0 + 101}" stroke="#fff" stroke-width="2"/>`);
      });
      // bordos
      g.push(`<line x1="${X0}" y1="${y0 + 46}" x2="${X0 + W}" y2="${y0 + 46}" stroke="#fff" stroke-width="2"/><line x1="${X0}" y1="${y0 + 82}" x2="${X0 + W}" y2="${y0 + 82}" stroke="#fff" stroke-width="2"/>`);
      segs.filter(q => q.tipo === 'bordo' && q.d2 > a && q.d1 < b).forEach(q => {
        const x1 = xs(Math.min(q.d1, q.d2)), x2 = xs(Math.max(q.d1, q.d2));
        g.push(`<line x1="${x1}" y1="${y0 + 46}" x2="${x2}" y2="${y0 + 46}" stroke="#E53935" stroke-width="3" stroke-dasharray="3 3"/><line x1="${x1}" y1="${y0 + 82}" x2="${x2}" y2="${y0 + 82}" stroke="#E53935" stroke-width="3" stroke-dasharray="3 3"/>`);
      });
      segs.filter(q => q.tipo === 'zeb' && q.d2 > a && q.d1 < b).forEach(q => {
        const x1 = xs(Math.min(q.d1, q.d2)), x2 = xs(Math.max(q.d1, q.d2));
        g.push(`<rect x="${x1}" y="${y0 + 56}" width="${x2 - x1}" height="16" fill="none" stroke="#F5C500" stroke-width="1.5"/>`);
        for (let x = x1 + 4; x < x2 - 4; x += 8) g.push(`<line x1="${x}" y1="${y0 + 72}" x2="${x + 6}" y2="${y0 + 56}" stroke="#F5C500" stroke-width="1"/>`);
      });
      segs.filter(q => q.tipo === 'tachas' && q.d2 > a && q.d1 < b).forEach(q => {
        const x1 = xs(Math.min(q.d1, q.d2)), x2 = xs(Math.max(q.d1, q.d2));
        for (let x = x1; x <= x2; x += 10) g.push(`<circle cx="${x}" cy="${y0 + 67}" r="1.8" fill="#FF5252"/>`);
      });
      // eixo
      segs.filter(q => q.tipo === 'eixo' && q.d2 > a && q.d1 < b).forEach(q => {
        const x1 = xs(Math.min(q.d1, q.d2)), x2 = xs(Math.max(q.d1, q.d2));
        const t = (p.eixoTraco || 4) * pxm, e = (p.eixoEsp || 12) * pxm; const dash = `stroke-dasharray="${Math.max(2, t)} ${Math.max(2, e)}"`;
        const ln = (y, d) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#F5C500" stroke-width="2.4" ${d ? dash : ''}/>`;
        const c = y0 + 64;
        if (q.cod === 'LFO-1') g.push(ln(c));
        else if (q.cod === 'LFO-2') g.push(ln(c, 1));
        else if (q.cod === 'LFO-3') g.push(ln(c - 3), ln(c + 3));
        else if (q.cod === 'LFO-4E') g.push(ln(c - 3), ln(c + 3, 1));
        else if (q.cod === 'LFO-4D') g.push(ln(c - 3, 1), ln(c + 3));
        else if (q.cod === 'LFO-5') g.push(ln(c - 3, 1), ln(c + 3, 1));
        if (x2 - x1 > 46 && q.cod !== 'SEM') g.push(`<text x="${(x1 + x2) / 2}" y="${y0 + 40}" font-size="9" text-anchor="middle" fill="#555" font-family="Arial">${esc(BY[q.cod].c || BY[q.cod].l)}</text>`);
      });
      // marcos de registro
      evs.filter(ev => ev.d >= a && ev.d < b).forEach(ev => {
        const x = xs(ev.d); const bb = BY[ev.cod];
        const pont = bb && bb.g === 'pontual';
        g.push(`<line x1="${x}" y1="${y0 + 14}" x2="${x}" y2="${y0 + 106}" stroke="${pont ? '#1565C0' : '#111'}" stroke-width="0.8" stroke-dasharray="${pont ? '0' : '2 2'}"/>`);
        g.push(`<text x="${x + 2}" y="${y0 + 12}" font-size="9" fill="#111" font-family="Arial">${Core.codigo(s, ev)}</text>`);
      });
      // régua a cada 100 m
      for (let d = Math.ceil(a / 100) * 100; d <= b; d += 100) {
        const x = xs(d);
        g.push(`<line x1="${x}" y1="${y0 + 108}" x2="${x}" y2="${y0 + 114}" stroke="#333" stroke-width="1"/>`);
        if ((d - a) % (L >= 1000 ? 200 : 100) === 0) g.push(`<text x="${x}" y="${y0 + 126}" font-size="9" text-anchor="middle" fill="#333" font-family="Arial">${esc(lbl(d))}</text>`);
      }
      out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${X0 + W + 10} ${RH}" role="img" aria-label="Croqui linha ${r + 1}">${g.join('')}</svg>`);
    }
    return `<p style="font-size:10px;color:#555;margin:0 0 6px">Esquerda do motorista na parte de cima · ${L} m por linha · ${s.dir === 'C' ? 'sentido crescente' : 'sentido decrescente'}</p>` + out.join('');
  }

  // ── ações ───────────────────────────────────────────────────
  let ultimoId = null;
  window.SH = {
    toque(cod, longo) {
      const s = Core.S(); if (!s) return;
      const p = Core.pos(s);                       // posição travada no toque
      const b = BY[cod];
      const ev = Core.addEvent({ grupo: b.g, cod, rotulo: b.r }, p);
      ultimoId = ev.id;
      buzz(b.g === 'trecho' ? [60, 40, 60] : 40); beep(b.g === 'trecho' ? 900 : 1300);
      const el = $('shb-' + cod); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      toast(Core.codigo(s, ev) + ' · ' + b.l + (b.c ? ' ' + b.c : '') + ' · ' + posTxt(s, ev));
      if (longo) SH.detalhe(ev.id);
    },
    desfazer() {
      const ev = Core.undoLast(); if (ev) { toast('↶ Desfeito: ' + ev.rotulo); beep(500, 0.12); }
    },
    detalhe(id) {
      const s = Core.S(); if (!s) return;
      const ev = id ? s.eventos.find(e => e.id === id) : s.eventos[s.eventos.length - 1];
      if (!ev) { toast('Nenhum registro ainda'); return; }
      UI.modal('📝 ' + Core.codigo(s, ev) + ' · ' + esc(ev.rotulo), `
        <div class="preview-fmt" style="margin-bottom:12px">${esc(posTxt(s, ev) + ' · ' + fmtCoord(ev.lat, ev.lon))}</div>
        <div class="field"><label>Observação</label><textarea class="inp" id="sh-obs" rows="3">${esc(ev.obs || '')}</textarea></div>
        <div class="field"><button class="btn-cam ${ev.fotos.length ? 'has' : ''}" onclick="SH.foto('${ev.id}')">📷 ${ev.fotos.length ? 'Mais uma foto (' + ev.fotos.length + ')' : 'Tirar foto'}</button></div>
        <button class="btn-full" onclick="SH.salvarDet('${ev.id}')">✓ Salvar</button>`);
    },
    async foto(id) {
      const s = Core.S(); const ev = s.eventos.find(e => e.id === id); if (!ev) return;
      const p = s.params || {};
      const name = await Photo.capture(s, ev, Photo.linhasPadrao(s, ev, ev.rotulo, [p.material, val('sh-obs').trim()]));
      if (name) { ev.obs = val('sh-obs').trim(); ev.fotos.push(name); Core.updateEvent(ev); SH.detalhe(id); }
    },
    salvarDet(id) {
      const s = Core.S(); const ev = s.eventos.find(e => e.id === id); if (!ev) return;
      ev.obs = val('sh-obs').trim(); Core.updateEvent(ev); UI.closeModal(); toast('Observação salva');
    },
    _segmentos: segmentos, _croqui: croqui, _quant: quantitativos,
  };
  Modules.register(M);
})();
