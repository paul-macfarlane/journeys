# 82: One membership seam and one data-layer result shape

Status: ready-for-agent
Blocked by: None
Owner:
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
