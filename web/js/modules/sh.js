// ════════════════════════════════════════════════════════════════
//  Módulo SH — Sinalização horizontal (levantamento da pintura)
//
//  Como funciona:
//  · Na abertura da sessão informa-se o tipo de pista (simples ou dupla),
//    as faixas por sentido e as linhas que existem no início. A partir do
//    ponto inicial o app já considera bordos contínuos, o eixo (pista
//    simples) ou a divisão de faixas (pista dupla) e o número de faixas.
//  · Depois só se toca quando algo MUDA, na posição travada do toque:
//      – eixo / divisão: o tipo vale até o próximo toque;
//      – faixas: "+ faixa" e "− faixa" (2→3, 3→4, 4→3…). A linha que era
//        bordo vira divisão tracejada e o bordo passa para a faixa nova;
//      – bordo seccionado / ausente, zebrado, tachas e pausa: um toque liga
//        (botão aceso) e outro toque volta ao normal.
//  · Pista dupla: levanta-se um sentido por sessão, canteiro à esquerda.
//    Não há eixo amarelo; as linhas entre faixas são brancas (LMS).
//  Nomenclatura: Manual Brasileiro de Sinalização de Trânsito, Vol. IV (CONTRAN).
// ════════════════════════════════════════════════════════════════
(function () {
  const B = [
    // trecho (pausa / retomada do levantamento)
    { g: 'trecho', cod: 'INI_TRECHO', r: 'Início do trecho', l: 'Início do trecho' },
    { g: 'trecho', cod: 'FIM_TRECHO', r: 'Fim do trecho', l: 'Fim do trecho' },
    // eixo — pista simples (amarelo, LFO)
    { g: 'eixo', cod: 'LFO-2', r: 'Eixo seccionado (LFO-2)', l: 'Seccionada', c: 'LFO-2' },
    { g: 'eixo', cod: 'LFO-1', r: 'Eixo contínuo simples (LFO-1)', l: 'Contínua', c: 'LFO-1' },
    { g: 'eixo', cod: 'LFO-3', r: 'Eixo dupla contínua (LFO-3)', l: 'Dupla contínua', c: 'LFO-3' },
    { g: 'eixo', cod: 'LFO-4E', r: 'Eixo misto, contínua à esquerda (LFO-4)', l: 'Mista esq.', c: 'LFO-4' },
    { g: 'eixo', cod: 'LFO-4D', r: 'Eixo misto, contínua à direita (LFO-4)', l: 'Mista dir.', c: 'LFO-4' },
    { g: 'eixo', cod: 'LFO-5', r: 'Eixo dupla seccionada', l: 'Dupla secc.' },
    { g: 'eixo', cod: 'SEM', r: 'Eixo sem pintura', l: 'Sem pintura' },
    // divisão de faixas do mesmo sentido (branco, LMS)
    { g: 'div', cod: 'LMS-1', r: 'Divisão de faixas seccionada (LMS-1)', l: 'Seccionada', c: 'LMS-1' },
    { g: 'div', cod: 'LMS-2', r: 'Divisão de faixas contínua (LMS-2)', l: 'Contínua', c: 'LMS-2' },
    { g: 'div', cod: 'DIV_SEM', r: 'Divisão de faixas sem pintura', l: 'Sem pintura' },
    // faixas
    // faixa adicional: um botão por lado — toque abre (fica aceso), toque de novo fecha
    { g: 'fx', cod: 'FX_MAIS_E', r: 'Início de faixa adicional à esquerda', l: 'Faixa adicional esq.', lado: 'E', delta: 1 },
    { g: 'fx', cod: 'FX_MAIS_D', r: 'Início de faixa adicional à direita', l: 'Faixa adicional dir.', lado: 'D', delta: 1 },
    { g: 'fx', cod: 'FX_MENOS_E', r: 'Término de faixa adicional à esquerda', l: 'Fim faixa adic. esq.', lado: 'E', delta: -1, oculto: 1 },
    { g: 'fx', cod: 'FX_MENOS_D', r: 'Término de faixa adicional à direita', l: 'Fim faixa adic. dir.', lado: 'D', delta: -1, oculto: 1 },
    // bordos (toque liga; toque de novo registra o retorno ao contínuo)
    { g: 'bo', cod: 'BOE_S', r: 'Bordo esquerdo seccionado', l: 'Bordo esq. seccionado', lado: 'E', est: 'S' },
    { g: 'bo', cod: 'BOD_S', r: 'Bordo direito seccionado', l: 'Bordo dir. seccionado', lado: 'D', est: 'S' },
    { g: 'bo', cod: 'BOE_A', r: 'Bordo esquerdo ausente', l: 'Bordo esq. ausente', lado: 'E', est: 'A' },
    { g: 'bo', cod: 'BOD_A', r: 'Bordo direito ausente', l: 'Bordo dir. ausente', lado: 'D', est: 'A' },
    { g: 'bo', cod: 'BOE_C', r: 'Bordo esquerdo volta a contínuo', l: 'Bordo esq. contínuo', lado: 'E', est: 'C', oculto: 1 },
    { g: 'bo', cod: 'BOD_C', r: 'Bordo direito volta a contínuo', l: 'Bordo dir. contínuo', lado: 'D', est: 'C', oculto: 1 },
    // zebrado e tachas (um botão liga/desliga cada)
    { g: 'zeb', cod: 'ZEB_INI', r: 'Início de zebrado', l: 'Zebrado', abre: true },
    { g: 'zeb', cod: 'ZEB_FIM', r: 'Fim de zebrado', l: 'Zebrado fim', oculto: 1 },
    // tachas: as do trecho valem em todo ele; o botão marca a exceção (falta, ou presença num trecho sem tachas)
    { g: 'tachas', cod: 'TA_INI', r: 'Início de exceção de tachas', l: 'Tachas (exceção)', abre: true },
    { g: 'tachas', cod: 'TA_FIM', r: 'Fim de exceção de tachas', l: 'Tachas fim', oculto: 1 },
    // dispositivo (interseção, acesso, retorno): início e término
    { g: 'disp', cod: 'DISP_INI', r: 'Início de dispositivo', l: 'Dispositivo', abre: true },
    { g: 'disp', cod: 'DISP_FIM', r: 'Término de dispositivo', l: 'Dispositivo fim', oculto: 1 },
    // pontuais
    { g: 'pontual', cod: 'FX_PED', r: 'Faixa de pedestres', l: 'Faixa pedestres' },
    { g: 'pontual', cod: 'LRE', r: 'Linha de retenção', l: 'Linha retenção' },
    { g: 'pontual', cod: 'LOMB', r: 'Lombada (ondulação transversal)', l: 'Lombada' },
    { g: 'pontual', cod: 'DESG', r: 'Pintura desgastada', l: 'Desgastada' },
    // códigos de versões anteriores (sessões antigas continuam abrindo)
    { g: 'fa', cod: 'FA_INI_E', r: 'Início faixa adicional à esquerda', l: 'Início f. adic.', lado: 'E', delta: 1, oculto: 1 },
    { g: 'fa', cod: 'FA_INI_D', r: 'Início faixa adicional à direita', l: 'Início f. adic.', lado: 'D', delta: 1, oculto: 1 },
    { g: 'fa', cod: 'FA_FIM_E', r: 'Término faixa adicional à esquerda', l: 'Fim f. adic.', lado: 'E', delta: -1, oculto: 1 },
    { g: 'fa', cod: 'FA_FIM_D', r: 'Término faixa adicional à direita', l: 'Fim f. adic.', lado: 'D', delta: -1, oculto: 1 },
    { g: 'bo2', cod: 'BO_AUS', r: 'Bordo ausente (início)', l: 'Bordo ausente', est: 'A', oculto: 1 },
    { g: 'bo2', cod: 'BO_RET', r: 'Bordo retomado', l: 'Bordo retomado', est: 'C', oculto: 1 },
  ];
  const BY = {}; B.forEach(b => BY[b.cod] = b);
  const COR = { 'LFO-1': '#E6A800', 'LFO-2': '#F5C500', 'LFO-3': '#D84315', 'LFO-4E': '#8E24AA', 'LFO-4D': '#3949AB', 'LFO-5': '#00897B', 'SEM': '#9E9E9E',
    'LMS-1': '#90CAF9', 'LMS-2': '#1565C0', 'DIV_SEM': '#BDBDBD' };
  const MATERIAIS = ['Tinta acrílica base solvente', 'Tinta base água', 'Termoplástico por aspersão', 'Termoplástico por extrusão', 'Termoplástico pré-formado', 'Plástico a frio', 'Não identificado'];
  const EST_BO = { C: 'contínuo', S: 'seccionado', A: 'ausente' };

  // configuração do trecho atual (definida no "Início do trecho"); sessões antigas usam os parâmetros da sessão
  const dupla = (s, e) => e ? !!e.dupla : (s.params || {}).pista === 'Dupla';
  const nBase = (s, e) => Math.max(1, Math.round(e ? e.k : ((s.params || {}).faixas || 1)));
  const BORDOS = { 'Ambos': ['C', 'C'], 'Só direito': ['A', 'C'], 'Só esquerdo': ['C', 'A'], 'Nenhum': ['A', 'A'] };

  // ── estado da pista ao longo do trecho ─────────────────────
  function estadoInicial(s) {
    const p = s.params || {};
    const dp = p.pista === 'Dupla', k = Math.max(1, Math.round(p.faixas || 1));
    const bo = BORDOS[p.bordoLados] || BORDOS.Ambos;
    const base = { dupla: dp, k, E: 0, D: 0, bo: { E: bo[0], D: bo[1] }, zeb: false, tachas: false, disp: false, div: p.divIni || 'LMS-1',
      ta: { eixo: 'Não há', eixoEsp: 16, bordo: 'Não há', bordoEsp: 16 }, zd: null };
    if (p.v3) return Object.assign(base, { ativo: false, eixo: null });           // atual: nada até o "Início do trecho"
    if (p.v2) return Object.assign(base, { ativo: true, eixo: dp ? null : (p.eixoIni || 'LFO-2') });
    return Object.assign(base, { ativo: !s.eventos.some(e => e.cod === 'INI_TRECHO'), eixo: null });   // versão 1
  }
  const clone = (e) => JSON.parse(JSON.stringify(e));
  function aplica(s, e, b, ev) {
    const cf = ev && ev.dados && ev.dados.pista;
    if (b.cod === 'INI_TRECHO' && cf) {
      // novo trecho: a configuração respondida no início substitui a anterior
      const d = ev.dados, bo = BORDOS[d.bordos] || BORDOS.Ambos;
      Object.assign(e, { ativo: true, dupla: d.pista === 'Dupla', k: Math.max(1, Math.round(d.faixas || 1)), E: 0, D: 0,
        eixo: d.pista === 'Dupla' ? null : (d.eixo || 'LFO-2'), div: 'LMS-1', bo: { E: bo[0], D: bo[1] }, zeb: false, tachas: false, disp: false,
        ta: { eixo: d.taEixo || 'Não há', eixoEsp: +d.taEixoEsp || 16, bordo: d.taBordo || 'Não há', bordoEsp: +d.taBordoEsp || 16 }, zd: null });
    }
    else if (b.g === 'trecho') e.ativo = b.cod === 'INI_TRECHO';
    else if (b.g === 'eixo') e.eixo = b.cod;
    else if (b.g === 'div') e.div = b.cod;
    else if (b.g === 'fx' || b.g === 'fa') {
      e[b.lado] += b.delta; const t = faixas(s, e);
      if (t.nr < 1 || t.nl < (e.dupla ? 0 : 1)) e[b.lado] -= b.delta;   // não fecha a última faixa de um sentido
    }
    else if (b.g === 'bo') e.bo[b.lado] = b.est;
    else if (b.g === 'bo2') { e.bo.E = b.est; e.bo.D = b.est; }
    else if (b.g === 'zeb') { e.zeb = !!b.abre; e.zd = b.abre ? (ev && ev.dados && ev.dados.larg ? ev.dados : null) : null; }
    else if (b.g === 'tachas') e.tachas = !!b.abre;
    else if (b.g === 'disp') e.disp = !!b.abre;
  }
  /** faixas à esquerda do eixo (contramão) e à direita; na pista dupla todas são do mesmo sentido */
  function faixas(s, e) {
    const k = nBase(s, e);
    let nl, nr;
    if (e.dupla) { nl = Math.max(0, e.E); nr = k + e.D + Math.min(0, e.E); }
    else { nl = k + e.E; nr = k + e.D; }
    return { nl, nr, total: nl + nr };
  }
  const ordem = (s) => s.eventos.slice().sort((a, b) => (a.d - b.d) || ((a.seq || 0) - (b.seq || 0)));
  function estado(s) { const e = estadoInicial(s); ordem(s).forEach(ev => { const b = BY[ev.cod]; if (b) aplica(s, e, b, ev); }); return e; }
  function fimPos(s) { const o = s.fim ? s.offFim : Core.off(s); return Object.assign({ d: s.dist, off: o }, Core.posValues(s, o)); }
  function iniPos(s) { const d0 = Math.min(0, ...s.eventos.map(e => e.d)); return Object.assign({ d: d0, off: 0 }, Core.posValues(s, 0)); }

  /** intervalos entre mudanças, cada um com o estado da pista */
  function intervalos(s) {
    const out = []; const e = estadoInicial(s); let a = iniPos(s);
    ordem(s).forEach(ev => {
      const b = BY[ev.cod]; if (!b || b.g === 'pontual') return;
      if (ev.d > a.d) out.push({ d1: a.d, d2: ev.d, ini: a, fim: ev, st: clone(e) });
      aplica(s, e, b, ev); a = ev;
    });
    const f = fimPos(s); if (f.d > a.d) out.push({ d1: a.d, d2: f.d, ini: a, fim: f, st: clone(e), aberto: true });
    return out;
  }
  /** linhas de um intervalo, de cima (esquerda do motorista) para baixo */
  function linhas(s, st) {
    const t = faixas(s, st); const L = [];
    const n = t.nl + t.nr;
    L.push({ i: 0, tipo: 'bordo', lado: 'E', est: st.bo.E });
    for (let i = 1; i < n; i++) {
      if (!st.dupla && i === t.nl) L.push({ i, tipo: 'eixo', cod: st.eixo });
      else L.push({ i, tipo: 'div', cod: st.div });
    }
    L.push({ i: n, tipo: 'bordo', lado: 'D', est: st.bo.D });
    return { t, L };
  }

  /** segmentos contínuos (para KML e tabelas): junta intervalos vizinhos com o mesmo valor */
  function segmentos(s) {
    const iv = intervalos(s).filter(x => x.st.ativo); const segs = [];
    const junta = (tipo, chave, info) => {
      let cur = null;
      iv.forEach(x => {
        const k = chave(x);
        if (k == null) { if (cur) { segs.push(cur); cur = null; } return; }
        if (cur && cur.k === k && Math.abs(cur.d2 - x.d1) < 0.01) { cur.d2 = x.d2; cur.fim = x.fim; cur.aberto = x.aberto; }
        else { if (cur) segs.push(cur); cur = Object.assign({ tipo, k, d1: x.d1, d2: x.d2, ini: x.ini, fim: x.fim, aberto: x.aberto }, info(x)); }
      });
      if (cur) segs.push(cur);
    };
    junta('eixo', x => x.st.dupla ? null : x.st.eixo, x => ({ cod: x.st.eixo }));
    junta('div', x => linhas(s, x.st).L.some(l => l.tipo === 'div') ? x.st.div : null, x => ({ cod: x.st.div, n: linhas(s, x.st).L.filter(l => l.tipo === 'div').length }));
    junta('faixas', x => faixas(s, x.st).total + (x.st.dupla ? 'd' : 's'), x => ({ n: faixas(s, x.st).total, base: x.st.dupla ? x.st.k : 2 * x.st.k, dupla: x.st.dupla }));
    ['E', 'D'].forEach(l => junta('bordo', x => x.st.bo[l] !== 'C' ? l + x.st.bo[l] : null, x => ({ lado: l, est: x.st.bo[l] })));
    junta('zeb', x => x.st.zeb ? 1 : null, x => ({ zd: x.st.zd }));
    junta('tachas', x => x.st.tachas ? 1 : null, x => ({ falta: temTachas(x.st) }));
    junta('disp', x => x.st.disp ? 1 : null, () => ({}));
    segs.forEach(g => g.len = Math.abs(g.d2 - g.d1));
    return segs;
  }
  const temTachas = (st) => st.ta && (st.ta.eixo !== 'Não há' || st.ta.bordo !== 'Não há');
  const cad = (txt, padrao) => { const m = String(txt || '').replace(',', '.').match(/([\d.]+)\s*[\/x:]\s*([\d.]+)/); return m && +m[1] + +m[2] > 0 ? +m[1] / (+m[1] + +m[2]) : padrao; };
  /** fração pintada e número de linhas de cada tipo de eixo */
  function fatorEixo(cod, p) {
    const sec = p.eixoTraco && p.eixoEsp ? p.eixoTraco / (p.eixoTraco + p.eixoEsp) : 0.25;
    return { 'LFO-1': 1, 'LFO-2': sec, 'LFO-3': 2, 'LFO-4E': 1 + sec, 'LFO-4D': 1 + sec, 'LFO-5': 2 * sec, 'SEM': 0 }[cod] || 0;
  }
  /** extensões (m), áreas pintadas (m²) e tachas (unidades) */
  function quantitativos(s) {
    const p = s.params || {}; const q = {};
    const add = (nome, m, area, cor, un) => { q[nome] = q[nome] || { m: 0, a: 0, cor, un: un || 'm' }; q[nome].m += m; q[nome].a += area || 0; };
    const lb = (p.bordoLarg || 0) / 100, le = (p.eixoLarg || 0) / 100, ld = (p.divLarg || p.bordoLarg || 0) / 100;
    const secB = cad(p.bordoCad, 0.5), secD = cad(p.divCad, 0.25);
    intervalos(s).forEach(x => {
      const len = Math.abs(x.d2 - x.d1); if (!x.st.ativo) { add('Fora de trecho (não levantado)', len); return; }
      const { t, L } = linhas(s, x.st);
      L.forEach(l => {
        if (l.tipo === 'bordo') add('Bordo ' + (l.lado === 'E' ? 'esquerdo' : 'direito') + ' ' + EST_BO[l.est], len, l.est === 'C' ? len * lb : l.est === 'S' ? len * lb * secB : 0);
        else if (l.tipo === 'eixo' && l.cod) add(BY[l.cod].r, len, len * le * fatorEixo(l.cod, p), COR[l.cod]);
        else if (l.tipo === 'div') add(BY[l.cod].r, len, l.cod === 'DIV_SEM' ? 0 : len * ld * (l.cod === 'LMS-2' ? 1 : secD), COR[l.cod]);
      });
      add('Pista com ' + t.total + ' faixa' + (t.total > 1 ? 's' : ''), len);
      if (x.st.zeb) {
        const z = x.st.zd; add('Zebrado' + (z ? ' ' + (z.cor === 'Branca' ? 'branco' : 'amarelo') : ''), len, 0);
        if (z) { add('Zebrado · área total (m²)', 0, len * z.larg, null, 'm²'); add('Zebrado · área pintada das listras (m²)', 0, len * z.larg * Math.min(1, (z.listra || 0.4) / (z.esp || 1.1)), null, 'm²'); }
      }
      if (x.st.disp) add('Dispositivos (interseções, acessos, retornos)', len);
      // tachas: as do trecho valem em todo ele; o botão aceso inverte (falta ou existe)
      const ta = x.st.ta || {}; const inv = x.st.tachas;
      if (inv) add(temTachas(x.st) ? 'Trecho sem tachas (falta)' : 'Trecho com tachas (fora do padrão do trecho)', len);
      const addN = (nome, n) => { q[nome] = q[nome] || { m: 0, a: 0, n: 0, un: 'un' }; q[nome].n += n; };
      const nE = x.st.dupla ? L.filter(l => l.tipo === 'div').length : 1;
      const nB = L.filter(l => l.tipo === 'bordo' && l.est !== 'A').length;
      const PL = { Monodirecional: 'monodirecionais', Bidirecional: 'bidirecionais' };
      // trecho com tachas: botão aceso = falta de tachas (nenhuma); trecho sem tachas: botão aceso = há tachas no eixo/divisões
      const tem = temTachas(x.st);
      const eixoOn = tem ? (!inv && ta.eixo !== 'Não há') : inv, bordoOn = tem && !inv && ta.bordo !== 'Não há';
      const tipoE = ta.eixo !== 'Não há' ? ta.eixo : (x.st.dupla ? 'Monodirecional' : 'Bidirecional');
      if (eixoOn && nE) addN('Tachas ' + PL[tipoE] + ' ' + (x.st.dupla ? 'nas divisões de faixas' : 'no eixo'), nE * len / (ta.eixoEsp || 16));
      if (bordoOn && nB) addN('Tachas ' + PL[ta.bordo] + ' nos bordos', nB * len / (ta.bordoEsp || 16));
    });
    return q;
  }

  // ── abertura da sessão ─────────────────────────────────────
  function sel(id, opts, v) { return `<select class="inp" id="${id}">${opts.map(o => Array.isArray(o) ? `<option value="${o[0]}" ${o[0] === v ? 'selected' : ''}>${esc(o[1])}</option>` : `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
  function inp(id, v, ph) { return `<input class="inp" id="${id}" inputmode="decimal" value="${v != null ? esc(v) : ''}" placeholder="${ph || ''}">`; }
  const f = (lbl, html) => `<div class="field"><label>${lbl}</label>${html}</div>`;
  const opEixo = B.filter(b => b.g === 'eixo').map(b => [b.cod, b.r]);
  const opDiv = B.filter(b => b.g === 'div').map(b => [b.cod, b.r]);

  const M = {
    id: 'sh', nome: 'Sinalização Horizontal', sub: 'Pintura com um toque, KML e croqui', icone: '〰️', prefixo: 'S',
    titulo: (ev) => ev.rotulo,
    iconeEvento: () => '',
    camposAbertura(u) {
      u = u || {};
      return `<div class="fsec">Descrição geral da rodovia</div>
        ${f('Descrição (opcional)', `<textarea class="inp" id="sh-desc" rows="2" placeholder="ex.: pista simples com 3ª faixa nas subidas, acostamento pavimentado">${esc(u.descricao || '')}</textarea>`)}
        <p class="help">Tipo de pista, faixas e bordos são perguntados em cada <b>Início do trecho</b> — assim a mesma sessão pode ter trechos de pista dupla e simples.</p>
        <div class="fsec">Eixo</div><div class="fgrid">
          ${f('Largura (cm)', inp('sh-ex-l', u.eixoLarg, 'ex.: 10'))}${f('Cor', sel('sh-ex-c', ['Amarela', 'Branca'], u.eixoCor || 'Amarela'))}
          ${f('Traço (m)', inp('sh-ex-t', u.eixoTraco, 'ex.: 4'))}${f('Espaço (m)', inp('sh-ex-e', u.eixoEsp, 'ex.: 12'))}</div>
        <div class="fsec">Bordos</div><div class="fgrid">
          ${f('Largura (cm)', inp('sh-bo-l', u.bordoLarg, 'ex.: 10'))}${f('Cor', sel('sh-bo-c', ['Branca', 'Amarela'], u.bordoCor || 'Branca'))}
          ${f('Seccionado: traço/espaço (m)', `<input class="inp" id="sh-bo-cad" value="${esc(u.bordoCad || '')}" placeholder="ex.: 1/1">`)}</div>
        <div class="fsec">Divisão de faixas (mesmo sentido, seccionada)</div><div class="fgrid">
          ${f('Largura (cm)', inp('sh-df-l', u.divLarg))}${f('Traço / espaço (m)', `<input class="inp" id="sh-df-c" value="${esc(u.divCad || '')}" placeholder="ex.: 4/12">`)}</div>
        <div class="fsec">Material</div>
          ${f('Material', sel('sh-mat', MATERIAIS, u.material || MATERIAIS[0]))}
          <p class="help">As tachas (eixo e bordos) são perguntadas no Início de cada trecho.</p>
        <div class="fsec">Estado e croqui</div><div class="fgrid">
          ${f('Estado geral', sel('sh-est', ['Bom', 'Regular', 'Ruim'], u.estado || 'Bom'))}
          ${f('Croqui: metros por linha', sel('sh-cq', ['250', '500', '1000'], String(u.croqui || '500')))}</div>
        <p class="help">As larguras e o material são deste levantamento. Nomenclatura das linhas conforme o Manual Brasileiro de Sinalização de Trânsito, Vol. IV (CONTRAN).</p>`;
    },
    lerAbertura() {
      const n = (id) => { const v = num(id); return isNaN(v) ? null : v; };
      return {
        v3: true, descricao: val('sh-desc').trim(),
        eixoLarg: n('sh-ex-l'), eixoCor: val('sh-ex-c'), eixoTraco: n('sh-ex-t'), eixoEsp: n('sh-ex-e'),
        bordoLarg: n('sh-bo-l'), bordoCor: val('sh-bo-c'), bordoCad: val('sh-bo-cad').trim(),
        divLarg: n('sh-df-l'), divCad: val('sh-df-c').trim(),
        material: val('sh-mat'), estado: val('sh-est'), croqui: parseInt(val('sh-cq')) || 500,
      };
    },

    // ── painel com os botões de um toque ──────────────────────
    painel(s) {
      s = s || Core.S();
      // botões só com a figura (maiores); o nome aparece no toque e na lista de registros
      const btn = (cod) => { const b = BY[cod]; return `<button class="sh-btn ico" id="shb-${cod}" data-cod="${cod}" title="${esc(b.l)}" aria-label="${esc(b.l)}">${ICONS.get(cod)}</button>`; };
      const grp = (id, t, cods, cols) => `<div class="sh-grp" id="${id}"><div class="sh-grp-t">${t}</div><div class="sh-grid" style="grid-template-columns:repeat(${cols || 3},1fr)">${cods.map(btn).join('')}</div></div>`;
      return `<div class="card">
        <div class="sh-state" id="sh-state"></div>
        <div class="sh-grp"><div class="sh-grid" style="grid-template-columns:1fr"><button class="sh-btn trecho" id="shb-TRECHO" data-cod="TRECHO">${ICONS.get('INI_TRECHO')}<span id="shb-TRECHO-t">▶ Início do trecho</span></button></div></div>
        <div class="sh-undo"><button class="btn-sm g" onclick="SH.desfazer()">↶ Desfazer último</button><button class="btn-sm n" onclick="SH.detalhe()">📷 Foto / obs. no último</button></div>
        <div id="sh-linhas">
        ${grp('sh-g-eixo', 'Eixo amarelo · LFO-2 seccionada, LFO-1 contínua, LFO-3 dupla, LFO-4 mista esq./dir., sem pintura', ['LFO-2', 'LFO-1', 'LFO-3', 'LFO-4E', 'LFO-4D', 'SEM'])}
        ${grp('sh-g-fx', 'Faixa adicional esq. / dir. · toque inicia (aceso), toque termina', ['FX_MAIS_E', 'FX_MAIS_D'], 2)}
        ${grp('sh-g-bo', 'Bordos (padrão contínuo) · seccionado esq. / dir. · ausente esq. / dir.', ['BOE_S', 'BOD_S', 'BOE_A', 'BOD_A'], 4)}
        ${grp('sh-g-ext', 'Zebrado · dispositivo · exceção de tachas · liga / desliga', ['ZEB_INI', 'DISP_INI', 'TA_INI'])}
        </div>
        ${grp('sh-g-pt', 'Pontuais · faixa de pedestres · linha de retenção · lombada', ['FX_PED', 'LRE', 'LOMB'])}
        <button class="btn-full gray" style="margin-top:4px" onclick="SH.inserir()">＋ Inserir trecho esquecido (por km)</button>
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
      const e = estado(s); const t = faixas(s, e);
      document.querySelectorAll('.sh-btn').forEach(el => {
        const b = BY[el.dataset.cod]; let on = false;
        if (!b) return;
        if (b.g === 'eixo') on = e.eixo === b.cod;
        else if (b.g === 'div') on = e.div === b.cod;
        else if (b.g === 'bo') on = e.bo[b.lado] === b.est;
        else if (b.g === 'fx') on = e[b.lado] > 0;
        else if (b.g === 'zeb') on = e.zeb;
        else if (b.g === 'tachas') on = e.tachas;
        else if (b.g === 'disp') on = e.disp;
        el.classList.toggle('on', !!on);
      });
      const tb = $('shb-TRECHO');
      if (tb) { tb.classList.toggle('trecho', !e.ativo); tb.classList.toggle('fim', e.ativo); $('shb-TRECHO-t').textContent = e.ativo ? '■ Fim do trecho' : '▶ Início do trecho'; }
      // botões conforme o trecho: nada antes do início; pista dupla sem eixo amarelo
      if ($('sh-linhas')) $('sh-linhas').style.display = e.ativo ? '' : 'none';
      if ($('sh-g-eixo')) $('sh-g-eixo').style.display = e.dupla ? 'none' : '';
      // na pista dupla não há eixo amarelo: os ícones passam a mostrar a divisão branca
      document.querySelectorAll('.sh-btn svg').forEach(sv => { if (!sv.dataset.orig) sv.dataset.orig = sv.innerHTML; sv.innerHTML = e.dupla ? sv.dataset.orig.replace(/#F5C500/g, '#FFFFFF') : sv.dataset.orig; });
      const bo = ['E', 'D'].filter(l => e.bo[l] !== 'C').map(l => `bordo ${l === 'E' ? 'esq.' : 'dir.'} <b>${EST_BO[e.bo[l]]}</b>`);
      if (!e.ativo) { $('sh-state').innerHTML = '<b style="color:#C62828">Fora de trecho</b> · toque em <b>▶ Início do trecho</b> para informar a pista e começar.'; return; }
      $('sh-state').innerHTML = `<b>${e.dupla ? 'Pista dupla' : 'Pista simples'}</b> · <b>${t.total} faixa${t.total > 1 ? 's' : ''}</b>`
        + (e.dupla ? '' : ` · Eixo: <b>${e.eixo ? BY[e.eixo].l : '—'}</b>`)
        + (bo.length ? ' · ' + bo.join(' · ') : ' · bordos contínuos')
        + (e.zeb ? ' · <b>zebrado</b>' : '') + (e.disp ? ' · <b>dispositivo</b>' : '')
        + (e.tachas ? (temTachas(e) ? ' · <b>sem tachas</b>' : ' · <b>com tachas</b>') : '');
    },

    // ── relatório ────────────────────────────────────────────
    relatorio(s, ctx) {
      const p = s.params || {};
      const v = (x, u) => x == null || x === '' ? '—' : (typeof x === 'number' ? nf(x, x % 1 ? 2 : 0) : esc(x)) + (u || '');
      const params = `<h2>Parâmetros do levantamento</h2><table><tbody>
        ${p.descricao ? `<tr><td><b>Rodovia</b></td><td colspan="3">${esc(p.descricao)}</td></tr>` : ''}
        <tr><td><b>Pista</b></td><td>${p.v3 ? 'conforme cada trecho (abaixo)' : v(p.pista) + ' · ' + v(p.faixas) + ' faixa(s) por sentido'}</td><td><b>Material</b></td><td>${v(p.material)}</td></tr>
        <tr><td><b>Eixo</b></td><td>${v(p.eixoLarg, ' cm')} · ${v(p.eixoCor)} · traço ${v(p.eixoTraco, ' m')} / espaço ${v(p.eixoEsp, ' m')}</td><td><b>Tachas</b></td><td>${p.v3 ? 'conforme cada trecho' : v(p.tachas)}</td></tr>
        <tr><td><b>Bordos</b></td><td>${v(p.bordoLarg, ' cm')} · ${v(p.bordoCor)}${p.bordoCad ? ' · seccionado ' + esc(p.bordoCad) : ''}</td><td><b>Estado geral</b></td><td>${v(p.estado)}</td></tr>
        <tr><td><b>Divisão de faixas</b></td><td>${v(p.divLarg, ' cm')} · ${v(p.divCad)}</td><td><b>Referência</b></td><td>MBST Vol. IV (CONTRAN)</td></tr>
      </tbody></table>`;
      const tini = s.eventos.filter(e => e.cod === 'INI_TRECHO' && e.dados && e.dados.pista);
      const taTx = (t, e) => t && t !== 'Não há' ? t + ' a cada ' + nf(+e || 16, 0) + ' m' : 'não há';
      const trechos = tini.length ? `<h2>Trechos levantados</h2><table><thead><tr><th>Início</th><th>Pista</th><th>Faixas/sentido</th><th>Bordos</th><th>Eixo no início</th><th>Tachas eixo</th><th>Tachas bordos</th></tr></thead><tbody>
        ${tini.map(e => `<tr><td class="nw">${esc(Core.codigo(s, e) + ' · ' + posTxt(s, e))}</td><td>${esc(e.dados.pista)}</td><td>${e.dados.faixas}</td><td>${esc(e.dados.bordos)}</td><td>${esc(e.dados.pista === 'Dupla' ? '— (divisões LMS-1)' : BY[e.dados.eixo].r)}</td><td>${esc(taTx(e.dados.taEixo, e.dados.taEixoEsp))}</td><td>${esc(taTx(e.dados.taBordo, e.dados.taBordoEsp))}</td></tr>`).join('')}</tbody></table>` : '';
      const q = quantitativos(s);
      const ks = Object.keys(q); const totA = ks.reduce((a, k) => a + (q[k].a || 0), 0);
      const cel = (k) => q[k].un === 'un' ? `<td class="r">—</td><td class="r">—</td><td class="r"><b>${nf(Math.round(q[k].n), 0)} un</b></td>`
        : q[k].un === 'm²' ? `<td class="r">—</td><td class="r"><b>${nf(q[k].a, 2)}</b></td><td class="r">—</td>`
        : `<td class="r">${nf(q[k].m, 1)}</td><td class="r">${q[k].a ? nf(q[k].a, 2) : '—'}</td><td class="r">—</td>`;
      const quant = `<h2>Quantitativos · apropriação</h2><table><thead><tr><th>Elemento</th><th class="r">Extensão (m)</th><th class="r">Área pintada (m²)</th><th class="r">Quantidade</th></tr></thead><tbody>
        ${ks.map(k => `<tr><td>${q[k].cor ? `<span style="display:inline-block;width:10px;height:10px;background:${q[k].cor};margin-right:6px"></span>` : ''}${esc(k)}</td>${cel(k)}</tr>`).join('') || '<tr><td colspan="4" class="c">Sem extensão registrada.</td></tr>'}
        <tr><td><b>Total de área pintada</b></td><td></td><td class="r"><b>${nf(totA, 2)}</b></td><td></td></tr>
      </tbody></table>
      <p style="font-size:10px;color:#555">Área = extensão × largura da linha × fração pintada (seccionadas: traço ÷ (traço + espaço); padrões quando não informado: eixo 4/12, divisão 4/12, bordo seccionado 1/1). Zebrado: listras × largura informada. Tachas = extensão ÷ espaçamento, por linha.</p>`;
      const nomeSeg = (g) => g.tipo === 'eixo' ? BY[g.cod].r : g.tipo === 'div' ? BY[g.cod].r + (g.n > 1 ? ' × ' + g.n + ' linhas' : '') : g.tipo === 'faixas' ? g.n + ' faixa(s)'
        : g.tipo === 'bordo' ? 'Bordo ' + (g.lado === 'E' ? 'esquerdo' : 'direito') + ' ' + EST_BO[g.est] : g.tipo === 'zeb' ? 'Zebrado' + (g.zd ? ' · largura ' + nf(g.zd.larg, 2) + ' m' : '')
        : g.tipo === 'disp' ? 'Dispositivo' : (g.falta ? 'Trecho sem tachas' : 'Trecho com tachas');
      const segs = segmentos(s);
      const lista = `<h2>Trechos</h2><table><thead><tr><th>Elemento</th><th>Início</th><th>Fim</th><th class="r">Extensão (m)</th></tr></thead><tbody>
        ${segs.map(g => `<tr><td>${esc(nomeSeg(g))}</td><td class="nw">${esc(posTxt(s, g.ini))}</td><td class="nw">${esc(posTxt(s, g.fim))}${g.aberto ? ' (aberto)' : ''}</td><td class="r">${nf(g.len, 1)}</td></tr>`).join('') || '<tr><td colspan="4" class="c">—</td></tr>'}</tbody></table>`;
      return params + trechos + quant + `<h2>Croqui linear</h2><div class="croqui">${croqui(s)}</div>` + lista + '<h2>Registros</h2>' + ctx.tabelaPadrao();
    },

    exportExtra: (pasta) => `
      <button class="exp-opt" onclick="SH.croquiDuplo('${esc(pasta)}')"><span class="ico">🛣️</span><div><div class="lbl">Croqui das duas pistas</div><div class="sub">Pista dupla · junta com a sessão do sentido oposto</div></div></button>
      <button class="exp-opt" onclick="SH.inserir('${esc(pasta)}')"><span class="ico">＋</span><div><div class="lbl">Inserir trecho esquecido</div><div class="sub">Por km, encaixado no trajeto gravado</div></div></button>
      <button class="exp-opt" onclick="SH.incorporar('${esc(pasta)}')"><span class="ico">🧩</span><div><div class="lbl">Incorporar a outra sessão</div><div class="sub">Esta sessão é uma correção de outro levantamento</div></div></button>`,

    // ── KML ──────────────────────────────────────────────────
    kmlEstilos(s, kc) {
      return Object.keys(COR).map(c => `<Style id="sh-${c}"><LineStyle><color>${kc(COR[c])}</color><width>${c === 'LFO-3' ? 7 : 5}</width></LineStyle></Style>`).join('\n')
        + `<Style id="sh-fa"><LineStyle><color>${kc('#1E88E5', 'cc')}</color><width>9</width></LineStyle></Style>`
        + `<Style id="sh-bordoS"><LineStyle><color>${kc('#FB8C00')}</color><width>6</width></LineStyle></Style>`
        + `<Style id="sh-bordoA"><LineStyle><color>${kc('#E53935')}</color><width>6</width></LineStyle></Style>`
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
        + fold('Divisão de faixas', segs.filter(g => g.tipo === 'div').map(g => pm(g, BY[g.cod].r + (g.n > 1 ? ' × ' + g.n : ''), 'sh-' + g.cod)))
        + fold('Número de faixas', segs.filter(g => g.tipo === 'faixas' && g.n !== g.base).map(g => pm(g, g.n + ' faixas', 'sh-fa')))
        + fold('Bordos', segs.filter(g => g.tipo === 'bordo').map(g => pm(g, 'Bordo ' + (g.lado === 'E' ? 'esquerdo' : 'direito') + ' ' + EST_BO[g.est], 'sh-bordo' + g.est)))
        + fold('Zebrado', segs.filter(g => g.tipo === 'zeb').map(g => pm(g, 'Zebrado', 'sh-zeb')))
        + fold('Tachas (exceções)', segs.filter(g => g.tipo === 'tachas').map(g => pm(g, g.falta ? 'Sem tachas' : 'Com tachas', 'sh-tachas')))
        + fold('Dispositivos', segs.filter(g => g.tipo === 'disp').map(g => pm(g, 'Dispositivo', 'sh-fa')));
    },
  };

  // ── posição por km (trecho esquecido, correções) ───────────
  /** "380+250", "380,250", "380.25" → metros (mesma unidade do marco) */
  function kmDe(txt) {
    txt = String(txt || '').trim(); if (!txt) return null;
    let m = txt.match(/^(\d+)\s*\+\s*(\d+(?:[.,]\d+)?)$/); if (m) return +m[1] * 1000 + parseFloat(m[2].replace(',', '.'));
    m = txt.replace(',', '.').match(/^\d+(\.\d+)?$/); if (m) return parseFloat(txt.replace(',', '.')) * 1000;
    return null;
  }
  /** função d → off ao longo do trajeto gravado */
  function offAtFn(s) {
    const pts = (s.track || []).filter(t => t[3] != null).map(t => [t[3], t[2]]).concat(s.eventos.map(e => [e.d, e.off])).sort((a, b) => a[0] - b[0]);
    return (d) => {
      if (!pts.length) return s.dir === 'C' ? d : -d;
      let i = pts.findIndex(q => q[0] >= d); if (i < 0) i = pts.length - 1; if (i === 0) return pts[0][1] + (s.dir === 'C' ? 1 : -1) * (d - pts[0][0]);
      const a = pts[i - 1], b = pts[i]; return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]);
    };
  }
  /** posição (d, lat, lon) no trajeto para um deslocamento do marco (off) */
  function posPorOff(s, off) {
    const pts = (s.track || []).filter(t => t[3] != null && t[2] != null).map(t => ({ lat: t[0], lon: t[1], off: t[2], d: t[3] }))
      .concat(s.eventos.map(e => ({ lat: e.lat, lon: e.lon, off: e.off, d: e.d }))).sort((a, b) => a.d - b.d);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if ((off - a.off) * (off - b.off) <= 0 && a.off !== b.off) {
        const k = (off - a.off) / (b.off - a.off);
        return Object.assign({ off: Math.round(off * 100) / 100, d: Math.round((a.d + k * (b.d - a.d)) * 10) / 10,
          lat: a.lat + k * (b.lat - a.lat), lon: a.lon + k * (b.lon - a.lon), t: Date.now(), dir: s.dir }, Core.posValues(s, off));
      }
    }
    return null;
  }
  function gravar(s) {
    const a = Core.S();
    if (a && a.pasta === s.pasta) { Core.persist(s, false); UI.renderEvents(); M.atualizar(s); }
    else { const c = Object.assign({}, s); delete c.track; Store.writeJSON(Core.dirOf(s) + '/sessao.json', c); }
  }
  /** insere registros por km; pares (início/término) são ordenados pela posição no trajeto */
  function incluirPorKm(s, regs, nota) {
    const pos = regs.map(r => ({ r, p: posPorOff(s, r.km - s.k0) }));
    const fora = pos.find(x => !x.p); if (fora) return { erro: 'O km ' + fmtKm(fora.r.km) + ' está fora do trecho percorrido nesta sessão.' };
    if (pos.length === 2 && pos[0].p.d > pos[1].p.d) { const c0 = pos[0].r.cod, c1 = pos[1].r.cod, d0 = pos[0].r.dados; pos[0].r.cod = c1; pos[1].r.cod = c0; pos[1].r.dados = d0; pos[0].r.dados = {}; pos.reverse(); }
    pos.forEach(({ r, p }) => {
      const b = BY[r.cod]; s.seq = (s.seq || 0) + 1;
      s.eventos.push(Object.assign({ id: uid(), seq: s.seq, grupo: b.g, cod: r.cod, rotulo: b.r + (r.cod === 'ZEB_INI' && r.dados && r.dados.larg ? ' · ' + nf(r.dados.larg, 2) + ' m de largura' : '') + ' (' + nota + ')', obs: '', dados: r.dados || {}, fotos: [] }, p));
    });
    gravar(s);
    return { n: pos.length };
  }
  /** converte os registros de uma sessão de correção em pares por km e encaixa em outra sessão */
  function incorporar(pastaOrig) {
    const o = Export.sessaoPor(pastaOrig); if (!o) return;
    const outras = Core.index().filter(x => x.modulo === 'sh' && x.pasta !== pastaOrig).slice().reverse();
    if (!outras.length) { UI.alert('Incorporar', 'Não há outra sessão de sinalização horizontal no aparelho.'); return; }
    UI.modal('🧩 Incorporar correção', `<p class="help" style="font-size:13px">Os registros de <b>${esc(o.nome)}</b> (faixas adicionais, bordos, zebrados, dispositivos, tachas e pontuais) serão encaixados pelo km na sessão escolhida. Se o sentido for o contrário, direita e esquerda são trocadas.</p>
      ${f('Sessão de destino', `<select class="inp" id="ic-dest">${outras.map(x => `<option value="${esc(x.pasta)}">${esc(x.nome)} · ${fmtDT(x.ini)}</option>`).join('')}</select>`)}
      <button class="btn-full" onclick="SH._incorporar('${esc(pastaOrig)}')">✓ Incorporar</button>`);
  }
  function _incorporar(pastaOrig) {
    const o = Export.sessaoPor(pastaOrig), d = Export.sessaoPor(val('ic-dest')); if (!o || !d) return;
    const troca = o.dir !== d.dir; const L = (l) => troca ? (l === 'E' ? 'D' : 'E') : l;
    const km = (ev) => o.k0 + ev.off; const kmFim = o.k0 + fimPos(o).off;
    const abertos = {}; const pares = [];
    const abre = (k, cIni, cFim, ev, dados) => { if (abertos[k]) fecha(k, ev); abertos[k] = { cIni, cFim, km: km(ev), dados }; };
    const fecha = (k, ev) => { const a = abertos[k]; if (!a) return; pares.push([{ cod: a.cIni, km: a.km, dados: a.dados }, { cod: a.cFim, km: ev ? km(ev) : kmFim }]); delete abertos[k]; };
    ordem(o).forEach(ev => {
      const b = BY[ev.cod]; if (!b) return;
      if (b.g === 'pontual') pares.push([{ cod: ev.cod, km: km(ev) }]);
      else if (b.g === 'fx' || b.g === 'fa') { const l = L(b.lado); if (b.delta > 0) abre('fx' + l + ev.id, 'FX_MAIS_' + l, 'FX_MENOS_' + l, ev); else { const k = Object.keys(abertos).find(x => x.startsWith('fx' + l)); if (k) fecha(k, ev); } }
      else if (b.g === 'bo') { const l = L(b.lado); if (b.est === 'C') fecha('bo' + l, ev); else abre('bo' + l, 'BO' + l + '_' + b.est, 'BO' + l + '_C', ev); }
      else if (b.g === 'zeb') { if (b.abre) abre('zeb', 'ZEB_INI', 'ZEB_FIM', ev, ev.dados); else fecha('zeb', ev); }
      else if (b.g === 'disp') { if (b.abre) abre('disp', 'DISP_INI', 'DISP_FIM', ev); else fecha('disp', ev); }
      else if (b.g === 'tachas') { if (b.abre) abre('ta', 'TA_INI', 'TA_FIM', ev); else fecha('ta', ev); }
    });
    Object.keys(abertos).forEach(k => fecha(k, null));
    if (!pares.length) { UI.alert('Incorporar', 'A sessão de correção não tem registros para incorporar.'); return; }
    let n = 0; const erros = [];
    pares.forEach(p => { const r = incluirPorKm(d, p, 'correção ' + o.nome); if (r.erro) erros.push(r.erro); else n += r.n; });
    UI.closeModal();
    UI.alert('Incorporar', `${n} registro(s) incorporado(s) em “${esc(d.nome)}”.` + (erros.length ? '<br><br>Não encaixados:<br>' + erros.map(esc).join('<br>') : ''));
  }

  // ── croqui das duas pistas (pista dupla, uma sessão por sentido) ──
  function croquiDuplo(pastaA) {
    const a = Export.sessaoPor(pastaA); if (!a) return;
    const outras = Core.index().filter(x => x.modulo === 'sh' && x.pasta !== pastaA).slice().reverse();
    if (!outras.length) { UI.alert('Croqui das duas pistas', 'Faça uma sessão do sentido oposto para montar o croqui das duas pistas.'); return; }
    UI.modal('🛣️ Croqui das duas pistas', `<p class="help" style="font-size:13px">Escolha a sessão do sentido oposto da mesma rodovia. As pistas são alinhadas pelo km, com o canteiro no meio.</p>
      ${f('Sentido oposto', `<select class="inp" id="cd-b">${outras.map(x => `<option value="${esc(x.pasta)}">${esc(x.nome)} · ${fmtDT(x.ini)}</option>`).join('')}</select>`)}
      <button class="btn-full" onclick="SH._croquiDuplo('${esc(pastaA)}')">📄 Gerar PDF</button>`);
  }
  function svgDuplo(A, B) {
    const p = A.params || {}; const Lm = p.croqui || 500; const W = 1000, X0 = 70, LH = 12, CH = 18;
    const prep = (S) => { const oa = offAtFn(S); return intervalos(S).map(x => Object.assign({}, x, { k1: S.k0 + oa(x.d1), k2: S.k0 + oa(x.d2) })); };
    const ia = prep(A), ib = prep(B); const todos = ia.concat(ib);
    if (!todos.length) return '<p>Sem trechos.</p>';
    const kmin = Math.min(...todos.map(x => Math.min(x.k1, x.k2))), kmax = Math.max(...todos.map(x => Math.max(x.k1, x.k2)));
    const maxN = (iv, S) => Math.max(1, ...iv.map(x => faixas(S, x.st).total));
    const nB = maxN(ib, B), nA = maxN(ia, A); const TOP = 26, yCt = TOP + nB * LH, yCb = yCt + CH, RH = yCb + nA * LH + 34;
    const rows = Math.max(1, Math.ceil((kmax - kmin) / Lm)); const pxm = W / Lm; const out = [];
    const dash = `stroke-dasharray="${Math.max(2, (p.eixoTraco || 4) * pxm)} ${Math.max(2, (p.eixoEsp || 12) * pxm)}"`;
    for (let r = 0; r < rows; r++) {
      const k0 = kmin + r * Lm, k1 = k0 + Lm; const xs = (k) => X0 + (Math.max(k0, Math.min(k1, k)) - k0) * pxm; const g = [];
      g.push(`<rect x="${X0}" y="${yCt}" width="${W}" height="${CH}" fill="#A5C79A"/><text x="${X0 + W / 2}" y="${yCt + 12}" font-size="9" text-anchor="middle" fill="#2E4A27" font-family="Arial">canteiro central</text>`);
      const desenha = (iv, S, yOf, rot) => iv.forEach(x => {
        const lo = Math.min(x.k1, x.k2), hi = Math.max(x.k1, x.k2); if (hi <= k0 || lo >= k1) return;
        const x1 = xs(lo), x2 = xs(hi), w = x2 - x1; if (w <= 0) return;
        const { t, L } = linhas(S, x.st); const n = t.total;
        const ya = yOf(0), yb = yOf(n); const yT = Math.min(ya, yb), yB = Math.max(ya, yb);
        g.push(`<rect x="${x1}" y="${yT}" width="${w}" height="${yB - yT}" fill="${x.st.ativo ? '#5A5F66' : '#C9CDD2'}"/>`);
        if (!x.st.ativo) return;
        if (x.st.disp) g.push(`<rect x="${x1}" y="${yT}" width="${w}" height="${yB - yT}" fill="#1565C0" fill-opacity=".18"/>`);
        L.forEach(l => {
          const y = yOf(l.i); const ln = (cor, d, sw) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${cor}" stroke-width="${sw || 1.8}" ${d || ''}/>`;
          if (l.tipo === 'bordo') g.push(l.est === 'C' ? ln('#fff') : l.est === 'S' ? ln('#fff', 'stroke-dasharray="5 5"') : ln('#E53935', 'stroke-dasharray="2 3"', 2.2));
          else if (l.tipo === 'div') g.push(ln('#fff', dash, 1.4));
          else if (l.tipo === 'eixo' && l.cod && l.cod !== 'SEM') g.push(ln('#F5C500', /LFO-2/.test(l.cod) ? dash : ''));
        });
        if (x.st.zeb) g.push(`<rect x="${x1}" y="${yT + 1}" width="${w}" height="${LH - 2}" fill="none" stroke="#F5C500" stroke-width="1.2"/>`);
        if (w > 60) g.push(`<text x="${(x1 + x2) / 2}" y="${rot === 'B' ? yT - 3 : yB + 10}" font-size="8.5" text-anchor="middle" fill="#555" font-family="Arial">${n} fx</text>`);
      });
      desenha(ib, B, (i) => yCt - i * LH, 'B');   // sentido oposto: esquerda (canteiro) embaixo
      desenha(ia, A, (i) => yCb + i * LH, 'A');   // este sentido: esquerda (canteiro) em cima
      g.push(`<text x="4" y="${yCt - 4}" font-size="9" fill="#333" font-family="Arial">${B.dir === 'C' ? '→' : '←'}</text><text x="4" y="${yCb + 12}" font-size="9" fill="#333" font-family="Arial">${A.dir === 'C' ? '→' : '←'}</text>`);
      for (let k = Math.ceil(k0 / 100) * 100; k <= k1; k += 100) {
        const x = xs(k); g.push(`<line x1="${x}" y1="${RH - 24}" x2="${x}" y2="${RH - 18}" stroke="#333"/>`);
        if (Math.round(k) % (Lm >= 1000 ? 200 : 100) === 0) g.push(`<text x="${x}" y="${RH - 6}" font-size="9" text-anchor="middle" fill="#333" font-family="Arial">km ${fmtKm(k)}</text>`);
      }
      out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${X0 + W + 10} ${RH}">${g.join('')}</svg>`);
    }
    return out.join('');
  }
  function _croquiDuplo(pastaA) {
    const A = Export.sessaoPor(pastaA), B = Export.sessaoPor(val('cd-b')); if (!A || !B) return;
    UI.closeModal();
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Croqui das duas pistas</title>
      <style>body{font-family:Arial,sans-serif;margin:14px;color:#111}h1{font-size:16px;margin:0}p{font-size:11px;color:#444;margin:4px 0 10px}svg{width:100%;margin-bottom:10px}@page{size:A4 landscape;margin:10mm}</style></head><body>
      <h1>${esc(APP.empresa)} · Croqui das duas pistas · ${esc(A.rodovia || '')}</h1>
      <p>Embaixo: ${esc(A.nome)} (sentido ${A.dir === 'C' ? 'crescente' : 'decrescente'}) · em cima: ${esc(B.nome)} (sentido ${B.dir === 'C' ? 'crescente' : 'decrescente'}) · alinhadas pelo km · canteiro central no meio · azul claro = dispositivo · bordo vermelho = ausente</p>
      ${svgDuplo(A, B)}<p>DVA Roads · gerado em ${fmtDT(Date.now())}</p></body></html>`;
    Export.imprimir(html, 'croqui_duas_pistas_' + slug(A.rodovia || A.nome));
  }

  // ── croqui linear (SVG) ─────────────────────────────────────
  //  x = distância percorrida; esquerda do motorista = parte de cima.
  function croqui(s) {
    const p = s.params || {}; const Lm = p.croqui || 500; const W = 1000, X0 = 70, LH = 13;
    const evs = s.eventos; const iv = intervalos(s);
    const dIni = iv.length ? iv[0].d1 : 0; const dFim = Math.max(dIni + 50, ...iv.map(x => x.d2), fimPos(s).d);
    const rows = Math.max(1, Math.ceil((dFim - dIni) / Lm));
    const fx = iv.map(x => faixas(s, x.st)); const maxL = Math.max(1, ...fx.map(t => t.nl)), maxR = Math.max(1, ...fx.map(t => t.nr));
    const TOP = 22, Yc = TOP + maxL * LH, RH = Yc + maxR * LH + 34;
    const pts = s.track.filter(t => t[3] != null).map(t => [t[3], t[2]]).concat(evs.map(e => [e.d, e.off])).sort((a, b) => a[0] - b[0]);
    const offAt = (d) => {
      if (!pts.length) return s.dir === 'C' ? d : -d;
      let i = pts.findIndex(q => q[0] >= d); if (i < 0) i = pts.length - 1; if (i === 0) return pts[0][1] + (s.dir === 'C' ? 1 : -1) * (d - pts[0][0]);
      const a = pts[i - 1], b = pts[i]; return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]);
    };
    const lbl = (d) => { const o = offAt(d); return s.modo === 'est' ? 'Est ' + fmtEst(s.s0 + o, s) : 'km ' + fmtKm(s.k0 + o); };
    const pxm = W / Lm; const out = [];
    const tr = (p.eixoTraco || 4) * pxm, es = (p.eixoEsp || 12) * pxm, dash = `stroke-dasharray="${Math.max(2, tr)} ${Math.max(2, es)}"`;
    for (let r = 0; r < rows; r++) {
      const a = dIni + r * Lm, b = a + Lm;
      const xs = (d) => X0 + (Math.max(a, Math.min(b, d)) - a) * pxm;
      const g = [`<text x="4" y="${Yc + 4}" font-size="11" fill="#333" font-family="Arial">${esc(lbl(a))}</text>`];
      iv.filter(x => x.d2 > a && x.d1 < b).forEach(x => {
        const x1 = xs(x.d1), x2 = xs(x.d2), w = x2 - x1; if (w <= 0) return;
        const { t, L } = linhas(s, x.st); const yTop = Yc - t.nl * LH, yBot = Yc + t.nr * LH;
        g.push(`<rect x="${x1}" y="${yTop}" width="${w}" height="${yBot - yTop}" fill="${x.st.ativo ? '#5A5F66' : '#B8BCC2'}"/>`);
        if (!x.st.ativo) { if (w > 50) g.push(`<text x="${(x1 + x2) / 2}" y="${Yc + 4}" font-size="10" text-anchor="middle" fill="#333" font-family="Arial">fora de trecho</text>`); return; }
        L.forEach(l => {
          const y = yTop + l.i * LH;
          const ln = (yy, cor, d, sw) => `<line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" stroke="${cor}" stroke-width="${sw || 2}" ${d || ''}/>`;
          if (l.tipo === 'bordo') {
            const yy = l.lado === 'E' ? y + 1.5 : y - 1.5;
            if (l.est === 'C') g.push(ln(yy, '#fff'));
            else if (l.est === 'S') g.push(ln(yy, '#fff', 'stroke-dasharray="5 5"'));
            else g.push(ln(yy, '#E53935', 'stroke-dasharray="2 3"', 2.5));
          } else if (l.tipo === 'div') {
            if (l.cod === 'LMS-1') g.push(ln(y, '#fff', dash, 1.6)); else if (l.cod === 'LMS-2') g.push(ln(y, '#fff', '', 1.6)); else g.push(ln(y, '#8A9099', 'stroke-dasharray="1 4"', 1));
          } else if (l.tipo === 'eixo' && l.cod) {
            const am = (yy, d) => ln(yy, '#F5C500', d ? dash : '', 2.2);
            if (l.cod === 'LFO-1') g.push(am(y)); else if (l.cod === 'LFO-2') g.push(am(y, 1));
            else if (l.cod === 'LFO-3') g.push(am(y - 2.5), am(y + 2.5)); else if (l.cod === 'LFO-4E') g.push(am(y - 2.5), am(y + 2.5, 1));
            else if (l.cod === 'LFO-4D') g.push(am(y - 2.5, 1), am(y + 2.5)); else if (l.cod === 'LFO-5') g.push(am(y - 2.5, 1), am(y + 2.5, 1));
            else g.push(ln(y, '#8A9099', 'stroke-dasharray="1 4"', 1));
          }
        });
        if (x.st.zeb) { const yz = x.st.dupla ? yTop + 2 : Yc - 6; g.push(`<rect x="${x1}" y="${yz}" width="${w}" height="12" fill="none" stroke="#F5C500" stroke-width="1.3"/>`); for (let xx = x1 + 4; xx < x2 - 4; xx += 8) g.push(`<line x1="${xx}" y1="${yz + 12}" x2="${xx + 6}" y2="${yz}" stroke="#F5C500" stroke-width="1"/>`); }
        if (x.st.disp) g.push(`<rect x="${x1}" y="${yTop}" width="${w}" height="${yBot - yTop}" fill="#1565C0" fill-opacity=".2"/>`);
        // tachas: as do trecho valem em todo ele; o botão aceso inverte
        const ta = x.st.ta || {}, inv = x.st.tachas;
        const temT = temTachas(x.st), eixoOn = temT ? (!inv && ta.eixo !== 'Não há') : inv, bordoOn = temT && !inv && ta.bordo !== 'Não há';
        if (eixoOn) L.filter(l => l.tipo === 'eixo' || (x.st.dupla && l.tipo === 'div')).forEach(l => { for (let xx = x1 + 3; xx <= x2; xx += 12) g.push(`<circle cx="${xx}" cy="${yTop + l.i * LH}" r="1.6" fill="#FF5252"/>`); });
        if (bordoOn) L.filter(l => l.tipo === 'bordo' && l.est !== 'A').forEach(l => { const yy = yTop + l.i * LH + (l.lado === 'E' ? 4 : -4); for (let xx = x1 + 9; xx <= x2; xx += 12) g.push(`<circle cx="${xx}" cy="${yy}" r="1.4" fill="#FF8A65"/>`); });
        const ei = L.find(l => l.tipo === 'eixo');
        if (w > 60) g.push(`<text x="${(x1 + x2) / 2}" y="${yTop - 4}" font-size="9" text-anchor="middle" fill="#555" font-family="Arial">${t.total} fx${ei && ei.cod ? ' · ' + esc(BY[ei.cod].c || BY[ei.cod].l) : ''}</text>`);
      });
      evs.filter(ev => ev.d >= a && ev.d < b).forEach(ev => {
        const x = xs(ev.d); const bb = BY[ev.cod]; const pont = bb && bb.g === 'pontual';
        g.push(`<line x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${RH - 26}" stroke="${pont ? '#1565C0' : '#111'}" stroke-width="0.8" stroke-dasharray="${pont ? '0' : '2 2'}"/>`);
        g.push(`<text x="${x + 2}" y="${TOP - 10}" font-size="9" fill="#111" font-family="Arial">${Core.codigo(s, ev)}</text>`);
      });
      for (let d = Math.ceil(a / 100) * 100; d <= b; d += 100) {
        const x = xs(d);
        g.push(`<line x1="${x}" y1="${RH - 24}" x2="${x}" y2="${RH - 18}" stroke="#333" stroke-width="1"/>`);
        if ((d - a) % (Lm >= 1000 ? 200 : 100) === 0) g.push(`<text x="${x}" y="${RH - 6}" font-size="9" text-anchor="middle" fill="#333" font-family="Arial">${esc(lbl(d))}</text>`);
      }
      out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${X0 + W + 10} ${RH}" role="img" aria-label="Croqui linha ${r + 1}">${g.join('')}</svg>`);
    }
    return `<p style="font-size:10px;color:#555;margin:0 0 6px">Esquerda do motorista na parte de cima · ${Lm} m por linha · ${s.dir === 'C' ? 'sentido crescente' : 'sentido decrescente'} · bordo vermelho pontilhado = ausente · azul claro = dispositivo · pontos vermelhos = tachas</p>` + out.join('');
  }

  // ── ações ───────────────────────────────────────────────────
  let ultimoId = null;
  window.SH = {
    toque(cod, longo) {
      const s = Core.S(); if (!s) return;
      const e = estado(s);
      if (cod === 'TRECHO') { if (!e.ativo) { SH.iniciar(); return; } cod = 'FIM_TRECHO'; }
      if (!e.ativo && !['FX_PED', 'LRE', 'LOMB'].includes(cod)) { toast('Toque primeiro em ▶ Início do trecho'); return; }
      // botões liga/desliga: o segundo toque registra a volta ao normal
      if (cod === 'ZEB_INI' && !e.zeb) { SH.zebrado(longo); return; }   // início do zebrado pergunta as medidas
      if (cod === 'ZEB_INI' && e.zeb) cod = 'ZEB_FIM';
      else if (cod === 'TA_INI' && e.tachas) cod = 'TA_FIM';
      else if (cod === 'DISP_INI' && e.disp) cod = 'DISP_FIM';
      else if (BY[cod] && BY[cod].g === 'bo' && e.bo[BY[cod].lado] === BY[cod].est) cod = 'BO' + BY[cod].lado + '_C';
      else if (cod === 'FX_MAIS_D' && e.D > 0) cod = 'FX_MENOS_D';
      else if (cod === 'FX_MAIS_E' && e.E > 0) cod = 'FX_MENOS_E';
      const b = BY[cod];
      if (b.g === 'fx') { const e2 = clone(e); aplica(s, e2, b); if (e2[b.lado] === e[b.lado]) { toast('Não há faixa para fechar desse lado'); return; } }
      let rot = b.r;
      if (b.g === 'tachas') rot = (temTachas(e) ? (cod === 'TA_INI' ? 'Início de trecho sem tachas' : 'Fim de trecho sem tachas') : (cod === 'TA_INI' ? 'Início de trecho com tachas' : 'Fim de trecho com tachas'));
      SH._registra(s, { grupo: b.g, cod, rotulo: rot }, Core.pos(s), longo);
    },
    _registra(s, dado, pos, longo) {
      const b = BY[dado.cod];
      const ev = Core.addEvent(dado, pos);
      ultimoId = ev.id;
      buzz(b.g === 'trecho' ? [60, 40, 60] : 40); beep(b.g === 'trecho' ? 900 : 1300);
      const el = $('shb-' + (b.g === 'trecho' ? 'TRECHO' : ({ ZEB_FIM: 'ZEB_INI', TA_FIM: 'TA_INI', DISP_FIM: 'DISP_INI', FX_MENOS_D: 'FX_MAIS_D', FX_MENOS_E: 'FX_MAIS_E', BOD_C: 'BOD_S', BOE_C: 'BOE_S' }[dado.cod] || dado.cod)));
      if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      const t = b.g === 'fx' ? ' → ' + faixas(s, estado(s)).total + ' faixas' : '';
      toast(Core.codigo(s, ev) + ' · ' + dado.rotulo + t + ' · ' + posTxt(s, ev));
      if (longo) SH.detalhe(ev.id);
      return ev;
    },
    /** início do zebrado: trava a posição e pergunta as medidas para a apropriação em m² */
    zebrado(longo) {
      const s = Core.S(); const pos = Core.pos(s); SH._posZeb = pos; SH._zebLongo = longo;
      const ult = s.eventos.filter(e => e.cod === 'ZEB_INI' && e.dados && e.dados.larg).pop();
      const d = ult ? ult.dados : { larg: 3, cor: 'Amarela', listra: 0.4, esp: 1.1 };
      UI.modal('Início de zebrado', `<div class="preview-fmt" style="margin-bottom:10px">${esc(posTxt(s, pos))}</div>
        <div class="fgrid">${f('Largura média da área (m)', inp('zb-l', d.larg))}${f('Cor', sel('zb-c', ['Amarela', 'Branca'], d.cor))}
        ${f('Largura da listra (m)', inp('zb-li', d.listra))}${f('Espaçamento entre listras (m)', inp('zb-e', d.esp))}</div>
        <p class="help">A extensão é medida até você tocar de novo no zebrado. Área pintada = extensão × largura × listra ÷ espaçamento.</p>
        <button class="btn-full" onclick="SH.confirmarZeb()">✓ Começar zebrado</button>`);
    },
    confirmarZeb() {
      const s = Core.S(); const n = (id) => { const v = num(id); return isNaN(v) ? null : v; };
      const dados = { larg: n('zb-l') || 0, cor: val('zb-c'), listra: n('zb-li') || 0.4, esp: n('zb-e') || 1.1 };
      UI.closeModal();
      SH._registra(s, { grupo: 'zeb', cod: 'ZEB_INI', rotulo: 'Início de zebrado · ' + nf(dados.larg, 2) + ' m de largura', dados }, SH._posZeb || Core.pos(s), SH._zebLongo);
    },
    /** Início do trecho: trava a posição no toque e pergunta como é a pista */
    iniciar() {
      const s = Core.S(); if (!s) return;
      const pos = Core.pos(s); SH._posIni = pos;
      const ult = s.eventos.filter(e => e.cod === 'INI_TRECHO' && e.dados && e.dados.pista).pop();
      const d = Object.assign({ pista: 'Simples', faixas: 1, bordos: 'Ambos', eixo: 'LFO-2', taEixo: 'Não há', taEixoEsp: 16, taBordo: 'Não há', taBordoEsp: 16 }, ult ? ult.dados : {});
      const chips = (id, ops, v) => `<div class="chips" id="${id}">${ops.map(o => `<button type="button" class="chip ${String(o) === String(v) ? 'sel' : ''}" data-v="${o}" onclick="this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('sel'));this.classList.add('sel');SH._ajIni()">${o}</button>`).join('')}</div>`;
      UI.modal('▶ Início do trecho', `<div class="preview-fmt" style="margin-bottom:10px">${esc(posTxt(s, pos))}</div>
        ${f('Pista', chips('si-pista', ['Simples', 'Dupla'], d.pista))}
        ${f('Faixas por sentido', chips('si-fx', [1, 2, 3, 4], d.faixas))}
        ${f('Bordos pintados', chips('si-bo', ['Ambos', 'Só direito', 'Só esquerdo', 'Nenhum'], d.bordos))}
        <div id="si-eixo-w">${f('Eixo (amarelo)', sel('si-eixo', opEixo, d.eixo || 'LFO-2'))}</div>
        <div class="fgrid">${f('<span id="si-ta-l">Tachas no eixo</span>', sel('si-tae', ['Não há', 'Bidirecional', 'Monodirecional'], d.taEixo))}${f('Espaçamento (m)', inp('si-tae-e', d.taEixoEsp))}
        ${f('Tachas nos bordos', sel('si-tab', ['Não há', 'Monodirecional', 'Bidirecional'], d.taBordo))}${f('Espaçamento (m)', inp('si-tab-e', d.taBordoEsp))}</div>
        <p class="help" id="si-help"></p>
        <button class="btn-full" onclick="SH.confirmarIni()">✓ Confirmar e começar</button>`);
      SH._ajIni();
    },
    _ajIni() {
      const g = (id) => { const c = document.querySelector('#' + id + ' .chip.sel'); return c ? c.dataset.v : null; };
      const dp = g('si-pista') === 'Dupla', fx = +g('si-fx');
      $('si-eixo-w').style.display = dp ? 'none' : '';
      $('si-ta-l').textContent = dp ? 'Tachas nas divisões de faixas' : 'Tachas no eixo';
      $('si-help').textContent = dp ? 'Pista dupla: levante um sentido, com o canteiro à esquerda. Sem eixo amarelo; divisões entre faixas brancas seccionadas (LMS-1).'
        : 'Pista simples: eixo amarelo no centro, ' + fx + ' faixa(s) em cada sentido' + (fx > 1 ? ', divisões brancas seccionadas (LMS-1).' : '.');
    },
    confirmarIni() {
      const s = Core.S(); if (!s) return;
      const g = (id) => document.querySelector('#' + id + ' .chip.sel').dataset.v;
      const n = (id, p) => { const v = num(id); return isNaN(v) || !v ? p : v; };
      const dados = { pista: g('si-pista'), faixas: +g('si-fx'), bordos: g('si-bo'), eixo: val('si-eixo'), div: 'LMS-1',
        taEixo: val('si-tae'), taEixoEsp: n('si-tae-e', 16), taBordo: val('si-tab'), taBordoEsp: n('si-tab-e', 16) };
      UI.closeModal();
      SH._registra(s, { grupo: 'trecho', cod: 'INI_TRECHO', rotulo: 'Início do trecho · pista ' + dados.pista.toLowerCase() + ', ' + dados.faixas + ' faixa(s) por sentido', dados }, SH._posIni || Core.pos(s));
    },

    // ── trecho esquecido, por km ──────────────────────────────
    inserir(pasta) {
      const s = pasta ? Export.sessaoPor(pasta) : Core.S(); if (!s) return;
      const ops = [['FX_E', 'Faixa adicional à esquerda'], ['FX_D', 'Faixa adicional à direita'], ['BOE_S', 'Bordo esquerdo seccionado'], ['BOD_S', 'Bordo direito seccionado'],
        ['BOE_A', 'Bordo esquerdo ausente'], ['BOD_A', 'Bordo direito ausente'], ['ZEB', 'Zebrado'], ['DISP', 'Dispositivo'], ['TA', 'Exceção de tachas'],
        ['FX_PED', 'Faixa de pedestres (ponto)'], ['LRE', 'Linha de retenção (ponto)'], ['LOMB', 'Lombada (ponto)']];
      UI.modal('＋ Inserir trecho esquecido', `<p class="help" style="font-size:13px">Informe o que faltou e os km. O app encaixa os registros na posição certa do trajeto gravado.</p>
        ${f('O que faltou', sel('in-tipo', ops, 'FX_D'))}
        <div class="fgrid">${f('Km de início', `<input class="inp" id="in-k1" inputmode="decimal" placeholder="ex.: 380+250">`)}${f('Km de término', `<input class="inp" id="in-k2" inputmode="decimal" placeholder="(vazio se for ponto)">`)}</div>
        <div id="in-zeb" class="fgrid">${f('Largura do zebrado (m)', inp('in-zl', 3))}${f('Cor', sel('in-zc', ['Amarela', 'Branca'], 'Amarela'))}</div>
        <button class="btn-full" onclick="SH.confirmarInserir(${pasta ? `'${esc(pasta)}'` : ''})">✓ Inserir</button>`);
    },
    confirmarInserir(pasta) {
      const s = pasta ? Export.sessaoPor(pasta) : Core.S(); if (!s) return;
      const k1 = kmDe(val('in-k1')), k2 = kmDe(val('in-k2')); const tipo = val('in-tipo');
      if (k1 == null) { toast('Informe o km de início'); return; }
      const pont = ['FX_PED', 'LRE', 'LOMB'].includes(tipo);
      if (!pont && k2 == null) { toast('Informe o km de término'); return; }
      const par = { FX_E: ['FX_MAIS_E', 'FX_MENOS_E'], FX_D: ['FX_MAIS_D', 'FX_MENOS_D'], BOE_S: ['BOE_S', 'BOE_C'], BOD_S: ['BOD_S', 'BOD_C'], BOE_A: ['BOE_A', 'BOE_C'], BOD_A: ['BOD_A', 'BOD_C'],
        ZEB: ['ZEB_INI', 'ZEB_FIM'], DISP: ['DISP_INI', 'DISP_FIM'], TA: ['TA_INI', 'TA_FIM'] }[tipo];
      const regs = pont ? [{ cod: tipo, km: k1 }] : [{ cod: par[0], km: k1 }, { cod: par[1], km: k2 }];
      const zd = tipo === 'ZEB' ? { larg: num('in-zl') || 0, cor: val('in-zc'), listra: 0.4, esp: 1.1 } : null;
      const r = incluirPorKm(s, regs.map(x => ({ cod: x.cod, km: x.km, dados: x.cod === 'ZEB_INI' ? zd : {} })), 'inserido por km');
      if (r.erro) { UI.alert('Inserir', r.erro); return; }
      UI.closeModal(); toast('✅ ' + r.n + ' registro(s) inserido(s)');
    },
    _segmentos: segmentos, _croqui: croqui, _quant: quantitativos, _estado: estado,
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
    incorporar, _incorporar, croquiDuplo, _croquiDuplo,
  };
  Modules.register(M);
})();
