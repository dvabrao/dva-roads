// ════════════════════════════════════════════════════════════════
//  DVA Roads — licenças por módulo (ativação por chave)
//  Chave: DVAR1.<dados em base64url>.<assinatura ECDSA P-256 em base64url>
//  dados = {c: cliente, m: ["marcozero","slir","sh"] ou ["*"], v: "AAAA-MM-DD", e: emissão, u: técnico (opcional), g: 1 = gestor (opcional)}
//  O app só tem a chave PÚBLICA: confere a assinatura, não consegue criar chaves.
//  As chaves são geradas no Painel DVA Roads com a chave privada (fora do app).
// ════════════════════════════════════════════════════════════════
const License = (function () {
  const PUB = { kty: 'EC', crv: 'P-256', x: 'kvyvNzzQgU2JkaglthbI_WrM1q2eYGW1BFvl25mWbEA', y: '2fvhpRcQTeLAPENlOgBaIAW-PPzSxkk3Rh0x3h1vY_w' };
  const PUB2 = null;   // chave pública do servidor (chaves criadas no painel)
  const KEY = 'dvaroads_licencas';
  // chaves canceladas (começo da assinatura): deixam de valer no app e no servidor
  const REVOGADAS = ['ddqgEl7xU6NxE07gOrRAivZR'];
  let lic = [];            // chaves válidas: [{raw, c, m, v, e}]
  let _pub = null, _pub2 = null;

  const b64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };
  const bytes = (s) => Uint8Array.from(atob(b64u(s)), c => c.charCodeAt(0));
  const hoje = () => new Date().toISOString().slice(0, 10);

  async function pub() {
    if (!_pub) _pub = await crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return _pub;
  }
  /** Confere a chave. Retorna os dados ou lança um erro com a explicação. */
  async function verify(raw) {
    raw = String(raw || '').replace(/\s+/g, '');
    const p = raw.split('.');
    if (p.length !== 3 || p[0] !== 'DVAR1') throw new Error('Formato de chave inválido.');
    if (!window.crypto || !crypto.subtle) throw new Error('Este aparelho não consegue conferir chaves.');
    const corpo = new TextEncoder().encode(p[0] + '.' + p[1]);
    let ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await pub(), bytes(p[2]), corpo);
    if (!ok && PUB2) {
      if (!_pub2) _pub2 = await crypto.subtle.importKey('jwk', PUB2, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, _pub2, bytes(p[2]), corpo);
    }
    if (!ok) throw new Error('Chave não reconhecida. Confira se foi copiada inteira.');
    if (REVOGADAS.some(r => p[2].startsWith(r))) throw new Error('Esta chave foi cancelada. Peça uma nova chave.');
    const d = JSON.parse(decodeURIComponent(escape(atob(b64u(p[1])))));
    return Object.assign({ raw }, d);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(lic.map(l => l.raw))); } catch (e) {} }

  return {
    async load() {
      let raws = [];
      try { raws = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}
      lic = [];
      for (const r of raws) { try { lic.push(await verify(r)); } catch (e) { /* chave inválida: ignora */ } }
      setTimeout(() => License.conferir(), 4000);
    },
    /** com internet: pergunta ao servidor se alguma chave foi cancelada no painel e remove do aparelho */
    async conferir() {
      if (!lic.length || (navigator.onLine === false) || typeof IA === 'undefined') return;
      const url = (IA.url ? IA.url() : '').replace(/\/+$/, ''); if (!url) return;
      let mudou = false;
      for (const l of lic.slice()) {
        try {
          const r = await fetch(url + '/licenca/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: l.raw }) });
          if (!r.ok) continue; const d = await r.json();
          if (d.valida === false && !(l.v && l.v < hoje())) { lic = lic.filter(x => x.raw !== l.raw); mudou = true; }
        } catch (e) { return; }
      }
      if (mudou) { save(); try { toast('🔑 Uma chave foi cancelada pelo administrador'); UI.renderLicencas && UI.renderLicencas(); UI.render && UI.render(); } catch (e) {} }
    },
    /** Módulo liberado? (chave válida e dentro da validade) */
    ok(mod) {
      const h = hoje();
      return lic.some(l => (!l.v || l.v >= h) && (l.m || []).some(x => x === '*' || x === mod));
    },
    info(mod) {
      const h = hoje();
      const l = lic.filter(l => (l.m || []).some(x => x === '*' || x === mod)).sort((a, b) => (b.v || '9999') > (a.v || '9999') ? 1 : -1)[0];
      if (!l) return null;
      return { cliente: l.c, usuario: l.u || '', validade: l.v, vencida: l.v && l.v < h, admin: (l.m || []).includes('*') };
    },
    /** Chave (texto) que libera o módulo, para o servidor conferir */
    raw(mod) { const h = hoje(); const l = lic.find(l => (!l.v || l.v >= h) && (l.m || []).some(x => x === '*' || x === mod)); return l ? l.raw : ''; },
    admin() { return lic.some(l => (l.m || []).includes('*')); },
    async activate(raw) {
      const d = await verify(raw);
      if (d.v && d.v < hoje()) throw new Error('Esta chave venceu em ' + d.v.split('-').reverse().join('/') + '.');
      lic = lic.filter(l => l.raw !== d.raw); lic.push(d); save();
      return d;
    },
    async activateFromInput() {
      const el = $('lic-key');
      try {
        const d = await License.activate(el.value);
        el.value = '';
        toast('🔑 Chave ativada' + (d.c ? ' · ' + d.c : '') + (d.u ? ' · ' + d.u : ''));
        UI.renderLicencas(); UI.render();
      } catch (e) { UI.alert('Chave não ativada', e.message); }
    },
    _verify: verify,
  };
})();
