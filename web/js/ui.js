// ════════════════════════════════════════════════════════════════
//  DVA Roads — interface: tela inicial, sessão, modais, configurações
// ════════════════════════════════════════════════════════════════
const UI = (function () {
  let filtro = '';
  const collState = JSON.parse(localStorage.getItem('dvaroads_coll') || '{"goto":true}');

  // ── modais ──────────────────────────────────────────────────
  function modal(title, body) { $('mg-title').innerHTML = title; $('mg-body').innerHTML = body; $('modal-gen').classList.remove('hidden'); }
  function closeModal() { $('modal-gen').classList.add('hidden'); $('mg-body').innerHTML = ''; }
  function confirm(t, d, fn, okTxt) {
    $('conf-title').textContent = t; $('conf-desc').innerHTML = d; $('conf-ok').textContent = okTxt || 'Confirmar';
    $('conf-ok').onclick = () => { closeConfirm(); fn(); }; $('modal-conf').classList.remove('hidden');
  }
  function closeConfirm() { $('modal-conf').classList.add('hidden'); }
  function alert(t, d) {
    $('conf-title').textContent = t; $('conf-desc').innerHTML = d; $('conf-ok').textContent = 'OK';
    $('conf-ok').onclick = closeConfirm; $('modal-conf').classList.remove('hidden');
  }

  function coll(id, title, inner, extra) {
    const closed = collState[id] ? ' closed' : '';
    return `<div class="card coll${closed}" id="coll-${id}"><div class="card-label" onclick="UI.toggleColl('${id}')"><span><span class="arr">›</span> ${title}</span>${extra || ''}</div>${inner}</div>`;
  }
  function toggleColl(id) {
    collState[id] = !collState[id]; localStorage.setItem('dvaroads_coll', JSON.stringify(collState));
    const el = $('coll-' + id); if (el) el.classList.toggle('closed', !!collState[id]);
  }

  // ── tela ────────────────────────────────────────────────────
  function render() {
    const s = Core.S(); const area = $('area');
    $('hdr-sub').textContent = s ? s.nome : 'Obras · Conserva · Levantamentos';
    area.innerHTML = s ? sessaoHTML(s) : inicioHTML();
    if (s) { const m = Core.M(s); if (m && m.montar) m.montar(s); renderParciais(); renderEvents(); Core.setGotoTipo('est'); }
    Core.updateOdo();
  }
  function inicioHTML() {
    const tiles = Modules.list().map(m => {
      const ok = License.ok(m.id);
      return `<button class="mod-tile ${ok ? '' : 'locked'}" onclick="Core.openNew('${m.id}')">
        ${ok ? '' : '<span class="lk">🔒</span>'}<span class="mi">${m.icone}</span><span class="mn">${esc(m.nome)}</span><span class="ms">${esc(m.sub)}</span></button>`;
    }).join('');
    const idx = Core.index().filter(x => !filtro || x.modulo === filtro).slice().reverse();
    const opts = '<option value="">Todos os módulos</option>' + Modules.list().map(m => `<option value="${m.id}" ${filtro === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
    const hist = idx.length ? idx.map(x => {
      const m = Modules.get(x.modulo);
      return `<div class="hist-item"><div class="i">
        <div class="t">${esc(x.nome)}</div>
        <div class="s">${m ? m.icone + ' ' + esc(m.nome) + ' · ' : ''}${esc(x.rodovia || '')}${x.rodovia ? ' · ' : ''}${fmtDT(x.ini)} · ${nf(x.dist / 1000, 3)} km · ${x.nev} reg.${x.backup ? ' · 💾' : ''}</div></div>
        <button class="btn-sm n" onclick="Export.open('${esc(x.pasta)}')">📤</button>
        <button class="btn-sm g" onclick="Core.reopen('${esc(x.pasta)}')">▶</button>
        <button class="btn-sm r" onclick="Core.askDelete('${esc(x.pasta)}')">🗑</button></div>`;
    }).join('') : '<div class="empty-pts" style="padding:10px">Nenhuma sessão gravada.</div>';
    return `<div class="card"><div class="card-label">Abrir nova sessão</div><div class="mod-grid">${tiles}</div></div>
      <div class="card"><div class="card-label">Sessões gravadas <select class="inp" style="width:auto;padding:4px 8px;font-size:12px" onchange="UI.setFiltro(this.value)">${opts}</select></div>${hist}</div>`;
  }
  function sessaoHTML(s) {
    const m = Core.M(s);
    return `<div class="card"><div class="sec-row"><div class="sec-info">
        <span class="tag-mod">${m ? m.icone + ' ' + esc(m.nome) : ''}</span>
        <h3>${esc(s.nome)}</h3>
        <p>${esc((s.rodovia ? s.rodovia + ' · ' : '') + Core.marcoTxt(s))}<br>${s.dir === 'C' ? '▲ Crescente' : '▼ Decrescente'} · ${modoTxt(s.modo)} · aberta em ${fmtDT(s.ini)}</p>
        <div class="rec"><i></i><span id="sec-rec-txt">Gravando trajeto</span></div></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn-sm r" onclick="Core.askEnd()">🏁 Encerrar</button>
          <button class="btn-sm n" onclick="Export.open()">📤 Exportar</button></div></div></div>
      <div id="mod-panel">${m && m.painel ? m.painel(s) : ''}</div>
      ${coll('parc', 'Odômetros parciais', '<div class="parc-grid" id="parc-grid"></div>', '<button class="lnk" onclick="event.stopPropagation();Core.addParcial()">+ Parcial</button>')}
      <div class="card hide-on-tablet"><div class="card-label">Registros da sessão</div><div class="pts-list" id="ev-list"></div></div>
      ${coll('goto', 'Ir até / Converter', `<div class="seg"><button id="gt-km" onclick="Core.setGotoTipo('km')">KM</button><button id="gt-est" onclick="Core.setGotoTipo('est')">Estaca</button></div>
        <div id="gt-in-km"><input class="inp" id="gt-km-v" inputmode="decimal" placeholder="km  ex.: 1,250" oninput="Core.calcGoto()"></div>
        <div id="gt-in-est" class="est-in"><input class="inp" id="gt-est-n" inputmode="numeric" placeholder="estaca  ex.: 92" oninput="Core.calcGoto()"><span class="plus">+</span><input class="inp" id="gt-est-m" inputmode="decimal" placeholder="metros" oninput="Core.calcGoto()"></div>
        <div class="goto-res" id="goto-res"></div>`)}`;
  }
  function setFiltro(v) { filtro = v; render(); }
  function renderParciais() {
    const s = Core.S(); const g = $('parc-grid'); if (!s || !g) return;
    const box = (name, d, cls, btns, idx) => `<div class="parc ${cls}">
        <div class="parc-name" ${idx != null ? `onclick="Core.renParcial(${idx})"` : ''}>${esc(name)}</div>
        <div class="parc-btns">${btns}</div>
        <div class="parc-km">${nf(d / 1000, 3)} <small>km</small></div>
        <div class="parc-est">${fmtEst(d, s)} est · ${nf(d, 1)} m</div></div>`;
    let h = box('Total da sessão', s.dist, 'tot', '', null);
    s.parciais.forEach((p, i) => {
      h += box(p.nome, Math.max(0, s.dist - p.base), '', `<button class="pb-zero" onclick="Core.zeroParcial(${i})" title="Zerar">↺</button><button class="pb-del" onclick="Core.delParcial(${i})" title="Remover">✕</button>`, i);
    });
    g.innerHTML = h;
  }
  function renderEvents() {
    const s = Core.S(); if (!s) return; const m = Core.M(s);
    const html = !s.eventos.length ? '<div class="empty-pts">Nenhum registro nesta sessão.</div>'
      : s.eventos.slice().reverse().slice(0, 200).map(ev => {
        const foto = (ev.fotos || [])[0];
        return `<div class="pt-item">
          <div class="ev-ico">${Core.codigo(s, ev)}</div>
          <div class="pt-info">
            <div class="pt-desc">${m && m.iconeEvento ? m.iconeEvento(ev) + ' ' : ''}${esc(m && m.titulo ? m.titulo(ev) : ev.rotulo)}</div>
            <div class="pt-line">${esc(posTxt(s, ev))}</div>
            ${m && m.descricao && m.descricao(ev, s) ? `<div class="pt-obs" style="font-style:normal">${esc(m.descricao(ev, s))}</div>` : ''}
            ${ev.obs ? `<div class="pt-obs">${esc(ev.obs)}</div>` : ''}
            <div class="pt-coords">${fmtCoord(ev.lat, ev.lon)} · ${fmtH(ev.t)}</div>
          </div>
          ${foto ? `<img class="photo-thumb" src="${Photo.src(s, foto)}" alt="">` : ''}
          ${m && m.editar ? `<button class="pt-edit" onclick="Modules.get('${m.id}').editar('${ev.id}')">✏️</button>` : ''}
          <button class="pt-del" onclick="UI.askDelEvent('${ev.id}')">🗑</button></div>`;
      }).join('');
    if ($('ev-list')) $('ev-list').innerHTML = html;
    $('ev-list-tablet').innerHTML = html;
    if (m && m.atualizar) m.atualizar(s);
  }
  function askDelEvent(id) {
    const s = Core.S(); const ev = s && s.eventos.find(e => e.id === id); if (!ev) return;
    const m = Core.M(s);
    confirm('Remover registro?', Core.codigo(s, ev) + ' · ' + esc(m && m.titulo ? m.titulo(ev) : ev.rotulo), () => { Core.removeEvent(id); toast('Registro removido'); }, '🗑️ Remover');
  }
  function onOdo() {
    const s = Core.S(); const r = $('sec-rec-txt');
    if (s && r) r.textContent = 'Gravando trajeto · ' + s.track.length + ' coords';
    if (s) { const m = Core.M(s); if (m && m.onOdo) m.onOdo(s); }
  }

  // ── configurações ───────────────────────────────────────────
  function openSettings() {
    $('set-unidade').value = settings.unidade; $('set-est').value = nf(settings.est, 2).replace(',00', '');
    $('set-kmfmt').value = settings.kmfmt; $('set-spd').value = settings.spd; $('set-coord').value = settings.coord;
    $('set-acc').value = String(settings.acc); $('set-path').textContent = Store.base() + '/Sessoes';
    renderLicencas();
    $('settings-panel').classList.add('open');
  }
  function closeSettings() { $('settings-panel').classList.remove('open'); }
  function saveSettings() {
    const e = parseNum(val('set-est'));
    settings.unidade = val('set-unidade'); settings.est = e > 0 ? e : 20; settings.kmfmt = val('set-kmfmt');
    settings.spd = val('set-spd'); settings.coord = val('set-coord'); settings.acc = parseInt(val('set-acc')) || 40;
    saveSettingsLS(); render();
  }
  function renderLicencas() {
    $('lic-list').innerHTML = Modules.list().map(m => {
      const i = License.info(m.id); const ok = License.ok(m.id);
      const det = i ? (i.admin ? 'administrador' : esc(i.cliente || '')) + (i.validade && i.validade < '2099' ? ' · até ' + i.validade.split('-').reverse().join('/') : '') : 'sem chave';
      return `<div class="lic-row"><span>${m.icone}</span><span class="n">${esc(m.nome)}<br><small style="font-weight:400;color:var(--sub)">${det}</small></span>${ok ? '<span class="ok-tag">liberado</span>' : '<span class="no-tag">bloqueado</span>'}</div>`;
    }).join('');
  }
  function toggleAcc(id) { $(id).classList.toggle('open'); }
  function version() { return GPS.isNative() && window.NativeGPS.getVersion ? window.NativeGPS.getVersion() : '1.0-prévia'; }

  // botão Voltar do Android: fecha o que estiver aberto
  window.odometroBack = function () {
    if ($('about-full').classList.contains('open')) { $('about-full').classList.remove('open'); return true; }
    if (!$('modal-conf').classList.contains('hidden')) { closeConfirm(); return true; }
    if (!$('modal-gen').classList.contains('hidden')) { closeModal(); return true; }
    if ($('settings-panel').classList.contains('open')) { closeSettings(); return true; }
    return false;
  };
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); }));

  return {
    modal, closeModal, confirm, closeConfirm, alert, render, setFiltro, renderParciais, renderEvents, askDelEvent, onOdo,
    openSettings, closeSettings, saveSettings, renderLicencas, toggleAcc, toggleColl, version,
    openAboutFull() { $('about-full').classList.add('open'); }, closeAboutFull() { $('about-full').classList.remove('open'); },
    fallbackLogo() { $('logo-container').innerHTML = '<div class="logo-fallback">DVA</div>'; },
  };
})();
