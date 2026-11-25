// ════════════════════════════════════════════════════════════════
//  Módulo MARCO ZERO — navegação e locação de obra (km e estacas)
//  O odômetro, os parciais e o "ir até" são do núcleo; aqui fica só
//  o ponto simples com descrição e observação.
// ════════════════════════════════════════════════════════════════
(function () {
  let frozen = null, editId = null;

  const M = {
    id: 'marcozero', nome: 'Marco Zero', sub: 'Navegação e locação de obra em km e estacas', icone: '🚩', prefixo: 'P',
    titulo: (ev) => ev.rotulo || '(sem descrição)',
    painel: () => `<div class="btn-row">
        <button class="btn btn-reg" onclick="MZ.marcar()"><span class="ico">📍</span>Marcar ponto</button>
        <button class="btn btn-exp-main" onclick="Export.open()"><span class="ico">📤</span>Exportar</button>
        <button class="btn btn-fin" onclick="Core.askEnd()"><span class="ico">🏁</span>Encerrar</button></div>`,
    editar(id) {
      const s = Core.S(); const ev = s.eventos.find(e => e.id === id); if (!ev) return;
      editId = id; form('✏️ Editar ' + Core.codigo(s, ev), ev, ev);
    },
  };
  function linha(s, p, seq) {
    return ['P' + pad(seq, 3), posTxt(s, p), p.lat != null ? p.lat.toFixed(6) + ', ' + p.lon.toFixed(6) : 'sem GPS'].filter(Boolean).join(' - ');
  }
  function form(title, p, ev) {
    const s = Core.S();
    UI.modal(title, `
      <div class="field"><label>Registro</label><div class="preview-fmt">${esc(linha(s, p, ev ? ev.seq : (s.seq || 0) + 1))}</div></div>
      <div class="field"><label>Descrição</label><input class="inp" id="mz-desc" value="${esc(ev ? ev.rotulo : '')}" placeholder="ex.: Bueiro existente, início do aterro..."></div>
      <div class="field"><label>Observação</label><textarea class="inp" id="mz-obs" rows="2" placeholder="Detalhes adicionais...">${esc(ev ? ev.obs : '')}</textarea></div>
      <button class="btn-full" onclick="MZ.salvar()">✓ Salvar ponto</button>`);
    if (!ev) setTimeout(() => $('mz-desc') && $('mz-desc').focus(), 150);
  }
  window.MZ = {
    marcar() {
      const s = Core.S(); if (!s) return;
      frozen = Core.pos(s); editId = null;          // posição travada no toque
      form('📍 Marcar ponto', frozen, null);
    },
    salvar() {
      const s = Core.S(); if (!s) return;
      const rotulo = val('mz-desc').trim(), obs = val('mz-obs').trim();
      if (editId) { const ev = s.eventos.find(e => e.id === editId); ev.rotulo = rotulo; ev.obs = obs; Core.updateEvent(ev); }
      else { const ev = Core.addEvent({ grupo: 'ponto', cod: 'PT', rotulo, obs }, frozen); toast('📍 ' + Core.codigo(s, ev) + ' salvo'); }
      editId = null; UI.closeModal();
    },
  };
  Modules.register(M);
})();
