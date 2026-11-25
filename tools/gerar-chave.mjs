// Gera uma chave de ativação do DVA Roads.
// Uso: node gerar-chave.mjs <arquivo-chave-privada.jwk.json> "<cliente>" <modulos|*> <validade AAAA-MM-DD>
// Ex.:  node gerar-chave.mjs ~/dvaroads-chave-privada.jwk.json "Construtora X" marcozero,sh 2027-12-31
// A chave privada NUNCA vai para o repositório nem para o app.
import { readFileSync } from 'fs';
import { createPrivateKey, sign } from 'crypto';
const [, , arq, cliente, mods, validade] = process.argv;
if (!arq || !cliente || !mods || !validade) { console.error('Uso: node gerar-chave.mjs <chave.jwk.json> "<cliente>" <modulos|*> <AAAA-MM-DD>'); process.exit(1); }
const key = createPrivateKey({ key: JSON.parse(readFileSync(arq, 'utf8')), format: 'jwk' });
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dados = { c: cliente, m: mods === '*' ? ['*'] : mods.split(','), v: validade, e: new Date().toISOString().slice(0, 10) };
const corpo = 'DVAR1.' + b64u(JSON.stringify(dados));
const sig = sign('sha256', Buffer.from(corpo), { key, dsaEncoding: 'ieee-p1363' });
console.log(corpo + '.' + b64u(sig));
