# 83: Error pages and unreadable Published Versions

Status: done
Blocked by: None
Owner: Claude Opus 5.5 (chunk 1, `feat/chunk-1-saves-and-unreadable-rows`)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (changes how Published Versions and Runs are read)

**Why:** ticket 72, finding Q-corrupt. `src/app` has no `error.tsx` and no `global-error.tsx`; only `not-found.tsx`. A thrown error anywhere reaches Next's default error page, which is unbranded and gives the Participant or Author no way back.

Every stored document is read with a throwing parse: `graphDocumentSchema.parse` or `contentSchema.parse`, at 8 sites in `src/db`. These are `drafts.ts:68`, `versions.ts:103, 270`, `analytics.ts:78`, `runs.ts:137, 250`, `projects.ts:60`, and `users.ts:208`. A Run's `path` is typed with `$type` and never validated (`runs.ts:223`). Ticket 73 takes the Draft (a recovery page offering Restore). This ticket takes everything else. The worst case is a Published Version that no longer parses: it breaks the public runner page and every live Run on it.

**What to build:**

- A root `src/app/error.tsx` and `src/app/global-error.tsx` in the app's layout and voice. They say something went wrong and offer "Try again" (`reset`) and a link home. They never show the error message or stack to a Participant or Author. Log the error server-side with its digest.
- Reads of a Published Version (`getPublicJourney`, `getRunForJourney`, `getLiveVersion`, analytics) use `safeParse`. On failure:
  - The runner renders the same "This Journey isn't available" page an unpublished Journey gets.
  - The Author's Journey page shows a banner on the Versions and Analytics tabs naming the version that cannot be read. The Draft and the other versions still work.
  - The failure is logged with the Journey and version id, never the document.
- A Run whose `path` fails a `z.array(idSchema)` parse restarts from the Start, as a Run on a replaced version does today.

Acceptance criteria:

- [ ] A unit test per `safeParse` site: a bad row gives the fallback result, not a throw.
- [ ] e2e `unreadable-version`, seeded with a bad Published Version row: the runner shows the unavailable page (status 200, not 500), and the Journey page's Draft tab still loads.
- [ ] e2e `error-page`: a route forced to throw in the test server shows the app's error page with "Try again". If no route can throw without a test-only hook, prove it with a unit render instead and say so.
- [ ] One full `pnpm test:e2e`.

Verification follows `docs/agents/testing.md` (`polish`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 72; ticket 15 ("Corrupt-row handling", the non-Draft half).

## Comments

### [EXECUTION PLAN] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 1, Route: contract)

Deliverable D3 of chunk 1 (see ticket 73's `[EXECUTION PLAN]` for the branch, worktree, env, and sequencing); runs after 73 so it reuses 73's `CannotBeRead` notice.

**Resolved decisions.**

- `src/app/error.tsx` and `src/app/global-error.tsx`: client components in the app's layout and voice with "Try again" (`reset`) and a link home; the error's message and stack never render; `console.error` carries only the digest. No test-only throwing route is added to the app, so the `error-page` criterion is proven by a unit render (`react-dom/server` under vitest), as the ticket allows.
- `safeParse` at every non-Draft site. `getLiveVersion` answers `{ kind: "unreadable", versionId, versionNumber }` beside the readable shape; `getAnalyticsForMember` the same; the Journey page passes the unreadable version to the Versions and Analytics tabs, which show the `CannotBeRead` notice as a banner naming "Version N", and the Draft and other versions keep working. `getPublicJourney` answers `{ kind: "unavailable" }`, `getRunForJourney` null (the runner restarts as on a replaced version), `restoreVersion` `{ ok: false, reason: "unreadable" }`, and the two `contentSchema` sites fall back to the empty document. Each failure logs `journeyId`/`versionId` (or the Project/Author id), never the document.
- A Run `path` that fails `z.array(idSchema)` restarts from the Start.

**Verification map** (contract; chain once at the chunk's end):

| Criterion | Proof | Evidence | Earliest |
|---|---|---|---|
| AC1 unit per `safeParse` site | vitest, one test per site | unit line in `test-results/chunk-1-commands.txt`, `test-results/83-ac-1-safeparse-unit.txt` | after D3 |
| AC2 e2e `unreadable-version` | seeded bad `published_version` row: runner 200 + unavailable page, Journey Editor tab loads, Versions banner | `test-results/unreadable-version/` | after D3 |
| AC3 `error-page` | unit render of `error.tsx` (no throwing route without a test hook; said so here) | `test-results/83-ac-3-error-page-unit.txt` | after D3 |
| AC4 one full `pnpm test:e2e` | the chunk chain | `test-results/chunk-1-commands.txt` | end of chunk |

### [AI CODE REVIEW] 2026-09-26 — two readers (correctness and spec; coding standards), diff `ebb8178...b72a3de`, judged by the orchestrator

*Correctness and spec:*
- Every parse site listed above now uses `safeParse`; a grep finds no throwing parse of a stored document left under `src`.
- The error pages never render `error.message`.
- A Run whose path fails its parse restarts from the Start.
- **Fixed in 5adb888:** the live-version and analytics logs now carry `journeyId` beside `versionId`, and restore answers `reason: "unreadable"`.
- **Rejected:** a banner for an unreadable *non-live* version. This ticket names the live version's banner, and restoring any other unreadable version refuses by name ("Version N can't be read, so it can't be restored.").
- **Noted:** the error pages log the digest in the browser. Next itself logs every server render error with its digest.

*Standards:*
- **Orchestrator fix, amended into b72a3de:** the Versions banner sentence collapsed the space before its dash, so it is now one string.
- **Fixed after the review:** the second runner screenshot was dropped for one screenshot per spec (25a0a4e), and the `restoreVersion` doc comment was corrected (5adb888).

### [CLOSEOUT] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 1, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/101 (base `staging`, comparison SHA `ebb8178`), shared with 81 and 73. Status set to `done` in this commit; merging the PR is Paul's acceptance. State log: ready-for-agent → in-progress → ai-review → ready-for-human → done (this commit). This commit also records in ticket 15 that the non-Draft half of "Corrupt-row handling" is closed.

**Deliverables.**
- D3, worker (sonnet): 145d3fb, amended by the orchestrator to b72a3de (banner copy and attribution trailer).
- Review fixes: 5adb888.
- One-screenshot fix: 25a0a4e.

| Criterion | Verdict | Evidence |
|---|---|---|
| A unit test per `safeParse` site: a bad row gives the fallback, not a throw | PASS | `test-results/83-ac-1-safeparse-unit.txt` (drafts, versions, analytics, runs incl. path, projects, users) |
| e2e `unreadable-version`: runner shows the unavailable page (200, not 500), and the Journey page's Draft tab still loads | PASS | `test-results/unreadable-version/unreadable-version.png` (viewed; the Versions banner "Version 1 can't be read"); the spec asserts 200 and "This journey isn't available", and the Editor canvas |
| `error-page`: the app's error page with "Try again" | PASS (unit render, as allowed: no route can throw without a test-only hook) | `test-results/83-ac-3-error-page-unit.txt` |
| One full `pnpm test:e2e` | PASS | `test-results/chunk-1-commands.txt` (120/120, 0 flaky) |

**Verified run command.** The same chain as 73 at e29037d, every step `exit=0`. At 25a0a4e only the spec's second screenshot call was removed, and `unreadable-version` was rerun on the existing build (1 passed).
