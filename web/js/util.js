// ════════════════════════════════════════════════════════════════
//  DVA Roads — utilitários comuns (formatação, unidades, números)
// ════════════════════════════════════════════════════════════════
const APP = { nome: 'DVA Roads', empresa: 'DVABRAO SERVIÇOS LTDA', schema: 1 };

// Configurações do núcleo (valem para todos os módulos)
let settings = { unidade: 'cor', est: 20, kmfmt: 'plus', spd: 'kmh', coord: 'dd', acc: 40 };
const SETTINGS_KEY = 'dvaroads_settings';
function loadSettings() {
  try { const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); settings = Object.assign(settings, d); } catch (e) {}
}
function saveSettingsLS() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }

function $(id) { return document.getElementById(id); }
function nf(v, dec) { return Number(v).toFixed(dec).replace('.', ','); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad(n, w) { return String(n).padStart(w || 2, '0'); }
function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}
function fmtDT(t) { const d = new Date(t); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtD(t) { return new Date(t).toLocaleDateString('pt-BR'); }
function fmtH(t) { return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function stamp(t) { const d = new Date(t); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }

function parseNum(v) {
  if (v == null) return NaN; v = String(v).trim().replace(/\s/g, ''); if (!v) return NaN;
  if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.');
  return parseFloat(v);
}
function val(id) { const el = $(id); return el ? el.value : ''; }
function num(id) { return parseNum(val(id)); }

// ── km e estaca ───────────────────────────────────────────────
function estSize(s) { const e = parseFloat(s && s.estSize ? s.estSize : settings.est); return e > 0 ? e : 20; }
/** km a partir de metros: "121+460" ou "121,460" conforme a configuração */
function fmtKm(m, fmt) {
  if (m == null || isNaN(m)) return '—';
  const sg = m < 0 ? '-' : ''; const a = Math.abs(m);
  if ((fmt || settings.kmfmt) === 'plus') {
    let k = Math.floor(a / 1000); let r = Math.round(a - k * 1000);
    if (r >= 1000) { k += 1; r = 0; }
    return sg + k + '+' + pad(r, 3);
  }
  return sg + nf(a / 1000, 3);
}
function estParts(m, s) {
  const E = estSize(s); const neg = m < 0; const a = Math.abs(m);
  let n = Math.floor(a / E); let r = Math.round((a - n * E) * 100) / 100;
  if (r >= E) { n += 1; r = 0; }
  return { neg, n, r };
}
function fmtEst(m, s) { if (m == null || isNaN(m)) return '—'; const p = estParts(m, s); return (p.neg ? '-' : '') + p.n + ' + ' + nf(p.r, 2); }
function fmtDistM(m) { return m < 1000 ? nf(m, 1) + ' m' : nf(m / 1000, 3) + ' km'; }
function modoTxt(m) { return m === 'km' ? 'Km' : m === 'est' ? 'Estaca' : 'Km + Estaca'; }
/** Texto de posição de um registro conforme a unidade da sessão */
function posTxt(s, p) {
  const a = [];
  if (p.km != null) a.push('km ' + fmtKm(p.km));
  if (p.est != null) a.push('Est ' + fmtEst(p.est, s));
  return a.join(' · ');
}

// ── coordenadas ───────────────────────────────────────────────
function fmtCoord(lat, lon) {
  if (lat == null) return 'sem GPS';
  if (settings.coord === 'ddm') return toDDM(lat, 'NS') + ', ' + toDDM(lon, 'EW');
  if (settings.coord === 'dms') return toDMS(lat, 'NS') + ', ' + toDMS(lon, 'EW');
  if (settings.coord === 'utm') return toUTM(lat, lon);
  return lat.toFixed(6) + ', ' + lon.toFixed(6);
}
function toDDM(v, d) { const g = Math.trunc(Math.abs(v)); return g + '°' + ((Math.abs(v) - g) * 60).toFixed(4) + "' " + (v >= 0 ? d[0] : d[1]); }
function toDMS(v, d) { const g = Math.trunc(Math.abs(v)); const mf = (Math.abs(v) - g) * 60; const m = Math.trunc(mf); return g + '°' + m + "'" + ((mf - m) * 60).toFixed(1) + '" ' + (v >= 0 ? d[0] : d[1]); }
function toUTM(lat, lon) {
  const zone = Math.floor((lon + 180) / 6) + 1, hemi = lat >= 0 ? 'N' : 'S', a = 6378137, e2 = 0.00669438;
  const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180, lam0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180, N0 = lat < 0 ? 10000000 : 0;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = e2 / (1 - e2) * Math.cos(phi) ** 2, A = (lam - lam0) * Math.cos(phi);
  const E = 500000 + 0.9996 * n * (A + (1 - T + C) * A ** 3 / 6);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32) * Math.sin(2 * phi) + (15 * e2 ** 2 / 256) * Math.sin(4 * phi));
  const N2 = N0 + 0.9996 * (M + n * Math.tan(phi) * ((A ** 2 / 2) + (5 - T + 9 * C) * A ** 4 / 24));
  return zone + hemi + ' E:' + Math.round(E) + ' N:' + Math.round(N2);
}
function haversine(la1, lo1, la2, lo2) {
  const R = 6371, r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // km
}

// ── retorno ao usuário: toast, bipe, vibração ──────────────────
let _toastT = null;
function toast(msg, ms) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('on'), ms || 2200);
}
let _actx = null;
function beep(freq, dur) {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _actx.createOscillator(), g = _actx.createGain();
    o.frequency.value = freq || 1200; o.type = 'square'; g.gain.value = 0.08;
    o.connect(g); g.connect(_actx.destination); o.start(); o.stop(_actx.currentTime + (dur || 0.09));
  } catch (e) {}
}
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms || 40); } catch (e) {} }
