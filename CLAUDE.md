# journeys

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- atlas-v3:guidance:start -->
## Workspace framing

Atlas workspace: **journeys**. Confirmed repositories:

- `journeys` at `.`; base `staging` (PRs target `staging`; humans promote `staging` → `main`); source host `github`.

When isolation or parallel delivery benefits from worktrees, they live beneath
`.claude/worktrees/<work-package>/<repository-id>/`. The frontier
orchestrator chooses direct checkout, worker worktrees, and an optional
integration worktree from the dependency, concurrency, file-ownership, and
shared-state risks. Never place worktrees beneath `.atlas/`. Each affected
repository keeps its own base SHA, branch, verification result, and pull request.

## Repository framing

**journeys** — A platform for authoring and running branching, text-based journeys: authors build a graph of steps and choices, publish immutable versions, and participants walk them anonymously. See `CONTEXT.md` for vocabulary.

### Structure

- `CONTEXT.md` — Domain glossary; use its terms in all agent output
- `docs/adr/` — Architecture decision records
- `docs/agents/` — Agent-facing tracker, triage-label, planning, testing, tooling, and guardrail guidance
- `.scratch/<feature-slug>/` — Committed specs, decisions, and ticket files (local markdown tracker)
- `src/app/` — Next.js 16 App Router routes, layouts, and the better-auth route handler
- `src/components/` — shadcn/ui primitives and app components
- `src/db/` — Drizzle schema, database client (Neon in deployments, `pg` locally), and per-table data access (`projects.ts`, `journeys.ts`); every file here except `schema.ts` is `server-only`
- `src/lib/` — Pure, database-free helpers shared by server and client (zod schemas, action results) plus startup env validation
- `drizzle/` — Committed Drizzle migrations; applied by CI and the Migrate workflow, never by Vercel builds
- `e2e/` — Playwright specs plus setup that provisions the dedicated `journeys_e2e` database and server on port 3100
- `scripts/` — Development-only commands run with `tsx` (`seed/journey-stories.ts` over the shared `seed/journey-stories-seed.ts` plus the three committed legacy graph documents beside it, `record-landing-demo.ts`, and `decide-probe.ts`); imports `@/db/schema`, `src/lib/graph`, `src/lib/ai`, and the `e2e/setup/` helpers only, never a `server-only` module
- `test-results/` — Committed proof artifacts: one directory per e2e test name plus captured command output
- `.github/workflows/` — CI (lint, format, typecheck, migrate, unit, build, e2e) and Migrate (per-branch Drizzle migrations)

### Repository-specific rules

- Stack: Next.js 16 App Router, React 19, TypeScript, pnpm 10, Drizzle + Neon Postgres (`pg` + docker-compose locally on host port 5436), better-auth (Google + Discord), Tailwind v4 + shadcn, zod 4, TanStack Query, Vitest + Playwright, Vercel. Mirror `paul-macfarlane/paulitakes` conventions.
- The Foundation ticket has landed. Use the commands in `docs/agents/testing.md`; CI runs the same commands on every pull request and on every push to `staging` and `main`.
- Vercel builds never run migrations. The `Migrate` GitHub Action applies Drizzle migrations on push to `staging` and `main`, and it starts alongside the Vercel build with no ordering guarantee, so every migration must stay compatible with the previously deployed code.
- There are no pull-request preview deployments: Vercel's Ignored Build Step skips every branch except `staging` and `main`. Deployed verification happens on the staging domain after a PR merges.
- `pnpm test:e2e` provisions its own `journeys_e2e` database and starts its own Next server on port 3100; it never reuses `pnpm dev` or the dev database. Specs sign in by minting a real better-auth session, never by driving OAuth or mocking better-auth.
- Agents may run `pnpm add`, but the Atlas plugin's commit-time secret scrub refuses any agent `git commit` whose staged diff holds a 40+ character token, which every `pnpm-lock.yaml` integrity hash is; the lockfile commit is therefore Paul's, from his own terminal, until that hook gains a lockfile allowlist.
- The legacy `paul-macfarlane/journey` repository is a private read-only reference (a local clone lives at `~/Code/journey`). Its three cases were converted once from `src/data/cases/*.json` into the committed documents under `scripts/seed/journey-stories/`, which are now the source of truth; seed with `pnpm seed:journey-stories <email>`. Do not scrape the live site and do not import Twine.
- Never place participant Responses or real run data in proof artifacts; use seeded or fixture journeys.

## Atlas repository workflow

Use the lightest route that fits:

