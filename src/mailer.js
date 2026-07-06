'use strict';
// Envio via API HTTP da Brevo (fetch nativo, sem dependência).
// O destinatário é FIXO no closure — o request nunca escolhe destino.
// Envia o texto do report no CORPO do email e os PDFs como anexos normais.

function makeBrevoSender({ apiKey, senderEmail, recipient, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  if (!apiKey || !senderEmail || !recipient) {
    throw new Error('makeBrevoSender: apiKey, senderEmail e recipient são obrigatórios.');
  }
  return async function sendReport({ reportText = '', files = [], meta = {} }) {
    // Anexos: cada item { name, content } (content = base64 do arquivo).
    const attachment = (files || [])
      .filter((f) => f && f.name && f.content)
      .map((f) => ({ name: f.name, content: f.content }));

    const body = {
      sender: { email: senderEmail, name: 'Liquidator Report' },
      to: [{ email: recipient }], // FIXO — nunca vem do request
      subject: `Report Liquidator ${meta.appVersion || ''} ${meta.stamp || ''}`.trim(),
      textContent: reportText || 'Report do Liquidator 3000.',
    };
    if (attachment.length) body.attachment = attachment;

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
