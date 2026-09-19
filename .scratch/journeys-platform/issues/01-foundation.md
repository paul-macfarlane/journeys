# 01: Foundation

Status: in-progress
Blocked by: None (can start immediately) — but gated on the human prerequisites below
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-19
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

### [EXECUTION PLAN] 2026-09-19 — Atlas orchestrator

**Contract:** this ticket, unchanged. Criteria are numbered AC-1..AC-9 in the order of the checklist above. Run surface: local + deployed (Vercel preview; staging and production are human-promoted).

**Repository delivery:** `journeys`, base `staging` @ `0ed317e`, branch `feat/01-foundation`, direct checkout, no worktrees. Sequential structure: D1 → D2. Parallelism rejected because both deliverables predictably edit `package.json`, `pnpm-lock.yaml`, `.gitignore`, `README.md`, and `src/db/*`; re-checked at closeout.

**Resolved technical decisions (execution, not contract changes):**
- Local Postgres host port: **5435** (5434 is already bound by the running `paulitakes-db` container on this machine; `.env.example` updated to match). Confirmed by Paul 2026-09-19; Paul updates `.env.local` to port 5435.
- Deployed migrations (Paul's choice, 2026-09-19): a GitHub Actions workflow mirroring paulitakes `migrate.yml` runs `drizzle-kit migrate` on push to `staging` and `main` against a `DATABASE_URL` GitHub secret per branch environment; CI (`ci.yml`) runs lint/typecheck/test/build on PRs. New human prerequisite recorded as `human-prerequisites.md` §11. Vercel builds do not migrate.
- `cacheComponents` stays off in Foundation; auth-aware pages render dynamically.
- Routes: `/` landing (static copy + Google/Discord sign-in buttons, lists nothing); `/projects` requires a session (server-side `getSession`; `src/proxy.ts` cookie-presence redirect as UX only); signed-out → `/`.
- better-auth tables (`user`, `session`, `account`, `verification`) in `src/db/schema.ts`; `drizzle/` migrations committed; `db` client selects `@neondatabase/serverless` when `VERCEL` is set, else `pg`.
- Env validated once with zod in `src/lib/env.ts` (DATABASE_URL, BETTER_AUTH_SECRET ≥32, BETTER_AUTH_URL, both OAuth pairs required; ANTHROPIC_API_KEY optional).
- Playwright: `e2e/`, own server `next dev -p 3100`, `reuseExistingServer: false`, `webServer.env` overrides `DATABASE_URL` (→ `journeys_e2e`, created + migrated + name logged in global setup) and `BETTER_AUTH_URL`; `outputDir` `test-results/playwright` (gitignored, failure-only); PASS screenshots written explicitly to `test-results/<test-name>/`.
- `packageManager` pinned to the installed `pnpm@10.33.0`; Node ≥ 22.
- Git hooks (Paul's approval, 2026-09-19): husky owns `core.hooksPath` (`.husky/_`) and **chains** to the Atlas hooks — `.husky/pre-commit` runs `pnpm exec lint-staged` then execs `.githooks/pre-commit`; `.husky/commit-msg` and `.husky/pre-push` exec their `.githooks` counterparts with arguments and stdin passed through. Paul re-records `hook_activation` as `chain` when rerunning `/atlas:setup-atlas` after merge (AC-9).

**Deliverables:**
- **D1 — App scaffold, database, auth, landing and projects pages.** Next 16 + tooling mirrored from paulitakes (ESLint/Prettier/husky/lint-staged/components.json/tsconfig), docker-compose, Drizzle schema + migration, better-auth server/client/route, env schema + Vitest unit test, `/` and `/projects`, README. Proves AC-1, AC-2, AC-3a, AC-4, AC-5 (all but `test:e2e`), AC-6 (unit), AC-8.
- **D2 — Playwright harness.** Global setup creating/migrating `journeys_e2e`, minted-session helper (internal adapter + HMAC-signed `better-auth.session_token`), specs for the landing page and the signed-in empty projects page (with screenshots), `test:e2e` script, README e2e section. Proves AC-5 (`test:e2e`), AC-6 (e2e), AC-2/AC-3a evidence.

**Verification map (evidence committed under `test-results/`, cleared once at start of this work package):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | fresh `git clone` into scratch → follow README (`pnpm install`, `.env.local` from `.env.example` with a generated secret and non-empty OAuth placeholders, `pnpm db:up`, `pnpm db:migrate`, `pnpm dev`) → `curl -s -o /dev/null -w '%{http_code}' localhost:3000/` | local; docker Postgres | app boots, `/` returns 200 | `test-results/ac-1-fresh-clone.txt` | after D1 | any change to README, compose, env schema, package scripts |
| AC-2 | Playwright spec `landing` + `curl localhost:3000/` text check | local | product copy + both sign-in controls present; no project/journey list | `test-results/landing/landing.png`, `test-results/ac-2-landing.txt` | after D2 | changes under `src/app/` |
| AC-3a | Playwright spec `projects-empty` (minted session) + spec asserting signed-out `/projects` redirects | local; docker Postgres (`journeys_e2e`) | empty projects page for the minted Author; redirect when signed out | `test-results/projects-empty/*.png`, `test-results/ac-6-e2e.txt` | after D2 | changes under `src/app/`, `src/lib/auth*`, `e2e/` |
| AC-3b | **Human gate.** Prerequisite: app running locally / deployed. Action: Paul signs in with Google and with Discord on local, staging, and production. Expected: lands on `/projects`. Post-check (orchestrator): `POST /api/auth/sign-in/social` for each provider on local and production returns an authorize URL whose `redirect_uri` matches `BETTER_AUTH_URL` | local + deployed; Google/Discord OAuth apps | both providers redirect to the correct callback | `test-results/ac-3b-oauth-start.txt` | after D1 (local), after PR merge (staging/prod) | OAuth env or auth config change |
| AC-4 | `createdb journeys_verify` (via psql in the container) → `DATABASE_URL=…/journeys_verify pnpm db:migrate` → list tables | local; docker Postgres | migration applies with no error; `user`, `session`, `account`, `verification` present | `test-results/ac-4-migrate.txt` | after D1 | changes under `src/db/`, `drizzle/` |
| AC-5 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`; husky proven by a commit whose output shows lint-staged running | local | all exit 0; pre-commit output visible | `test-results/ac-5-commands.txt` | after D2 | any source, config or dependency change |
| AC-6 | `pnpm test` output shows ≥1 real test; `pnpm test:e2e` output shows the e2e database name logged by global setup, port 3100, and the minted-session spec passing; `playwright.config.ts` shows `reuseExistingServer: false` and `webServer.env` overrides | local; docker Postgres | as stated | `test-results/ac-6-e2e.txt` | after D2 | changes under `e2e/`, `playwright.config.ts`, `vitest.config.ts` |
| AC-7a | push branch → Vercel deployment for the head commit reaches READY (Vercel MCP read tools) | deployed (Vercel Preview, Neon preview branch) | READY | `test-results/ac-7-vercel-preview.txt` | after D2 integrated + push | any commit |
| AC-7b | **Human gate.** Prerequisite: PR merged to `staging`, later promoted to `main`. Action: Paul merges/promotes. Expected: staging domain and production URL serve the landing page. Post-check: `curl` both URLs → 200 with landing copy (run by the next work package or by Paul) | deployed | 200 | recorded in `[CLOSEOUT]` as pending human action | after merge | — |
| AC-8 | `grep` README for purpose, setup, commands, `docs/atlas-operators-guide.md` | local | all present | `test-results/ac-8-readme.txt` | after D2 | README change |
| AC-9 | **Human follow-up.** PR body carries the note; Paul reruns `/atlas:setup-atlas` after merge | — | commands recorded as `verified` | PR body | closeout | — |
