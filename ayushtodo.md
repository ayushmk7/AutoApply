# Ayush — setup checklist

- Install Node 20+ and Docker.
- Copy `.env.example` → `.env` at repo root; fill `VITE_FIREBASE_*` when you want real login.
- Copy `backend/server/.env.example` → `backend/server/.env`.
- Generate strong random values: `DEMO_JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` (64 hex chars), `OAUTH_STATE_SECRET`.
- Start Redis (e.g. `docker compose` using repo `docker-compose.yml` or `backend/docker-compose.yml`).
- Create a Firebase project: enable Auth + Firestore; add a Web app for frontend config.
- Download a Firebase **service account** JSON; set `FIREBASE_*` in `backend/server/.env` (or path/json/base64 variant).
- Optional: run Firebase emulators so local dev does not touch prod data.
- Create a GCS bucket and IAM for the service account; set `GCS_BUCKET`.
- Get an Anthropic API key; set `ANTHROPIC_API_KEY`.
- Sign up for AgentMail; set keys + webhook secret; point webhook URL at your deployed API when live.
- Add GitHub PAT + `GITHUB_SCRAPE_REPOS` when you turn on listing scrape.
- Add Google OAuth client + redirect URIs for local and prod; set `GOOGLE_*` and `GOOGLE_SHEETS_REDIRECT_URI`.
- Add Apollo and 2Captcha keys only when you need those features.
- For cheap local dev: use `MOCK_AGENTMAIL=true` / `MOCK_CLASSIFY_INBOUND_EMAIL=true` where possible.
- Before production: set `NODE_ENV=production`, real `API_BASE_URL` and `FRONTEND_URL`, turn mocks off, fill every key `config.ts` requires.
- Deploy: static frontend (e.g. Cloudflare Pages / Netlify / Vercel) + host API + worker + Redis + enough RAM for Playwright.
- Store secrets in the host’s secret manager, not in git.
