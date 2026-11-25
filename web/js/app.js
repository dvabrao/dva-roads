// ════════════════════════════════════════════════════════════════
//  DVA Roads — inicialização
// ════════════════════════════════════════════════════════════════
(async function () {
  loadSettings();
  await License.load();
  Core.init();
  UI.render();
  GPS.start();
  const v = 'Versão ' + UI.version();
  ['about-ver', 'about-full-ver'].forEach(id => { const el = $(id); if (el) el.textContent = v; });
})();
