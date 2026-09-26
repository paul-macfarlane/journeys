# 85: Leftovers sweep: AI-authoring text, dead code, and pure-core test gaps

Status: done
Blocked by: None
Owner: Claude (/atlas-implement, chunk 2)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (`schema.ts` changes, although this PR commits no migration; see the two-deploy note)

**Why:** ticket 72, findings D1–D5, M6, and T1. Ticket 14 (AI authoring) is `wontfix`. Its code never merged, but its text did. The deletion test also finds a few exports and one dependency with no caller.

**What to build:**

1. **AI-authoring text** (D1). The Judge is the only AI consumer; ticket 80 may add AI editing later.
   - `.env.example:19`: "Anthropic API key for AI authoring (priority 11). Leave empty to hide AI features." It is the Vercel AI Gateway key, and leaving it empty means deciding Prompts let the Participant choose.
   - `src/lib/env.ts:24-26`: the comment "Optional until AI authoring lands". It is optional because the Judge falls back without it.
   - `README.md:39`.
   - `.scratch/journeys-platform/human-prerequisites.md` §6 heading and lines 59 and 61: drop ticket 14. Keep ticket 43, the Fluid note, and the budget alert, and point at ticket 84's spend limit.
   - `docs/adr/0001-graph-as-one-json-document.md:33-34, 112-113`: add a dated note that AI authoring was withdrawn (ticket 14, 2026-09-26), so the "projection" it mentions was never built. Do not rewrite the decision.
   - `.scratch/journeys-platform/spec.md`: mark the "AI authoring" stories (lines 140-148) and the "### AI" section (212-216) withdrawn, with a pointer to the 2026-09-26 scope change. `decisions.md` is a historical log and stays.
   - `CLAUDE.md`'s `src/lib/` line says "Pure, database-free helpers", but `auth.ts` imports `db`, and `session.ts` and `ai/judge.ts` are `server-only` (72 finding M6). Make it say "plus the server-only auth, session, env, and Judge modules".
2. **Unused dependency** (D2). Remove `@tanstack/react-query` from `package.json`; nothing imports it. The `pnpm-lock.yaml` change is Paul's commit (the secret-scrub hook). Also remove it from `spec.md:158`'s stack line and `CLAUDE.md`'s stack line.
3. **Dead exports** (D3):
   - Delete `parseGraphDocument` (`src/lib/graph/document.ts:217`) and its tests. Production uses `graphDocumentSchema.parse` and `prepareDocumentForWrite`.
   - Delete the unreferenced types `ProjectThemeInput` (`src/lib/validation/project.ts:42`), `JourneyThemeInput` (`validation/journey.ts:67`), and `AuthorPageInput` and `AuthorPageVisibilityInput` (`validation/author.ts:40-41`).
   - Replace the 13 raw `Object.hasOwn(….steps, …)` reads with the existing `hasStep` (for example `draft-editor.tsx:208, 334, 698, 880`, `choice-list.tsx:136`, `step-view.tsx:352`, `response-list.ts:87`, both preview pages).
   - Merge the identical callbacks `addNextStep` and `connectToNewStep` (`draft-editor.tsx:737-748, 813-825`).
4. **Stale comments on `position`** (D4). Ticket 17 (manual layout) is `wontfix`, so `position` has no planned reader. Reword `src/lib/graph/layout.ts:19-22`, `src/components/journeys/journey-canvas.tsx:84-85`, and `spec.md:222-224` to say it is an unused legacy field kept only so stored documents parse. Removing it is `wontfix` (see 72).
5. **The dead `project.description` column** (D5). Drizzle's inserts name every schema column, so the deployed code writes `description` on each `createProject`. A drop migration in the same deploy would break inserts while Migrate and Vercel race (the `CLAUDE.md` deploy-window rule). So there are two PRs, back to back:
   - **This ticket's PR:** remove `description` from `src/db/schema.ts`, and do not commit the drop migration `pnpm db:generate` would now produce. The column keeps its default in the database.
   - **The follow-up PR, as soon as Paul has promoted this one to production:** commit that generated `DROP COLUMN` migration. Until it lands, any other ticket that runs `db:generate` must remove the stray drop from its own migration. Take the follow-up before the next ticket that adds a migration (84 in the proposed order), so that never happens.
