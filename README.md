# Journeys

A platform for authoring and running branching, text-based journeys. Authors
build a journey as a graph of steps and choices — each step is one screen of
text, each choice leads to another step — group journeys into projects they
own with other members, and publish an immutable version. Participants are
anonymous and never have an account: they read a step, make a choice, and
live with the consequence.

Next.js 16 App Router · TypeScript · Tailwind v4 + shadcn/ui · Drizzle ·
Neon Postgres (Docker locally) · Better Auth · Vitest + Playwright · Vercel.

Domain vocabulary is in [`CONTEXT.md`](CONTEXT.md). Architecture decisions are
recorded in `docs/adr/`: by
[ADR-0001](docs/adr/0001-graph-as-one-json-document.md), each draft and each
published version is one validated JSON graph document, whose shape lives in
`src/lib/graph/` rather than in the database.

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

## Routes

- `/` and `/sign-in` — the landing page and the Google/Discord sign-in.
- `/projects` — the signed-in author's projects, with a dialog to create one.
- `/projects/<project-id>` — one project: rename it, delete it, and see the
  journeys inside it, with a dialog to create one. Members only; anyone else
  gets a 404.
- `/projects/<project-id>/journeys/<journey-id>` — one journey: edit its
  title and description, delete it, and see its draft — the steps it holds,
  which is the start, which are endings (editing arrives later). Members of
  the project only; anyone else gets a 404.
- `/j/<journey-id>` — reserved for the public participant runner (not built
  yet).

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
| `pnpm seed:case-3 <email>`        | Seed the legacy case-3 journey (see below)     |
| `pnpm prepare`                    | Installs the husky git hooks (runs on install) |

### Seeding the legacy case-3 journey

`pnpm seed:case-3 <author-email>` reads the legacy site's prerendered case-3
pages, converts them into a graph document — titles, paragraphs, images with
their credit lines, choices, endings — and writes it as the draft of a `Case 3`
journey inside a `Journey Stories` project.

**Prerequisite:** the account must already exist. The script never creates
users; sign in once through Google or Discord with that email (see
[`human-prerequisites.md`](.scratch/journeys-platform/human-prerequisites.md)
§10), then run it. With no such user it prints the email, writes nothing, and
exits non-zero.

```bash
pnpm seed:case-3 you@example.com                    # seed the local dev database
pnpm seed:case-3 you@example.com --write-fixture    # …and rewrite the test fixture
```

- **Idempotent.** The project and the journey have fixed ids, so rerunning
  updates the same rows: there is only ever one seed project and one case-3
  journey, and the signed-in account is added as a member of the project if it
  is not one already.
- **`--write-fixture`** also writes `src/lib/graph/fixtures/case-3.json`, the
  real-content success case `src/lib/graph/validate.test.ts` validates. Pass it
  when the legacy content or the outcome mapping has changed, and commit the
  result.
- **Outcomes are hand-written.** `scripts/seed-case-3/outcomes.json` maps each
  legacy ending to an outcome id and gives each outcome its label. Edit the
  labels there — they are what a participant is told they reached — and rerun
  the seed to apply them. The script refuses to write anything if an ending is
  missing from the mapping, a mapped step still has choices, or an outcome id
  names nothing.
- **Against Neon staging,** export the connection string for that one command:
  `DATABASE_URL=… pnpm seed:case-3 you@example.com`. An explicit `DATABASE_URL`
  wins over `.env.local`, and the script prints only the host and port it
  connected to.
- **Images hotlink the legacy site.** Nothing is copied: every seeded image
  points at the URL the legacy page used, so the seeded journey's images break
  if that host goes away. The scraper itself is throwaway — it reads the markup
  the legacy Astro build emits today and is not maintained against changes to
  it.

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

<!-- atlas-v3:readme:start -->

## Atlas

This repo uses Atlas, a Claude Code plugin that acts as a shared path for AI-assisted development — generated, customizable policies, guidelines, and guardrails that keep agent-driven work safe and consistent without locking teams into one rigid workflow. Read [`docs/atlas-operators-guide.md`](./docs/atlas-operators-guide.md) for how to work in this repo, in plain language, and the **Atlas** section in [`CLAUDE.md`](./CLAUDE.md) for the policy the agents follow.

**Before working in this repo:**

1. **Git hooks are already active** once you run `pnpm install`: husky owns
   `core.hooksPath`, and each husky hook chains to its counterpart in
   `.githooks/` (see [Git hooks](#git-hooks) above). Do **not** run
   `git config core.hooksPath .githooks` here; that would detach husky and
   stop `lint-staged` from running.

   The Atlas hooks block a handful of destructive git operations before they run.

2. **Claude Code hooks** are already configured in `.claude/settings.json` — they guard against risky file, shell, and MCP actions during agent sessions. See `docs/agents/guardrails.md` if you need to change them.

Everything Atlas generated here — hooks, the `CLAUDE.md` section, `docs/agents/` — is a **base recommendation**, not fixed policy. Adapt it to this project's actual needs and processes.
<!-- atlas-v3:readme:end -->
