#!/usr/bin/env node
// Ferramenta de decifragem (roda na máquina do dev, com a chave privada).
//
// Uso:  node scripts/decrypt-report.mjs <arquivo.enc> [arquivo-chave-privada]
// Default da chave: <home>/liquidator-report-keys/chave-privada-NAO-COMPARTILHAR.key
//
// Escreve o pacote decifrado (report.zip) ao lado do .enc.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { open } = require('../src/crypto.js');

const encPath = process.argv[2];
const keyPath =
  process.argv[3] || join(homedir(), 'liquidator-report-keys', 'chave-privada-NAO-COMPARTILHAR.key');

if (!encPath) {
  console.error('Uso: node scripts/decrypt-report.mjs <arquivo.enc> [arquivo-chave-privada]');
  process.exit(1);
}
if (!existsSync(encPath)) {
  console.error(`Arquivo cifrado não encontrado: ${encPath}`);
  process.exit(1);
}
if (!existsSync(keyPath)) {
  console.error(`Chave privada não encontrada: ${keyPath}`);
  console.error('Passe o caminho como 2º argumento, ou gere com: npm run gen-keys');
  process.exit(1);
}

// A chave privada é armazenada com linhas de comentário (#) + base64.
const privB64 = readFileSync(keyPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('#'))
  .join('');

const sealed = readFileSync(encPath);

let clear;
try {
  clear = open(sealed, privB64);
} catch (e) {
  console.error('Falha ao decifrar. Chave errada ou pacote corrompido.');
  console.error(String(e.message || e));
  process.exit(2);
}

const outName = basename(encPath).replace(/\.(enc\.txt|enc|txt|zip)$/i, '') + '.zip';
const outPath = join(dirname(encPath), outName);
writeFileSync(outPath, clear);
console.log('Decifrado com sucesso:');
console.log('  ' + outPath);
