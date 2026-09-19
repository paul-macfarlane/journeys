<!-- atlas-v3:planning:start -->
# Repository planning profile

This document is the repository's scoped planning profile. Each entry has the
authority named by its classification; the document is not blanket mandatory
policy.

Read this guide before clarifying, researching, prototyping, specifying,
decomposing, technically planning, or red-team reviewing proposed work. It
routes repository-specific concerns; generic planning mechanics remain in the
invoked skill.

| Classification | Trigger | Required consideration |
|---|---|---|
| Atlas recommendation | Ticket lacks a clear problem, outcome, or bounded decision | Return to /grill-with-docs, Wayfinder, /to-spec, or /to-tickets as appropriate. |
| confirmed team policy | Any work that assumes a language, framework, or runtime | Next.js 16 App Router, React 19, TypeScript, pnpm; Drizzle + Neon Postgres (`@neondatabase/serverless` in prod, `pg` + docker-compose locally); better-auth (Google + Discord); Tailwind v4 + shadcn; zod 4; TanStack Query; Vitest + Playwright; Vercel. Mirror `paul-macfarlane/paulitakes` conventions. |
| confirmed team policy | Any work that names a domain concept | Use the vocabulary in `CONTEXT.md` (Journey, Project, Step, Choice, Ending, Outcome, Draft, Published Version, Run, Prompt, Response, Member, Theme). Do not bake the migrant-healthcare example into the model. |
| confirmed team policy | Any work touching the journey graph, publishing, or runs | Published Versions are immutable; Runs pin to the version they started on; the Draft is the only mutable copy. Read `docs/adr/` and `.scratch/journeys-platform/decisions.md`. |
| discovered repository fact | Work that would need a pull request | Open it with `gh pr create --base main --head <feature-branch>`; a human merges. |
| unresolved question | Work that depends on lint, test, typecheck, build, or e2e commands | None are recorded until the Foundation ticket lands. Rerun Atlas setup afterward; do not invent commands. |

Classifications have distinct authority: confirmed team policy is mandatory;
Atlas recommendations are proposals; discovered repository facts are evidence;
unresolved questions must not be silently converted into policy.

## Work-package plan contract

`/atlas-plan <ticket-epic-or-spec>` reads the complete stable contract, existing
technical or execution plan, dependencies, decisions, and relevant repository
areas. For tracked work it also reads state, comments, linked parent specs, and
applicable children. Its plan covers intent, affected areas and interfaces,
ordered steps, declared scope, dependencies, AC and DoD coverage, run surface,
verification commands, real-dependency checks, fixtures, and human
prerequisites. It preserves the stable contract and adequate existing plan
content.

Return an unclear or unbounded work package to `/grill-with-docs`, Wayfinder,
`/to-spec`, or `/to-tickets`; a stable repository spec is a valid input, but
`/atlas-plan` does not invoke those flows or create product specs or child
tickets from unresolved material.

## Review and publication

Red-team policy: Required for high-risk work and for any plan that materially establishes or changes this repository's architecture. Given the repository is greenfield, the first architectural plan qualifies..

Storage: **tracker**. Drafts before approval:
**false**. A repository spec uses
the planning section of sibling `execution.md`; tracked work uses the configured
storage. Exact file or tracker mutations are previewed before publication. Read
`docs/agents/issue-tracker.md` for the authoritative approval, persistence, and
ticket status rules, `docs/agents/triage-labels.md` for decomposition,
`docs/agents/domain.md` for terminology, and `docs/agents/testing.md` for AC,
DoD, fixture, and verification design.
<!-- atlas-v3:planning:end -->
