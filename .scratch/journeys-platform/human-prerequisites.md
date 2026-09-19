# Human prerequisites — things only Paul can do

Status: open
Purpose: everything the Foundation ticket needs that an agent cannot provision.
Check items off here; ticket 01 references this file as its human-gated criteria.
Never paste secret values into this file or any tracked file — they go into
`.env.local` (git-ignored) and the Vercel dashboard only.

## 1. Vercel

- [ ] Create a Vercel project named `journeys`, connected to `paul-macfarlane/journeys` on GitHub.
- [ ] Production branch: `main`. Preview deployments: on for all other branches.
- [ ] Note the production URL (e.g. `https://journeys-….vercel.app`) — needed for OAuth redirect URIs below.
- [ ] Optional: a custom domain. Not required for the hackathon.

## 2. Neon Postgres

- [ ] Create a Neon project `journeys` (any region near you).
- [ ] Copy the pooled connection string into Vercel env `DATABASE_URL` for **Production** and **Preview**.
- [ ] Local dev uses docker-compose Postgres, so no Neon string is needed in `.env.local` unless you want to point local at Neon.

## 3. Google OAuth (better-auth)

- [ ] In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (Web application) named `journeys`.
- [ ] Authorized redirect URIs — add all three:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://<production-url>/api/auth/callback/google`
  - `https://*.vercel.app/api/auth/callback/google` is **not** accepted by Google; preview deployments will not have Google sign-in unless you add each preview URL by hand. Accept this for the hackathon.
- [ ] Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel (Production) and `.env.local`.

## 4. Discord OAuth (better-auth)

- [ ] In the Discord Developer Portal, create an application `journeys` → OAuth2.
- [ ] Redirects:
  - `http://localhost:3000/api/auth/callback/discord`
  - `https://<production-url>/api/auth/callback/discord`
- [ ] Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel (Production) and `.env.local`.

## 5. better-auth secret

- [ ] Generate a random 32+ byte secret (`openssl rand -base64 32`) and set `BETTER_AUTH_SECRET` in Vercel (Production and Preview) and `.env.local`.
- [ ] Set `BETTER_AUTH_URL` to `http://localhost:3000` locally and the production URL in Vercel Production.

## 6. Anthropic API key (AI authoring — priority 11, can wait)

- [ ] Create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY` in Vercel (Production) and `.env.local`.
- [ ] Without it, AI features are hidden and everything else works — safe to defer until ticket 11.

## 7. Local machine

- [x] Node 24 and pnpm 10 present (verified 2026-09-18).
- [x] Docker present (verified 2026-09-18) — used for local Postgres via docker-compose.
- [ ] Optional: `pnpm add -g typescript-language-server typescript` then `/plugin install typescript-lsp@claude-plugins-official` for LSP diagnostics in Claude Code.
- [ ] Optional: enable the already-installed `playwright` plugin so agents can drive e2e runs.

## 8. Redirect URIs to revisit after first deploy

- [ ] Once the production URL is known, go back and fill it into sections 3 and 4.

## Expected `.env.example` (agents create this file; you fill `.env.local`)

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
ANTHROPIC_API_KEY=
```
