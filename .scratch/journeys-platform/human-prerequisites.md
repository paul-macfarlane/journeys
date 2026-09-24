# Human prerequisites — things only Paul can do

Status: open
Purpose: everything the Foundation ticket needs that an agent cannot provision.
Check items off here; ticket 01 references this file as its human-gated criteria.
Never paste secret values into this file or any tracked file — they go into
`.env.local` (git-ignored) and the Vercel dashboard only.

Production URL: `https://journeys-mvp-prod.vercel.app` (renamed 2026-09-24; the old `journeys-ten-virid.vercel.app` still serves until removed)
Staging URL: `https://journeys-mvp-staging.vercel.app` (renamed 2026-09-24 from `staging-journeys-ten-virid.vercel.app`)

## 1. Vercel

- [x] Create a Vercel project named `journeys`, connected to `paul-macfarlane/journeys` on GitHub.
- [x] Production branch: `main`. Preview deployments: on for all other branches.
- [x] Note the production URL (above) — needed for OAuth redirect URIs below.
- [ ] Optional: a custom domain. Not required for the hackathon.

## 2. Neon Postgres

- [x] Create a Neon project `journeys` (any region near you).
- [x] Copy the pooled connection string into Vercel env `DATABASE_URL` for **Production** and **Preview**.
- [x] Recommended: create a Neon branch `staging` and use *its* pooled connection string for the **Preview** environment instead, so staging and PR previews never touch production data.
- [x] Local dev uses docker-compose Postgres on host port 5436, so no Neon string is needed in `.env.local` unless you want to point local at Neon.

## 3. Google OAuth (better-auth)

- [x] In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (Web application) named `journeys`.
- [x] Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://journeys-mvp-prod.vercel.app/api/auth/callback/google` (renamed 2026-09-24; keep the `journeys-ten-virid` entry while the old domain serves)
  - [ ] `https://journeys-mvp-staging.vercel.app/api/auth/callback/google` (renamed 2026-09-24)
- [x] Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel (Production) and `.env.local`.
- [x] Also set them for **Preview** (see §9).
- Note: Google does not accept wildcard redirect URIs, so ephemeral PR preview URLs will never have working Google sign-in. Staging (a fixed domain) does. Accept this for the hackathon.

## 4. Discord OAuth (better-auth)

- [x] In the Discord Developer Portal, create an application `journeys` → OAuth2.
- [x] Redirects:
  - `http://localhost:3000/api/auth/callback/discord`
  - `https://journeys-mvp-prod.vercel.app/api/auth/callback/discord` (renamed 2026-09-24; keep the `journeys-ten-virid` entry while the old domain serves)
  - [ ] `https://journeys-mvp-staging.vercel.app/api/auth/callback/discord` (renamed 2026-09-24)
- [x] Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel (Production) and `.env.local`.
- [x] Also set them for **Preview** (see §9).

## 5. better-auth secret

- [x] Generate a random 32+ byte secret (`openssl rand -base64 32`) and set `BETTER_AUTH_SECRET` in Vercel (Production and Preview) and `.env.local`.
- [x] Set `BETTER_AUTH_URL` to `http://localhost:3000` locally and the production URL in Vercel Production.
- [x] Set `BETTER_AUTH_URL` for **Preview** to the staging URL (see §9).

## 6. Vercel AI Gateway key (AI authoring, ticket 14; jev decisions, ticket 43)

Decided 2026-09-22 (Paul): every model call goes through the Vercel AI Gateway with a static key, not a provider key.

- [ ] In Vercel → `journeys` → Settings → AI Gateway, enable the gateway and create an API key.
- [ ] Set `AI_GATEWAY_API_KEY` in Vercel (Production and Preview) and `.env.local`. Optional: a budget alert in the same settings page; the team's free monthly credit covers hackathon use.
- [ ] Without it, AI features are hidden and everything else works — safe to defer until ticket 14 or 43 starts.
- [ ] Confirm the Vercel project runs on Fluid compute (the default; Settings → Functions), so a server action may wait the judge's full 20 s (ticket 49). A non-Fluid function is cut off at 10 s, before the judge's fallback, and a Participant would see an error page instead of the Choices.
- Expected result: after ticket 14, the AI controls render on a Journey page; after ticket 43, a deciding Prompt advances a Run.

## 7. Local machine

