// ════════════════════════════════════════════════════════════════
//  Módulo SV — Sinalização vertical e dispositivos de segurança
//  Cadastro / inventário de uma rodovia (órgão ou concessionária):
//  placas por código (MBST/CONTRAN), defensas e barreiras rígidas
//  por trecho (início/fim), demais dispositivos pontuais.
//  Tudo com estado de conservação, que filtra a lista, o relatório e o KML.
// ════════════════════════════════════════════════════════════════
(function () {
  // ── estados de conservação ──────────────────────────────────
  const ESTADOS = [
    { v: 'Bom', cor: '#2E7D32' }, { v: 'Regular', cor: '#F9A825' }, { v: 'Danificada', cor: '#EF6C00' },
    { v: 'Ausente', cor: '#C62828' }, { v: 'Desbotada / sem retrorrefletância', cor: '#8D6E63' },
    { v: 'Torta / desalinhada', cor: '#6D4C41' }, { v: 'Encoberta (vegetação)', cor: '#558B2F' }, { v: 'Pichada / vandalizada', cor: '#7B1FA2' },
  ];
  const corEst = (e) => (ESTADOS.find(x => x.v === e) || { cor: '#607D8B' }).cor;
  const problema = (e) => e && e !== 'Bom';

  // ── categorias e catálogo de placas (editável) ──────────────
  const CAT = {
    R: { n: 'Regulamentação', ico: 'R' }, A: { n: 'Advertência', ico: 'A' }, I: { n: 'Indicação', ico: 'I' },
    EDU: { n: 'Educativa', ico: 'EDU' }, SA: { n: 'Serviços auxiliares', ico: 'SA' }, TUR: { n: 'Atrativo turístico', ico: 'TUR' }, OBR: { n: 'Obras', ico: 'OBR' },
    DA: { n: 'Dispositivos auxiliares', ico: 'DA' },
  };
  const CATALOGO_PADRAO = {
    // códigos e nomes conforme o índice do MBST, Vol. I e Vol. II (CONTRAN, 2022)
    R: ['R-1 Parada obrigatória', 'R-2 Dê a preferência', 'R-3 Sentido proibido', 'R-4a Proibido virar à esquerda', 'R-4b Proibido virar à direita', 'R-5a Proibido retornar à esquerda', 'R-5b Proibido retornar à direita', 'R-6a Proibido estacionar', 'R-6b Estacionamento regulamentado', 'R-6c Proibido parar e estacionar', 'R-7 Proibido ultrapassar', 'R-8a Proibido mudar de faixa ou pista de trânsito da esquerda para a direita', 'R-8b Proibido mudar de faixa ou pista de trânsito da direita para a esquerda', 'R-9 Proibido trânsito de caminhões', 'R-10 Proibido trânsito de veículos automotores', 'R-11 Proibido trânsito de veículos de tração animal', 'R-12 Proibido trânsito de bicicletas', 'R-13 Proibido trânsito de tratores e máquinas de obras', 'R-14 Peso bruto total máximo permitido', 'R-15 Altura máxima permitida', 'R-16 Largura máxima permitida', 'R-17 Peso máximo permitido por eixo', 'R-18 Comprimento máximo permitido', 'R-19 Velocidade máxima permitida', 'R-20 Proibido acionar buzina ou sinal sonoro', 'R-21 Alfândega', 'R-22 Uso obrigatório de corrente', 'R-23 Conserve-se à direita', 'R-24a Sentido de circulação da via/pista', 'R-24b Passagem obrigatória', 'R-25a Vire à esquerda', 'R-25b Vire à direita', 'R-25c Siga em frente ou à esquerda', 'R-25d Siga em frente ou à direita', 'R-26 Siga em frente', 'R-27 Ônibus, caminhões e veículos de grande porte mantenham-se à direita', 'R-28 Duplo sentido de circulação', 'R-29 Proibido trânsito de pedestres', 'R-30 Pedestre, ande pela esquerda', 'R-31 Pedestre, ande pela direita', 'R-32 Circulação exclusiva de ônibus', 'R-33 Sentido de circulação na rotatória', 'R-34 Circulação exclusiva de bicicletas', 'R-35a Ciclista, transite à esquerda', 'R-35b Ciclista, transite à direita', 'R-36a Ciclistas à esquerda, pedestres à direita', 'R-36b Pedestres à esquerda, ciclistas à direita', 'R-37 Proibido trânsito de motocicletas, motonetas e ciclomotores', 'R-38 Proibido trânsito de ônibus', 'R-39 Circulação exclusiva de caminhão', 'R-40 Trânsito proibido a carros de mão', 'R-41 Circulação exclusiva de VLT / bonde', 'R-42a Ciclistas à esquerda, VLT à direita', 'R-42b Ciclistas à direita, VLT à esquerda', 'R-43a Veículos à esquerda, VLT à direita', 'R-43b Veículos à direita, VLT à esquerda', 'R-44 Circulação compartilhada de ciclistas e pedestres'],
    A: ['A-1a Curva acentuada à esquerda', 'A-1b Curva acentuada à direita', 'A-2a Curva à esquerda', 'A-2b Curva à direita', 'A-3a Pista sinuosa à esquerda', 'A-3b Pista sinuosa à direita', 'A-4a Curva acentuada em “S” à esquerda', 'A-4b Curva acentuada em “S” à direita', 'A-5a Curva em “S” à esquerda', 'A-5b Curva em “S” à direita', 'A-6 Cruzamento de vias', 'A-7a Via lateral à esquerda', 'A-7b Via lateral à direita', 'A-8 Interseção em “T”', 'A-9 Bifurcação em “Y”', 'A-10a Entroncamento oblíquo à esquerda', 'A-10b Entroncamento oblíquo à direita', 'A-11a Junções sucessivas contrárias primeira à esquerda', 'A-11b Junções sucessivas contrárias primeira à direita', 'A-12 Interseção em círculo', 'A-13a Confluência à esquerda', 'A-13b Confluência à direita', 'A-14 Semáforo à frente', 'A-15 Parada obrigatória à frente', 'A-16 Bonde / VLT', 'A-17 Pista irregular', 'A-18 Saliência ou lombada', 'A-19 Depressão', 'A-20a Declive acentuado', 'A-20b Aclive acentuado', 'A-21a Estreitamento de pista ao centro', 'A-21b Estreitamento de pista à esquerda', 'A-21c Estreitamento de pista à direita', 'A-21d Alargamento de pista à esquerda', 'A-21e Alargamento de pista à direita', 'A-22 Ponte estreita', 'A-23 Ponte móvel', 'A-24 Obras', 'A-25 Mão dupla adiante', 'A-26a Sentido único', 'A-26b Sentido duplo', 'A-27 Área com desmoronamento', 'A-28 Pista escorregadia', 'A-29 Projeção de cascalho', 'A-30a Trânsito de ciclistas', 'A-30b Passagem sinalizada de ciclistas', 'A-30c Trânsito compartilhado por ciclistas e pedestres', 'A-31 Trânsito de tratores ou maquinária agrícola', 'A-32a Trânsito de pedestres', 'A-32b Passagem sinalizada de pedestres', 'A-33a Área escolar', 'A-33b Passagem sinalizada de escolares', 'A-34 Crianças', 'A-35 Animais', 'A-36 Animais selvagens', 'A-37 Altura limitada', 'A-38 Largura limitada', 'A-39 Passagem de nível sem barreira', 'A-40 Passagem de nível com barreira', 'A-41 Cruz de Santo André', 'A-42a Início de pista dupla', 'A-42b Fim de pista dupla', 'A-42c Pista dividida', 'A-43 Aeroporto', 'A-44 Vento lateral', 'A-45 Rua sem saída', 'A-46 Peso bruto total limitado', 'A-47 Peso limitado por eixo', 'A-48 Comprimento limitado', 'A-49a Pedestres à esquerda, VLT à direita', 'A-49b Pedestres à direita, VLT à esquerda', 'A-50a Veículos à esquerda, VLT à direita', 'A-50b Veículos à direita, VLT à esquerda'],
    I: ['Identificação de rodovia', 'Identificação de município / localidade', 'Distância (km a destinos)', 'Orientação de destino',
      'Pré-sinalização', 'Marco quilométrico', 'Identificação de ponte / curso d’água'],
    EDU: ['Educativa'], SA: ['Posto de combustível', 'Restaurante', 'Hospital / pronto-socorro', 'Polícia rodoviária', 'Área de descanso', 'Telefone de emergência'],
    TUR: ['Atrativo turístico'], OBR: ['Obras / desvio', 'Fim de obras'],
    // DER-SP V.II, seção F (MA e MP) e MBST Vol. VI (balizadores e delimitadores)
    DA: ['MA-D Marcador de alinhamento (seta à direita)', 'MA-E Marcador de alinhamento (seta à esquerda)', 'MA-N Marcador de alinhamento numerado',
      'MP-1 Marcador de perigo', 'MP-2 Marcador de perigo', 'MP-3 Marcador de perigo (em V)',
      'Balizador de borda (delineador)', 'Balizador em defensa / barreira', 'Balizador flexível (cilindro delimitador)', 'Balizador de ponte / obra de arte',
      'Marcador de obstáculo', 'Tachão'],
  };
  const LADOS = { D: 'Direito', E: 'Esquerdo', CC: 'Canteiro central', AE: 'Aérea (pórtico)' };
  const SUPORTES = ['Coluna simples', 'Coluna dupla', 'Semipórtico', 'Pórtico', 'Poste existente', 'Fixada em estrutura', 'Sem suporte'];
  const MATERIAIS_SUP = ['Aço galvanizado', 'Madeira'];
  const SECOES = { 'Aço galvanizado': ['Ø 2½"', 'Ø 3"', 'Ø 4"'], 'Madeira': ['8 × 8 cm', '10 × 10 cm', '12 × 12 cm'] };
  // DER-SP Vol. II: Tipo I (classes II–IV) 800 mm, Tipo II (classe Ib) 1000 mm, Tipo III (classes 0 e Ia) 1200 mm.
  // A velocidade de projeto do trecho sobe o tipo: acima de 80 km/h no mínimo Tipo II, acima de 100 km/h Tipo III.
  const TIPO_TAM = { I: 0.8, II: 1.0, III: 1.2 };
  function tipoDER(p) {
    p = p || {}; const ord = ['I', 'II', 'III'];
    let t = { '0': 'III', 'Ia': 'III', 'Ib': 'II', 'II': 'I', 'III': 'I', 'IV': 'I' }[p.classe] || 'I';
    const v = +p.velocidade || 0;
    if (v > 100) t = 'III'; else if (v > 80 && ord.indexOf(t) < 1) t = 'II';
    return t;
  }
  /** largura × altura (m) da placa conforme o tipo DER; null para placas sem tamanho padrão */
  function dimsNorma(cod, cat, p) {
    const t = tipoDER(p), S = TIPO_TAM[t]; const c = codDe(cod || '') || '';
    if (cat === 'R') { if (c === 'R-2') return { t, larg: S, alt: +(S * 0.866).toFixed(2) }; return { t, larg: S, alt: S }; }
    if (cat === 'DA') {
      if (/^MA/.test(c)) return { t, larg: 0.5, alt: 0.6 };
      if (/^MP/.test(c)) { const g = ['0', 'Ia', 'Ib'].includes((p || {}).classe) || (!(p || {}).classe && t !== 'I'); return g ? { t, larg: 0.5, alt: 1.5 } : { t, larg: 0.3, alt: 0.8 }; }
      return null;
    }
    if (cat === 'A') { if (/^A-26/.test(c)) return { t, larg: +(S * 1.5).toFixed(2), alt: +(S * 0.5).toFixed(2) }; return { t, larg: S, alt: S }; }
    return null;
  }
  /** placas que têm um valor escrito (velocidade, limites) ou texto livre */
  function pedeTexto(cod, cat) {
    const c = codDe(cod || '') || '';
    if (cat === 'DA' && cod !== '__outro') return c === 'MA-N' ? 'Número' : null;
    if (cod === '__outro' || !['R', 'A'].includes(cat)) return 'Texto na placa';
    if (c === 'R-19') return 'Velocidade (km/h)';
    if (/^R-1[4-8]$/.test(c)) return 'Limite indicado na placa';
    if (/^A-(37|38|39|46|47)/.test(c)) return 'Valor indicado na placa';
    return null;
  }
  const PELICULAS = ['Não verificada', 'Grau técnico', 'Alta intensidade', 'Grau diamante / prismática', 'Sem película refletiva'];
  // dispositivos de segurança por trecho e pontuais
  const SEGS = { DEF: { n: 'Defensa metálica', tipos: ['Simples', 'Dupla', 'Semimaleável', 'Maleável'] }, BAR: { n: 'Barreira rígida', tipos: ['New Jersey', 'Perfil F', 'Vertical', 'Simples (meia barreira)'] } };
  const DISP = ['Terminal de defensa', 'Atenuador de impacto', 'Marco quilométrico', 'Pórtico / semipórtico', 'Tela antiofuscante'];

  // figura oficial da placa (índice do MBST); sem figura, usa o ícone da categoria
  const codDe = (txt) => { const m = String(txt || '').match(/^([RA]-\d+[a-z]?|MA-[DEN]|MP-[123])(?![\w-])/); return m ? m[1] : null; };
  const figura = (txt, cat, px) => {
    const c = codDe(txt); px = px || 44;
    const fb = `<span class="sv-fig-fb" style="width:${px}px;height:${px}px">${ic[cat] || ic.R}</span>`;
    return c ? `<img class="sv-fig" src="img/placas/${c}.png" style="width:${px}px;height:${px}px" alt="${c}" onerror="this.outerHTML=this.dataset.fb" data-fb='${fb.replace(/'/g, '&#39;')}'>` : fb;
  };
  const catalogo = () => Object.assign({}, CATALOGO_PADRAO, Store.readJSON('Config/sv_catalogo.json', {}) || {});
  let frozen = null, editId = null, cat = 'R', lado = 'D', estado = 'Bom', fotos = [], filtroTela = '';

  // ── ícones dos botões (SVG simples) ─────────────────────────
  const ic = {
    R: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#fff" stroke="#C62828" stroke-width="5"/><text x="20" y="25" font-size="13" font-weight="800" text-anchor="middle" fill="#111" font-family="Arial">R</text></svg>',
    A: '<svg viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24" transform="rotate(45 20 20)" fill="#F5C500" stroke="#111" stroke-width="2"/><text x="20" y="25" font-size="13" font-weight="800" text-anchor="middle" fill="#111" font-family="Arial">A</text></svg>',
    I: '<svg viewBox="0 0 40 40"><rect x="4" y="10" width="32" height="20" rx="3" fill="#2E7D32" stroke="#fff" stroke-width="1.5"/><text x="20" y="25" font-size="12" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial">I</text></svg>',
    EDU: '<svg viewBox="0 0 40 40"><rect x="4" y="10" width="32" height="20" rx="3" fill="#fff" stroke="#111" stroke-width="2"/><text x="20" y="24" font-size="9" font-weight="800" text-anchor="middle" fill="#111" font-family="Arial">EDU</text></svg>',
    SA: '<svg viewBox="0 0 40 40"><rect x="7" y="6" width="26" height="28" rx="3" fill="#1565C0"/><rect x="13" y="12" width="14" height="12" fill="#fff"/><text x="20" y="22" font-size="9" font-weight="800" text-anchor="middle" fill="#1565C0" font-family="Arial">SA</text></svg>',
    TUR: '<svg viewBox="0 0 40 40"><rect x="4" y="10" width="32" height="20" rx="3" fill="#6D4C41"/><text x="20" y="24" font-size="9" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial">TUR</text></svg>',
    OBR: '<svg viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24" transform="rotate(45 20 20)" fill="#EF6C00" stroke="#111" stroke-width="2"/><text x="20" y="24" font-size="8" font-weight="800" text-anchor="middle" fill="#111" font-family="Arial">OBR</text></svg>',
    DEF: '<svg viewBox="0 0 40 40"><rect x="9" y="14" width="3" height="20" fill="#555"/><rect x="28" y="14" width="3" height="20" fill="#555"/><path d="M3 15 h34 v3 l-3 2 l3 2 v3 h-34 v-3 l3 -2 l-3 -2z" fill="#90A4AE" stroke="#455A64" stroke-width="1.2"/></svg>',
    BAR: '<svg viewBox="0 0 40 40"><path d="M14 6 h12 v8 l6 16 v4 h-24 v-4 l6 -16z" fill="#BDBDBD" stroke="#616161" stroke-width="1.5"/></svg>',
    DA: '<svg viewBox="0 0 40 40"><rect x="13" y="3" width="14" height="34" fill="#F5C500" stroke="#111" stroke-width="1.5"/><path d="M13 9 l14 -6 v6 l-14 6z M13 21 l14 -6 v6 l-14 6z M13 33 l14 -6 v6 l-14 4z" fill="#111"/></svg>',
    DISP: '<svg viewBox="0 0 40 40"><rect x="17" y="6" width="6" height="28" fill="#fff" stroke="#111" stroke-width="1.5"/><rect x="17" y="9" width="6" height="5" fill="#F5C500"/><rect x="10" y="33" width="20" height="3" fill="#555"/></svg>',
  };

  // ── trechos (defensa/barreira): pares início → fim ──────────
  function trechos(s) {
    const out = []; const abertos = {};
    s.eventos.forEach(ev => {
      if (ev.grupo !== 'seg') return; const d = ev.dados || {};
      if (d.ini) abertos[d.sid] = { ini: ev, d };
      else if (abertos[d.sid]) { const a = abertos[d.sid]; out.push({ ini: a.ini, fim: ev, elem: a.d.elem, tipo: a.d.tipo, lado: a.d.lado, estado: d.estado || a.d.estado, len: Math.abs(ev.d - a.ini.d), sid: d.sid }); delete abertos[d.sid]; }
    });
    Object.values(abertos).forEach(a => out.push({ ini: a.ini, fim: null, elem: a.d.elem, tipo: a.d.tipo, lado: a.d.lado, estado: a.d.estado, len: Math.abs(s.dist - a.ini.d), sid: a.d.sid, aberto: true }));
    return out;
  }
  const abertosAgora = (s) => trechos(s).filter(t => t.aberto);
  const estadoDe = (ev) => (ev.dados || {}).estado || '';
  function passaFiltro(ev, f) {
    if (!f) return true;
    if (ev.grupo === 'seg' && !(ev.dados || {}).ini) return true;   // fim acompanha o início no relatório
    const e = estadoDe(ev);
    return f === '__problema' ? problema(e) : e === f;
  }
  const filtros = () => [{ v: '', t: 'Todos os itens' }, { v: '__problema', t: 'Só itens com problema (tudo exceto Bom)' }].concat(ESTADOS.map(e => ({ v: e.v, t: e.v })));

  const M = {
    id: 'sv', nome: 'Sinalização Vertical', sub: 'Placas, defensas e barreiras · inventário por estado', icone: '🪧', prefixo: 'V',
    titulo: (ev) => ev.rotulo,
    descricao: (ev) => {
      const d = ev.dados || {};
      if (ev.grupo === 'seg') return d.ini ? [LADOS[d.lado], d.tipo, d.estado].filter(Boolean).join(' · ') : 'Fim do trecho' + (d.estado ? ' · ' + d.estado : '');
      return [LADOS[d.lado], d.legenda ? '“' + d.legenda + '”' : '', d.larg && d.alt ? nf(d.larg, 2) + ' × ' + nf(d.alt, 2) + ' m' : '', d.suporte, d.estado].filter(Boolean).join(' · ');
    },
    // campos legíveis para o painel web
    paraNuvem(s, ev) {
      const d = ev.dados || {};
      const nf2 = (v) => v == null ? null : String(v).replace('.', ',');
      if (ev.grupo === 'placa') return { categoria: 'Placa · ' + ((CAT[d.cat] || {}).n || d.cat || ''), item: ev.rotulo, figura: codDe(ev.rotulo), ladoTxt: LADOS[d.lado] || '',
        detalhes: [d.legenda && 'Texto: ' + d.legenda, d.suporte, d.pelicula && d.pelicula !== 'Não verificada' ? 'Película ' + d.pelicula.toLowerCase() : '',
          d.larg || d.alt ? 'Placa ' + (nf2(d.larg) || '?') + ' × ' + (nf2(d.alt) || '?') + ' m' : '', d.altLivre ? 'Altura livre ' + nf2(d.altLivre) + ' m' : '', d.afast ? 'Afastamento ' + nf2(d.afast) + ' m' : ''].filter(Boolean).join(' · ') };
      if (ev.grupo === 'seg') { const t = trechos(s).find(x => x.sid === d.sid);
        return { categoria: (SEGS[d.elem || (t && t.elem)] || {}).n || 'Defensa / barreira', item: ev.rotulo, ladoTxt: LADOS[d.lado || (t && t.lado)] || '',
          detalhes: t ? [t.tipo, 'Extensão ' + nf(t.len, 1) + ' m', t.fim ? '' : 'trecho em aberto'].filter(Boolean).join(' · ') : '' }; }
      if (ev.grupo === 'disp') return { categoria: 'Dispositivo de segurança', item: ev.rotulo, ladoTxt: LADOS[d.lado] || '' };
      return {};
    },
    iconeEvento: (ev) => {
      const e = estadoDe(ev);
      const dot = e ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${corEst(e)};margin-right:2px"></span>` : '';
      return (ev.grupo === 'placa' ? `<span style="vertical-align:middle;display:inline-block;margin-right:4px">${figura(ev.rotulo, (ev.dados || {}).cat, 26)}</span>` : '') + dot;
    },
    filtros, passaFiltro,
    filtroLista: (ev) => passaFiltro(ev, filtroTela),
    // filtro compacto junto aos registros (também disponível na exportação)
    filtroUI: () => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:12px;color:var(--sub);font-weight:700">Mostrar:</span>
      <select class="inp" style="flex:1;padding:6px 8px" onchange="SV.filtrar(this.value)">${[{ v: '', t: 'Todos os registros' }, { v: '__problema', t: 'Só com problema' }].concat(ESTADOS.slice(1).map(e => ({ v: e.v, t: e.v })))
        .map(f => `<option value="${esc(f.v)}" ${filtroTela === f.v ? 'selected' : ''}>${esc(f.t)}</option>`).join('')}</select></div>`,

    camposAbertura(u) {
      u = u || {};
      const sel = (id, o, v) => `<select class="inp" id="${id}">${o.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
      return `<div class="fsec">Tipo de levantamento</div>
        <div class="field">${sel('sv-tipo', ['Cadastro inicial', 'Inventário', 'Vistoria de conservação'], u.tipo || 'Inventário')}</div>
        <div class="field"><label>Órgão ou concessionária</label><input class="inp" id="sv-org" value="${esc(u.orgao || '')}" placeholder="ex.: DER-SP, concessionária..."></div>
        <div class="fgrid">
          <div class="field"><label>Contrato / referência</label><input class="inp" id="sv-ref" value="${esc(u.ref || '')}"></div>
          <div class="field"><label>Pista</label>${sel('sv-pista', ['Simples', 'Dupla'], u.pista || 'Simples')}</div>
          <div class="field"><label>Classe da rodovia (DER)</label>${sel('sv-classe', ['0', 'Ia', 'Ib', 'II', 'III', 'IV'], u.classe || 'II')}</div>
          <div class="field"><label>Velocidade de projeto (km/h)</label><input class="inp" id="sv-vel" inputmode="numeric" value="${esc(u.velocidade || '')}" placeholder="ex.: 80"></div>
          <div class="field"><label>Lados levantados</label>${sel('sv-lados', ['Direito', 'Esquerdo', 'Ambos'], u.lados || 'Direito')}</div>
        </div>
        <p class="help">Classe e velocidade definem o tamanho das placas pela norma do DER (Tipo I 0,80 m · II 1,00 m · III 1,20 m). Códigos das placas de regulamentação e advertência conforme o índice do Manual Brasileiro de Sinalização de Trânsito, Vol. I e II (CONTRAN, 2022). O catálogo pode ser completado no próprio app.</p>`;
    },
    lerAbertura() {
      return { orgao: val('sv-org').trim(), tipo: val('sv-tipo'), ref: val('sv-ref').trim(), pista: val('sv-pista'), lados: val('sv-lados'), classe: val('sv-classe'), velocidade: parseInt(val('sv-vel')) || null };
    },

    painel(s) {
      const b = (k, l, fn, sub) => `<button class="sh-btn" onclick="${fn}"><span class="sv-ico">${ic[k]}</span><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
      return `<div class="card">
        <div class="sh-state" id="sv-state"></div>
        <div id="sv-abertos"></div>
        <div class="sh-grp"><div class="sh-grp-t">Placas</div><div class="sh-grid">
          ${b('R', 'Regulamentação', "SV.placa('R')")}${b('A', 'Advertência', "SV.placa('A')")}${b('I', 'Indicação', "SV.placa('I')")}
          ${b('EDU', 'Educativa', "SV.placa('EDU')")}${b('SA', 'Serviços', "SV.placa('SA')")}${b('TUR', 'Turística', "SV.placa('TUR')")}
          ${b('OBR', 'Obras', "SV.placa('OBR')")}${b('DA', 'Marcadores e balizadores', "SV.placa('DA')")}</div></div>
        <div class="sh-grp"><div class="sh-grp-t">Dispositivos de segurança</div><div class="sh-grid">
          ${b('DEF', 'Defensa', "SV.iniSeg('DEF')", 'início do trecho')}${b('BAR', 'Barreira rígida', "SV.iniSeg('BAR')", 'início do trecho')}${b('DISP', 'Outro dispositivo', 'SV.disp()', 'terminal, atenuador...')}</div></div>
        <div style="display:flex;gap:8px;margin-top:6px"><button class="btn-sm n" style="flex:1" onclick="Export.open()">📤 Exportar</button><button class="btn-sm g" style="flex:1" onclick="SV.editarCatalogo()">✏️ Catálogo de placas</button></div>
      </div>`;
    },
    montar(s) { M.atualizar(s); },
    atualizar(s) {
      if (!$('sv-state')) return;
      const n = s.eventos.filter(e => e.grupo !== 'seg' || (e.dados || {}).ini);
      const prob = n.filter(e => problema(estadoDe(e))).length;
      $('sv-state').innerHTML = `Itens: <b>${n.length}</b> · com problema: <b style="color:${prob ? '#C62828' : 'inherit'}">${prob}</b>` + (s.params && s.params.orgao ? ' · ' + esc(s.params.orgao) : '');
      $('sv-abertos').innerHTML = abertosAgora(s).map(t => `<button class="btn-full" style="margin-bottom:8px;background:#C62828;color:#fff" onclick="SV.fimSeg('${t.sid}')">⏹ Fim ${esc(SEGS[t.elem].n.toLowerCase())} · ${esc(LADOS[t.lado])} <small style="opacity:.8">(desde ${esc(posTxt(s, t.ini))})</small></button>`).join('');
    },

    relatorio(s, ctx) {
      const p = s.params || {}; const f = ctx.filtro;
      const evs = s.eventos.filter(ev => passaFiltro(ev, f));
      const itens = evs.filter(e => e.grupo !== 'seg' || (e.dados || {}).ini);
      // resumo: categoria × estado
      const linhas = {}; const cols = {};
      itens.forEach(e => {
        const k = e.grupo === 'placa' ? 'Placa · ' + CAT[(e.dados || {}).cat].n : e.grupo === 'seg' ? SEGS[e.dados.elem].n : e.rotulo;
        const st = estadoDe(e) || '—'; cols[st] = 1; linhas[k] = linhas[k] || {}; linhas[k][st] = (linhas[k][st] || 0) + 1;
      });
      const cs = ESTADOS.map(e => e.v).filter(v => cols[v]).concat(cols['—'] ? ['—'] : []);
      const resumo = `<h2>Resumo por tipo e estado</h2><table><thead><tr><th>Item</th>${cs.map(c => `<th class="c">${esc(c.split(' ')[0])}</th>`).join('')}<th class="c">Total</th></tr></thead><tbody>
        ${Object.keys(linhas).sort().map(k => { const r = linhas[k]; const t = Object.values(r).reduce((a, b) => a + b, 0); return `<tr><td>${esc(k)}</td>${cs.map(c => `<td class="c">${r[c] || ''}</td>`).join('')}<td class="c b">${t}</td></tr>`; }).join('') || `<tr><td colspan="${cs.length + 2}" class="c">Nenhum item${f ? ' com este filtro' : ''}.</td></tr>`}
      </tbody></table>`;
      const tr = trechos(s).filter(t => !f || (f === '__problema' ? problema(t.estado) : t.estado === f));
      const tot = {}; tr.forEach(t => { const k = SEGS[t.elem].n; tot[k] = (tot[k] || 0) + t.len; });
      const segs = `<h2>Defensas e barreiras</h2><table><thead><tr><th>Elemento</th><th>Lado</th><th>Início</th><th>Fim</th><th class="r">Extensão (m)</th><th>Estado</th></tr></thead><tbody>
        ${tr.map(t => `<tr><td>${esc(SEGS[t.elem].n)}${t.tipo ? ' · ' + esc(t.tipo) : ''}</td><td>${esc(LADOS[t.lado] || '')}</td><td class="nw">${esc(posTxt(s, t.ini))}</td><td class="nw">${t.fim ? esc(posTxt(s, t.fim)) : 'em aberto'}</td><td class="r">${nf(t.len, 1)}</td><td><span style="color:${corEst(t.estado)};font-weight:700">${esc(t.estado || '')}</span></td></tr>`).join('') || '<tr><td colspan="6" class="c">—</td></tr>'}
        ${Object.keys(tot).map(k => `<tr><td colspan="4" class="b">Total ${esc(k.toLowerCase())}</td><td class="r b">${nf(tot[k], 1)}</td><td></td></tr>`).join('')}
      </tbody></table>`;
      const cab = `<h2>Inventário</h2><table><tbody>
        <tr><td><b>Órgão / concessionária</b></td><td>${esc(p.orgao || '—')}</td><td><b>Tipo</b></td><td>${esc(p.tipo || '—')}</td></tr>
        <tr><td><b>Contrato / referência</b></td><td>${esc(p.ref || '—')}</td><td><b>Pista · lados</b></td><td>${esc((p.pista || '—') + ' · ' + (p.lados || '—'))}</td></tr>
        <tr><td><b>Filtro aplicado</b></td><td colspan="3">${esc(f ? filtros().find(x => x.v === f).t : 'Todos os itens')}</td></tr></tbody></table>`;
      return cab + resumo + segs + '<h2>Itens</h2>' + ctx.tabelaPadrao(evs);
    },
    kmlEstilos(s, kc) {
      return ESTADOS.map((e, i) => `<Style id="sv-e${i}"><IconStyle><color>${kc(e.cor)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle><LineStyle><color>${kc(e.cor)}</color><width>7</width></LineStyle></Style>`).join('\n');
    },
    kmlEstiloEvento: (ev) => { const i = ESTADOS.findIndex(e => e.v === estadoDe(ev)); return i >= 0 ? 'sv-e' + i : 'pt'; },
    kmlExtra(s, h) {
      const tr = trechos(s).filter(t => !h.filtro || (h.filtro === '__problema' ? problema(t.estado) : t.estado === h.filtro));
      const pm = tr.map(t => {
        const c = h.trechoTrack(s, t.ini.d, t.fim ? t.fim.d : s.dist); if (!c) return '';
        const i = ESTADOS.findIndex(e => e.v === t.estado);
        return `<Placemark><name>${esc(SEGS[t.elem].n + ' · ' + (LADOS[t.lado] || '') + ' · ' + nf(t.len, 0) + ' m')}</name><description>${esc((t.tipo || '') + ' · ' + (t.estado || '') + ' · ' + posTxt(s, t.ini) + (t.fim ? ' → ' + posTxt(s, t.fim) : ''))}</description><styleUrl>#sv-e${i >= 0 ? i : 0}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${c}</coordinates></LineString></Placemark>`;
      });
      return pm.length ? `<Folder><name>Defensas e barreiras</name>\n${pm.join('\n')}</Folder>\n` : '';
    },
    editar(id) {
      const s = Core.S(); const ev = s.eventos.find(e => e.id === id); if (!ev) return;
      const d = ev.dados || {};
      editId = id; frozen = ev; fotos = (ev.fotos || []).slice(); estado = d.estado || 'Bom'; lado = d.lado || 'D';
      if (ev.grupo === 'placa') { cat = d.cat; formPlaca('✏️ Editar ' + Core.codigo(s, ev), ev); }
      else if (ev.grupo === 'seg') formSeg(d.ini ? '✏️ Início ' + SEGS[d.elem].n.toLowerCase() : '✏️ Fim do trecho', ev, d.elem, !d.ini);
      else formDisp('✏️ Editar ' + Core.codigo(s, ev), ev);
    },
  };

  // ── formulários ─────────────────────────────────────────────
  const ladosDa = (s) => (s && s.params && s.params.pista === 'Dupla') ? ['D', 'CC', 'AE'] : ['D', 'E', 'AE'];
  const nomeLado = (s, k) => k === 'E' && !(s && s.params && s.params.pista === 'Dupla') ? 'Esquerdo (lado oposto)' : LADOS[k];
  const chipsLado = () => `<div class="field"><label>Lado</label><div class="chips">${ladosDa(Core.S()).map(k => `<button class="chip" id="sv-l-${k}" onclick="SV.lado('${k}')">${nomeLado(Core.S(), k)}</button>`).join('')}</div></div>`;
  const chipsEstado = () => `<div class="field"><label>Estado de conservação</label><div class="chips">${ESTADOS.map((e, i) => `<button class="chip" id="sv-e-${i}" onclick="SV.estado(${i})">${esc(e.v)}</button>`).join('')}</div></div>`;
  const blocoFoto = () => `<div class="field"><button class="btn-cam" id="sv-cam" onclick="SV.foto()">📷 Tirar foto</button><div id="sv-fotos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div></div>`;
  const cabPos = (s) => `<div class="field"><label>Posição (travada no toque)</label><div class="preview-fmt">${esc(posTxt(s, frozen) + ' · ' + fmtCoord(frozen.lat, frozen.lon))}</div></div>`;
  function marcar() {
    Object.keys(LADOS).forEach(k => { const b = $('sv-l-' + k); if (b) b.className = 'chip' + (lado === k ? ' sel' : ''); });
    ESTADOS.forEach((e, i) => { const b = $('sv-e-' + i); if (b) { b.className = 'chip' + (estado === e.v ? ' sel' : ''); b.style.borderColor = estado === e.v ? e.cor : ''; } });
    if ($('sv-ruim')) $('sv-ruim').style.display = estado === 'Bom' ? 'none' : '';
    const el = $('sv-fotos'); const s = Core.S();
    if (el) { el.innerHTML = fotos.map(f => `<img class="photo-thumb" src="${Photo.src(s, f)}">`).join(''); $('sv-cam').className = 'btn-cam' + (fotos.length ? ' has' : ''); $('sv-cam').textContent = fotos.length ? '📷 Mais uma foto (' + fotos.length + ')' : '📷 Tirar foto'; }
  }
  // valores escolhidos por botões (no lugar das listas do sistema, que mudam de cor conforme o aparelho)
  let fv = {};
  const chipsDe = (key, ops, v) => `<div class="chips" id="sv-ch-${key}">${ops.map(o => `<button type="button" class="chip ${o === v ? 'sel' : ''}" data-v="${esc(o)}" onclick="SV._ch('${key}',this)">${esc(o)}</button>`).join('')}</div>`;
  function formPlaca(title, ev) {
    const s = Core.S(); const d = (ev && ev.dados) || {}; const p = s.params || {};
    codSel = d.codigo || '';
    const mat = d.supMat || localStorage.getItem('sv_ult_supmat') || 'Aço galvanizado';
    fv = { supMat: mat, sup: d.suporte || localStorage.getItem('sv_ult_sup') || 'Coluna simples', secao: d.secao || (SECOES[mat] || [])[0], pel: d.pelicula || 'Não verificada' };
    UI.modal(title, `${cabPos(s)}
      <div class="field"><label>Categoria</label>${`<div class="chips">${Object.keys(CAT).map(k => `<button type="button" class="chip ${k === cat ? 'sel' : ''}" onclick="SV.trocaCat('${k}')">${CAT[k].n}</button>`).join('')}</div>`}</div>
      <div class="field" id="sv-escolha"><label>Placa</label><input class="inp" id="sv-busca" placeholder="🔎 filtrar: ex. 19, curva, lombada" oninput="SV.buscar()" style="margin-bottom:8px">
        <div class="sv-grade" id="sv-grade"></div>
        <input class="inp" id="sv-outro" style="margin-top:6px;display:none" placeholder="ex.: placa de indicação com destinos"></div>
      <div class="field" id="sv-escolhida" style="display:none"></div>
      <div id="sv-resto" style="display:none">
        <div class="field" id="sv-leg-w"><label id="sv-leg-l">Texto / valor</label><input class="inp" id="sv-leg" value="${esc(d.legenda || '')}"></div>
        ${chipsLado()}${chipsEstado()}
        <div id="sv-ruim">
          <div class="field"><label>Película</label>${chipsDe('pel', PELICULAS, fv.pel)}</div>
          <div class="field"><label>Observação</label><textarea class="inp" id="sv-obs" rows="2">${esc(ev ? ev.obs : '')}</textarea></div>
        </div>
        <details class="sv-det" id="sv-det"><summary id="sv-det-s">Dimensões e suporte</summary>
          <div class="fgrid" style="margin-top:8px">
            <div class="field"><label>Largura (m)</label><input class="inp" id="sv-lg" inputmode="decimal" value="${d.larg ? nf(d.larg, 2) : ''}" oninput="SV._resumo()"></div>
            <div class="field"><label>Altura da placa (m)</label><input class="inp" id="sv-al" inputmode="decimal" value="${d.alt ? nf(d.alt, 2) : ''}" oninput="SV._resumo()"></div>
            <div class="field"><label>Altura livre (m)</label><input class="inp" id="sv-hl" inputmode="decimal" value="${d.altLivre ? nf(d.altLivre, 2) : ''}"></div>
            <div class="field"><label>Afastamento (m)</label><input class="inp" id="sv-af" inputmode="decimal" value="${d.afast ? nf(d.afast, 2) : ''}"></div>
          </div>
          <div class="field"><label>Suporte</label>${chipsDe('sup', SUPORTES, fv.sup)}</div>
          <div class="field"><label>Material do suporte</label>${chipsDe('supMat', MATERIAIS_SUP, fv.supMat)}</div>
          <div class="field"><label>Seção do suporte</label><div id="sv-secao-w">${chipsDe('secao', SECOES[fv.supMat] || [], fv.secao)}</div></div>
        </details>
        ${blocoFoto()}
        <button class="btn-full" onclick="SV.salvarPlaca()">✓ Salvar placa</button>
      </div>`);
    grade(''); escolhida(!!codSel); marcar();
  }
  /** com a placa escolhida, a grade some e aparecem só os campos que ela pede */
  function escolhida(sim) {
    const s = Core.S(); const p = s.params || {};
    $('sv-escolha').style.display = sim ? 'none' : '';
    $('sv-escolhida').style.display = sim ? '' : 'none';
    $('sv-resto').style.display = sim ? '' : 'none';
    if (!sim) return;
    const nome = codSel === '__outro' ? (val('sv-outro') || 'Outra placa') : codSel;
    const c = codDe(nome); const tx = c ? nome.slice(c.length).trim() : nome;
    $('sv-escolhida').innerHTML = `<label>Placa</label><div style="display:flex;align-items:center;gap:10px;background:var(--bg);border-radius:12px;padding:8px">
      ${codSel === '__outro' ? '<span style="font-size:30px">✏️</span>' : figura(nome, cat, 52)}<div style="flex:1"><b>${esc(c || '')}</b><br><span style="font-size:13px">${esc(tx)}</span></div>
      <button class="btn-sm g" onclick="SV.trocar()">Trocar</button></div>`;
    const pt = pedeTexto(codSel, cat);
    $('sv-leg-w').style.display = pt ? '' : 'none'; if (pt) $('sv-leg-l').textContent = pt;
    // dimensões pela norma (se ainda não informadas)
    const dn = dimsNorma(nome, cat, p);
    if (dn && !val('sv-lg')) $('sv-lg').value = nf(dn.larg, 2);
    if (dn && !val('sv-al')) $('sv-al').value = nf(dn.alt, 2);
    SV._resumo();
  }
  let codSel = '';
  function grade(q) {
    const lista = catalogo()[cat] || [];
    const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const f = lista.filter(x => !q || norm(x).includes(norm(q)));
    if (codSel && codSel !== '__outro' && !lista.includes(codSel) && !q) f.unshift(codSel);
    $('sv-grade').innerHTML = f.map(x => {
      const c = codDe(x); const nome = c ? x.slice(c.length).trim() : x;
      return `<button class="sv-pl ${x === codSel ? 'sel' : ''}" onclick="SV.escolher(this)" data-v="${esc(x)}">${figura(x, cat, 44)}<b>${esc(c || '')}</b><span>${esc(nome)}</span></button>`;
    }).join('') + `<button class="sv-pl ${codSel === '__outro' ? 'sel' : ''}" onclick="SV.escolher(this)" data-v="__outro"><span class="sv-fig-fb" style="width:44px;height:44px;font-size:26px;display:flex;align-items:center;justify-content:center">✏️</span><b>Outra</b><span>digitar</span></button>`;
    $('sv-outro').style.display = codSel === '__outro' ? 'block' : 'none';
  }
  function formSeg(title, ev, elem, isFim) {
    const s = Core.S(); const d = (ev && ev.dados) || {};
    UI.modal(title, `${cabPos(s)}
      ${isFim ? '' : `${chipsLado()}<div class="field"><label>Tipo</label><select class="inp" id="sv-st">${SEGS[elem].tipos.map(x => `<option ${x === d.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`}
      ${chipsEstado()}
      <div class="field"><label>Observação</label><textarea class="inp" id="sv-obs" rows="2" placeholder="${isFim ? 'ex.: terminal ausente, lâmina amassada no km...' : ''}">${esc(ev ? ev.obs : '')}</textarea></div>
      ${blocoFoto()}
      <button class="btn-full" onclick="SV.salvarSeg('${elem}', ${isFim ? 1 : 0})">✓ ${isFim ? 'Salvar fim do trecho' : 'Iniciar trecho'}</button>`);
    marcar();
  }
  function formDisp(title, ev) {
    const s = Core.S(); const d = (ev && ev.dados) || {};
    UI.modal(title, `${cabPos(s)}
      <div class="field"><label>Dispositivo</label><select class="inp" id="sv-dp">${DISP.map(x => `<option ${x === (ev ? ev.rotulo : '') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      ${chipsLado()}${chipsEstado()}
      <div class="field"><label>Observação</label><textarea class="inp" id="sv-obs" rows="2">${esc(ev ? ev.obs : '')}</textarea></div>
      ${blocoFoto()}
      <button class="btn-full" onclick="SV.salvarDisp()">✓ Salvar dispositivo</button>`);
    marcar();
  }
  function iniciaForm(s) { frozen = Core.pos(s); editId = null; fotos = []; estado = 'Bom'; lado = (s.params && s.params.lados === 'Esquerdo') ? (s.params.pista === 'Dupla' ? 'CC' : 'E') : 'D'; }
  function numOrNull(id) { const v = num(id); return isNaN(v) ? null : v; }
  function salvar(data) {
    const s = Core.S();
    if (editId) { const ev = s.eventos.find(e => e.id === editId); Object.assign(ev, data, { fotos: fotos.slice() }); Core.updateEvent(ev); }
    else { const ev = Core.addEvent(Object.assign(data, { fotos: fotos.slice() }), frozen); toast(Core.codigo(s, ev) + ' · ' + data.rotulo + ' · ' + estado); }
    editId = null; fotos = []; UI.closeModal();
  }

  window.SV = {
    placa(c) { const s = Core.S(); if (!s) return; iniciaForm(s); cat = c; formPlaca('🪧 ' + CAT[c].n, null); },
    trocaCat(c) { cat = c; const keep = { legenda: '' }; const ev = editId ? Core.S().eventos.find(e => e.id === editId) : null; formPlaca($('mg-title').innerHTML, ev ? Object.assign({}, ev, { dados: Object.assign({}, ev.dados, { codigo: '' }, keep) }) : { obs: val('sv-obs'), dados: keep }); },
    buscar() { grade(val('sv-busca')); },
    escolher(el) {
      codSel = el.dataset.v; document.querySelectorAll('.sv-pl').forEach(b => b.classList.toggle('sel', b === el));
      if (codSel === '__outro') { $('sv-outro').style.display = 'block'; $('sv-outro').focus(); $('sv-outro').onchange = () => { if (val('sv-outro').trim()) escolhida(true); }; return; }
      $('sv-lg').value = ''; $('sv-al').value = ''; escolhida(true);
    },
    trocar() { escolhida(false); $('sv-busca').value = ''; grade(''); },
    _ch(key, el) {
      fv[key] = el.dataset.v; el.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c === el));
      if (key === 'supMat') { fv.secao = (SECOES[fv.supMat] || [])[0]; $('sv-secao-w').innerHTML = chipsDe('secao', SECOES[fv.supMat] || [], fv.secao); }
      SV._resumo();
    },
    _resumo() {
      if (!$('sv-det-s')) return; const s = Core.S(); const t = tipoDER(s.params);
      $('sv-det-s').innerHTML = `Dimensões e suporte · <b>${esc(val('sv-lg') || '?')} × ${esc(val('sv-al') || '?')} m</b>${['R', 'A'].includes(cat) ? ' (Tipo ' + t + ')' : ''} · ${esc(fv.sup)}${fv.sup !== 'Sem suporte' && fv.sup !== 'Poste existente' && fv.sup !== 'Fixada em estrutura' ? ' · ' + esc(fv.supMat.split(' ')[0].toLowerCase() + ' ' + (fv.secao || '')) : ''}`;
    },
    lado(k) { lado = k; marcar(); },
    estado(i) { estado = ESTADOS[i].v; marcar(); },
    filtrar(v) { filtroTela = v; UI.renderEvents(); M.atualizar(Core.S()); },
    async foto() {
      const s = Core.S(); if (!s) return;
      const evRef = editId ? s.eventos.find(e => e.id === editId) : Object.assign({}, frozen, { seq: (s.seq || 0) + 1 });
      evRef.fotos = fotos;
      const tit = $('sv-grade') ? (codSel === '__outro' ? val('sv-outro') : codSel) : $('sv-dp') ? val('sv-dp') : $('mg-title').textContent;
      const name = await Photo.capture(s, evRef, Photo.linhasPadrao(s, frozen, tit, [LADOS[lado] ? 'Lado ' + LADOS[lado].toLowerCase() : '', 'Estado: ' + estado, val('sv-obs').trim()]));
      if (name) { fotos.push(name); marcar(); }
    },
    salvarPlaca() {
      let cod = codSel; if (cod === '__outro' || !cod) cod = val('sv-outro').trim();
      if (!cod) { toast('Escolha ou digite a placa'); return; }
      if (codSel !== '__outro') localStorage.setItem('sv_ult_' + cat, cod);
      localStorage.setItem('sv_ult_sup', fv.sup); localStorage.setItem('sv_ult_supmat', fv.supMat);
      const bom = estado === 'Bom';
      salvar({ grupo: 'placa', cod: cat, rotulo: cod, obs: bom ? '' : val('sv-obs').trim(),
        dados: { cat, codigo: cod, legenda: pedeTexto(codSel, cat) ? val('sv-leg').trim() : '', lado, estado, larg: numOrNull('sv-lg'), alt: numOrNull('sv-al'), altLivre: numOrNull('sv-hl'), afast: numOrNull('sv-af'),
          suporte: fv.sup, supMat: fv.supMat, secao: fv.secao, pelicula: bom ? 'Não verificada' : fv.pel, tipoDER: ['R', 'A'].includes(cat) ? tipoDER(Core.S().params) : null } });
    },
    iniSeg(elem) { const s = Core.S(); if (!s) return; iniciaForm(s); formSeg('▶ Início ' + SEGS[elem].n.toLowerCase(), null, elem, false); },
    fimSeg(sid) {
      const s = Core.S(); if (!s) return;
      const t = abertosAgora(s).find(x => x.sid === sid); if (!t) return;
      iniciaForm(s); estado = t.estado || 'Bom';
      // o fim é gravado na hora (posição do toque); o formulário só completa estado, foto e observação
      const ev = Core.addEvent({ grupo: 'seg', cod: t.elem, rotulo: 'Fim ' + SEGS[t.elem].n.toLowerCase() + ' · ' + LADOS[t.lado].toLowerCase(), dados: { sid, ini: false, elem: t.elem, estado } }, frozen);
      buzz(40); beep(900);
      editId = ev.id; frozen = ev;
      formSeg('⏹ Fim ' + SEGS[t.elem].n.toLowerCase() + ' · ' + nf(Math.abs(ev.d - t.ini.d), 0) + ' m', ev, t.elem, true);
    },
    salvarSeg(elem, isFim) {
      if (isFim) {
        const s = Core.S(); const ev = s.eventos.find(e => e.id === editId);
        ev.dados.estado = estado; ev.obs = val('sv-obs').trim(); ev.fotos = fotos.slice();
        // o estado do trecho é o informado no fim (vistoria do trecho inteiro)
        const ini = s.eventos.find(e => e.grupo === 'seg' && e.dados.ini && e.dados.sid === ev.dados.sid); if (ini) ini.dados.estado = estado;
        Core.updateEvent(ev); editId = null; fotos = []; UI.closeModal(); toast('Trecho fechado'); return;
      }
      if (editId) { const ev = Core.S().eventos.find(e => e.id === editId); salvar({ rotulo: 'Início ' + SEGS[elem].n.toLowerCase() + ' · ' + LADOS[lado].toLowerCase(), obs: val('sv-obs').trim(), dados: Object.assign({}, ev.dados, { lado, tipo: val('sv-st'), estado }) }); return; }
      salvar({ grupo: 'seg', cod: elem, rotulo: 'Início ' + SEGS[elem].n.toLowerCase() + ' · ' + LADOS[lado].toLowerCase(), obs: val('sv-obs').trim(),
        dados: { sid: uid(), ini: true, elem, lado, tipo: val('sv-st'), estado } });
    },
    disp() { const s = Core.S(); if (!s) return; iniciaForm(s); formDisp('🛡️ Dispositivo', null); },
    salvarDisp() {
      salvar({ grupo: 'disp', cod: 'DISP', rotulo: val('sv-dp'), obs: val('sv-obs').trim(), dados: { lado, estado } });
    },
    // ── catálogo de placas editável ──
    editarCatalogo() {
      const c = catalogo();
      UI.modal('✏️ Catálogo de placas', `<p class="help" style="margin:-6px 0 10px">Um item por linha, no formato “código nome”. Vale para as próximas placas registradas.</p>
        <div class="field"><label>Categoria</label><select class="inp" id="cat-sel" onchange="SV.catMostra()">${Object.keys(CAT).map(k => `<option value="${k}">${CAT[k].n}</option>`).join('')}</select></div>
        <textarea class="inp" id="cat-txt" rows="12" style="font-size:13px"></textarea>
        <button class="btn-full" style="margin-top:12px" onclick="SV.catSalvar()">✓ Salvar categoria</button>
        <button class="btn-full gray" style="margin-top:8px" onclick="SV.catPadrao()">↺ Voltar ao catálogo padrão desta categoria</button>`);
      SV._cat = c; SV.catMostra();
    },
    catMostra() { $('cat-txt').value = (SV._cat[val('cat-sel')] || []).join('\n'); },
    catSalvar() {
      const k = val('cat-sel'); const l = val('cat-txt').split('\n').map(x => x.trim()).filter(Boolean);
      const salvo = Store.readJSON('Config/sv_catalogo.json', {}) || {}; salvo[k] = l; Store.writeJSON('Config/sv_catalogo.json', salvo);
      SV._cat[k] = l; toast(CAT[k].n + ': ' + l.length + ' placas');
    },
    catPadrao() {
      const k = val('cat-sel'); const salvo = Store.readJSON('Config/sv_catalogo.json', {}) || {}; delete salvo[k]; Store.writeJSON('Config/sv_catalogo.json', salvo);
      SV._cat[k] = CATALOGO_PADRAO[k]; SV.catMostra();
    },
    _trechos: trechos,
  };
  Modules.register(M);
})();
