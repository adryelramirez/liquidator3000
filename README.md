# Liquidator Report Relay

Recebe o report **cifrado** do Liquidator 3000 e encaminha por email, **sem guardar
nada**. Zero dependências externas (só Node built-ins). Node ≥ 20.

## Como a confidencialidade é garantida
- O app cifra o report com a **chave pública** (assimétrica). Só a **chave privada**,
  que fica **só na sua máquina**, abre. O relay e o email nunca veem o conteúdo em claro.
- O destinatário é **fixo** (env do servidor); o request não escolhe destino.
- Segredos (`BREVO_API_KEY`) ficam **só no servidor**, nunca no `.exe`.
- O relay **não persiste** nada: recebe → envia → descarta.

## Estrutura
```
src/crypto.js    ECIES X25519 + AES-256-GCM (seal/open)
src/app.js       servidor HTTP (auth, rate limit, /report, /health)
src/mailer.js    envio via API HTTP da Brevo (destino fixo)
server.js        lê env e sobe
scripts/gen-keys.mjs        gera o par de chaves
scripts/decrypt-report.mjs  abre um .enc com a chave privada
test/            node --test (10 testes: cifra + relay)
```

## Testes
```
npm test
```

## Setup local
```
cp .env.example .env      # preencha os valores
npm start                 # sobe em PORT (default 8787)
```

## Chaves (fazer 1 vez)
```
npm run gen-keys
```
- Salva a **privada** em `~/liquidator-report-keys/chave-privada-NAO-COMPARTILHAR.key`
  (guarde num backup seguro — é o único segredo que abre os reports).
- Imprime a **pública** — é ela que vai embutida no app do Liquidator.

## Abrir um report que chegou por email
```
npm run decrypt -- caminho/do/report.enc
```
Gera o `report.zip` ao lado, com `report.txt` + `parsed.json` + PDFs.

## Deploy no Render (grátis)
1. Suba esta pasta num repositório Git (o `.gitignore` já protege `.env` e a chave).
2. No Render: **New > Web Service**, aponte pro repo.
   - Build command: (vazio — não há deps)
   - Start command: `npm start`
3. Em **Environment**, adicione as variáveis do `.env.example`:
   - `REPORT_API_KEY` (invente uma string longa; a mesma vai embutida no app)
   - `REPORT_RECIPIENT` = `liquidator3000psfrgr@gmail.com`
   - `BREVO_API_KEY`, `BREVO_SENDER`
4. Deploy. A URL pública (ex.: `https://liquidator-relay.onrender.com`) vai embutida no app.
   - Free tier hiberna: a 1ª chamada do dia pode levar ~30s.

## Brevo (email grátis, sem domínio)
1. Conta em brevo.com com o Gmail dedicado.
2. **Senders**: adicione e valide `liquidator3000psfrgr@gmail.com`.
3. **SMTP & API > API Keys**: gere a chave → `BREVO_API_KEY`.
