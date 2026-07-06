# Liquidator Report Relay

Recebe o report do Liquidator 3000 e encaminha por email, **sem guardar nada**.
O texto do report vai no **corpo** do email e os PDFs como **anexos normais**
(abrem direto no Gmail). Zero dependências externas (só Node built-ins). Node ≥ 20.

## Segurança
- Destinatário **fixo** (env do servidor); o request não escolhe destino.
- Segredos (`BREVO_API_KEY`) ficam **só no servidor**, nunca no `.exe`.
- O relay **não persiste**: recebe → envia → descarta.
- Tráfego por HTTPS/TLS. Obs.: os PDFs trafegam/ficam no email em texto puro —
  aceitável por irem só pro Gmail dedicado do dev, que é quem já lida com os dados.

## Contrato do endpoint
`POST /report` (header `x-api-key`), corpo JSON:
```json
{
  "reportText": "texto do report (vai no corpo do email)",
  "files": [{ "name": "dossie.pdf", "content": "<base64 do PDF>" }],
  "meta": { "appVersion": "0.1.11", "stamp": "20260706-1458" }
}
```
`GET /health` → `{ "ok": true }`.

## Estrutura
```
src/app.js       servidor HTTP (auth, rate limit, /report, /health)
src/mailer.js    envio via API HTTP da Brevo (destino fixo, texto + anexos)
server.js        lê env e sobe
test/            node --test (7 testes)
```

## Testes / local
```
npm test
cp .env.example .env   # preencha
npm start
```

## Deploy no Render (grátis)
1. Repo já no GitHub (`.gitignore` protege `.env`).
2. Render lê o `render.yaml` (runtime node). Use **New → Blueprint**.
3. Preencha as env vars do `.env.example` (`REPORT_API_KEY`, `REPORT_RECIPIENT`,
   `BREVO_API_KEY`, `BREVO_SENDER`).
4. Deploy. Free tier hiberna: 1ª chamada do dia ~30s.

## Brevo (email grátis, sem domínio)
1. Conta em brevo.com com o Gmail dedicado.
2. **Senders**: adicione e valide `liquidator3000psfrgr@gmail.com`.
3. **SMTP & API > API Keys**: gere a chave → `BREVO_API_KEY`.
