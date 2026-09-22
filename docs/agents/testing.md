<!-- atlas-v3:testing:start -->
# Testing and proof of work

This document is the authoritative repository policy for verification commands,
acceptance evidence, and `PASS`, `FAIL`, `BLOCKED`, and `SKIPPED` verdict
semantics.

Run surface: **local + deployed**.

Read this guide while planning acceptance criteria, Definition of Done,
fixtures, and verification. Resolve the applicable commands and evidence rules
into each execution packet; implementation workers execute that packet without
rereading this guide.

## Commands

| Check | Command | Coverage | When | Status |
|---|---|---|---|---|
| unit | `pnpm test` | Vitest unit tests under `src/**/*.test.{ts,tsx}` (no database needed) | During implementation and before PR | verified |
| lint | `pnpm lint` | ESLint (next + prettier config) | Before PR; lint-staged also runs it on staged files at commit | verified |
| format | `pnpm format` | Prettier write over the repository | Before lint; keep reformatting within task scope | verified |
| format:check | `pnpm format:check` | Prettier check (what CI runs) | Before PR | verified |
| typecheck | `pnpm typecheck` | `tsc --noEmit` type consistency | During implementation and before PR | verified |
| build | `pnpm build` | Next.js production build; catches prerender and route-export errors dev mode cannot see | Before PR | verified |
| migrate | `pnpm db:migrate` | Applies committed Drizzle migrations to the local Postgres (docker `pnpm db:up` on host port 5436); CI runs it against a fresh database | After any schema change and before PR | verified |
| e2e | `pnpm test:e2e` | Builds the app, then runs the Playwright suite in `e2e/` against the dedicated `journeys_e2e` database and a self-started production server (`next start`, never `next dev`) on port 3100; requires Docker Postgres up and `pnpm exec playwright install chromium`. `pnpm test:e2e:prebuilt` runs the suite over an existing build (CI, after its build step) | Before PR | verified |
| run | `pnpm dev` | Local development server on http://localhost:3000 against the docker Postgres | Manual verification | inferred |
| db:up | `pnpm db:up` | Starts the local Postgres 18 container on host port 5436 | Before migrate, e2e, or run when the container is not up | inferred |

`verified` means the command ran successfully here. `inferred` means configuration names it but setup did not execute it. `unavailable` is an explicit gap.

## Flaky tests

A flaky test is one that fails and then passes without a code change. The
repository has none on purpose (Paul, 2026-09-21: "I'd rather have not a test
than a flaky one"):

- Playwright `retries` is 0 in every environment, including CI, so a flake
  fails the run instead of hiding behind a second attempt. Never raise it.
- A test that flakes is fixed at its cause — a real race in the app, a test
  that interacts before the page can respond, a shared fixture two tests
  fight over — or deleted. Widening a timeout is a fix only when the wait is
  for an event that genuinely takes that long; it is never the answer to an
  interaction that was simply lost. Never mark a test as skipped, `fixme`, or
  slow to keep it in the suite.
- e2e runs against a production build, never `next dev`: on-demand route
  compilation and slow bundle delivery were the cause of every flake this
  repository has had.
- A run that reports "flaky" or needs a rerun to go green is a failed run.
  Record it as `FAIL` with the raw output; do not rerun until it passes and
  cite the passing run.

## Evidence policy

- Repository-local proof-artifact root: `test-results`.
- Evidence is scoped to the work package (Paul, 2026-09-21). Commit only the
  screenshot directories and captured outputs for the specs and criteria the
  ticket names; leave every other directory under the proof root exactly as
  the last work package left it. Never clear the whole proof root, and never
  re-capture evidence for behaviour the ticket does not touch. The CI run on
  the PR is the proof that the rest of the suite still passes.
- For UI screenshots and videos, use one directory per test name beneath the
  proof-artifact root. Rerunning a test replaces that test directory.
- Visual/browser behavior: Screenshot is the default: each e2e spec writes a full-page screenshot to `test-results/<test-name>/<test-name>.png`, one subdirectory per test name. Video only for the canvas editor or other multi-step interactions a still image cannot prove. `test-results/playwright/` is Playwright's git-ignored scratch output and is never PASS evidence..
- Integration and non-UI behavior: Captured command output committed as `test-results/ac-<n>-<slug>.txt`, one file per acceptance criterion, plus the Vitest result line..
- External integration: Post-merge smoke result against the Vercel staging deployment (there are no PR preview deployments); production is checked after a human promotes `staging` to `main`..
- Sensitive data: Sanitize before storage. Never include participant Responses, real run data, `.env.local` values, or OAuth credentials; use seeded or fixture journeys only..
- Any screenshot, video, test report, captured output, or other artifact cited as
  `PASS` evidence is saved beneath `test-results` and committed
  on the feature branch. The PR links to the committed path; it never describes
  an uncommitted local file as attached evidence.
- Screenshot is the default visual proof. Add video only when motion, timing, or
  a multi-step interaction is material and a still image cannot prove it. Do not
  require screenshots or video when the repository has no UI/browser surface.
- Failure-only diagnostics not cited as `PASS` evidence, such as large traces,
  may remain uncommitted when repository policy says so.
- A blocked or skipped check records the attempted command and raw failure.
- `BLOCKED`, `SKIPPED`, ambiguity, and worker self-report are never `PASS`.

Run formatting before lint review, avoid unrelated reformatting, and rerun
affected tests after automatic fixes. Give every real integration seam at least
one criterion against the real dependency. Name test accounts, seed data,
confirmation flows, and cleanup. Human-gated criteria name the prerequisite,
human action, expected result, and post-action check. Runnable work must be
startable and exercisable by a fresh context using committed instructions.

Use `PASS` when evidence proves the criterion, `FAIL` when observable behavior is
incorrect, `BLOCKED` when it cannot be observed or exercised, and `SKIPPED` only
for an approved exception with the attempted command and reason. Sanitize every
retained artifact before storage or sharing.
<!-- atlas-v3:testing:end -->

## Proportional verification (team policy, Paul, 2026-09-21)

Verification effort follows the ticket's `Route:` line, not a fixed ladder.
Every ticket carries `Route: polish` or `Route: contract`.

| | `polish` | `contract` |
|---|---|---|
| Meaning | UI layout, copy, controls, and behaviour that does not change a stored document, a route contract, auth, or a migration. | Anything that changes the graph document, the rich-text contract, Published Versions, Runs, auth, the schema, or a public route. |
| Command chain | `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e` at the end of the ticket. Never per criterion. | The full chain in the Commands table, with `pnpm build` and `pnpm db:migrate` when the ticket touches them, and one full `pnpm test:e2e` at the end. |
| Evidence | One `dod-1-commands.txt` capture plus the screenshot directories of the specs the ticket names. | The same, plus `ac-<n>-<slug>.txt` captures only for criteria a screenshot cannot prove. |
| AI review | One reviewer reading the whole diff. | Two reviewers (correctness and contract) as `/atlas-implement` runs them. |
| Red team | Never. | Only where `docs/agents/planning.md` already requires it. |
| Tracker records | `[CLOSEOUT]` only. | `[EXECUTION PLAN]` and `[CLOSEOUT]`; `[PROGRESS]` only when work spans sessions. |

The CI run on the PR is the proof that the whole suite passes. A red CI run
is a `FAIL` regardless of local evidence.
