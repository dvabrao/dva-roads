// ════════════════════════════════════════════════════════════════
//  DVA Roads — GPS (mesmo motor do SLIR / Marco Zero)
//  Nativo: GpsService (FusedLocation + GPS) em segundo plano → _nativeGpsPosition
//  Reserva: Geolocation API da WebView
// ════════════════════════════════════════════════════════════════
const GPS = (function () {
  const st = { lat: null, lon: null, acc: 0, spd: 0 };
  const diag = { posCount: 0, lastSource: '', lastError: '', startedAt: null, visible: false };
  let watchId = null, fallbackT = null;

  const isNative = () => typeof window.NativeGPS !== 'undefined' && window.NativeGPS.isNative && window.NativeGPS.isNative() === 'true';

  function banner(state, txt) {
    $('gps-banner').className = 'gps-banner ' + state;
    $('gps-banner-txt').textContent = txt;
    $('odo-dot').className = 'odo-dot' + (state === 'ok' ? ' on' : state === 'weak' ? ' weak' : '');
    const s = Core.S();
    $('odo-status').textContent = (state === 'ok' ? 'GPS ativo' : state === 'weak' ? 'GPS fraco' : 'GPS aguardando') + (s ? ' · ' + s.nome : '');
  }
  function updDiag() {
    if (!diag.visible) return;
    const lbl = { fused: 'FusedLocation', gps: 'GPS nativo', network: 'Rede/WiFi', webview: 'WebView Geo' }[diag.lastSource] || diag.lastSource || '—';
    $('gps-diag-src').textContent = lbl;
    $('gps-diag-cnt').textContent = diag.posCount;
    $('gps-diag-acc').textContent = st.acc ? Math.round(st.acc) + 'm' : '—';
    $('gps-diag-err').textContent = diag.lastError || '—';
    $('gps-diag-ela').textContent = diag.startedAt ? Math.round((Date.now() - diag.startedAt) / 1000) + 's' : '—';
    $('gps-diag-coord').textContent = st.lat != null ? fmtCoord(st.lat, st.lon) : 'aguardando...';
  }
  setInterval(updDiag, 2000);

  function onPosition(pos) {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    const acc = Math.abs(pos.coords.accuracy || 999);
    st.lat = lat; st.lon = lon; st.acc = acc;
    if (acc > settings.acc) { banner('weak', '⚠️ GPS fraco · Precisão: ' + Math.round(acc) + 'm'); Core.updateOdo(); return; }
    banner('ok', 'GPS ativo · Precisão: ' + Math.round(acc) + 'm');
    Core.onFix(lat, lon, Date.now());
  }
  function startWebView() {
    if (!navigator.geolocation) { diag.lastError = 'GPS não disponível'; banner('err', 'GPS não disponível'); return; }
    if (watchId !== null) return;
    diag.lastSource = 'webview';
    watchId = navigator.geolocation.watchPosition(
      p => { diag.posCount++; diag.lastSource = 'webview'; diag.lastError = ''; onPosition(p); },
      e => {
        if (e.code === 1) { diag.lastError = 'Permissão negada'; banner('err', 'Permissão negada. Libere a localização nas configurações.'); }
        else { diag.lastError = 'Erro código ' + e.code; banner('warn', 'Aguardando sinal GPS...'); }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 2000 });
    banner('ok', 'Aguardando primeira posição...');
  }
  function start() {
    diag.startedAt = Date.now();
    if (isNative()) {
      window.NativeGPS.start && window.NativeGPS.start();
      banner('ok', 'GPS nativo ativo');
      fallbackT = setTimeout(() => {
        if (st.lat === null) { diag.lastError = 'Nativo sem sinal · usando WebView'; banner('warn', 'GPS nativo sem sinal · tentando alternativa...'); startWebView(); }
      }, 10000);
      return;
    }
    startWebView();
  }
  window._nativeGpsPosition = function (lat, lon, acc, speedMs, source) {
    if (fallbackT) { clearTimeout(fallbackT); fallbackT = null; }
    diag.posCount++; diag.lastSource = source || 'native'; diag.lastError = ''; updDiag();
    onPosition({ coords: { latitude: lat, longitude: lon, accuracy: acc, speed: speedMs } });
  };

  return {
    st, isNative, start,
    toggleDiag() { diag.visible = !diag.visible; $('gps-diag-panel').style.display = diag.visible ? 'block' : 'none'; updDiag(); },
    restart() {
      diag.posCount = 0; diag.lastSource = ''; diag.lastError = '';
      if (fallbackT) { clearTimeout(fallbackT); fallbackT = null; }
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      start(); updDiag();
    },
    testWebview() {
      diag.posCount = 0; diag.lastSource = 'webview'; diag.lastError = ''; diag.startedAt = Date.now();
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      startWebView(); updDiag();
    },
    /** Para testes: simula uma posição */
    _simulate(lat, lon, acc) { onPosition({ coords: { latitude: lat, longitude: lon, accuracy: acc || 5 } }); },
  };
})();