- [x] Node 24 and pnpm 10 present (verified 2026-09-18).
- [x] Docker present (verified 2026-09-18) — used for local Postgres via docker-compose (host port 5434; 5432/5433 are taken).
- [x] Optional: `pnpm add -g typescript-language-server typescript` then `/plugin install typescript-lsp@claude-plugins-official` for LSP diagnostics in Claude Code.
- [x] Optional: enable the already-installed `playwright` plugin so agents can drive e2e runs.

## 8. Redirect URIs to revisit after first deploy

- [x] Once the production URL is known, go back and fill it into sections 3 and 4.
- [x] Once the staging domain is known (§9), fill it into sections 3, 4, and 5.

## 9. Staging branch and Preview environment (unblocks green preview builds)

Env validation runs at build/boot, so every preview deployment needs a full set
of values. Rather than placeholders, give the Preview environment real values
that point at a fixed staging domain.

- [x] Create and push a long-lived `staging` branch from `main`: `git checkout -b staging main && git push -u origin staging`.
- [x] In Vercel → `journeys` → Settings → Domains, add a domain (`journeys-mvp-staging.vercel.app`, formerly `staging-journeys-ten-virid.vercel.app`) and assign it to the git branch `staging`. Record it at the top of this file.
- [x] In Vercel → Settings → Environment Variables, set for the **Preview** environment: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (same values as Production), `BETTER_AUTH_URL` = the staging URL, and confirm `BETTER_AUTH_SECRET` and `DATABASE_URL` are already present for Preview (§2, §5).
- [x] Add the staging callback URLs to Google (§3) and Discord (§4).
- Expected result: PR preview deployments build green; sign-in works on the staging domain; it is not expected to work on ephemeral PR preview URLs.

## 10. Sign in once before seeding (unblocks ticket 04)

The seed script attaches the seed Project to an *existing* account and never
creates user rows, so better-auth owns account linking end to end.

- [x] After ticket 01 is deployed, sign in once with Google or Discord as `pauljosephmacfarlane@gmail.com` on **local** (`http://localhost:3000`) and on **production** (and staging if you want the seed there too).
- Expected result: a user row with that email exists in each database the seed will run against. Post-check: after seeding, sign in again and the seed Project appears in your projects list.

## Expected `.env.example` (agents keep this file; you fill `.env.local`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/journeys
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
AI_GATEWAY_API_KEY=
```

## 11. GitHub secrets for deployed migrations (added 2026-09-19 by the Foundation work package)

Migrations for Neon run from a GitHub Actions workflow (`.github/workflows/migrate.yml`), not from Vercel builds, per Paul's choice during ticket 01.

- [x] In GitHub → `paul-macfarlane/journeys` → Settings → Secrets and variables → Actions, add repository secrets `STAGING_DATABASE_URL` (Neon `staging` branch pooled string) and `PROD_DATABASE_URL` (Neon main pooled string). Until a secret exists the workflow logs a notice and exits green without migrating.
- Expected result: pushes to `staging` and `main` apply pending migrations shortly after the push (no ordering guarantee against the Vercel build, so migrations must stay compatible with the previously deployed code). Post-check: the workflow run is green and sign-in works on the corresponding URL.
- Local Postgres now listens on host port **5436** (5434 is used by paulitakes-db, 5435 by the h2 console). Update `DATABASE_URL` in `.env.local` to `postgresql://postgres:postgres@localhost:5436/journeys`.

## 12. Re-record git hook activation after merge (added 2026-09-19)

Ticket 01 installs husky, which takes over `core.hooksPath` and chains to the Atlas hooks in `.githooks/`.

- [x] After merging ticket 01, rerun `/atlas:setup-atlas` and record the hook activation decision as `chain` (approved by Paul on 2026-09-19 in the ticket 01 session). The same rerun records the lint/test/build commands as `verified` (AC-9).
- Expected result: Atlas verification reports the `.githooks` checks active through husky rather than displaced.

## 13. OAuth branding and legal links (added 2026-09-22, Paul's item 6)

Paul does this himself. `/privacy` and `/terms` are live on staging and production since PR #36.

- [ ] Google Cloud Console → OAuth consent screen: app name, logo, home page, privacy policy URL (`/privacy`), terms URL (`/terms`).
- [ ] Discord Developer Portal → the application: name, icon, terms of service URL, privacy policy URL.
- Expected result: both sign-in buttons show the app name and logo; ticket 31's remaining human gate closes. Post-check: a fresh sign-in on staging with each provider. If ticket 44 renames the app, repeat.
