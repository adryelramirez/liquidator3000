'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { createServer } = require('../src/app');
const { makeBrevoSender } = require('../src/mailer');

// Sobe o server numa porta efêmera e devolve base URL + close().
function start(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

test('sem x-api-key → 401; key errada → 401; correta → 200', async () => {
  let called = 0;
  const server = createServer({ apiKey: 'segredo', sender: async () => { called++; } });
  const { url, close } = await start(server);
  try {
    const r1 = await fetch(`${url}/report`, { method: 'POST', body: 'x' });
    assert.equal(r1.status, 401);
    const r2 = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'errada' }, body: 'x' });
    assert.equal(r2.status, 401);
    const r3 = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: 'pacote' });
    assert.equal(r3.status, 200);
    assert.equal(called, 1);
  } finally { await close(); }
});

test('destino é SEMPRE o fixo, ignorando qualquer header do request', async () => {
  let captured = null;
  const fakeFetch = async (_u, opts) => { captured = JSON.parse(opts.body); return { ok: true, text: async () => '' }; };
  const sender = makeBrevoSender({
    apiKey: 'brevo', senderEmail: 'liquidator3000psfrgr@gmail.com',
    recipient: 'liquidator3000psfrgr@gmail.com', fetchImpl: fakeFetch,
  });
  const server = createServer({ apiKey: 'segredo', sender });
  const { url, close } = await start(server);
  try {
    const r = await fetch(`${url}/report`, {
      method: 'POST',
      headers: { 'x-api-key': 'segredo', 'x-to': 'atacante@evil.com', to: 'atacante@evil.com' },
      body: Buffer.from('pacote-cifrado'),
    });
    assert.equal(r.status, 200);
    assert.equal(captured.to.length, 1);
    assert.equal(captured.to[0].email, 'liquidator3000psfrgr@gmail.com');
  } finally { await close(); }
});

test('não persiste em disco durante um POST válido', async () => {
  const spies = ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'createWriteStream'];
  const originals = {};
  let writes = 0;
  for (const m of spies) { originals[m] = fs[m]; fs[m] = (...a) => { writes++; return originals[m](...a); }; }
  try {
    const server = createServer({ apiKey: 'segredo', sender: async () => {} });
    const { url, close } = await start(server);
    const r = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: Buffer.from('cifrado') });
    assert.equal(r.status, 200);
    await close();
    assert.equal(writes, 0, 'nenhuma escrita em disco deve ocorrer');
  } finally { for (const m of spies) fs[m] = originals[m]; }
});

test('o sender recebe exatamente os bytes postados (relay não descriptografa)', async () => {
  let got = null;
  const server = createServer({ apiKey: 'segredo', sender: async ({ sealed }) => { got = Buffer.from(sealed); } });
  const { url, close } = await start(server);
  try {
    const payload = Buffer.from([0x4c, 0x51, 0x52, 0x31, 1, 2, 3, 250, 0, 99]);
    const r = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: payload });
    assert.equal(r.status, 200);
    assert.ok(got.equals(payload));
  } finally { await close(); }
});

test('rate limit → 429 depois do máximo', async () => {
  const server = createServer({ apiKey: 'segredo', sender: async () => {}, rateLimit: { max: 2, windowMs: 60000 } });
  const { url, close } = await start(server);
  try {
    const post = () => fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: 'x' });
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
  } finally { await close(); }
});

test('sender que falha → 502 (e não vaza detalhe)', async () => {
  const server = createServer({ apiKey: 'segredo', sender: async () => { throw new Error('smtp caiu'); } });
  const { url, close } = await start(server);
  try {
    const r = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: 'x' });
    assert.equal(r.status, 502);
    const j = await r.json();
    assert.ok(!/smtp caiu/.test(JSON.stringify(j)));
  } finally { await close(); }
});
