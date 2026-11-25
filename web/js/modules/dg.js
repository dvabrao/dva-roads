// ════════════════════════════════════════════════════════════════
//  Módulo SV · DIAGRAMAÇÃO — projeto de placas (DER-SP)
//  Ferramenta sem GPS: cria e edita placas de indicação, educativas,
//  de obras e as do catálogo (R e A), do zero ou a partir de uma foto
//  (a IA lê a placa e preenche o projeto). Exporta JPG, PDF, DXF e WMF.
//  Os projetos ficam em DVA Roads/Diagramacao/ no celular.
// ════════════════════════════════════════════════════════════════
(function () {
  const DIR = 'Diagramacao', ARQ = DIR + '/projetos.json';
  let projetos = [], atual = null, carregado = false, timer = null, ultimo = null;
  const SETAS = [['', '—'], ['E', '←'], ['IE', '↖'], ['F', '↑'], ['ID', '↗'], ['D', '→']];
  const ALTURAS = [100, 125, 150, 175, 200, 250, 300, 350, 400];

  function carregaScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); });
  }
  async function preparar() {
    if (carregado) return;
    if (!window.opentype) await carregaScript('js/dg/opentype.min.js');
    if (!window.DG_PICTOS) await carregaScript('js/dg/pictos.js');
    if (!window.DGMotor) await carregaScript('js/dg/motor.js');
    await DGMotor.carregarFonte();
    carregado = true;
  }
  const salvarLista = () => Store.writeJSON(ARQ, projetos);
  const novoTexto = () => ({ id: uid(), nome: 'Placa ' + (projetos.length + 1), t: Date.now(),
    P: { tipo: 'texto', esquema: 'verde', classe: 'II', modular: true, linhas: [{ texto: 'Ribeirão Preto', h: 200, serie: 'auto', seta: 'D', dist: '', escudo: '', tarja: false }] } });
  const novoCatalogo = () => ({ id: uid(), nome: 'Placa ' + (projetos.length + 1), t: Date.now(), P: { tipo: 'placa', codigo: 'R-19', tipoTam: 'I', valor: '80', compl: '' } });

  // ── tela ──────────────────────────────────────────────────────
  function tela(html) {
    let el = $('dg-tela');
    if (!el) {
      el = document.createElement('div'); el.id = 'dg-tela'; document.body.appendChild(el);
      const st = document.createElement('style'); st.textContent = `
        #dg-tela{position:fixed;inset:0;background:var(--bg,#F1F4F8);z-index:150;overflow:auto;padding-bottom:40px}
        #dg-tela .dg-h{position:sticky;top:0;z-index:3;background:#111D3D;color:#fff;display:flex;align-items:center;gap:10px;padding:12px 14px}
        #dg-tela .dg-h b{flex:1;font-size:16px}#dg-tela .dg-h button{background:transparent;border:1px solid #ffffff55;color:#fff;border-radius:9px;padding:6px 10px;font-size:14px}
        #dg-tela .dg-c{padding:12px 14px;max-width:900px;margin:0 auto}
        .dg-prev{position:sticky;top:52px;z-index:2;background:#e9edf3;border-radius:14px;padding:10px;margin-bottom:10px;text-align:center;box-shadow:0 2px 8px #0002}
        .dg-prev svg{max-width:100%;max-height:34vh;display:block;margin:0 auto}
        .dg-dim{font-size:12.5px;color:#334;margin-top:6px}.dg-av{font-size:12px;color:#C62828;margin-top:4px}
        .dg-ln{background:#fff;border:1px solid #DDE3EC;border-radius:12px;padding:10px;margin-bottom:8px}
        .dg-ln .r{display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap}
        .dg-ln .r .inp{flex:1;min-width:90px}
        .dg-st{display:flex;gap:4px}.dg-st button{width:38px;height:36px;border-radius:9px;border:1px solid #DDE3EC;background:#fff;font-size:18px}
        .dg-st button.on{background:#FFD740;border-color:#E0B000}
        .dg-mini{border:0;background:#EEF1F6;border-radius:8px;padding:6px 9px;font-size:13px}
        .dg-exp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
        .dg-exp button{padding:12px 4px;border-radius:12px;border:0;background:#111D3D;color:#fff;font-weight:800;font-size:14px}
        .dg-item{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #DDE3EC;border-radius:12px;padding:8px;margin-bottom:8px}
        .dg-item .th{width:92px;height:56px;display:flex;align-items:center;justify-content:center;background:#e9edf3;border-radius:8px;overflow:hidden}
        .dg-item .th svg{max-width:88px;max-height:52px}.dg-item .tx{flex:1;font-size:13px}.dg-item .tx b{font-size:14px}
        .dg-cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px;max-height:230px;overflow:auto;background:#fff;border:1px solid #DDE3EC;border-radius:12px;padding:6px}
        .dg-cat button{border:2px solid transparent;background:#f7f9fc;border-radius:10px;padding:4px;font-size:10.5px;font-weight:700}
        .dg-cat button.on{border-color:#E0B000;background:#FFF8D6}.dg-cat img{width:44px;height:44px;object-fit:contain;display:block;margin:0 auto 2px}`;
      document.head.appendChild(st);
    }
    el.style.display = 'block'; el.innerHTML = html; return el;
  }
  function fechar() { const el = $('dg-tela'); if (el) el.style.display = 'none'; atual = null; }

  const miniatura = (p) => { try { return DGMotor.svg(DGMotor.desenhar(p.P)); } catch (e) { return ''; } };
  function lista() {
    tela(`<div class="dg-h"><b>📐 SV · Diagramação</b><button onclick="DG.fechar()">✕</button></div><div class="dg-c">
      <div class="dg-exp" style="grid-template-columns:1fr 1fr 1fr;margin:0 0 12px">
        <button onclick="DG.novo('texto')">✏️ Placa de texto</button>
        <button onclick="DG.novo('placa')">🛑 Catálogo R / A</button>
        <button onclick="DG.daFoto()" style="background:#FFD740;color:#111D3D">📷 Da foto (IA)</button></div>
      <p class="help" style="font-size:12.5px;margin:0 0 10px">Diagramação conforme o Manual de Sinalização Rodoviária do DER-SP (Vol. II): alfabetos séries D e E(M), espaçamentos de 3/4 da altura da letra, setas, escudos, orlas e modulação das placas. Placas R e A com o desenho vetorial do manual.</p>
      ${projetos.length ? projetos.slice().reverse().map(p => `<div class="dg-item" onclick="DG.editar('${p.id}')"><div class="th">${miniatura(p)}</div>
        <div class="tx"><b>${esc(p.nome)}</b><br>${p.P.tipo === 'placa' ? esc(p.P.codigo) : esc((DGMotor.ESQUEMAS[p.P.esquema] || {}).n || '')}<br><span style="color:#5B6B82">${fmtDT(p.t)}</span></div>
        <button class="dg-mini" onclick="event.stopPropagation();DG.excluir('${p.id}')">🗑</button></div>`).join('')
        : '<p class="help" style="text-align:center;padding:30px 0">Nenhuma placa ainda.</p>'}</div>`);
  }

  function linhaHTML(l, i, n) {
    return `<div class="dg-ln">
      <div class="r" style="margin-top:0"><input class="inp" value="${esc(l.texto || '')}" placeholder="Texto (ex.: Ribeirão Preto, SAÍDA)" oninput="DG.set(${i},'texto',this.value)">
        <button class="dg-mini" onclick="DG.mover(${i},-1)" ${i ? '' : 'disabled'}>▲</button><button class="dg-mini" onclick="DG.mover(${i},1)" ${i < n - 1 ? '' : 'disabled'}>▼</button><button class="dg-mini" onclick="DG.remover(${i})">✕</button></div>
      <div class="r"><div class="dg-st">${SETAS.map(([v, t]) => `<button class="${(l.seta || '') === v ? 'on' : ''}" onclick="DG.set(${i},'seta','${v}',true)">${t}</button>`).join('')}</div></div>
      <div class="r"><select class="inp" onchange="DG.set(${i},'h',+this.value)">${ALTURAS.map(h => `<option value="${h}" ${+l.h === h ? 'selected' : ''}>h ${h} mm</option>`).join('')}</select>
        <select class="inp" onchange="DG.set(${i},'serie',this.value)">${[['auto', 'Série automática'], ['D', 'Série D'], ['EM', 'Série E(M)']].map(([v, t]) => `<option value="${v}" ${(l.serie || 'auto') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="r"><input class="inp" value="${esc(l.dist || '')}" placeholder="Distância (ex.: 12 km)" oninput="DG.set(${i},'dist',this.value)">
        <input class="inp" value="${esc(l.escudo || '')}" placeholder="Escudo (SP 330, BR 050)" oninput="DG.set(${i},'escudo',this.value)"></div>
      <div class="r"><label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" ${l.tarja ? 'checked' : ''} onchange="DG.set(${i},'tarja',this.checked)"> Tarja abaixo desta linha</label></div></div>`;
  }
  function formTexto(P) {
    return `<div class="fgrid">
        <div class="field"><label>Cores</label><select class="inp" onchange="DG.setP('esquema',this.value)">${Object.entries(DGMotor.ESQUEMAS).map(([k, e]) => `<option value="${k}" ${P.esquema === k ? 'selected' : ''}>${esc(e.n)}</option>`).join('')}</select></div>
        <div class="field"><label>Rodovia</label><select class="inp" onchange="DG.setP('classe',this.value,true)">${Object.entries(DGMotor.CLASSES).map(([k, c]) => `<option value="${k}" ${P.classe === k ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div></div>
      <div class="card-label" style="margin:6px 0">Linhas (de cima para baixo · máximo 5)</div>
      <div id="dg-linhas">${P.linhas.map((l, i) => linhaHTML(l, i, P.linhas.length)).join('')}</div>
      ${P.linhas.length < 5 ? '<button class="btn-full gray" onclick="DG.addLinha()">+ Linha</button>' : ''}
      <div class="card-label" style="margin:12px 0 6px">Dimensões da placa</div>
      <label style="font-size:13px;display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" ${P.modular !== false ? 'checked' : ''} onchange="DG.setP('modular',this.checked)"> Arredondar para o módulo do DER</label>
      <div class="fgrid"><div class="field"><label>Largura fixa (mm)</label><input class="inp" inputmode="numeric" value="${P.L || ''}" placeholder="automática" oninput="DG.setP('L',+this.value||null)"></div>
        <div class="field"><label>Altura fixa (mm)</label><input class="inp" inputmode="numeric" value="${P.H || ''}" placeholder="automática" oninput="DG.setP('H',+this.value||null)"></div></div>`;
  }
  const codigos = () => Object.keys(window.DG_PICTOS || {}).sort((a, b) => a[0].localeCompare(b[0]) || parseInt(a.slice(2)) - parseInt(b.slice(2)) || a.localeCompare(b));
  function gradeCat(P, q) {
    q = (q || '').toLowerCase().trim();
    return codigos().filter(c => !q || c.toLowerCase().includes(q)).map(c => `<button class="${P.codigo === c ? 'on' : ''}" onclick="DG.setP('codigo','${c}',true)"><img src="img/placas/${c}.png" onerror="this.style.visibility='hidden'">${c}</button>`).join('');
  }
  function formPlaca(P) {
    return `<div class="field"><label>Placa</label><input class="inp" id="dg-q" placeholder="🔎 filtrar código (ex.: R-19, A-2)" oninput="$('dg-cat').innerHTML=DG.grade(this.value)" style="margin-bottom:6px">
        <div class="dg-cat" id="dg-cat">${gradeCat(P)}</div></div>
      <div class="fgrid"><div class="field"><label>Tamanho (DER)</label><select class="inp" onchange="DG.setP('tipoTam',this.value)">${Object.entries(DGMotor.TAMANHOS).map(([k, v]) => `<option value="${k}" ${P.tipoTam === k ? 'selected' : ''}>Tipo ${k} · ${v} mm</option>`).join('')}</select></div>
        ${P.codigo === 'R-19' ? `<div class="field"><label>Velocidade (km/h)</label><input class="inp" inputmode="numeric" value="${esc(P.valor || '')}" oninput="DG.setP('valor',this.value)"></div>` : ''}</div>
      <div class="field"><label>Placa complementar (opcional, uma linha por linha)</label><textarea class="inp" rows="2" placeholder="ex.: A 300 m" oninput="DG.setP('compl',this.value)">${esc(P.compl || '')}</textarea></div>`;
  }
  function editor() {
    const p = atual;
    tela(`<div class="dg-h"><button onclick="DG.voltar()">‹</button><b>📐 ${esc(p.nome)}</b><button onclick="DG.renomear()">✏️</button></div><div class="dg-c">
      <div class="dg-prev"><div id="dg-svg"></div><div class="dg-dim" id="dg-dim"></div><div class="dg-av" id="dg-av"></div></div>
      <div class="dg-exp"><button onclick="DG.exportar('jpg')">JPG</button><button onclick="DG.exportar('pdf')">PDF</button><button onclick="DG.exportar('dxf')">DXF</button><button onclick="DG.exportar('wmf')">WMF</button></div>
      <div style="margin-top:12px">${p.P.tipo === 'placa' ? formPlaca(p.P) : formTexto(p.P)}</div>
      ${p.ia ? `<p class="help" style="font-size:12px;margin-top:10px">🤖 Lido da foto pela IA${p.ia.obs ? ': ' + esc(p.ia.obs) : ''}. Confira textos e setas.</p>` : ''}</div>`);
    desenhar();
  }
  function desenhar() {
    if (!atual) return;
    try {
      ultimo = DGMotor.desenhar(atual.P);
      $('dg-svg').innerHTML = DGMotor.svg(ultimo);
      const c = ultimo.calc;
      $('dg-dim').innerHTML = `<b>${nf(ultimo.L, 0)} × ${nf(ultimo.H, 0)} mm</b>${c && (c.L !== Math.round(ultimo.L) || c.H !== Math.round(ultimo.H)) ? ` · calculado ${nf(c.L, 0)} × ${nf(c.H, 0)} mm` : ''} · área ${nf(ultimo.L * ultimo.H / 1e6, 2)} m²`;
      $('dg-av').innerHTML = (ultimo.avisos || []).map(esc).join('<br>');
    } catch (e) { $('dg-av').textContent = 'Erro ao desenhar: ' + e.message; }
  }
  function agenda() { clearTimeout(timer); timer = setTimeout(() => { desenhar(); atual.t = Date.now(); salvarLista(); }, 160); }

  async function exportar(fmt) {
    if (!ultimo) return;
    const nome = slug(atual.nome) || 'placa'; const rel = DIR + '/export/' + nome + '.' + fmt;
    const MIME = { jpg: 'image/jpeg', pdf: 'application/pdf', dxf: 'application/dxf', wmf: 'image/wmf' };
    try {
      let ok;
      if (fmt === 'dxf') ok = Store.writeText(rel, DGMotor.dxf(ultimo));
      else ok = Store.writeB64(rel, fmt === 'jpg' ? await DGMotor.jpg(ultimo, 3000) : fmt === 'pdf' ? DGMotor.pdf(ultimo, atual.nome) : DGMotor.wmf(ultimo));
      if (ok === false) throw new Error('não foi possível gravar');
      Store.copyToDownloads(rel, 'Diagramacao');
      toast('✅ ' + nome + '.' + fmt + ' salvo em Downloads/DVA Roads/Diagramacao');
      Store.share(rel, MIME[fmt]);
    } catch (e) { UI.alert('Exportação', 'Não foi possível gerar o arquivo: ' + e.message); }
  }

  // ── leitura da placa por foto (IA) ──
  function reduzir(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight)); const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.8).split(',')[1]); };
      im.onerror = ko; im.src = url;
    });
  }
  function daFoto() {
    UI.modal('📷 Placa a partir de foto', `<p class="help" style="font-size:13px">Tire ou escolha a foto da placa. A IA lê textos, setas, cores e o código; o app diagrama conforme o DER e você ajusta.</p>
      <div style="display:flex;gap:8px;margin:10px 0"><button class="btn-cam" style="flex:1" onclick="DG.foto(false)">📷 Tirar foto</button><button class="btn-cam" style="flex:1" onclick="DG.foto(true)">🖼️ Da galeria</button></div>
      <div class="field"><label>Observação (opcional)</label><input class="inp" id="dg-obs" placeholder="ex.: rodovia classe Ib, refazer com seta à direita"></div>
      <div id="dg-st" style="font-weight:600;font-size:14px"></div>`);
  }
  async function foto(galeria) {
    const inp = $(galeria ? 'gal-in' : 'cam-in'); inp.value = '';
    const file = await new Promise(r => { inp.onchange = () => r(inp.files && inp.files[0]); inp.click(); });
    if (!file) return;
    const st = (t) => { if ($('dg-st')) $('dg-st').innerHTML = t; };
    st('⏳ Lendo a placa…');
    let r;
    try {
      const img = await reduzir(file);
      const resp = await fetch(IA.url() + '/ia/diagramar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: License.raw('dg'), modulo: 'dg', imagem: img, texto: val('dg-obs') }) });
      r = await resp.json(); if (!resp.ok || r.erro) throw new Error(r.erro || 'Servidor respondeu ' + resp.status);
    } catch (e) { st('⚠️ ' + esc(/fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message)); return; }
    const p = deIA(r); projetos.push(p); atual = p; salvarLista(); UI.closeModal(); editor();
  }
  function deIA(r) {
    const cods = window.DG_PICTOS || {};
    if (r.tipo === 'placa' && cods[r.codigo]) return { id: uid(), nome: r.codigo + (r.valor ? ' ' + r.valor : ''), t: Date.now(), ia: { obs: r.observacoes || '' },
      P: { tipo: 'placa', codigo: r.codigo, tipoTam: 'I', valor: r.valor || '', compl: (r.complementar || '').trim() } };
    const classe = DGMotor.CLASSES[r.classe] ? r.classe : 'II', h = DGMotor.CLASSES[classe].hPadrao;
    const esquema = DGMotor.ESQUEMAS[r.esquema] ? r.esquema : 'verde';
    const linhas = (r.linhas || []).slice(0, 5).map(l => ({ texto: l.texto || '', h: esquema === 'branco' || esquema === 'laranja' ? Math.min(h, 150) : h, serie: 'auto',
      seta: ['E', 'IE', 'F', 'ID', 'D'].includes(l.seta) ? l.seta : '', dist: l.dist || '', escudo: l.escudo || '', tarja: !!l.tarja }));
    return { id: uid(), nome: (linhas[0] && linhas[0].texto) || 'Placa da foto', t: Date.now(), ia: { obs: r.observacoes || '' },
      P: { tipo: 'texto', esquema, classe, modular: true, linhas: linhas.length ? linhas : [{ texto: '', h }] } };
  }

  window.DG = {
    async abrir() {
      try { tela('<div class="dg-h"><b>📐 SV · Diagramação</b></div><div class="dg-c"><p class="help">Carregando…</p></div>'); await preparar(); }
      catch (e) { fechar(); UI.alert('Diagramação', e.message); return; }
      projetos = Store.readJSON(ARQ, []) || []; lista();
    },
    fechar, voltar() { atual = null; lista(); }, grade: (q) => gradeCat(atual.P, q),
    novo(tipo) { const p = tipo === 'placa' ? novoCatalogo() : novoTexto(); projetos.push(p); atual = p; salvarLista(); editor(); },
    editar(id) { atual = projetos.find(p => p.id === id); if (atual) editor(); },
    excluir(id) { const p = projetos.find(x => x.id === id); UI.confirm('Excluir placa?', esc(p ? p.nome : ''), () => { projetos = projetos.filter(x => x.id !== id); salvarLista(); lista(); }, '🗑️ Excluir'); },
    renomear() { const n = prompt('Nome da placa', atual.nome); if (n && n.trim()) { atual.nome = n.trim(); salvarLista(); editor(); } },
    set(i, k, v, redesenhaForm) { atual.P.linhas[i][k] = v; if (redesenhaForm) editor(); else agenda(); },
    setP(k, v, redesenhaForm) {
      atual.P[k] = v;
      if (k === 'classe') atual.P.linhas.forEach(l => { l.h = DGMotor.CLASSES[v].hPadrao; });
      if (redesenhaForm) { editor(); atual.t = Date.now(); salvarLista(); } else agenda();
    },
    addLinha() { const l = atual.P.linhas; l.push({ texto: '', h: (l[l.length - 1] || {}).h || 200, serie: 'auto', seta: '', dist: '', escudo: '', tarja: false }); editor(); },
    mover(i, d) { const l = atual.P.linhas; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; editor(); },
    remover(i) { atual.P.linhas.splice(i, 1); if (!atual.P.linhas.length) atual.P.linhas.push({ texto: '', h: 200 }); editor(); },
    exportar, daFoto, foto,
  };

  Modules.register({ id: 'dg', nome: 'SV · Diagramação', sub: 'Projeto de placas DER-SP · JPG, PDF, DXF e WMF', icone: '📐', prefixo: 'D', ferramenta: true, abrir: () => DG.abrir() });
})();
