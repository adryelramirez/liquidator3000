'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { createServer } = require('../src/app');
const { makeBrevoSender } = require('../src/mailer');

function start(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

const jsonBody = (obj) => JSON.stringify(obj);

test('sem x-api-key → 401; key errada → 401; correta → 200', async () => {
  let called = 0;
  const server = createServer({ apiKey: 'segredo', sender: async () => { called++; } });
  const { url, close } = await start(server);
  try {
    const r1 = await fetch(`${url}/report`, { method: 'POST', body: jsonBody({ reportText: 'x' }) });
    assert.equal(r1.status, 401);
    const r2 = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'errada' }, body: jsonBody({ reportText: 'x' }) });
    assert.equal(r2.status, 401);
    const r3 = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: jsonBody({ reportText: 'x' }) });
    assert.equal(r3.status, 200);
    assert.equal(called, 1);
  } finally { await close(); }
});

test('destino fixo + texto no corpo + PDFs como anexos', async () => {
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
      headers: { 'x-api-key': 'segredo', 'x-app-version': '0.1.11' },
      body: jsonBody({
        reportText: 'DESCRICAO DO PROBLEMA',
        to: 'atacante@evil.com',
        files: [{ name: 'dossie.pdf', content: 'QUJD' }],
      }),
    });
    assert.equal(r.status, 200);
    assert.equal(captured.to[0].email, 'liquidator3000psfrgr@gmail.com');
    assert.equal(captured.textContent, 'DESCRICAO DO PROBLEMA');
    assert.equal(captured.attachment.length, 1);
    assert.equal(captured.attachment[0].name, 'dossie.pdf');
    assert.equal(captured.attachment[0].content, 'QUJD');
  } finally { await close(); }
});

test('corpo inválido (não-JSON) → 400', async () => {
  const server = createServer({ apiKey: 'segredo', sender: async () => {} });
  const { url, close } = await start(server);
  try {
    const r = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: 'isso não é json' });
    assert.equal(r.status, 400);
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
    const r = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: jsonBody({ reportText: 'x' }) });
    assert.equal(r.status, 200);
    await close();
    assert.equal(writes, 0);
  } finally { for (const m of spies) fs[m] = originals[m]; }
});

test('o sender recebe reportText e files do payload', async () => {
  let got = null;
  const server = createServer({ apiKey: 'segredo', sender: async (p) => { got = p; } });
  const { url, close } = await start(server);
  try {
    const r = await fetch(`${url}/report`, {
      method: 'POST', headers: { 'x-api-key': 'segredo' },
      body: jsonBody({ reportText: 'oi', files: [{ name: 'a.pdf', content: 'Zg==' }] }),
    });
    assert.equal(r.status, 200);
    assert.equal(got.reportText, 'oi');
    assert.equal(got.files[0].name, 'a.pdf');
  } finally { await close(); }
});

test('rate limit → 429 depois do máximo', async () => {
  const server = createServer({ apiKey: 'segredo', sender: async () => {}, rateLimit: { max: 2, windowMs: 60000 } });
  const { url, close } = await start(server);
  try {
    const post = () => fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: jsonBody({ reportText: 'x' }) });
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
  } finally { await close(); }
});

test('sender que falha → 502 (e não vaza detalhe)', async () => {
  const server = createServer({ apiKey: 'segredo', sender: async () => { throw new Error('smtp caiu'); } });
  const { url, close } = await start(server);
  try {
    const r = await fetch(`${url}/report`, { method: 'POST', headers: { 'x-api-key': 'segredo' }, body: jsonBody({ reportText: 'x' }) });
    assert.equal(r.status, 502);
    const j = await r.json();
    assert.ok(!/smtp caiu/.test(JSON.stringify(j)));
  } finally { await close(); }
});
