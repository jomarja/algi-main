# ალგი (Algi) — web

The web version of the Algi iOS app: a character-led personal finance coach for Georgia, with Luka as the
coach. Same design and features as the iOS app (Algi-Luka), responsive from phones to laptops, with real
data from **TBC Bank Open Banking** and an **AI coach powered by Claude**.

> The previous web demo (the savings navigator for "Sandro") is kept unchanged in `../algi-main-previous`.

## Run it

```bash
npm install
cp .env.example .env        # optional: TBC credentials and ANTHROPIC_API_KEY
npm run dev:server          # API + mock TBC bank on http://localhost:8787
npm run dev                 # the app on http://localhost:5173 (proxies /api to the server)
npm test                    # engine, open banking and AI coach tests
npm run build               # type-checks app + server, builds the front end into dist/
```

Production: `npm run build && NODE_ENV=production npm run start` serves the API and `dist/` from one
process (Node 23.6+ runs the TypeScript server directly). See **Deployment** for the Azure VM.

## How it fits together

```
browser (React, src/)  ──/api/bank/*──►  server/openbanking  ──mTLS──►  TBC Open Banking (NextGenPSD2 AIS)
                       ──/api/coach/*─►  server/ai           ──────►  Claude (Anthropic API)
                                          │                         └─ or server/mock-tbc in mock mode
                                          └─ server/http.ts sessions: tokens never reach the browser
```

| Path | What |
| --- | --- |
| `shared/bank.ts`, `shared/coach.ts` | The data and HTTP contracts both sides use |
| `server/index.ts` | Node server (no framework): routes, sessions, static files |
| `server/config.ts`, `.env.example` | All settings; `TBC_MODE` = `mock` / `sandbox` / `production` |
| `server/openbanking/` | TBC consent → OAuth (PKCE) → token → accounts, balances, transactions, loans; normalisation and categorisation |
| `server/mock-tbc/` | A faithful imitation of TBC's Open Banking API, so everything works without credentials |
| `server/ai/` | Luka the AI coach: system prompt, live bank-data context, streaming chat, structured recommendations |
| `src/engine/` | The iOS app's logic ported to TypeScript (budget, allowance, goal planner, loans, what-if, journey, rewards, coach) |
| `src/state/` | The app store (iOS AppState) and its React binding |
| `src/design/`, `src/layout/` | Design system and responsive shell (bottom tabs on phones, sidebar on laptops) |
| `src/screens/` | Every screen of the iOS app |
| `public/luka/` | Luka's Higgsfield artwork and animations |

## TBC Open Banking

Algi uses TBC's **Account Information Service** (NextGenPSD2 v1.3.6, OAuth SCA approach):

1. **Consent** — `POST /0.8/v1/consents` asks for access to the accounts the user chooses at the bank.
2. **Sign-in at TBC** — the user is sent to TBC's authorize page (`/psd2/openbanking/oauth/authorize`,
   scope `AIS:<consentId>`, PKCE) and approves.
3. **Token** — TBC redirects to `/api/bank/callback`; the server exchanges the code at
   `/openbanking/oauth/token` over mutual TLS and keeps the tokens in the server-side session.
4. **Data** — accounts with balances, transactions (booked + pending), card accounts, loans and savings are
   read, normalised into `shared/bank.ts` and categorised (Wolt → food delivery, Nikora → groceries, …).
   Every screen and the AI coach use this data; pulling to refresh fetches it again.

### Modes

| `TBC_MODE` | What you need | Use |
| --- | --- | --- |
| `mock` (default) | nothing | The built-in mock bank follows TBC's exact flow and payloads, with a demo persona whose month matches the iOS app |
| `sandbox` | a developer account and registered app at developers.tbcbank.ge, `TBC_CLIENT_ID`, a TBC-accepted QWAC certificate (`TBC_CERT_PATH`, `TBC_KEY_PATH`) | TBC's test environment |
| `production` | all of the above, plus an open banking licence from the National Bank of Georgia | Real customers |

If TBC asks for signed requests, also set the QSealC key and certificate (`TBC_SIGNING_KEY_PATH`,
`TBC_SIGNING_CERT_PATH`); the server then adds `Digest` and `X-JWS-Signature`.

## AI coach

Set `ANTHROPIC_API_KEY` (and optionally `AI_MODEL`, default `claude-opus-5-5`). Luka then:

- answers in the chat with streaming replies grounded in the user's live bank data, goals and plan;
- generates the "next step" recommendations from the same data.

Every request re-reads the latest bank data, so answers reflect new transactions right away. The rules Luka
follows (essentials are never cut, no investment advice, no choosing banks for people, Georgian or English,
data is never invented) are in `server/ai/prompts.ts`. Without a key, the app falls back to Luka's built-in
scripted answers from the iOS app.

## Deployment (Azure VM)

| | |
| --- | --- |
| Host | `algi-demo.polandcentral.cloudapp.azure.com`, user `azureuser`, key `~/.ssh/id_ed25519` |
| Web | nginx serves `dist/` from `/var/www/algi` and forwards `/api` + `/mock-tbc` to Node on port 8787 |
| Server | systemd unit `algi` runs `/opt/algi/server/index.ts` with Node 24; secrets in `/etc/algi/algi.env` (mode 600) |

```bash
HOST=azureuser@algi-demo.polandcentral.cloudapp.azure.com ./deploy/deploy.sh
```

`deploy/cloud-init.yaml` prepares a new VM (nginx, certbot, Node 24). Put `PUBLIC_BASE_URL=https://<host>`,
the TBC settings and `ANTHROPIC_API_KEY` in `/etc/algi/algi.env` before the first deploy. The VM's
certificate files for TBC must be readable by `azureuser` and referenced by absolute path.

Static-only hosts (Vercel, Netlify) can still serve the front end, but open banking and the AI coach need
the Node server.
