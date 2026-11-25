// ════════════════════════════════════════════════════════════════
//  DVA Roads — núcleo: módulos, sessões, odômetro, registros, backup
// ════════════════════════════════════════════════════════════════

// ── Registro de módulos ───────────────────────────────────────
//  Cada módulo traz só o que é dele: campos de abertura, painel de
//  ações, como descrever um registro e o que entra no relatório/KML.
const Modules = (function () {
  const list = [];
  return {
    register(m) { list.push(m); },
    list() { return list.slice(); },
    get(id) { return list.find(m => m.id === id) || null; },
  };
})();

const Core = (function () {
  const ATIVA_KEY = 'dvaroads_ativa';
  const SPD_MAX = 150;                 // km/h — descarta saltos do GPS
  let index = [];                      // resumo de todas as sessões
  let ativa = null;                    // sessão aberta (objeto completo)
  let lastLat = null, lastLon = null, lastTime = null;
  let dirty = false, trackDirty = false;
  let nsState = { modo: null, dir: 'C' };

  const S = () => ativa;
  const M = (s) => Modules.get((s || ativa || {}).modulo);
  const dirOf = (s) => 'Sessoes/' + s.pasta;

  // ── posição no eixo ─────────────────────────────────────────
  //  off = deslocamento (m) desde o marco zero, com sinal pelo sentido
  //  km(m) = k0 + off      estaca(m) = s0 + off
  function off(s) { s = s || ativa; if (!s) return 0; return s.baseOff + (s.dir === 'C' ? 1 : -1) * (s.dist - s.baseDist); }
  function posValues(s, o) {
    return { km: s.modo !== 'est' ? s.k0 + o : null, est: s.modo !== 'km' ? s.s0 + o : null };
  }
  /** Posição travada agora (usada no toque de qualquer botão de registro) */
  function pos(s) {
    s = s || ativa; const o = off(s); const v = posValues(s, o);
    return { off: Math.round(o * 100) / 100, km: v.km, est: v.est, d: Math.round(s.dist * 10) / 10,
      lat: GPS.st.lat, lon: GPS.st.lon, t: Date.now(), dir: s.dir };
  }
  function marcoTxt(s) {
    if (s.modo === 'km') return 'Marco zero: km ' + fmtKm(s.k0);
    if (s.modo === 'est') return 'Marco zero: Est ' + fmtEst(s.s0, s);
    return 'Marco zero: Est ' + fmtEst(s.s0, s) + ' = km ' + fmtKm(s.k0);
  }
  function codigo(s, ev) { const m = M(s); return (m && m.prefixo ? m.prefixo : 'R') + pad(ev.seq, 3); }

  // ── persistência ────────────────────────────────────────────
  function resumo(s) {
    return { id: s.id, pasta: s.pasta, modulo: s.modulo, nome: s.nome, rodovia: s.rodovia || '', ini: s.ini, fim: s.fim,
      dist: Math.round(s.dist), nev: s.eventos.length, modo: s.modo };
  }
  function saveIndex() { Store.writeJSON('Sessoes/index.json', index); }
  function upsertIndex(s) {
    const r = resumo(s); const i = index.findIndex(x => x.pasta === s.pasta);
    if (i >= 0) index[i] = r; else index.push(r);
    saveIndex();
  }
  function persist(s, withTrack) {
    s = s || ativa; if (!s) return;
    const copy = Object.assign({}, s); delete copy.track;
    Store.writeJSON(dirOf(s) + '/sessao.json', copy);
    if (withTrack !== false) Store.writeJSON(dirOf(s) + '/trajeto.json', s.track || []);
    upsertIndex(s); dirty = false; trackDirty = false;
  }
  function touch(track) { dirty = true; if (track) trackDirty = true; }
  // grava a cada 10 s enquanto houver mudança (e ao sair do app)
  setInterval(() => { if (ativa && (dirty || trackDirty)) persist(ativa, trackDirty); }, 10000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && ativa) persist(ativa, true); });

  function loadSession(pasta) {
    const s = Store.readJSON('Sessoes/' + pasta + '/sessao.json', null);
    if (!s) return null;
    s.track = Store.readJSON('Sessoes/' + pasta + '/trajeto.json', []);
    s.eventos = s.eventos || []; s.parciais = s.parciais || []; s.params = s.params || {};
    return s;
  }
  function rebuildIndex() {
    // reconstrói o índice lendo as pastas (usado se o index.json se perder)
    index = Store.list('Sessoes').filter(e => e.dir).map(e => {
      const s = Store.readJSON('Sessoes/' + e.name + '/sessao.json', null); return s ? resumo(Object.assign({ eventos: [] }, s)) : null;
    }).filter(Boolean);
    saveIndex();
  }

  // ── GPS → distância ─────────────────────────────────────────
  function onFix(lat, lon, now) {
    const s = ativa;
    if (lastLat !== null && lastTime !== null) {
      const dkm = haversine(lastLat, lastLon, lat, lon);
      const dt = (now - lastTime) / 3600000; const spd = dt > 0 ? dkm / dt : 0;
      if (spd > SPD_MAX) { lastLat = lat; lastLon = lon; lastTime = now; return; }
      if (dkm > 0.003) {           // 3 m; parado não move a âncora → trechos curtos se somam
        GPS.st.spd = spd;
        if (s && !s.pausada) {
          s.dist += dkm * 1000;
          s.track.push([+lat.toFixed(7), +lon.toFixed(7), Math.round(off(s) * 10) / 10, Math.round(s.dist)]);
          touch(true);
        }
        lastLat = lat; lastLon = lon; lastTime = now;
      }
      updateOdo(); return;
    }
    lastLat = lat; lastLon = lon; lastTime = now;
    if (s && !s.track.length) { s.track.push([+lat.toFixed(7), +lon.toFixed(7), Math.round(off(s) * 10) / 10, Math.round(s.dist)]); touch(true); }
    updateOdo();
  }

  // ── odômetro (tela) ─────────────────────────────────────────
  function bigHTML(kind, m, s) {
    if (kind === 'km') {
      if (settings.kmfmt === 'plus') {
        const f = fmtKm(m); const i = f.indexOf('+');
        return '<span class="odo-val">' + f.substring(0, i) + '<span class="odo-plus">+' + f.substring(i + 1) + '</span></span><span class="odo-unit">km</span>';
      }
      const f = fmtKm(m); const i = f.indexOf(',');
      return '<span class="odo-val">' + f.substring(0, i) + '<span class="odo-dec">' + f.substring(i) + '</span></span><span class="odo-unit">km</span>';
    }
    const p = estParts(m, s);
    return '<span class="odo-val"><span class="odo-pre">Est</span>' + (p.neg ? '-' : '') + p.n + '<span class="odo-plus"> + ' + nf(p.r, 2) + '</span></span>';
  }
  function updateOdo() {
    const s = ativa;
    $('odo-open').style.display = s ? 'block' : 'none';
    $('odo-closed').style.display = s ? 'none' : 'block';
    const pill = $('pill-dir');
    $('b-spd').textContent = settings.spd === 'ms' ? nf(GPS.st.spd / 3.6, 1) : Math.round(GPS.st.spd);
    $('b-spd-unit').textContent = settings.spd === 'ms' ? 'm/s' : 'km/h';
    if (GPS.st.lat !== null) $('odo-latlon').textContent = fmtCoord(GPS.st.lat, GPS.st.lon);
    if (!s) { pill.style.visibility = 'hidden'; $('b-dist').textContent = '0,000'; $('b-pts').textContent = '0'; UI.onOdo(); return; }
    pill.style.visibility = 'visible';
    if (s.dir === 'C') { pill.textContent = '▲ Crescente'; pill.className = 'pill pill-dir cresc'; }
    else { pill.textContent = '▼ Decrescente'; pill.className = 'pill pill-dir decresc'; }
    ['km', 'est', 'cor'].forEach(m => $('mode-' + m).className = 'mode-chip' + (s.modo === m ? ' sel' : ''));
    const o = off(s); const main = $('odo-main'), sec = $('odo-second');
    if (s.modo === 'km') { main.innerHTML = bigHTML('km', s.k0 + o, s); sec.style.display = 'none'; }
    else if (s.modo === 'est') { main.innerHTML = bigHTML('est', s.s0 + o, s); sec.style.display = 'none'; }
    else {
      const prim = s.prim || 'est';
      main.innerHTML = bigHTML(prim, prim === 'km' ? s.k0 + o : s.s0 + o, s);
      sec.style.display = 'block';
      sec.innerHTML = prim === 'km'
        ? '<span class="l">Estaca</span><span class="v">' + fmtEst(s.s0 + o, s) + '</span> <span class="l">⇅</span>'
        : '<span class="l">km</span><span class="v">' + fmtKm(s.k0 + o) + '</span> <span class="l">⇅</span>';
    }
    $('b-dist').textContent = nf(s.dist / 1000, 3);
    $('b-pts').textContent = s.eventos.length;
    UI.onOdo();
  }

  // ── abrir sessão ────────────────────────────────────────────
  function openNew(modId) {
    const m = Modules.get(modId); if (!m) return;
    if (!License.ok(modId)) { UI.alert('Módulo não liberado', 'O módulo ' + m.nome + ' precisa de uma chave de ativação. Abra Configurações › Licenças dos módulos.'); return; }
    if (ativa) { UI.alert('Já existe uma sessão aberta', 'Encerre a sessão “' + ativa.nome + '” antes de abrir outra.'); return; }
    nsState = { modo: settings.unidade || 'cor', dir: 'C' };
    const n = index.filter(x => x.modulo === modId).length + 1;
    const last = Store.readJSON('Config/ultima_' + modId + '.json', {}) || {};
    UI.modal('🚩 Nova sessão · ' + m.nome, `
      <div class="field"><label>Nome da sessão / trecho</label><input class="inp" id="ns-nome" value="${esc(m.nome + ' ' + pad(n, 2))}"></div>
      <div class="field"><label>Rodovia</label><input class="inp" id="ns-rod" value="${esc(last.rodovia || '')}" placeholder="ex.: SP-330" style="text-transform:uppercase"></div>
      <div class="field"><label>Trabalhar em</label><div class="chips">
        <button class="chip" id="ns-m-km" onclick="Core.nsModo('km')">Km</button>
        <button class="chip" id="ns-m-est" onclick="Core.nsModo('est')">Estaca</button>
        <button class="chip" id="ns-m-cor" onclick="Core.nsModo('cor')">Km + Estaca</button></div></div>
      <div class="field"><label>Sentido</label><div class="chips">
        <button class="chip" id="ns-d-C" onclick="Core.nsDir('C')">▲ Crescente</button>
        <button class="chip" id="ns-d-D" onclick="Core.nsDir('D')">▼ Decrescente</button></div></div>
      <div class="field" id="ns-f-km"><label>Km inicial (marco zero)</label><input class="inp big" id="ns-km" inputmode="decimal" placeholder="0,000"></div>
      <div class="field" id="ns-f-est"><label id="ns-est-lbl">Estaca inicial</label>
        <div class="est-in"><input class="inp big" id="ns-est-n" inputmode="numeric" placeholder="0"><span class="plus">+</span><input class="inp big" id="ns-est-m" inputmode="decimal" placeholder="0,00"></div></div>
      <div class="help" id="ns-help"></div>
      ${m.camposAbertura ? m.camposAbertura(last) : ''}
      <button class="btn-full" style="margin-top:16px" onclick="Core.startSession('${modId}')">▶ Abrir sessão e zerar aqui</button>`);
    nsModoF(nsState.modo); nsDirF('C');
  }
  function nsModoF(m) {
    nsState.modo = m;
    ['km', 'est', 'cor'].forEach(x => $('ns-m-' + x).className = 'chip' + (x === m ? ' sel' : ''));
    $('ns-f-km').style.display = m === 'est' ? 'none' : 'block';
    $('ns-f-est').style.display = m === 'km' ? 'none' : 'block';
    $('ns-est-lbl').textContent = m === 'cor' ? 'Equivale à estaca' : 'Estaca inicial (marco zero)';
    $('ns-help').innerHTML = m === 'cor'
      ? 'Correlação no ponto onde você está agora. Ex.: <b>km 0,000 = Est 92 + 0,00</b>. Daqui em diante km e estaca andam juntos.'
      : m === 'est' ? 'Estaca de ' + nf(estSize(), 0) + ' m. Ex.: Est 6 + 15,00 = 135 m do início do estaqueamento.' : 'Ex.: 340,000 para começar no km 340.';
  }
  function nsDirF(d) {
    nsState.dir = d;
    $('ns-d-C').className = 'chip' + (d === 'C' ? ' sel' : '');
    $('ns-d-D').className = 'chip' + (d === 'D' ? ' sel dec' : '');
  }
  function readKm(id) { const v = num(id); return isNaN(v) ? NaN : v * 1000; }
  function readEst(nId, mId) {
    const n = num(nId), m = num(mId);
    if (isNaN(n) && isNaN(m)) return NaN; return (isNaN(n) ? 0 : n) * estSize() + (isNaN(m) ? 0 : m);
  }
  function startSession(modId) {
    const m = Modules.get(modId);
    let params = {};
    try { params = m.lerAbertura ? m.lerAbertura() : {}; } catch (e) { UI.alert('Confira os dados', e.message); return; }
    const k = readKm('ns-km'), e = readEst('ns-est-n', 'ns-est-m');
    const ini = Date.now(); const d = new Date(ini);
    const nome = val('ns-nome').trim() || m.nome;
    const rodovia = val('ns-rod').trim().toUpperCase();
    const s = {
      schema: APP.schema, id: uid(), modulo: modId, nome, rodovia,
      pasta: stamp(ini) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '_' + m.id.toUpperCase() + '_' + slug(nome),
      modo: nsState.modo, prim: 'est', dir: nsState.dir, k0: isNaN(k) ? 0 : k, s0: isNaN(e) ? 0 : e, estSize: estSize(),
      ini, fim: null, dist: 0, baseDist: 0, baseOff: 0, seq: 0,
      parciais: [{ nome: 'Parcial 1', base: 0 }, { nome: 'Parcial 2', base: 0 }],
      params, eventos: [], track: [],
      app: { versao: UI.version(), aparelho: navigator.userAgent.slice(0, 120) },
    };
    if (GPS.st.lat != null && GPS.st.acc <= settings.acc) s.track.push([+GPS.st.lat.toFixed(7), +GPS.st.lon.toFixed(7), 0, 0]);
    lastLat = GPS.st.lat; lastLon = GPS.st.lon; lastTime = Date.now(); // marco zero = posição atual
    Store.writeJSON('Config/ultima_' + modId + '.json', Object.assign({ rodovia }, params));
    ativa = s; localStorage.setItem(ATIVA_KEY, s.pasta);
    persist(s, true);
    UI.closeModal(); UI.render();
    if (m.aoAbrir) m.aoAbrir(s);
  }
  function askEnd() {
    if (!ativa) return;
    UI.modal('🏁 Encerrar sessão', `
      <p class="help" style="font-size:13px;margin-bottom:12px">A gravação do trajeto para e a sessão fica salva na pasta do celular. Você pode exportar, fazer backup ou retomar depois.</p>
      <button class="btn-full" onclick="Core.endSession()">🏁 Encerrar sessão</button>
      <button class="btn-full gray" style="margin-top:8px" onclick="UI.closeModal()">Continuar medindo</button>`);
  }
  function endSession() {
    const s = ativa; if (!s) return;
    const m = M(s); if (m && m.aoEncerrar) m.aoEncerrar(s);
    s.fim = Date.now(); s.offFim = off(s);
    persist(s, true); ativa = null; localStorage.removeItem(ATIVA_KEY);
    UI.closeModal(); UI.render();
    toast('Sessão encerrada e salva');
  }
  function reopen(pasta) {
    if (ativa) { UI.alert('Já existe uma sessão aberta', 'Encerre a sessão “' + ativa.nome + '” antes de retomar outra.'); return; }
    const s = loadSession(pasta); if (!s) { toast('Sessão não encontrada'); return; }
    if (!License.ok(s.modulo)) { UI.alert('Módulo não liberado', 'Ative a licença do módulo para retomar esta sessão.'); return; }
    UI.confirm('Retomar sessão?', esc(s.nome) + '<br>A contagem continua de onde parou. Corrija a posição ao passar por um ponto conhecido.', () => {
      s.fim = null;
      // retoma na posição em que foi encerrada
      if (s.offFim != null) { s.baseOff = s.offFim; s.baseDist = s.dist; }
      ativa = s; localStorage.setItem(ATIVA_KEY, s.pasta);
      lastLat = GPS.st.lat; lastLon = GPS.st.lon; lastTime = Date.now();
      persist(s, false); UI.render();
    }, '▶ Retomar');
  }
  function askDelete(pasta) {
    const r = index.find(x => x.pasta === pasta); if (!r) return;
    UI.confirm('Excluir sessão?', esc(r.nome) + ' · ' + r.nev + ' registro(s).<br>A pasta da sessão, com fotos e exportações, será apagada. Faça backup antes se precisar.', () => {
      Store.remove('Sessoes/' + pasta); index = index.filter(x => x.pasta !== pasta); saveIndex(); UI.render();
    }, '🗑️ Excluir');
  }

  // ── comandos do odômetro ────────────────────────────────────
  function setModo(m) { if (!ativa) return; ativa.modo = m; touch(); updateOdo(); UI.renderEvents(); }
  function swapPrim() { if (!ativa) return; ativa.prim = (ativa.prim || 'est') === 'est' ? 'km' : 'est'; touch(); updateOdo(); }
  function toggleDir() {
    const s = ativa; if (!s) return;
    s.baseOff = off(s); s.baseDist = s.dist; s.dir = s.dir === 'C' ? 'D' : 'C'; // ancora: não salta
    touch(); updateOdo();
  }
  let corTipo = 'est';
  function openCorrigir() {
    const s = ativa; if (!s) return;
    const o = off(s); const p = estParts(s.s0 + o, s);
    UI.modal('🎯 Corrigir posição atual', `
      <p class="help" style="margin:-6px 0 12px">Use ao passar por uma estaca ou marco conhecido. A posição é ajustada e a contagem continua daqui. Parciais e trajeto não são zerados.</p>
      <div class="seg"><button id="cr-km" onclick="Core.setCorTipo('km')">KM</button><button id="cr-est" onclick="Core.setCorTipo('est')">Estaca</button></div>
      <div id="cr-in-km" class="field"><input class="inp big" id="cr-km-v" inputmode="decimal" value="${nf((s.k0 + o) / 1000, 3)}"></div>
      <div id="cr-in-est" class="field est-in"><input class="inp big" id="cr-est-n" inputmode="numeric" value="${(p.neg ? '-' : '') + p.n}"><span class="plus">+</span><input class="inp big" id="cr-est-m" inputmode="decimal" value="${nf(p.r, 2)}"></div>
      <button class="btn-full" onclick="Core.applyCorrigir()">✓ Aplicar correção</button>`);
    $('cr-km').style.display = s.modo === 'est' ? 'none' : '';
    $('cr-est').style.display = s.modo === 'km' ? 'none' : '';
    setCorTipo(s.modo === 'km' ? 'km' : (s.modo === 'est' ? 'est' : (s.prim || 'est')));
  }
  function setCorTipo(t) {
    corTipo = t;
    $('cr-km').className = t === 'km' ? 'sel' : ''; $('cr-est').className = t === 'est' ? 'sel' : '';
    $('cr-in-km').style.display = t === 'km' ? 'block' : 'none';
    $('cr-in-est').style.display = t === 'est' ? 'flex' : 'none';
  }
  function applyCorrigir() {
    const s = ativa; if (!s) return; let o;
    if (corTipo === 'km') { const k = readKm('cr-km-v'); if (isNaN(k)) return; o = k - s.k0; }
    else { const e = readEst('cr-est-n', 'cr-est-m'); if (isNaN(e)) return; o = e - s.s0; }
    s.baseOff = o; s.baseDist = s.dist;
    s.correcoes = s.correcoes || []; s.correcoes.push({ t: Date.now(), d: s.dist, off: o });
    UI.closeModal(); touch(); updateOdo();
  }

  // ── parciais ────────────────────────────────────────────────
  function addParcial() { const s = ativa; if (!s) return; if (s.parciais.length >= 8) { toast('Máximo de 8 parciais'); return; } s.parciais.push({ nome: 'Parcial ' + (s.parciais.length + 1), base: s.dist }); touch(); UI.renderParciais(); }
  function zeroParcial(i) { const s = ativa; if (!s) return; s.parciais[i].base = s.dist; touch(); UI.renderParciais(); }
  function delParcial(i) { const s = ativa; if (!s) return; s.parciais.splice(i, 1); touch(); UI.renderParciais(); }
  function renParcial(i) {
    const s = ativa; if (!s) return;
    UI.modal('✏️ Nome do parcial', `<div class="field"><input class="inp" id="ren-v" value="${esc(s.parciais[i].nome)}"></div>
      <button class="btn-full" onclick="Core.applyRen(${i})">✓ Salvar</button>`);
  }
  function applyRen(i) { const s = ativa; const v = val('ren-v').trim(); if (v) s.parciais[i].nome = v; UI.closeModal(); touch(); UI.renderParciais(); }

  // ── registros (eventos) ─────────────────────────────────────
  /** Grava um registro na posição travada `p` (ou na posição atual) */
  function addEvent(data, p) {
    const s = ativa; if (!s) return null;
    p = p || pos(s);
    s.seq = (s.seq || 0) + 1;
    const ev = Object.assign({ id: uid(), seq: s.seq, grupo: '', cod: '', rotulo: '', obs: '', dados: {}, fotos: [] }, p, data);
    s.eventos.push(ev);
    persist(s, false);           // registro é gravado no disco na hora
    updateOdo(); UI.renderEvents();
    return ev;
  }
  function updateEvent(ev) { if (!ativa) return; persist(ativa, false); UI.renderEvents(); }
  function removeEvent(id) {
    const s = ativa; if (!s) return;
    const ev = s.eventos.find(e => e.id === id); if (!ev) return;
    (ev.fotos || []).forEach(f => Store.remove(dirOf(s) + '/fotos/' + f));
    s.eventos = s.eventos.filter(e => e.id !== id);
    persist(s, false); updateOdo(); UI.renderEvents();
  }
  function undoLast() {
    const s = ativa; if (!s || !s.eventos.length) { toast('Nada para desfazer'); return null; }
    const ev = s.eventos[s.eventos.length - 1]; removeEvent(ev.id); return ev;
  }

  // ── ir até / converter ──────────────────────────────────────
  let gotoTipo = 'est';
  function calcGoto() {
    const res = $('goto-res'); if (!res) return; const s = ativa;
    const tm = gotoTipo === 'km' ? readKm('gt-km-v') : readEst('gt-est-n', 'gt-est-m');
    if (isNaN(tm)) { res.style.display = 'none'; return; }
    let h = gotoTipo === 'est' ? 'Est ' + fmtEst(tm) + ' = <b>' + nf(tm, 2) + ' m</b> do início do estaqueamento' : 'km ' + fmtKm(tm) + ' = <b>' + nf(tm, 1) + ' m</b>';
    if (s) {
      const to = gotoTipo === 'km' ? tm - s.k0 : tm - s.s0;
      if (s.modo === 'cor') h += '<br>Correlação: ' + (gotoTipo === 'km' ? 'Est ' + fmtEst(s.s0 + to, s) : 'km ' + fmtKm(s.k0 + to));
      const delta = to - off(s); const ahead = s.dir === 'C' ? delta > 0 : delta < 0; const ad = Math.abs(delta);
      h += '<br>' + (ad < 1 ? '📍 <b>Você está no ponto</b>' : (ahead ? '⬆️ Faltam <b>' + fmtDistM(ad) + '</b> à frente' : '⬇️ Ficou <b>' + fmtDistM(ad) + '</b> para trás'))
        + ' <span style="color:var(--sub)">(' + nf(ad / estSize(s), 2) + ' estacas)</span>';
    }
    res.innerHTML = h; res.style.display = 'block';
  }
  function setGotoTipo(t) {
    gotoTipo = t;
    if (!$('gt-km')) return;
    $('gt-km').className = t === 'km' ? 'sel' : ''; $('gt-est').className = t === 'est' ? 'sel' : '';
    $('gt-in-km').style.display = t === 'km' ? 'block' : 'none';
    $('gt-in-est').style.display = t === 'est' ? 'flex' : 'none';
    calcGoto();
  }

  // ── backup e restauração ────────────────────────────────────
  async function backup(pasta, silencioso) {
    if (ativa && ativa.pasta === pasta) persist(ativa, true);
    const r = await Store.zipDir('Sessoes/' + pasta, pasta + '.zip');
    if (!r) { UI.alert('Backup não concluído', 'Não foi possível gerar o .zip desta sessão.'); return null; }
    const i = index.find(x => x.pasta === pasta); if (i) { i.backup = Date.now(); saveIndex(); }
    if (!silencioso) {
      toast('💾 Backup salvo em ' + r.visivel, 3500);
      Store.share(r.rel, 'application/zip');   // escolha "Drive" para enviar ao Google Drive
    }
    return r;
  }
  async function backupAll() {
    if (!index.length) { toast('Nenhuma sessão para backup'); return; }
    if (ativa) persist(ativa, true);
    const d = new Date();
    const name = 'DVA_Roads_backup_' + stamp(d) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.zip';
    const r = await Store.zipDir('Sessoes', name);
    if (!r) { UI.alert('Backup não concluído', 'Não foi possível gerar o .zip.'); return; }
    index.forEach(i => i.backup = Date.now()); saveIndex();
    toast('💾 Backup salvo em ' + r.visivel, 3500);
    Store.share(r.rel, 'application/zip');
  }
  function restorePick() { $('restore-in').click(); }
  async function restoreFile(input) {
    const f = input.files && input.files[0]; input.value = ''; if (!f) return;
    const b64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(f); });
    const pasta = await Store.unzipSession(b64);
    if (!pasta) { UI.alert('Restauração', 'O arquivo não parece ser um backup do DVA Roads.'); return; }
    rebuildIndex(); UI.closeSettings(); UI.render();
    toast('♻️ Restaurado: ' + pasta, 3000);
  }

  // ── inicialização ───────────────────────────────────────────
  function init() {
    index = Store.readJSON('Sessoes/index.json', null);
    if (!Array.isArray(index)) rebuildIndex();
    const p = localStorage.getItem(ATIVA_KEY);
    if (p) { const s = loadSession(p); if (s && !s.fim) ativa = s; else localStorage.removeItem(ATIVA_KEY); }
  }

  return {
    S, M, off, pos, posValues, marcoTxt, codigo, dirOf, init, onFix, updateOdo, loadSession, persist,
    index: () => index.slice(),
    openNew, nsModo: nsModoF, nsDir: nsDirF, startSession, askEnd, endSession, reopen, askDelete,
    setModo, swapPrim, toggleDir, openCorrigir, setCorTipo, applyCorrigir,
    addParcial, zeroParcial, delParcial, renParcial, applyRen,
    addEvent, updateEvent, removeEvent, undoLast,
    calcGoto, setGotoTipo, backup, backupAll, restorePick, restoreFile,
  };
})();
