// ════════════════════════════════════════════════════════════════
//  DVA Roads — ícones das faixas (SVG, vista de cima)
//  O carro anda de baixo para cima: "esquerda" e "direita" são as
//  do motorista no sentido do levantamento.
//  Pista: asfalto x 10–46, bordos brancos, eixo amarelo no centro (x 28).
// ════════════════════════════════════════════════════════════════
const ICONS = (function () {
  const ASF = '#4A4F57', BR = '#FFFFFF', AM = '#F5C500', VD = '#2E7D32', VM = '#C62828';
  const svg = (inner) => `<svg class="sh-pat-ico" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g transform="translate(4,0)">${inner}</g></svg>`;
  const asf = () => `<rect x="10" y="0" width="36" height="64" rx="3" fill="${ASF}"/>`;
  const bordoE = (y0 = 0, y1 = 64) => `<rect x="12" y="${y0}" width="3" height="${y1 - y0}" fill="${BR}"/>`;
  const bordoD = (y0 = 0, y1 = 64) => `<rect x="41" y="${y0}" width="3" height="${y1 - y0}" fill="${BR}"/>`;
  const bordos = () => bordoE() + bordoD();
  const cheia = (x, c = AM) => `<rect x="${x}" y="0" width="3" height="64" fill="${c}"/>`;
  const trac = (x, c = AM) => [0, 24, 48].map(y => `<rect x="${x}" y="${y + 2}" width="3" height="12" fill="${c}"/>`).join('');
  const C = 26.5, L = 23.5, R = 29.5; // eixo simples; duplas à esquerda e à direita

  // faixa adicional à direita: começa (abre) ou termina (fecha) no meio do ícone
  function faixaAdic(lado, inicio) {
    // desenhada para o lado direito; o lado esquerdo é o espelho
    const f = ([x, y]) => [x, inicio ? y : 64 - y];
    const poly = [[44, 64], [44, 42], [58, 26], [58, 0], [44, 0]].map(f);
    const bord = [[42.5, 64], [42.5, 42], [56.5, 26], [56.5, 0]].map(f);
    const div = [[44, 0], [44, 30]].map(f);
    const g = `<rect x="10" y="0" width="36" height="64" fill="${ASF}"/>`
      + `<polygon points="${poly.map(p => p.join(',')).join(' ')}" fill="${ASF}"/>`
      + bordoE()
      + `<polyline points="${bord.map(p => p.join(',')).join(' ')}" fill="none" stroke="${BR}" stroke-width="3"/>`
      + `<line x1="${div[0][0]}" y1="${div[0][1]}" x2="${div[1][0]}" y2="${div[1][1]}" stroke="${BR}" stroke-width="2.5" stroke-dasharray="6 5"/>`
      + trac(C);
    return lado === 'D' ? g : `<g transform="translate(64,0) scale(-1,1)">${g}</g>`;
  }

  const I = {
    // ── trecho ──
    INI_TRECHO: () => svg(asf() + bordos() + trac(C)
      + `<rect x="6" y="46" width="44" height="7" rx="2" fill="${VD}"/>`
      + `<path d="M28 18 L38 32 H31 V42 H25 V32 H18 Z" fill="${VD}"/>`),
    FIM_TRECHO: () => svg(asf() + bordos() + trac(C)
      + `<rect x="6" y="10" width="44" height="8" fill="${BR}"/>`
      + [6, 17, 28, 39].map(x => `<rect x="${x}" y="10" width="5.5" height="4" fill="${VM}"/><rect x="${x + 5.5}" y="14" width="5.5" height="4" fill="${VM}"/>`).join('')
      + `<rect x="5" y="9" width="46" height="10" fill="none" stroke="${VM}" stroke-width="1.5"/>`),
    // ── eixo (LFO) ──
    'LFO-2': () => svg(asf() + bordos() + trac(C)),                     // seccionada
    'LFO-1': () => svg(asf() + bordos() + cheia(C)),                    // contínua simples
    'LFO-3': () => svg(asf() + bordos() + cheia(L) + cheia(R)),         // dupla contínua
    'LFO-4E': () => svg(asf() + bordos() + cheia(L) + trac(R)),         // mista, contínua à esquerda
    'LFO-4D': () => svg(asf() + bordos() + trac(L) + cheia(R)),         // mista, contínua à direita
    'LFO-5': () => svg(asf() + bordos() + trac(L) + trac(R)),           // dupla seccionada
    SEM: () => svg(asf() + bordos()
      + `<line x1="20" y1="22" x2="36" y2="42" stroke="#9AA0A8" stroke-width="3" stroke-linecap="round"/>`
      + `<line x1="36" y1="22" x2="20" y2="42" stroke="#9AA0A8" stroke-width="3" stroke-linecap="round"/>`),
    // ── faixa adicional ──
    FA_INI_D: () => svg(faixaAdic('D', true)),
    FA_INI_E: () => svg(faixaAdic('E', true)),
    FA_FIM_D: () => svg(faixaAdic('D', false)),
    FA_FIM_E: () => svg(faixaAdic('E', false)),
    // ── bordo ──
    BO_AUS: () => svg(asf() + bordoE() + bordoD(0, 18) + bordoD(46, 64) + trac(C)
      + `<rect x="38" y="24" width="9" height="16" rx="2" fill="none" stroke="${VM}" stroke-width="2" stroke-dasharray="3 2"/>`),
    BO_RET: () => svg(asf() + bordoE() + bordoD(0, 34) + trac(C)
      + `<rect x="41" y="44" width="3" height="20" fill="#7A8088"/>`
      + `<path d="M42.5 28 l5 7 h-10 z" fill="${VD}"/>`),
    // ── pontuais ──
    ZEB_INI: () => svg(asf() + bordos()
      + `<polygon points="28,8 34,30 28,58 22,30" fill="none" stroke="${AM}" stroke-width="2.5"/>`
      + [20, 28, 36, 44].map(y => `<line x1="24" y1="${y + 4}" x2="32" y2="${y - 4}" stroke="${AM}" stroke-width="2"/>`).join('')),
    ZEB_FIM: () => svg(asf() + bordos() + trac(C)
      + `<polygon points="28,2 33,18 28,30 23,18" fill="none" stroke="${AM}" stroke-width="2.5"/>`
      + `<line x1="25" y1="20" x2="31" y2="14" stroke="${AM}" stroke-width="2"/>`),
    FX_PED: () => svg(asf() + bordos()
      + [16, 24, 32, 40].map(x => `<rect x="${x - 2}" y="18" width="5" height="28" fill="${BR}"/>`).join('')),
    LRE: () => svg(asf() + bordos() + trac(C) + `<rect x="10" y="40" width="17" height="6" fill="${BR}"/>`),
    TA_INI: () => svg(asf() + bordos() + trac(C)
      + [8, 20, 32, 44, 56].map(y => `<circle cx="34.5" cy="${y}" r="2.6" fill="#E53935" stroke="${BR}" stroke-width="1"/>`).join('')),
    TA_FIM: () => svg(asf() + bordos() + trac(C)
      + [44, 56].map(y => `<circle cx="34.5" cy="${y}" r="2.6" fill="#E53935" stroke="${BR}" stroke-width="1"/>`).join('')
      + `<line x1="29" y1="34" x2="40" y2="34" stroke="${VM}" stroke-width="2"/>`),
    DESG: () => svg(asf() + `<rect x="12" y="0" width="3" height="64" fill="${BR}" opacity=".45"/>`
      + `<rect x="41" y="0" width="3" height="64" fill="${BR}" opacity=".45"/>`
      + [0, 24, 48].map(y => `<rect x="${C}" y="${y + 2}" width="3" height="12" fill="${AM}" opacity=".35"/>`).join('')
      + `<path d="M20 30 q4-6 8 0 t8 0" fill="none" stroke="#E0B000" stroke-width="2"/>`),
  };
  return {
    get: (cod) => (I[cod] ? I[cod]() : ''),
    has: (cod) => !!I[cod],
    all: () => Object.keys(I),
  };
})();
