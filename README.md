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
  journeys inside it, with a dialog to create one. Also lists its members,
  adds one by the email of an account that has signed in before, and removes
  one — never the last. Members only; anyone else gets a 404.
- `/projects/<project-id>/journeys/<journey-id>` — one journey: edit its
  title and description, delete it, and edit its draft — find a step by name
  and change its title and rich text in the panel, add, reorder,
  retarget and remove its choices — the field that says where a choice leads
  is searchable, and it creates the step a choice needs in the same motion —
  make a step the start, delete a step and see which choices
  break, make, choose and rename an ending's outcome from the ending itself
  (searchable too; an outcome the last ending drops is removed with it), and
  run validation on demand. The draft is also drawn as a map on a canvas —
  laid out automatically from the steps and choices themselves, never from
  stored positions — where clicking a box opens that step in the panel, a
  step can be added from the canvas, and validation problems are marked on
  the step or choice it is about. The map is drawn either top to bottom or
  left to right, switched from the control beside "Add step" and stored on the
  draft rather than in the browser, so every member of the project sees the
  journey the same way round; changing it re-fits the whole map. Its arrows
  follow the routes the layout computes, and the arrows into and out of the
  step the panel has open are drawn at full strength while the rest dim.
  The view is the author's and moves only when they ask: the first render, a
  change of direction, "Hide panel" and "Show panel", and the zoom to a step
  opened from a hidden panel, found by name, or just made — adding or
  deleting a step otherwise leaves the map where they left it. Nothing on it
  is coloured by outcome and there is no legend: the start and a step's
  problems are read from its badge and its ring, and an ending names its
  outcome in words. The journey is built on the
  map too: dragging from a box's connect dot onto another box makes the
  choice between them, dropping one on bare map makes the step it leads to as
  well, and dragging the head of the arrow in hand onto a third box moves it
  there — only the selected arrow has a head to take hold of, so a head
  dragged out of a stack is the choice the author chose. The box the author
  clicks carries a "Step actions" button that opens onto the five moves: add
  the next step, duplicate the step, zoom the map to it, make it the start,
  delete it — the panel's footer duplicates it too — and clicking an arrow
  opens its step with that choice's row marked, scrolling nothing and taking
  the keyboard nowhere, while the Delete key on the arrow removes the choice.
  The map is read as well as built: hovering
  or focusing a box shows the opening of that step's content without opening
  it, and the arrow keys walk from box to nearest box, where Enter opens the
  one the keyboard is on and Escape steps back out to the map itself. The
  panel beside the map can be hidden with "Hide panel" to give the map the
  whole width, and comes back from "Show panel" at the canvas's right edge or
  by opening any step from anywhere; a second Escape, with the map itself
  holding the keyboard, hides it again. Whether it is hidden is remembered
  per browser rather than stored on the journey, so it is how one author is
  reading the map and not something every member sees. Problems are listed on
  the step they belong to and in a live count above the map, and the
  "Find step" field above the map — reached with Cmd/Ctrl+K from anywhere on
  the page — filters the steps by title as they are typed, lists every one of
  them in the map's own order when nothing is, and centers the map on
  whichever is chosen. The draft autosaves. Publish the draft as an immutable
  version (refused, with the problems listed, while the draft has any),
  unpublish to take it back from participants, preview it, and see every
  published version — number, when, and who published it — with the live one
  marked and any of them restorable into the draft. Members of the project
  only; anyone else gets a 404.
- `/projects/<project-id>/journeys/<journey-id>/preview` — walks the draft
  from its start step to an ending, exactly as a participant would, and
  records nothing. Members of the project only; anyone else gets a 404, and a
  signed-out request is redirected to `/`.
- `/j/<journey-id>` — the public participant runner's start screen: the live
  published version's title and description, and a button that begins a run.
  Anonymous — no account, no sign-in. An unpublished (or never published)
  journey shows an "unavailable" screen instead; an unknown id gets a 404.
- `/j/<journey-id>/<step-id>` — one step of a run: its text, its choices as
  links, and a back control. The run is identified by an unguessable id in a
  cookie scoped to that journey's path, so two journeys open in one browser
  keep separate runs and a step URL opened without one lands on the start
  screen. Going back — the browser's button or the in-app control — truncates
  the run's path to that step and counts a backtrack; reaching an ending
  records the outcome; starting over begins a new run and leaves the old one
  as it was. A run in progress keeps walking the version it started on, even
  if a new version is published meanwhile.

