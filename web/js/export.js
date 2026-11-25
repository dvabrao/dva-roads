// ════════════════════════════════════════════════════════════════
//  DVA Roads — exportação (KML, KMZ, relatório HTML/PDF) e croqui
//  Os arquivos são gravados em Sessoes/<sessão>/export/ e depois
//  enviados pelo "Enviar" do Android (WhatsApp, Drive, e-mail...).
// ════════════════════════════════════════════════════════════════
const Export = (function () {
  const kmlColor = (hex, a) => { const h = hex.replace('#', ''); return (a || 'ff') + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };

  function sessaoPor(pasta) { const a = Core.S(); return a && a.pasta === pasta ? a : Core.loadSession(pasta); }
  function base(s) { return slug((s.rodovia ? s.rodovia + '_' : '') + s.nome) + '_' + stamp(s.ini); }

  // ── KML ─────────────────────────────────────────────────────
  function kml(s, comFotos, filtro) {
    const m = Core.M(s);
    const passa = (ev) => !filtro || !m || !m.passaFiltro || m.passaFiltro(ev, filtro);
    const head = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${esc(s.nome)} — ${esc(m ? m.nome : '')}</name>
<description>${esc((s.rodovia ? s.rodovia + ' · ' : '') + Core.marcoTxt(s))} · ${s.dir === 'C' ? 'Crescente' : 'Decrescente'} · ${fmtDT(s.ini)}${s.fim ? ' a ' + fmtDT(s.fim) : ''} · ${APP.nome} · ${APP.empresa}</description>
<Style id="trk"><LineStyle><color>${kmlColor('#F5C500')}</color><width>4</width></LineStyle></Style>
<Style id="pt"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon></IconStyle></Style>
<Style id="mz"><IconStyle><scale>1.3</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-stars.png</href></Icon></IconStyle></Style>
${m && m.kmlEstilos ? m.kmlEstilos(s, kmlColor) : ''}\n`;
    let k = head;
    if (s.track.length) {
      const t0 = s.track[0];
      k += `<Placemark><name>Marco zero</name><description>${esc(Core.marcoTxt(s))}</description><styleUrl>#mz</styleUrl><Point><coordinates>${t0[1]},${t0[0]},0</coordinates></Point></Placemark>\n`;
    }
    if (s.track.length > 1) {
      k += `<Placemark><name>Trajeto (${nf(s.dist / 1000, 3)} km)</name><styleUrl>#trk</styleUrl><LineString><tessellate>1</tessellate><coordinates>\n`
        + s.track.map(p => p[1] + ',' + p[0] + ',0').join('\n') + `\n</coordinates></LineString></Placemark>\n`;
    }
    if (m && m.kmlExtra) k += m.kmlExtra(s, { trechoTrack, kmlColor, filtro });
    k += '<Folder><name>Registros</name>\n';
    s.eventos.forEach(ev => {
      if (ev.lat == null || !passa(ev)) return;
      const cod = Core.codigo(s, ev);
      const titulo = m && m.titulo ? m.titulo(ev) : ev.rotulo;
      const fotos = comFotos ? (ev.fotos || []).map(f => `<br><img src="fotos/${f}" width="480"/>`).join('') : '';
      const desc = esc(posTxt(s, ev) + (ev.obs ? ' · Obs.: ' + ev.obs : '') + (m && m.descricao ? ' · ' + m.descricao(ev, s) : ''));
      k += `<Placemark><name>${esc(cod + ' - ' + titulo)}</name><description><![CDATA[${desc}${fotos}]]></description>`
        + `<styleUrl>#${m && m.kmlEstiloEvento ? m.kmlEstiloEvento(ev) : 'pt'}</styleUrl><Point><coordinates>${ev.lon},${ev.lat},0</coordinates></Point></Placemark>\n`;
    });
    return k + '</Folder></Document></kml>';
  }
  /** Pontos do trajeto entre duas distâncias percorridas (d em metros) */
  function trechoTrack(s, d1, d2) {
    const a = Math.min(d1, d2), b = Math.max(d1, d2);
    const pts = s.track.filter(p => (p[3] != null ? p[3] : 0) >= a - 1 && (p[3] != null ? p[3] : 0) <= b + 1);
    return pts.map(p => p[1] + ',' + p[0] + ',0').join(' ');
  }

  // ── relatório ───────────────────────────────────────────────
  function cabecalho(s, m) {
    const o1 = s.fim ? s.offFim : Core.off(s);
    const fimTxt = s.modo === 'km' ? 'km ' + fmtKm(s.k0 + o1) : s.modo === 'est' ? 'Est ' + fmtEst(s.s0 + o1, s) : 'Est ' + fmtEst(s.s0 + o1, s) + ' = km ' + fmtKm(s.k0 + o1);
    return `<div class="cab"><div class="emp">${esc(APP.empresa)}</div><div class="sub">${APP.nome} · ${esc(m ? m.nome + ' — ' + m.sub : '')}</div>
<div class="grid">
<div><b>Sessão:</b> ${esc(s.nome)}</div><div><b>Rodovia:</b> ${esc(s.rodovia || '—')}</div>
<div><b>Marco zero:</b> ${esc(Core.marcoTxt(s).replace('Marco zero: ', ''))}</div><div><b>Unidade:</b> ${modoTxt(s.modo)} · estaca ${nf(estSize(s), 0)} m</div>
<div><b>Posição final:</b> ${fimTxt}</div><div><b>Sentido:</b> ${s.dir === 'C' ? 'Crescente' : 'Decrescente'}</div>
<div><b>Percorrido:</b> ${nf(s.dist / 1000, 3)} km</div><div><b>Registros:</b> ${s.eventos.length}</div>
<div><b>Início:</b> ${fmtDT(s.ini)}</div><div><b>Fim:</b> ${s.fim ? fmtDT(s.fim) : 'em andamento'}</div>
</div></div>`;
  }
  function tabelaPadrao(s, m, ctx) {
    const cols = s.modo === 'cor' ? 2 : 1;
    const rows = (ctx.eventos || s.eventos).map(ev => `<tr>
      <td class="c b nw">${Core.codigo(s, ev)}</td>
      <td><b>${esc(m && m.titulo ? m.titulo(ev) : ev.rotulo)}</b>${m && m.descricao ? '<br>' + esc(m.descricao(ev, s)) : ''}${ev.obs ? '<br><i>' + esc(ev.obs) + '</i>' : ''}</td>
      ${s.modo !== 'est' ? `<td class="c nw">${ev.km != null ? fmtKm(ev.km) : '—'}</td>` : ''}
      ${s.modo !== 'km' ? `<td class="c nw">${ev.est != null ? fmtEst(ev.est, s) : '—'}</td>` : ''}
      <td class="mono">${ev.lat != null ? ev.lat.toFixed(6) + '<br>' + ev.lon.toFixed(6) : '—'}</td>
      <td class="c nw">${new Date(ev.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td></tr>
      ${(ev.fotos || []).length && ctx.fotos ? `<tr class="ln"><td></td><td colspan="${3 + cols}">${ev.fotos.map(f => `<img class="foto" src="${ctx.foto(f)}">`).join('')}</td></tr>` : ''}`).join('');
    return `<table><thead><tr><th>Cód.</th><th>Registro</th>${s.modo !== 'est' ? '<th>KM</th>' : ''}${s.modo !== 'km' ? '<th>Estaca</th>' : ''}<th>Coordenadas</th><th>Hora</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6" class="c">Nenhum registro.</td></tr>'}</tbody></table>`;
  }
  function report(s, opts) {
    opts = opts || {}; const m = Core.M(s);
    const ctx = { fotos: opts.fotos !== false, foto: (f) => Photo.src(s, f), filtro: opts.filtro || '', tabelaPadrao: (evs) => tabelaPadrao(s, m, Object.assign({}, ctx, { eventos: evs })) };
    const corpo = m && m.relatorio ? m.relatorio(s, ctx) : tabelaPadrao(s, m, ctx);
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.nome)} — Relatório ${APP.nome}</title><style>
html,body{background:#fff!important;color:#111!important;margin:0;padding:0}*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px}
.content{padding:16px 14px}.cab{border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:10px}
.emp{font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.sub{font-size:11px;color:#333;margin-top:3px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-top:8px;font-size:10.5px;line-height:1.35}.grid b{margin-right:4px}
h2{font-size:13px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #999;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#111;color:#fff;padding:6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px}
td{padding:5px 6px;border-top:1px solid #ccc;vertical-align:top;color:#111}tr.ln td{border-top:none;padding-top:0}
.c{text-align:center}.b{font-weight:800}.nw{white-space:nowrap}.mono{font-family:monospace;font-size:9.5px}.r{text-align:right}
.foto{width:48%;max-width:340px;margin:3px 1% 3px 0;border:1px solid #ccc}
.croqui svg{width:100%;height:auto;display:block;margin-bottom:6px}
.rod{margin-top:14px;font-size:10px;color:#555;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:8px}
@media print{@page{size:A4;margin:12mm}.content{padding:0}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .croqui svg{break-inside:avoid}tr{break-inside:avoid}}
</style></head><body><div class="content">
${cabecalho(s, m)}
${corpo}
<div class="rod"><span>${s.eventos.length} registro(s) · ${s.track.length} coordenadas de trajeto</span><span>${APP.nome} · gerado em ${fmtDT(Date.now())}</span></div>
</div></body></html>`;
  }

  // ── tela de exportação ──────────────────────────────────────
  function open(pasta) {
    const list = Core.index().slice().reverse();
    if (!list.length) { toast('Nenhuma sessão para exportar'); return; }
    pasta = pasta || (Core.S() ? Core.S().pasta : list[0].pasta);
    UI.modal('📤 Exportar sessão', `
      <div class="field"><label>Sessão</label><select class="inp" id="exp-sec" onchange="Export.filtroUI()">${list.map(s => `<option value="${esc(s.pasta)}" ${s.pasta === pasta ? 'selected' : ''}>${esc(s.nome)} · ${fmtDT(s.ini)}</option>`).join('')}</select></div>
      <div class="field" id="exp-f-wrap" style="display:none"><label>Filtrar por estado de conservação</label><select class="inp" id="exp-filtro"></select></div>
      <div class="exp-btn-list">
        <button class="exp-opt" onclick="Export.go('pdf')"><span class="ico">📄</span><div><div class="lbl">Relatório PDF</div><div class="sub">Abre a impressão · “Salvar como PDF”</div></div></button>
        <button class="exp-opt" onclick="Export.go('kml')"><span class="ico">🗺️</span><div><div class="lbl">KML</div><div class="sub">Trajeto e registros · Google Earth / Maps</div></div></button>
        <button class="exp-opt" onclick="Export.go('kmz')"><span class="ico">📦</span><div><div class="lbl">KMZ com fotos</div><div class="sub">Um arquivo só, fotos dentro dos pontos</div></div></button>
        <button class="exp-opt" onclick="Export.go('html')"><span class="ico">🌐</span><div><div class="lbl">Relatório HTML</div><div class="sub">WhatsApp / Drive / e-mail</div></div></button>
        <button class="exp-opt" onclick="Export.go('zip')"><span class="ico">💾</span><div><div class="lbl">Backup da sessão (.zip)</div><div class="sub">Tudo: dados, trajeto, fotos · envie ao Google Drive</div></div></button>
      </div>`);
    filtroUI();
  }
  // módulos com estado de conservação (ex.: SV) oferecem filtro no relatório e no KML
  function filtroUI() {
    const r = Core.index().find(x => x.pasta === val('exp-sec')); const m = r && Modules.get(r.modulo);
    const w = $('exp-f-wrap'); if (!w) return;
    if (m && m.filtros) { $('exp-filtro').innerHTML = m.filtros().map(f => `<option value="${esc(f.v)}">${esc(f.t)}</option>`).join(''); w.style.display = 'block'; }
    else { $('exp-filtro').innerHTML = ''; w.style.display = 'none'; }
  }
  async function go(tipo) {
    const pasta = val('exp-sec'); const s = sessaoPor(pasta); if (!s) { toast('Sessão não encontrada'); return; }
    const filtro = val('exp-filtro');
    UI.closeModal();
    if (Core.S() && Core.S().pasta === pasta) Core.persist(Core.S(), true);
    const dir = Core.dirOf(s) + '/export/'; const b = base(s) + (filtro ? '_' + slug(filtro) : '');
    if (tipo === 'zip') { await Core.backup(pasta); return; }
    if (tipo === 'kml') {
      Store.writeText(dir + b + '.kml', kml(s, false, filtro));
      Store.copyToDownloads(dir + b + '.kml', 'Exportacoes');
      Store.share(dir + b + '.kml', 'application/vnd.google-earth.kml+xml'); return;
    }
    if (tipo === 'kmz') {
      const zip = new JSZip(); zip.file('doc.kml', kml(s, true, filtro));
      s.eventos.forEach(ev => (ev.fotos || []).forEach(f => { const x = Store.readB64(Core.dirOf(s) + '/fotos/' + f); if (x) zip.file('fotos/' + f, x, { base64: true }); }));
      const z = await zip.generateAsync({ type: 'base64' });
      Store.writeB64(dir + b + '.kmz', z);
      Store.copyToDownloads(dir + b + '.kmz', 'Exportacoes');
      Store.share(dir + b + '.kmz', 'application/vnd.google-earth.kmz'); return;
    }
    const html = report(s, { filtro });
    Store.writeText(dir + b + '.html', html);
    if (tipo === 'html') { Store.copyToDownloads(dir + b + '.html', 'Exportacoes'); Store.share(dir + b + '.html', 'text/html'); return; }
    if (tipo === 'pdf') {
      if (typeof window.NativePrint !== 'undefined' && window.NativePrint.printHtml) { window.NativePrint.printHtml(html, b); return; }
      const w = window.open('', '_blank');
      if (w) { w.document.write(html.replace('</body>', '<script>setTimeout(function(){print()},400)<\/script></body>')); w.document.close(); }
    }
  }

  return { kml, report, open, go, filtroUI, trechoTrack, kmlColor };
})();
