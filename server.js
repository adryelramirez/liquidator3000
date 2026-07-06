'use strict';
// Ponto de entrada: lê env e sobe o relay. Falha cedo se faltar config.

const { createServer } = require('./src/app');
const { makeBrevoSender } = require('./src/mailer');

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[relay] Faltando variável de ambiente obrigatória: ${name}`);
    process.exit(1);
  }
  return v;
}

const apiKey = required('REPORT_API_KEY');
const recipient = required('REPORT_RECIPIENT');
const brevoApiKey = required('BREVO_API_KEY');
const senderEmail = required('BREVO_SENDER');

const port = Number(process.env.PORT || 8787);
const max = Number(process.env.RATE_LIMIT_MAX || 20);
const windowMin = Number(process.env.RATE_LIMIT_WINDOW_MIN || 15);

const sender = makeBrevoSender({ apiKey: brevoApiKey, senderEmail, recipient });
const server = createServer({
  apiKey,
  sender,
  rateLimit: { max, windowMs: windowMin * 60 * 1000 },
});

server.listen(port, () => {
  console.log(`[relay] ouvindo na porta ${port} — destino fixo: ${recipient}`);
});
