// Gera uma chave de ativação do DVA Roads.
// Uso: node gerar-chave.mjs <chave-privada.jwk.json> "<cliente>" <modulos|*> <validade AAAA-MM-DD> [--usuario "Nome"] [--gestor]
// Ex.:  node gerar-chave.mjs ~/dvaroads-chave-privada.jwk.json "Construtora X" sv,sh 2027-12-31 --usuario "João Silva"
//   · cliente  = empresa/banco onde os dados ficam (todos os técnicos do mesmo cliente lançam no mesmo banco)
//   · usuario  = técnico dono da chave: aparece nos levantamentos e, sem --gestor, ele só vê o que ele mesmo levantou
//   · --gestor = vê no painel tudo do cliente (de todos os técnicos)
//   · chave sem --usuario funciona como antes (vê tudo do cliente)
// A chave privada NUNCA vai para o repositório nem para o app.
import { readFileSync } from 'fs';
import { createPrivateKey, sign } from 'crypto';
const args = process.argv.slice(2), pos = [];
let usuario = '', gestor = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--usuario') usuario = args[++i] || '';
  else if (args[i] === '--gestor') gestor = true;
  else pos.push(args[i]);
}
const [arq, cliente, mods, validade] = pos;
if (!arq || !cliente || !mods || !validade) { console.error('Uso: node gerar-chave.mjs <chave.jwk.json> "<cliente>" <modulos|*> <AAAA-MM-DD> [--usuario "Nome"] [--gestor]'); process.exit(1); }
const key = createPrivateKey({ key: JSON.parse(readFileSync(arq, 'utf8')), format: 'jwk' });
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dados = { c: cliente, m: mods === '*' ? ['*'] : mods.split(','), v: validade, e: new Date().toISOString().slice(0, 10) };
if (usuario) dados.u = usuario;
if (gestor) dados.g = 1;
const corpo = 'DVAR1.' + b64u(JSON.stringify(dados));
const sig = sign('sha256', Buffer.from(corpo), { key, dsaEncoding: 'ieee-p1363' });
console.log(corpo + '.' + b64u(sig));
