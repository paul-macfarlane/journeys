# Journeys

A platform for authoring and running branching, text-based journeys. Authors
build a journey as a graph of steps and choices — each step is one screen of
text, each choice leads to another step — group journeys into projects they
own with other members, and publish an immutable version. Participants are
anonymous and never have an account: they read a step, make a choice, and
live with the consequence.

Next.js 16 App Router · TypeScript · Tailwind v4 + shadcn/ui · Drizzle ·
Neon Postgres (Docker locally) · Better Auth · Vitest + Playwright · Vercel.

Domain vocabulary is in [`CONTEXT.md`](CONTEXT.md). Architecture decision
records will live in `docs/adr/` from the first recorded decision onward.

## Local setup

Prerequisites: Node 22 or newer, pnpm 10 (`corepack enable` picks up the
pinned version), and Docker running.

```bash
pnpm install
cp .env.example .env.local    # then fill it in — see below
pnpm db:up                    # Docker Postgres 18 on localhost:5436
pnpm db:migrate
pnpm dev                      # http://localhost:3000
```

`.env.local` is never committed. Every variable in `.env.example` except
`ANTHROPIC_API_KEY` is required — the app validates its configuration at
startup and refuses to boot with a missing or malformed value. Generate the
auth secret with `openssl rand -base64 32`; the Google and Discord OAuth
client pairs come from real OAuth apps, and where to get each value is
documented in
[`.scratch/journeys-platform/human-prerequisites.md`](.scratch/journeys-platform/human-prerequisites.md).
Leave `ANTHROPIC_API_KEY` empty to hide the AI authoring features.

## Commands

| Command                           | What it does                                   |
| --------------------------------- | ---------------------------------------------- |
| `pnpm dev`                        | Next.js dev server on port 3000                |
| `pnpm build` / `start`            | Production build / serve the build             |
| `pnpm lint`                       | ESLint                                         |
| `pnpm typecheck`                  | `tsc --noEmit`                                 |
| `pnpm format` / `format:check`    | Prettier write / check                         |
| `pnpm test` / `test:watch`        | Vitest unit tests                              |
| `pnpm test:e2e`                   | Playwright e2e (starts its own server)         |
| `pnpm db:up` / `db:down`          | Start / stop local Postgres (host port 5436)   |
| `pnpm db:generate` / `db:migrate` | Create / apply Drizzle migrations              |
| `pnpm db:push`                    | Push the schema without a migration (dev only) |
| `pnpm db:studio`                  | Drizzle Studio                                 |
| `pnpm prepare`                    | Installs the husky git hooks (runs on install) |

## Environments

Local development runs against the Docker Postgres above. Every branch gets
an ephemeral Vercel preview deployment; the long-lived `staging` branch
deploys to a stable domain, and `main` is production. Pull requests target
`staging`, and a human promotes `staging` to `main`.

Vercel builds never run migrations. The
[`Migrate`](.github/workflows/migrate.yml) GitHub Action applies Drizzle
migrations on push to `staging` and `main`, using the `STAGING_DATABASE_URL`
and `PROD_DATABASE_URL` repository secrets — one secret per branch, with no
fallback, so `main` can never migrate the staging database. Until a branch's
secret exists the job logs a notice and exits green. The Action and the
Vercel build start from the same push with no ordering guarantee, so every
migration must stay compatible with the previously deployed code.
[`CI`](.github/workflows/ci.yml) runs lint, format, typecheck, migrations,
tests, a production build, and the e2e suite on every pull request and on
every push to `staging` and `main`. Vercel's Ignored Build Step skips
branches other than `staging` and `main`, so there are no PR preview
deployments.

## End-to-end tests

`pnpm test:e2e` runs the Playwright suite in `e2e/`. It never touches your
dev database or a running `pnpm dev`:

- Global setup creates and migrates a dedicated `journeys_e2e` database
  (derived from `DATABASE_URL` by swapping the database name) and logs the
  database name it ran against.
- The suite starts its own Next server on port 3100 — never port 3000 —
  with `DATABASE_URL` and `BETTER_AUTH_URL` overridden to match, and never
  reuses an already-running server.
- Specs sign in by minting a real better-auth session directly (through
  better-auth's internal adapter) rather than driving OAuth; there is no
  test-only auth provider and no mocking of better-auth.

Each spec writes a full-page screenshot as pass evidence to
`test-results/<test-name>/<test-name>.png`.

First run: `pnpm exec playwright install chromium` to download the browser.
Set `E2E_DATABASE_URL` to point the suite at a database elsewhere; without it
the harness refuses any non-local host.

## Git hooks

Husky owns `core.hooksPath`, and each husky hook chains to its counterpart in
`.githooks/` so the Atlas guardrails still run. `.husky/pre-commit` runs
`lint-staged` (ESLint and Prettier over staged files) and then the Atlas
pre-commit hook; `.husky/commit-msg` and `.husky/pre-push` hand straight over
to theirs. `pnpm install` installs them via the `prepare` script.

## Agent workflows

Atlas conventions, guardrails, and the ticket tracker are described in
[`docs/atlas-operators-guide.md`](docs/atlas-operators-guide.md).
