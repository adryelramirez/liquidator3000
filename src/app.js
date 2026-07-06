'use strict';
// Relay HTTP nativo. Recebe o pacote CIFRADO no corpo (octet-stream) e o
// encaminha via `sender`. Não persiste nada. Não descriptografa.

const http = require('node:http');

function createServer({
  apiKey,
  sender,
  rateLimit = { max: 20, windowMs: 15 * 60 * 1000 },
  maxBodyBytes = 45 * 1024 * 1024,
} = {}) {
  if (!apiKey) throw new Error('createServer: apiKey é obrigatória.');
  if (typeof sender !== 'function') throw new Error('createServer: sender deve ser função.');

  const hits = new Map(); // ip -> timestamps[]
  function isRateLimited(ip) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < rateLimit.windowMs);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length > rateLimit.max;
  }

  const handler = (req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };

    const path = (req.url || '').split('?')[0];
    if (req.method === 'GET' && path === '/health') return send(200, { ok: true });
    if (req.method !== 'POST' || path !== '/report') return send(404, { error: 'not found' });

    if ((req.headers['x-api-key'] || '') !== apiKey) return send(401, { error: 'unauthorized' });

    const ip = req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) return send(429, { error: 'rate limit' });

    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBodyBytes) {
        aborted = true;
        send(413, { error: 'payload too large' });
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', async () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks);
      if (raw.length === 0) return send(400, { error: 'empty body' });
      let payload;
      try {
        payload = JSON.parse(raw.toString('utf8'));
      } catch (_e) {
        return send(400, { error: 'invalid json' });
      }
      // Metadados NÃO sensíveis.
      const meta = {
        appVersion: req.headers['x-app-version'] || payload.meta?.appVersion || null,
        stamp: payload.meta?.stamp || null,
      };
      try {
        await sender({ reportText: payload.reportText, files: payload.files, meta });
        send(200, { ok: true });
      } catch (_e) {
        send(502, { error: 'envio falhou' });
      }
    });
    req.on('error', () => {
      if (!aborted) send(400, { error: 'bad request' });
    });
  };

  return http.createServer(handler);
}

module.exports = { createServer };
