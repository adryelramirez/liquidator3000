'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { seal, open } = require('../src/crypto');

// Gera um par de teste (não usa a chave real do dev).
function genPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return {
    pubB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privB64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

test('round-trip: seal → open devolve os bytes originais', () => {
  const { pubB64, privB64 } = genPair();
  const msg = Buffer.from('conteúdo do report — PDFs e parsed.json 🧾', 'utf8');
  const sealed = seal(msg, pubB64);
  assert.ok(sealed.length > msg.length, 'pacote cifrado deve existir');
  assert.notEqual(sealed.toString('utf8'), msg.toString('utf8'), 'não pode estar em claro');
  const opened = open(sealed, privB64);
  assert.deepStrictEqual(opened, msg);
});

test('binário grande (simula PDF) sobrevive ao round-trip', () => {
  const { pubB64, privB64 } = genPair();
  const msg = crypto.randomBytes(2 * 1024 * 1024); // 2 MB
  const opened = open(seal(msg, pubB64), privB64);
  assert.ok(opened.equals(msg));
});

test('chave privada errada não abre (falha autenticada)', () => {
  const { pubB64 } = genPair();
  const outra = genPair();
  const sealed = seal(Buffer.from('segredo'), pubB64);
  assert.throws(() => open(sealed, outra.privB64));
});

test('pacote adulterado é rejeitado (GCM)', () => {
  const { pubB64, privB64 } = genPair();
  const sealed = seal(Buffer.from('segredo'), pubB64);
  sealed[sealed.length - 1] ^= 0xff; // corrompe 1 byte do ciphertext
  assert.throws(() => open(sealed, privB64));
});
