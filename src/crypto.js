'use strict';
// Cifra assimétrica dos reports (ECIES) — só com node:crypto, sem dependências.
//
// Esquema (padrão, bem estabelecido):
//   1. Par efêmero X25519 por mensagem.
//   2. Segredo compartilhado = ECDH(efêmera_privada, destinatário_pública).
//   3. Chave AES = HKDF-SHA256(segredo, salt = efêmera_pública_DER).
//   4. AES-256-GCM (confidencialidade + integridade autenticada).
//
// Formato do pacote cifrado (binário):
//   MAGIC(4="LQR1") | ephPubLen(1) | ephPubDer | iv(12) | tag(16) | ciphertext
//
// Só a chave PRIVADA do destinatário abre. A pública pode ser embutida no app.

const crypto = require('node:crypto');

const MAGIC = Buffer.from('LQR1', 'ascii');
const INFO = Buffer.from('liquidator-report-v1', 'utf8');
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(sharedSecret, ephPubDer) {
  // salt = DER da pública efêmera (o destinatário a recebe no pacote).
  const keyBuf = crypto.hkdfSync('sha256', sharedSecret, ephPubDer, INFO, 32);
  return Buffer.from(keyBuf);
}

/**
 * Cifra `message` (Buffer) para a chave pública (base64 de SPKI DER, X25519).
 * Retorna um Buffer com o pacote cifrado.
 */
function seal(message, recipientPubB64) {
  const recipientPub = crypto.createPublicKey({
    key: Buffer.from(recipientPubB64, 'base64'),
    type: 'spki',
    format: 'der',
  });

  const eph = crypto.generateKeyPairSync('x25519');
  const ephPubDer = eph.publicKey.export({ type: 'spki', format: 'der' });
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: recipientPub });
  const key = deriveKey(shared, ephPubDer);

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(message), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([
    MAGIC,
    Buffer.from([ephPubDer.length]),
    ephPubDer,
    iv,
    tag,
    ct,
  ]);
}

/**
 * Abre um pacote cifrado com a chave privada (base64 de PKCS8 DER, X25519).
 * Retorna o Buffer da mensagem original. Lança se o pacote for inválido/adulterado.
 */
function open(sealed, privB64) {
  if (!Buffer.isBuffer(sealed)) sealed = Buffer.from(sealed);
  if (sealed.length < 5 || !sealed.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Pacote inválido: MAGIC não confere.');
  }
  let off = 4;
  const ephLen = sealed[off]; off += 1;
  const ephPubDer = sealed.subarray(off, off + ephLen); off += ephLen;
  const iv = sealed.subarray(off, off + IV_LEN); off += IV_LEN;
  const tag = sealed.subarray(off, off + TAG_LEN); off += TAG_LEN;
  const ct = sealed.subarray(off);

  const priv = crypto.createPrivateKey({
    key: Buffer.from(privB64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  const ephPub = crypto.createPublicKey({ key: ephPubDer, type: 'spki', format: 'der' });
  const shared = crypto.diffieHellman({ privateKey: priv, publicKey: ephPub });
  const key = deriveKey(shared, ephPubDer);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

module.exports = { seal, open };
