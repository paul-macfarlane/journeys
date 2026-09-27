# 82: One membership seam and one data-layer result shape

Status: ai-review
Blocked by: None
Owner: Claude (chunk 4)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (the membership rule is the app's authorization; behaviour-preserving, no schema change)

**Why:** ticket 72, findings M1–M4. Authentication is one seam (`requireSession`, `src/lib/session.ts:20`). The membership check is not. About 15 `src/db` functions each open with `const existing = await getJourneyForMember(...); if (!existing) return null`. Three functions run separate membership joins (`getJourneyForMember` `src/db/journeys.ts:246`, `getDraftForMember` `src/db/drafts.ts:46`, `getProjectForMember` `src/db/projects.ts:132`). Three functions trust the caller to have checked first:

- `createJourney` (`journeys.ts:204-208`, where only a comment enforces it)
- `listJourneysForProject` (`journeys.ts:144`)
- `listMembers` (`members.ts:30`)

That contradicts `projects.ts:20` ("every read and write re-checks it").

`getJourneyForMember` is not wrapped in `cache()`, so one Journey page render repeats the membership join about six times, each plus a version count. The calls come from the page, then Draft, Versions, Responses, Analytics, and the live version (`src/app/projects/[projectId]/journeys/[journeyId]/page.tsx:56-123`). `publishDraft` checks twice (`src/db/versions.ts:153-156`).

The db results disagree about failure:

- `null` or `false` means "not found" in drafts, versions, journeys, and projects.
- `{ ok: false, reason: "no-project" }` in members (`members.ts:39-41, 85-87`).
- `{ ok: false, conflict: true }` in versions (`versions.ts:111`).

So "…no longer exists" is mapped by hand in 19 places under `src/app`.

**What to build:**

- `src/db/access.ts`, one module:
  - `projectForMember(projectId, userId)` and `journeyForMember(projectId, journeyId, userId)`, both request-scoped with `cache()`. Each returns a branded `MemberProject` / `MemberJourney` (or null).
  - `getProjectForMember` and `getJourneyForMember` are replaced by them: every caller moves to the new names, and nothing re-exports the old ones.
- Every `src/db` function that needs a membership takes the branded value, not `(projectId, journeyId, userId)`. The caller-trusting functions become impossible to call without it. The type system holds the "caller must check" rule, not a comment.
- The Journey page resolves membership once and passes the `MemberJourney` down. Remove the "Null only for a non-Member, which the check above already answered" branches (`page.tsx:75, 84, 96`).
- One failure shape for db writes: `{ ok: false, reason: "not-found" } | { ok: false, reason: "conflict" }` (the publish numbering race) `| { ok: false, reason: "invalid", error, stepId? }` (a refused document or field), plus 73's `"stale"`. One mapper in the action layer turns each reason into its user message. Delete the bare aliases `ProjectActionResult` (`src/app/projects/actions.ts:33`) and `JourneyActionResult` (`src/app/projects/[projectId]/journeys/actions.ts:36`). 73 adds `"stale"` to the same union, so if 73 lands first, fold its variant in here.
- Shared db helpers: `isUniqueViolation`/`pgErrorCode` into `src/db/errors.ts` (duplicated at `versions.ts:118` and `members.ts:160-176`), and `lockProject` shared with `removeMember` (`journeys.ts:132`, `members.ts:113-117`). Add `revalidateProjectPaths()` beside `revalidateJourneyPaths` for the four inline pairs in `src/app/projects/actions.ts`.
- **Sanitising in one layer.** `saveDraft` sanitises inside the db layer (`prepareDocumentForWrite`, `drafts.ts:106`). The Project description is sanitised in the action (`src/app/projects/actions.ts:83`). Move it into `editProjectDescription` so the db function is the only path that accepts Content, as the Draft's is.
- **Page rules into `src/lib`.** `hasUnpublishedChanges` and `draftEditedAt` (`page.tsx:124-139`) are publish-state rules computed in a page. Move them to a pure function beside `src/lib/publish-state.ts` with a unit test. The two preview pages' shared prologue (`preview/page.tsx:44-60`, `preview/[stepId]/page.tsx:47-66`) becomes one `loadPreview`.

Acceptance criteria:

- [ ] No `src/db` function takes a bare `userId` for a membership check except the two functions in `access.ts`.
- [ ] One Journey page render runs the membership join once (a unit or e2e check on query count, or a logged count in the closeout).
- [ ] `grep -rn "no longer exist" src/app` names one mapper, not 19 sites.
- [ ] Unit test for the publish-state function. The existing specs pass, plus one full `pnpm test:e2e`.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 72.

## Comments

### 2026-09-26 — Claude (Opus 5.5), chunk 4

`[EXECUTION PLAN]` Chunk 4 is 82 → 77 (backlog rows 9 and 10), one branch `feat/chunk-4-membership-and-accounts`, one PR to `staging`. The two tickets share no source files, so they run in parallel: this ticket is deliverable D1, one worker (Opus) in worktree `journeys-d1`; 77 is D2 in `journeys-d2`. The backlog's `Route: contract` wins over this ticket's "(`polish`)" verification line; the chunk runs the contract chain, one full `pnpm test:e2e`, and two reviewers at the end.

Resolved decisions for D1 (ticket 72 findings M1–M4, applied as written, with 73's `stale` already landed):

- `src/db/access.ts` holds the only two membership reads, `projectForMember(projectId, userId)` and `journeyForMember(projectId, journeyId, userId)`, both `cache()`d, returning branded `MemberProject` / `MemberJourney` or null. `journeyForMember` is one query (journey ⋈ project ⋈ member) plus the version count, and it selects the Project's columns too, so `MemberJourney.project` is a `MemberProject` and the Journey page never asks for the Project again. Both carry `memberUserId`, so `publishDraft` reads `publishedBy` from the value it was handed.
- Every other `src/db` function that needed a membership takes the branded value: `createJourney`, `listJourneysForProject`, `listMembers`, `addMemberByEmail`, `removeMember`, `renameProject`, `editProjectDescription`, `setProjectTheme`, `deleteProject` take a `MemberProject`; `getDraft`, `saveDraft`, `listVersions`, `getLiveVersion`, `publishDraft`, `restoreVersion`, `unpublishJourney`, `updateJourney`, `setJourneyTheme`, `moveJourney`, `deleteJourney`, `listResponses`, `getAnalytics` take a `MemberJourney`. None re-checks membership; the guarded writes' `rowExists` fallback still tells a vanished row from a stale one.
- One failure shape, `WriteFailure`, in `src/lib/write-result.ts` (pure, so the action layer and `src/db` both import it): `not-found | conflict | stale | invalid { error, stepId?, problems? }`. `guarded-write.ts`'s `StaleWrite` is its `stale` member. Members' `unknown-email`, `already-member`, `not-a-member`, `last-member` stay as those functions' own extra reasons. One mapper, `failureResult`, in `src/lib/action-result.ts` turns a `WriteFailure` into the `ActionResult` sentence; the user-facing copy stays byte-identical to today's, and `grep -rn "no longer exist" src` names the mapper alone. The bare aliases `ProjectActionResult` and `JourneyActionResult` go.
- `src/db/errors.ts` holds `pgErrorCode` and `isUniqueViolation`; `lockProject` is exported from `src/db/projects.ts` and shared by `journeys.ts` and `members.ts`; `revalidateProjectPaths()` joins `revalidateJourneyPaths()`.
- `editProjectDescription` takes unknown input and baseline and sanitises them itself; the action stops calling `sanitizeContent`.
- The publish-state rules leave the page: a pure function beside `publishStateOf` in `src/lib/publish-state.ts` answers `hasUnpublishedChanges` and `draftEditedAt` from the Journey row, the Draft, and the live version, with a unit test. The two Preview pages share one `loadPreview`.

Evidence: `test-results/82-ac-1-membership-signatures.txt` (the exported `src/db` signatures), `test-results/82-ac-2-membership-query-count.txt` (Postgres statement log for one Journey page request: the orchestrator's capture), `test-results/82-ac-3-no-longer-exists-grep.txt`, the publish-state unit test in the chain, and the chunk's full run in `test-results/chunk-4-commands.txt`.

`[AI CODE REVIEW]` Two fresh reviewers (Opus) read the whole chunk diff (`8da2dd0..9300bb7`), one for correctness and spec, one for coding standards; the orchestrator adjudicated from the cited hunks. Fixed in 2698b30 (one worker, Opus):
- Correctness and spec:
  - `removeMember` re-checks, under the Project lock, that the acting Member still belongs (the in-lock check the base code had, dropped by the refactor).
  - The not-found copy was asserted through `failureResult` itself; `src/lib/action-result.test.ts` now pins every sentence, and the action tests assert literals.
  - The AC-1 evidence predated ticket 77's `src/db/account.ts`; recaptured at 2698b30.
- Coding standards: unused exports removed (`Transaction`, `StaleWrite`, `MissingRow`, `pgErrorCode`, `staleResult`, `titleOrDescriptionPending`); `access.ts`'s comment narrowed to "the only reads that resolve one Project or Journey for a Member"; comment wrap and the detached `PublishState` JSDoc; duplicate `beforeEach` stubs.
- Approved deviations, kept:
  - The publish and unreadable sentences ("This journey can't be published yet", "This journey's draft can't be read…", "Version N can't be read…") travel from `src/db` as `invalid` errors, as the plan's `WriteFailure` shape gives them; copy is byte-identical to 8da2dd0.
  - AC-2 is read as the Journey's membership join, which runs once. The `[projectId]` layout's navbar still resolves the Project in its own cached query, so one render joins `member` twice for the two (plus the switcher's own list).
  - `moveJourney`, `deleteJourney`, `deleteProject`, and `unpublishJourney` answer `ok` once membership is resolved; a row already gone stays a quiet success, as before.
  - `editProjectDescriptionAction` resolves membership before sanitising, so a non-Member posting malformed content reads "That project no longer exists".
- Accepted risk: `addMemberByEmail` racing a Project or account deletion still surfaces an unmapped foreign-key error, as before this ticket.
