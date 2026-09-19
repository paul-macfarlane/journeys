# 01: Foundation

Status: ready-for-agent
Blocked by: None (can start immediately) — but gated on the human prerequisites below
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** An Author can open the deployed site, read a landing page that says what Journeys is, sign in with Google or Discord, and land on an empty "your projects" page. Everything later tickets build on exists and is proven: database, auth, deploy, local dev loop, and the test harness for both seams.

Stack is confirmed team policy in `docs/agents/planning.md`: Next.js 16 App Router, React 19, TypeScript, pnpm; Drizzle with Neon Postgres in deployed environments and docker-compose Postgres locally; better-auth with Google and Discord; Tailwind v4 + shadcn; zod 4; TanStack Query; Vitest + Playwright; Vercel. Mirror `paul-macfarlane/paulitakes` for layout, ESLint/Prettier/husky/lint-staged, and `components.json`. The Playwright session helper mirrors `picksleagues`: mint a real better-auth user + session through the internal adapter, sign the `better-auth.session_token` cookie, add it to the browser context, against a dedicated e2e database created in global setup, with Playwright starting its own server on a dedicated port (`reuseExistingServer: false`) and `webServer.env` overriding `DATABASE_URL` and `BETTER_AUTH_URL`. docker-compose publishes Postgres on host port 5434 (5432/5433 are taken locally); `.env.example` already matches.

**Human prerequisites (blocking, from `.scratch/journeys-platform/human-prerequisites.md` §1–5 and §9):** Vercel project linked to the repo; Neon database with `DATABASE_URL` set in Vercel; Google and Discord OAuth apps with local, staging, and production redirect URIs; `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` and both OAuth client pairs set for Production **and Preview** in Vercel and in `.env.local`; `staging` branch pushed with its stable domain assigned. Expected result: the agent can run the app locally with `.env.local`, and Vercel preview and production builds pass env validation. Post-check: sign-in works with both providers on staging and production.

- [ ] `pnpm dev` starts the app against docker-compose Postgres with the values in `.env.local`; a fresh clone following the README reaches a running app.
- [ ] Landing page at `/` explains the product and offers sign-in; it lists no projects or journeys.
- [ ] Sign-in with Google and with Discord succeeds locally and in production; signed-in Authors see an empty projects page; signed-out users are redirected from it.
- [ ] Drizzle schema and migrations exist for user/session (better-auth) tables; `pnpm db:migrate` (or the chosen name) applies cleanly to an empty database.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` all exist and pass; husky + lint-staged run lint and format on commit.
- [ ] Vitest runs at least one real unit test; Playwright runs at least one e2e spec that signs in via the minted-session helper and asserts the signed-in projects page. Global setup creates and migrates the dedicated e2e database and logs its name; the e2e server runs on its own port with `DATABASE_URL`/`BETTER_AUTH_URL` overridden via `webServer.env`, never reusing a running dev server.
- [ ] Vercel preview deployment builds green for the PR (Preview env values from §9); the `staging` branch deploys to its stable domain; production deploys from `main`.
- [ ] `README.md` exists: purpose, local setup, commands, link to `docs/atlas-operators-guide.md`.
- [ ] `/atlas:setup-atlas` rerun by a human after merge records the commands as `verified` (note in the PR that this is the human follow-up).

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
