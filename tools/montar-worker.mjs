// Junta servidor/worker.js + servidor/painel.html em servidor/dist/worker.js (arquivo único para colar no Cloudflare)
import { readFileSync, writeFileSync } from 'fs';
const w = readFileSync(new URL('../servidor/worker.js', import.meta.url), 'utf8');
const h = readFileSync(new URL('../servidor/painel.html', import.meta.url), 'utf8');
writeFileSync(new URL('../servidor/dist/worker.js', import.meta.url), w.replace("'__PAINEL__'", () => JSON.stringify(h)));
console.log('ok', (w.length + h.length) / 1024 | 0, 'KB');
