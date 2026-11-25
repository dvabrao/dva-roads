// ════════════════════════════════════════════════════════════════
//  Módulo SLIR — patologias e inventário com foto legendada
// ════════════════════════════════════════════════════════════════
(function () {
  const TIPOS_PADRAO = ['Trinca longitudinal', 'Trinca transversal', 'Trinca em malha (couro de jacaré)',
    'Afundamento', 'Ondulação (corrugação)', 'Panela / Buraco', 'Desgaste superficial',
    'Remendo', 'Exsudação', 'Desnível entre faixas', 'Acostamento danificado', 'Sinalização ausente',
    'Drenagem comprometida', 'Obstáculo na pista', 'Outro'];
  const BORDOS = { E: '◀ Bordo esquerdo', D: '▶ Bordo direito', CC: '⬛ Canteiro central' };
  let frozen = null, editId = null, bordo = '', fotos = [];

  const tipos = () => Store.readJSON('Config/slir_tipos.json', null) || TIPOS_PADRAO;
  function dimsTxt(d) {
    const a = [];
    if (d.w) a.push('L ' + nf(d.w, 2) + ' m'); if (d.l) a.push('C ' + nf(d.l, 2) + ' m'); if (d.h) a.push('E ' + nf(d.h, 1) + ' cm');
    return a.join(' · ');
  }

  const M = {
    id: 'slir', nome: 'SLIR', sub: 'Patologias e inventário com foto legendada', icone: '🛣️', prefixo: 'P',
    titulo: (ev) => ev.rotulo || '(sem tipo)',
    descricao: (ev) => [ev.dados && ev.dados.bordo ? BORDOS[ev.dados.bordo].slice(2) : '', ev.dados ? dimsTxt(ev.dados) : ''].filter(Boolean).join(' · '),
    painel: () => `<div class="btn-row">
        <button class="btn btn-reg" onclick="SLIR.registrar()"><span class="ico">📍</span>Registrar ponto</button>
        <button class="btn btn-exp-main" onclick="Export.open()"><span class="ico">📤</span>Exportar</button>
        <button class="btn btn-fin" onclick="Core.askEnd()"><span class="ico">🏁</span>Encerrar</button></div>`,
    editar(id) {
      const s = Core.S(); const ev = s.eventos.find(e => e.id === id); if (!ev) return;
      editId = id; frozen = ev; bordo = (ev.dados || {}).bordo || ''; fotos = (ev.fotos || []).slice();
      form('✏️ Editar ' + Core.codigo(s, ev), ev);
    },
    relatorio(s, ctx) {
      // resumo por tipo + tabela com fotos
      const cont = {}; s.eventos.forEach(e => { cont[e.rotulo] = (cont[e.rotulo] || 0) + 1; });
      const res = Object.keys(cont).sort().map(k => `<tr><td>${esc(k)}</td><td class="c">${cont[k]}</td></tr>`).join('');
      return `<h2>Resumo por tipo</h2><table><thead><tr><th>Tipo</th><th class="c">Qtd.</th></tr></thead><tbody>${res || '<tr><td colspan="2" class="c">—</td></tr>'}</tbody></table>
        <h2>Registros</h2>${ctx.tabelaPadrao()}`;
    },
  };

  function form(title, ev) {
    const s = Core.S(); const t = tipos(); const d = (ev && ev.dados) || {};
    const atual = ev ? ev.rotulo : (localStorage.getItem('slir_ultimo_tipo') || t[0]);
    UI.modal(title, `
      <div class="field"><label>Posição (travada no toque)</label><div class="preview-fmt">${esc(posTxt(s, frozen) + ' · ' + fmtCoord(frozen.lat, frozen.lon))}</div></div>
      <div class="field"><label>Tipo</label><select class="inp" id="sl-tipo" onchange="SLIR.tipoChange()">
        ${t.map(x => `<option ${x === atual ? 'selected' : ''}>${esc(x)}</option>`).join('')}
        ${t.includes(atual) ? '' : `<option selected>${esc(atual)}</option>`}</select>
        <input class="inp" id="sl-outro" style="margin-top:6px;display:none" placeholder="Descreva o tipo"></div>
      <div class="field"><label>Bordo</label><div class="chips">${Object.keys(BORDOS).map(k => `<button class="chip" id="sl-b-${k}" onclick="SLIR.bordo('${k}')">${BORDOS[k]}</button>`).join('')}</div></div>
      <div class="fgrid">
        <div class="field"><label>Largura (m)</label><input class="inp" id="sl-w" inputmode="decimal" value="${d.w ? nf(d.w, 2) : ''}"></div>
        <div class="field"><label>Compr. (m)</label><input class="inp" id="sl-l" inputmode="decimal" value="${d.l ? nf(d.l, 2) : ''}"></div>
        <div class="field"><label>Espessura / altura (cm)</label><input class="inp" id="sl-h" inputmode="decimal" value="${d.h ? nf(d.h, 1) : ''}"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Observação</label><textarea class="inp" id="sl-obs" rows="2">${esc(ev ? ev.obs : '')}</textarea></div>
      <div class="field"><button class="btn-cam" id="sl-cam" onclick="SLIR.foto()">📷 Tirar foto</button><div id="sl-fotos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div></div>
      <button class="btn-full" onclick="SLIR.salvar()">✓ Salvar ponto</button>`);
    SLIR.bordo(bordo, true); SLIR.tipoChange(); renderFotos();
  }
  function renderFotos() {
    const s = Core.S(); const el = $('sl-fotos'); if (!el) return;
    el.innerHTML = fotos.map(f => `<img class="photo-thumb" src="${Photo.src(s, f)}">`).join('');
    $('sl-cam').className = 'btn-cam' + (fotos.length ? ' has' : '');
    $('sl-cam').textContent = fotos.length ? '📷 Mais uma foto (' + fotos.length + ')' : '📷 Tirar foto';
  }
  function dadosForm() {
    const w = num('sl-w'), l = num('sl-l'), h = num('sl-h');
    return { bordo, w: isNaN(w) ? null : w, l: isNaN(l) ? null : l, h: isNaN(h) ? null : h };
  }
  function tipoAtual() { const t = val('sl-tipo'); return t === 'Outro' && val('sl-outro').trim() ? val('sl-outro').trim() : t; }

  window.SLIR = {
    registrar() {
      const s = Core.S(); if (!s) return;
      frozen = Core.pos(s); editId = null; bordo = ''; fotos = [];
      form('📍 Registrar ponto', null);
    },
    bordo(k, keep) {
      if (!keep) bordo = bordo === k ? '' : k;
      Object.keys(BORDOS).forEach(x => { const b = $('sl-b-' + x); if (b) b.className = 'chip' + (bordo === x ? ' sel' : ''); });
    },
    tipoChange() { const o = $('sl-outro'); if (o) o.style.display = val('sl-tipo') === 'Outro' ? 'block' : 'none'; },
    async foto() {
      const s = Core.S(); if (!s) return;
      const evRef = editId ? s.eventos.find(e => e.id === editId) : Object.assign({}, frozen, { seq: (s.seq || 0) + 1, fotos });
      evRef.fotos = fotos;
      const d = dadosForm();
      const extras = [d.bordo ? BORDOS[d.bordo].slice(2) : '', dimsTxt(d), val('sl-obs').trim()];
      const name = await Photo.capture(s, evRef, Photo.linhasPadrao(s, frozen, tipoAtual(), extras));
      if (name) { fotos.push(name); renderFotos(); }
    },
    salvar() {
      const s = Core.S(); if (!s) return;
      const rotulo = tipoAtual(); const obs = val('sl-obs').trim(); const dados = dadosForm();
      localStorage.setItem('slir_ultimo_tipo', val('sl-tipo'));
      if (editId) {
        const ev = s.eventos.find(e => e.id === editId); Object.assign(ev, { rotulo, obs, dados, fotos: fotos.slice() }); Core.updateEvent(ev);
      } else {
        const ev = Core.addEvent({ grupo: 'ponto', cod: 'SLIR', rotulo, obs, dados, fotos: fotos.slice() }, frozen);
        toast('📍 ' + Core.codigo(s, ev) + ' · ' + rotulo);
      }
      editId = null; fotos = []; UI.closeModal();
    },
  };
  Modules.register(M);
})();
