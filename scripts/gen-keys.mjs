#!/usr/bin/env node
// Gera o par de chaves (X25519) do esquema de cifra dos reports.
//
//   • Chave PÚBLICA  → impressa no stdout (segura pra embutir no app).
//   • Chave PRIVADA  → gravada num arquivo local, FORA do repositório.
//                      NUNCA é impressa (não entra em logs/transcrições).
//
// Uso:  node scripts/gen-keys.mjs [pastaDeSaida]
// Default da pasta: <home>/liquidator-report-keys
//
// A chave privada é o ÚNICO segredo que abre os reports. Guarde-a com cuidado
// (gerenciador de senhas / backup offline). Se perder, reports antigos ficam
// ilegíveis. Se vazar, a proteção cai — nesse caso gere um novo par e troque a
// pública embutida no app.

import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const outDir = process.argv[2] || join(homedir(), 'liquidator-report-keys');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('x25519');

// Formato compacto e round-trippável com createPublicKey/createPrivateKey:
// SPKI DER (pública) e PKCS8 DER (privada), em base64.
const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const privB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');

const privPath = join(outDir, 'chave-privada-NAO-COMPARTILHAR.key');
const pubPath = join(outDir, 'chave-publica.txt');

const privFileBody =
  '# CHAVE PRIVADA do Liquidator Report — NÃO COMPARTILHE, NÃO VERSIONE.\n' +
  '# É o único segredo que decifra os reports. Guarde em local seguro.\n' +
  privB64 + '\n';

writeFileSync(privPath, privFileBody, { encoding: 'utf8' });
writeFileSync(pubPath, pubB64 + '\n', { encoding: 'utf8' });

console.log('=== PAR DE CHAVES GERADO ===');
console.log('Chave PRIVADA salva em (guarde com segurança, NÃO compartilhe):');
console.log('  ' + privPath);
console.log('Chave PÚBLICA salva em:');
console.log('  ' + pubPath);
console.log('');
console.log('CHAVE PÚBLICA (embuta esta no app — pode expor à vontade):');
console.log(pubB64);
