'use strict';
// Envio via API HTTP da Brevo (fetch nativo, sem dependência).
// O destinatário é FIXO no closure — o request nunca escolhe destino.

function makeBrevoSender({ apiKey, senderEmail, recipient, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  if (!apiKey || !senderEmail || !recipient) {
    throw new Error('makeBrevoSender: apiKey, senderEmail e recipient são obrigatórios.');
  }
  return async function sendReport({ sealed, meta = {} }) {
    const body = {
      sender: { email: senderEmail, name: 'Liquidator Report' },
      to: [{ email: recipient }], // FIXO — nunca vem do request
      subject: `Report Liquidator ${meta.appVersion || ''} ${meta.stamp || ''}`.trim(),
      textContent:
        'Report cifrado recebido do Liquidator 3000.\n' +
        `App: ${meta.appVersion || '?'}\n` +
        `Quando: ${meta.stamp || '?'}\n` +
        `Tamanho: ${sealed.length} bytes\n\n` +
        'Abra o anexo com a ferramenta de decifragem e sua chave privada.',
      attachment: [
        { name: meta.filename || 'report.enc', content: Buffer.from(sealed).toString('base64') },
      ],
    };
    const res = await doFetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Brevo respondeu ${res.status}: ${detail}`);
    }
    return { ok: true };
  };
}

module.exports = { makeBrevoSender };