- Small, clear change: `/implement <description-or-spec>` then verify.
- Ticket marked `Route: polish` (see `docs/agents/testing.md`, "Proportional verification"): `/implement <ticket-path>`, one full `pnpm test:e2e` at the end, one AI reviewer, evidence only for the specs the ticket names, a `[CLOSEOUT]` record, then a PR to `staging`. No red team, no execution plan.
- Normal feature: `/grill-with-docs` → optional prototype → `/to-spec` → optional `/to-tickets` → `/atlas-red-team` when required → optional `/atlas-plan <ticket-epic-or-spec>` → `/atlas-implement`.
- Huge or unclear effort: `/wayfinder`, then rejoin at the spec route.
- Existing ticket, epic, or stable spec: optional `/atlas-plan <work-package>` → `/atlas-implement <work-package>`.

Run `/atlas-plan` and `/atlas-implement` using the most capable approved
frontier-grade model available. These commands reserve frontier capacity for
planning, orchestration, review, and final verification; implementation
delegates tightly specified or mechanical work to the least expensive capable
worker model.

Managed work uses `/atlas-implement <ticket-or-epic-or-spec>`. A frontier
orchestrator chooses the execution structure and delegates bounded deliverables
when useful. It uses the least expensive capable worker model per delegation;
tight, mechanical packets favor cheaper models, while final review and
verification judgment stay with the frontier orchestrator. Implementation
workers read and follow the supported Matt Pocock implementation skill source
while deferring its final review step. Size alone is never a reason to stop.

## Repository policy and contract model

`CLAUDE.md` is the agent entry point and cross-cutting policy router. Team-owned
documents under `docs/agents/` are authoritative for their named scope. Within
a document that classifies entries, the classification determines authority;
recommendations and repository facts do not silently become mandatory policy.
Tickets and specs remain stable work-package contracts. Planning resolves the
applicable repository policy and facts into technical plans and execution
packets. Generic skills provide reusable mechanics and do not override
repository policy.

Setup initializes `docs/agents/*`; the team owns those files afterward. A setup
rerun refreshes only the managed sections Atlas itself last wrote, preserves any
section the team has edited, and reports every preserved edit in `plan` and
`verify` output.

- Before any tracker read, write, comment, claim, or transition, read and follow
  `docs/agents/issue-tracker.md`.
- Before creating, classifying, prioritizing, or decomposing tickets, read and
  follow `docs/agents/triage-labels.md`.
- Before clarifying, researching, prototyping, specifying, decomposing,
  technically planning, or red-team reviewing proposed work, read and follow
  `docs/agents/planning.md`. This includes `/grill-with-docs`, Wayfinder,
  planning prototypes, `/to-spec`, `/to-tickets`, and `/atlas-plan`.
- During planning, read `docs/agents/domain.md` when the work introduces or
  changes domain concepts and resolve conflicting terminology in the plan.
- Before writing acceptance criteria, Definition of Done, fixtures, or
  verification steps, read `docs/agents/testing.md`.
- During planning, read `docs/agents/tooling.md` when work depends on a detected
  capability and resolve the applicable tool into the execution plan.
- Before changing Claude permissions, Atlas hooks, git hooks, or guardrail
  policy, read `docs/agents/guardrails.md` and obtain human approval.

Execution workers receive resolved decisions, exact verification commands, and
the evidence location in their task packet. Do not make execution workers
reread planning, tracker, triage, domain, testing, or tooling guidance.

## Atlas planning contract

- Invoking `/atlas-implement` approves the fixed work-package contract and any
  existing technical plan. When the contract is content-complete but no plan
  exists, the frontier orchestrator derives the execution plan without inventing
  missing product or architectural decisions.
- `/atlas-plan` is optional. Read `docs/agents/issue-tracker.md` for the
  project's configured readiness, availability, claim, transition, and
  writeback policy; do not infer those rules here.

## Atlas guardrails

- Protected branches by repository: `journeys:main`, `journeys:staging`. Changes land through each repository's configured PR, always based on `staging`.
- Never merge a PR. Follow `docs/agents/issue-tracker.md` for human-only tracker actions.
- Never read or write live secret files. Use `.example` or `.template` files and ask a human to populate live values out of band.
- Never force-push, bypass hooks, destroy uncommitted work, repoint remotes, or weaken guardrails.
- Cloud tools detected/configured: none detected. Mutating cloud and infrastructure actions are denied by default.
- Guardrail exceptions must be durable, attributable, narrow, environment-specific, and time-bounded.
- Claude permission precedence is `deny` over `ask` over `allow`, regardless of
  specificity. Permission modes that suppress prompts can bypass an `ask`; they
  do not override a `deny` or an enforcement hook.
- Installed guardrail files are self-protected. A Claude file-tool edit to one
  prompts for human approval; ask Claude Code to run the `setup-atlas` skill's
  adopt step (not a full setup or refresh) to record it so verification treats
  it as a sanctioned customization rather than tampering.
- Activation, failure behavior, transcript retention, and troubleshooting are in
  `docs/agents/guardrails.md`.
<!-- atlas-v3:guidance:end -->
