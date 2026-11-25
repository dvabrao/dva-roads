// ════════════════════════════════════════════════════════════════
//  DVA Roads — camada de dados (único ponto de acesso ao armazenamento)
//  No APK: arquivos reais via window.NativeFS (pasta do app).
//  No navegador (prévia): simula os arquivos no localStorage.
//  Trocar o Drive por um banco multiusuário no futuro = mexer só aqui.
// ════════════════════════════════════════════════════════════════
const Store = (function () {
  const native = typeof window.NativeFS !== 'undefined';
  const P = 'dvafs:';
  const clean = (rel) => String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');

  const api = {
    native,
    base() { return native ? window.NativeFS.basePath() : '(prévia no navegador — localStorage)'; },
    writeText(rel, txt) {
      rel = clean(rel);
      if (native) return window.NativeFS.writeText(rel, txt);
      try { localStorage.setItem(P + rel, txt); return true; } catch (e) { console.warn('Store cheio', e); return false; }
    },
    readText(rel) {
      rel = clean(rel);
      if (native) { const r = window.NativeFS.readText(rel); return r == null ? null : r; }
      return localStorage.getItem(P + rel);
    },
    writeJSON(rel, o) { return api.writeText(rel, JSON.stringify(o)); },
    readJSON(rel, def) { try { const t = api.readText(rel); return t ? JSON.parse(t) : def; } catch (e) { return def; } },
    writeB64(rel, b64) {
      rel = clean(rel);
      if (native) return window.NativeFS.writeBase64(rel, b64);
      try { localStorage.setItem(P + rel, 'b64:' + b64); return true; } catch (e) { return false; }
    },
    readB64(rel) {
      rel = clean(rel);
      if (native) return window.NativeFS.readBase64(rel);
      const v = localStorage.getItem(P + rel);
      if (v == null) return null;
      return v.startsWith('b64:') ? v.slice(4) : btoa(unescape(encodeURIComponent(v)));
    },
    exists(rel) { rel = clean(rel); return native ? window.NativeFS.exists(rel) : localStorage.getItem(P + rel) != null; },
    /** Lista o conteúdo direto de uma pasta: [{name, dir}] */
    list(rel) {
      rel = clean(rel).replace(/\/$/, '');
      if (native) { try { return JSON.parse(window.NativeFS.list(rel)); } catch (e) { return []; } }
      const pre = P + (rel ? rel + '/' : ''); const seen = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); if (!k.startsWith(pre)) continue;
        const rest = k.slice(pre.length); const part = rest.split('/')[0];
        seen[part] = seen[part] || { name: part, dir: rest.includes('/') };
      }
      return Object.values(seen);
    },
    /** Todos os arquivos sob uma pasta (caminhos relativos a ela) */
    walk(rel) {
      rel = clean(rel).replace(/\/$/, ''); const out = [];
      const rec = (r, pre) => api.list(r).forEach(e => { const p = pre ? pre + '/' + e.name : e.name; if (e.dir) rec(r + '/' + e.name, p); else out.push(p); });
      rec(rel, ''); return out;
    },
    remove(rel) {
      rel = clean(rel);
      if (native) return window.NativeFS.remove(rel);
      const pre = P + rel;
      Object.keys(localStorage).filter(k => k === pre || k.startsWith(pre + '/')).forEach(k => localStorage.removeItem(k));
      return true;
    },
    /** Abre o "Enviar" do Android (WhatsApp, Drive, e-mail...) para um arquivo já gravado */
    async share(rel, mime) {
      rel = clean(rel);
      if (native) { window.NativeFS.shareFile(rel, mime || ''); return; }
      const b64 = api.readB64(rel); if (b64 == null) return;
      const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: mime || 'application/octet-stream' }));
      a.download = rel.split('/').pop(); a.click();
    },
    copyToDownloads(rel, sub) { rel = clean(rel); return native ? window.NativeFS.copyToDownloads(rel, sub || '') : null; },
    /** Backup: compacta uma pasta. Retorna {rel, visivel} */
    async zipDir(relDir, zipName) {
      relDir = clean(relDir);
      if (native) { try { return JSON.parse(window.NativeFS.zipDir(relDir, zipName)); } catch (e) { return null; } }
      // prévia: monta o .zip com JSZip
      const zip = new JSZip(); const top = relDir.split('/').pop();
      api.walk(relDir).forEach(f => {
        const v = localStorage.getItem(P + relDir + '/' + f);
        if (v.startsWith('b64:')) zip.file(top + '/' + f, v.slice(4), { base64: true }); else zip.file(top + '/' + f, v);
      });
      const b64 = await zip.generateAsync({ type: 'base64' });
      api.writeB64('Backup/' + zipName, b64);
      return { rel: 'Backup/' + zipName, visivel: 'Backup/' + zipName };
    },
    /** Restaura um .zip de sessão (base64). Retorna o nome da pasta restaurada. */
    async unzipSession(b64) {
      if (native) return window.NativeFS.unzipToSessions(b64);
      const zip = await JSZip.loadAsync(b64, { base64: true }); let first = null;
      for (const name of Object.keys(zip.files)) {
        const f = zip.files[name]; if (f.dir || name.includes('..')) continue;
        first = first || name.split('/')[0];
        if (/\.(jpg|jpeg|png|zip|kmz)$/i.test(name)) api.writeB64('Sessoes/' + name, await f.async('base64'));
        else api.writeText('Sessoes/' + name, await f.async('string'));
      }
      return first;
    },
  };
  return api;
})();

/** Converte texto para base64 (UTF-8) */
function b64utf8(txt) { return btoa(unescape(encodeURIComponent(txt))); }