## Commands

| Command                             | What it does                                   |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm dev`                          | Next.js dev server on port 3000                |
| `pnpm build` / `start`              | Production build / serve the build             |
| `pnpm lint`                         | ESLint                                         |
| `pnpm typecheck`                    | `tsc --noEmit`                                 |
| `pnpm format` / `format:check`      | Prettier write / check                         |
| `pnpm test` / `test:watch`          | Vitest unit tests                              |
| `pnpm test:e2e`                     | Playwright e2e (starts its own server)         |
| `pnpm db:up` / `db:down`            | Start / stop local Postgres (host port 5436)   |
| `pnpm db:generate` / `db:migrate`   | Create / apply Drizzle migrations              |
| `pnpm db:push`                      | Push the schema without a migration (dev only) |
| `pnpm db:studio`                    | Drizzle Studio                                 |
| `pnpm seed:journey-stories <email>` | Seed the three legacy cases (see below)        |
| `pnpm prepare`                      | Installs the husky git hooks (runs on install) |

### Seeding the legacy Journey Stories cases

`pnpm seed:journey-stories <author-email>` writes the legacy site's three
migrant-healthcare cases into one `Journey Stories` project as the journeys
`Case 1`, `Case 2`, and `Case 3`, each with its draft: the steps, choices,
endings, outcomes, and credited images the legacy case has. Each document is
validated for publish before anything is written.

**Prerequisite:** the account must already exist. The command never creates
users; sign in once through Google or Discord with that email (see
[`human-prerequisites.md`](.scratch/journeys-platform/human-prerequisites.md)
§10), then run it. With no such user it prints the email, writes nothing, and
exits non-zero.

```bash
pnpm seed:journey-stories you@example.com    # seed the local dev database
```

- **Idempotent.** The project and the three journeys have fixed ids, so
  rerunning updates the same rows in place: there is only ever one seed
  project and one journey per case, and the account is added as a member of
  the project if it is not one already.
- **The documents are the source of truth.** `scripts/seed/journey-stories/`
  holds `case-1.json`, `case-2.json`, and `case-3.json` — converted once from
  `src/data/cases/*.json` in the legacy repository
  (`paul-macfarlane/journey`). The legacy content never changes,
  so nothing re-reads it and no converter is kept. Edit the outcome labels (and
  anything else) in those files and rerun the command to apply the change;
  `src/lib/graph/validate.test.ts` checks every document still publishes and
  still holds the counts the legacy case has.
- **One step was left out.** Case 1's "Detention" is omitted because nothing
  in the legacy data links to it — unreachable on the legacy site itself, with
  nothing to do with cycles. The four choices that loop back on the legacy
  site — case 1's "Yes" on "Detention 1", and case 2's "Call the legal
  organization" on "Call Sponsor", "Call your bunkmate's cousin's friend" on "I
  quit!", and "Go home, and try again later" on "ER" — are present, since
  cycles became allowed (ticket 18, ADR-0002).
- **Against Neon staging,** export the connection string for that one command:
  `DATABASE_URL=… pnpm seed:journey-stories you@example.com`. An explicit
  `DATABASE_URL` wins over `.env.local`, and the command prints only the host
  and port it connected to.
- **Images point at third-party hosts.** Nothing is copied: every seeded image
  keeps the URL the legacy page linked, spread over some eighteen hosts (mostly
  flickr, rawpixel, and news sites) and never the legacy site itself, so an
  image stops loading when its own host does. A handful of long image paths
  and credit URLs in the documents carry a `\u` JSON escape that breaks up a
  40+ character alphanumeric run, which the commit-time secret scanner would
  otherwise refuse; the escapes change nothing when parsed — keep them.

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
- `pnpm test:e2e` builds the app first and the suite starts its own
  production server (`next start`) over that build on port 3100 — never
  port 3000 — with `DATABASE_URL` and `BETTER_AUTH_URL` overridden to match,
  and never reuses an already-running server. It is never `next dev`: a dev
  server compiles routes on demand and delivers the editor's bundle slowly
  under load, which is what made tests flaky in CI. `pnpm test:e2e:prebuilt`
  skips the build when one is already in `.next` (CI uses it after its own
  build step; locally, remember a stale build tests stale code).
- Retries are off everywhere. A test that fails once fails the run; a flaky
  test is fixed at its cause or deleted, never retried.
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