6. **Pure-core test gaps** (T1):
   - Unit tests for `hasStep`, `hasOutcome`, `readStoredImageAttrs` (`content.ts:158`), and the cookie options in `src/lib/run-cookies.ts`: path scope, `httpOnly`, `secure` in production.
   - **Key-order invariance.** Postgres `jsonb` reorders object keys, and `steps` is a record. Add one table test asserting that `layoutGraph`, `validateForPublish`, `mapOrder`, the analytics functions, and `response-list` give identical results for a document and the same document with its `steps` keys reversed.
   - `validateForPublish` lists problems in raw key order (`validate.ts:58`). Order them by `mapOrder`, or by breadth-first order from the Start, so the Publish dialog's list is stable.

Acceptance criteria:

- [ ] `grep -rni "ai authoring" .env.example README.md src docs/adr` finds only the dated ADR note.
- [ ] `@tanstack/react-query` is gone from `package.json` (the lockfile is Paul's).
- [ ] `project.description` is gone from `schema.ts`, and this PR commits no migration. The closeout records the drop-migration follow-up and when it may run.
- [ ] The new unit tests pass, including key-order invariance. The existing suites pass, plus one full `pnpm test:e2e`.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 72.

## Comments

### [EXECUTION PLAN] 2026-09-26 — Claude Fable 5.1 (`/atlas-implement`, chunk 2 "Cleanup and stability": 85 → 74)

Chunk record for both tickets (74 is `Route: polish` and carries only its `[CLOSEOUT]`). Backlog and tickets agree on the order: 85 then 74. Comparison SHA `4f2e8c7` (staging), branch `feat/chunk-2-cleanup-and-stability`, one worktree beneath `.claude/worktrees/chunk-2-cleanup-and-stability/journeys` with a dummy env (port 3185, database `journeys_e2e_c2`), one PR to `staging`.

**Structure: sequential, three deliverables.** Parallelism rejected: D1 and D2 both edit `.scratch/journeys-platform/human-prerequisites.md` (§6 rewrite vs. a new Skew Protection section), D1 edits `src/components/journeys/draft-editor.tsx` while D3's flake hunt must run over the integrated app (D1's `validateForPublish` ordering changes what the Publish dialog lists; D2 mounts a client component in the root layout), and one Docker database and port serve the checkout. Re-checked at closeout against the real diffs.

| Deliverable | Ticket slice | Worker |
|---|---|---|
| D1 | 85 items 1–6 (AI-authoring text, `@tanstack/react-query`, dead exports and `hasStep`, `position` comments, `project.description` off the schema with no migration, pure-core tests and `validateForPublish` ordering) | sonnet |
| D2 | 74 chunk-load recovery: `isChunkLoadError` shared with `error.tsx`/`global-error.tsx`, reload-once client component in the root layout with a `sessionStorage` marker in try/catch, unit tests; Skew Protection in `human-prerequisites.md`; ticket 15's deploy-window bullet closed with a pointer to the `CLAUDE.md` rule | sonnet |
| D3 | 74 flake hunt: shared helpers into `e2e/setup/` (ticket 72 T3 list, including `holdServerAction`), the T2 suspects fixed at their cause, `--repeat-each 3` under the load recipe, the recipe written into `docs/agents/testing.md` | opus |

**Resolved decisions.**
- `validateForPublish` orders problems breadth-first from the Start (Choice order within a Step), then unreachable Steps by id; it never imports `layout.ts` (which already imports `PublishProblem`).
- Key-order invariance is a table test over `layoutGraph`, `validateForPublish`, `mapOrder`, `analyticsForVersion`, and `groupResponsesByStep` with the fixture's `steps` keys reversed.
- The drop migration for `project.description` is a follow-up PR after Paul promotes this one to production, and before ticket 84 (the next migration).
- The lockfile change from `pnpm remove @tanstack/react-query` stays uncommitted for Paul's own commit on this branch; CI's `--frozen-lockfile` step stays red until then.
- 74-AC-1's staging check needs a deploy, which only the merge produces: it is recorded in the closeout as Paul's post-merge step with the exact recipe, not as `PASS`.

**Verification map** (`docs/agents/testing.md`, contract chain once at the chunk's end).

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 85-AC-1 | `grep -rni "ai authoring" .env.example README.md src docs/adr` | only the dated ADR-0001 note | `test-results/85-ac-1-ai-authoring-grep.txt` | D1 integrated | any edit to those files |
| 85-AC-2 | `grep -c "@tanstack/react-query" package.json` | `0` | in `test-results/chunk-2-commands.txt` | D1 integrated | `package.json` edit |
| 85-AC-3 | `grep -n "description" src/db/schema.ts`; `git diff 4f2e8c7 --stat -- drizzle` | no `project.description` column; no migration in the diff | `test-results/85-ac-3-schema-no-migration.txt` | D1 integrated | `schema.ts` or `drizzle/` edit |
| 85-AC-4 | `pnpm test`, then the chunk's full `pnpm test:e2e` | all green, new tests listed | `test-results/85-ac-4-unit.txt`, `test-results/chunk-2-commands.txt` | D1 (unit) / final (e2e) | any `src` or `e2e` edit |
| 74-AC-1 | `pnpm test src/components/chunk-load-recovery` (handler: reloads once on a chunk-load error, never twice, tolerant of throwing storage); human gate: Paul loads a page on staging, merges a later deploy, navigates, sees one reload onto the new build | unit green; staging check recorded by Paul after merge | `test-results/74-ac-1-chunk-load-unit.txt`; closeout | D2 / post-merge | handler or error-page edit |
| 74-AC-2 | `pnpm test:e2e:prebuilt --repeat-each 3` under the load recipe, over a fresh build | every test passes ×3, 0 flaky; recipe present in `docs/agents/testing.md` | `test-results/74-ac-2-repeat-each-under-load.txt` | D3 integrated (final code) | any `src` or `e2e` edit |
| 74-AC-3 | `grep -n "Skew Protection" .scratch/journeys-platform/human-prerequisites.md` | a checklist item for Paul | in `test-results/chunk-2-commands.txt` | D2 integrated | file edit |
| DoD | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate && E2E_EVIDENCE=… pnpm test:e2e` | every step `exit=0` | `test-results/chunk-2-commands.txt` | final integration | any edit |

Run surface: local; deployed only for 74-AC-1's post-merge check. Fixtures: the e2e suite's own seeded Journeys; no participant Responses in evidence. Human gates: Skew Protection (Paul, Vercel settings, any time) and the post-merge staging check (Paul, after merging this PR).

### [AI CODE REVIEW] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 2: 85 and 74)

The chunk's single formal review, over `4f2e8c7..78d916e`. It was read by two fresh Opus reviewers, one on technical implementation and spec conformity and one on coding standards. The orchestrator adjudicated every finding. The fixes landed in `651044d`, `63d6649`, `ca3f366`, and `7d7553d`, and the tracker record in `739c026`.

**Technical implementation and spec conformity**

| # | Severity | Finding | Paths | Disposition |
|---|---|---|---|---|
| T1 | blocking | The key-order test compared two empty problem lists, so `validateForPublish`'s new order was untested. | `src/lib/graph/key-order.test.ts`, `validate.test.ts` | Resolved (`651044d`): the fixture now has problems under every rule, and a `validate.test.ts` case uses a key order that is neither breadth-first nor id order. |
| T2 | blocking | Two live key-order dependencies: `groupResponsesByStep` appended unreachable Steps in raw key order, and analytics broke Outcome-group ties by label only. The fixture could not show either. | `src/lib/response-list.ts`, `src/lib/analytics.ts` | Resolved (`651044d`): one `walkSteps` in `document.ts` serves validation, Responses, and layout, and analytics ties now break by key. The widened test also exposed that `layoutGraph` fed dagre in key order; it now uses `walkSteps` too. Four tests failed before the fix. |
| T3 | non-blocking | The 10 s reload window could loop on a load slower than 10 s. | `src/lib/chunk-load.ts`, `src/components/chunk-load-recovery.tsx` | Resolved (`63d6649`): one reload, then none until a client-side navigation succeeds. |
| T4 | non-blocking | The listener reloads on any unhandled chunk-load failure, not only a navigation. | `src/components/chunk-load-recovery.tsx` | Accepted as designed: a chunk that cannot load is a stale build wherever it fails, and the leave guard still asks before an unsaved edit is lost. |
| T5 | non-blocking | `human-prerequisites.md` §6 dropped the budget alert. | §6 | Resolved (`ca3f366`). |
| T6 | non-blocking | `addStepFromCanvas` read the box count once. | `e2e/canvas.spec.ts` | Resolved (`7d7553d`): polls until two reads agree. |
| T7 | non-blocking | A held request that never arrives hung to the test timeout. | `e2e/setup/server-action.ts` | Resolved (`7d7553d`): rejects with a message after 10 s. |

**Coding standards**

| # | Severity | Finding | Disposition |
|---|---|---|---|
| S1 | non-blocking | `docs/agents/planning.md` still listed TanStack Query. | Resolved (`ca3f366`) |
| S2 | non-blocking | §6 heading said "jev"; stale "defer until 43". | Resolved (`ca3f366`) |
| S3, S4 | non-blocking | `spec.md:216` pointed at a bullet that does not exist; `spec.md:160` claimed PR previews. | Resolved (`ca3f366`) |
| S5–S7 | non-blocking | A `"use client"` lib module; `//` docs, first person, `interface`, and a dotted storage key in `chunk-load.ts`; a doc naming the wrong function. | Resolved (`63d6649`): `chunk-load-browser.ts` deleted, its helpers live in the component |
| S8 | non-blocking | Outcomes were never reversed in the key-order test. | Resolved (`651044d`) |
| S9–S11 | non-blocking | Duplicate or unsorted e2e imports; `release` removed every route on the page; a missing return type. | Resolved (`7d7553d`): `release` now unroutes only its own handler and waits for it |
| S12, S13 | non-blocking | Wording of the `CLAUDE.md` `src/lib/` line; "Authors" for developers in `env.ts`. | Resolved (`ca3f366`) |
| S14 | non-blocking | Record the `ai-review` transition. | Resolved (`739c026`) |

No blocking finding is open.

Remaining risks:
- Dagre now receives Steps in walk order, so an existing Draft's map may lay out a little differently on staging.
- The dagre layout of a Draft is otherwise unchanged. All layout unit tests and the canvas crossing baseline pass.

### [CLOSEOUT] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 2, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/102 (base `staging`, comparison SHA `4f2e8c7`), shared with ticket 74. Status set to `done` in this commit; merging the PR is Paul's acceptance. State log: ready-for-agent → in-progress → ai-review → ready-for-human → done (this commit).

**Deliverables.**
- D1, one worker (sonnet): `57b39dd`. Orchestrator fix `20984e1` kept the problem list grouped by rule, with breadth-first Step order inside each rule; the worker had grouped by Step.
- Review fixes, one worker (opus): `651044d`, `ca3f366`.

| Criterion | Verdict | Evidence |
|---|---|---|
| `grep -rni "ai authoring" .env.example README.md src docs/adr` finds only the dated ADR note | PASS, with a deviation | `test-results/85-ac-1-ai-authoring-grep.txt`. ADR-0001's decision text keeps its two original mentions (lines 35, 114), because this ticket says not to rewrite the decision. |
| `@tanstack/react-query` is gone from `package.json` | PASS | `test-results/chunk-2-commands.txt` (`grep -c` prints 0). The `pnpm-lock.yaml` change is uncommitted, for Paul's commit. |
| `project.description` is gone from `schema.ts` and no migration is committed; the follow-up is recorded | PASS | `test-results/85-ac-3-schema-no-migration.txt`; follow-up below |
| New unit tests pass, including key-order invariance; existing suites pass; one full `pnpm test:e2e` | PASS | `test-results/85-ac-4-unit.txt` (183 tests in the ticket's files; 669 in the full suite); `test-results/chunk-2-commands.txt` (e2e 121/121, 0 flaky) |

**Drop-migration follow-up.** After Paul promotes this PR to production, and before ticket 84 (the next ticket that adds a migration), open one PR that commits what `pnpm db:generate` produces: a single `ALTER TABLE "project" DROP COLUMN "description"`. Until it lands, any other ticket that runs `db:generate` must delete that stray drop from its own migration.

**Paul owes:**
- Commit `pnpm-lock.yaml` on this branch (`pnpm install` already rewrote it). CI's `--frozen-lockfile` step fails until he does.
- The drop-migration follow-up above.

**Verified run command.** `sh node_modules/.atlas-c2/run.sh sh node_modules/.atlas-c2/chain.sh`: `format:check`, `lint`, `typecheck`, `test`, `build`, `db:migrate` (on the chunk's e2e database), and `pnpm test:e2e:prebuilt`. Every step `exit=0` at `7b692b6`.
