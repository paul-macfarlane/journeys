# 36: The Draft on the Versions tab

Status: done
Blocked by: None
Owner: Claude (Fable 5.1), worktree `feat/36-versions-tab-draft-row`, 2026-09-23
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → **36** → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: polish

**Why:** The Versions tab lists Published Versions only. Paul, 2026-09-22, item 13: "it would be helpful to also show the current draft version on there (assuming there are staged but not published changes)".

**Decisions (Paul, 2026-09-22, grilled):** the Draft appears as the first row only while it differs from the live version (the page already derives `hasUnpublishedChanges` from the title, the description, and `documentsEqual`); when the live version matches the Draft exactly, the list is as it is today. A never-published Journey shows the Draft row above "Not published yet."

**What to build:**

- **Data.** `getDraftForMember` (`src/db/drafts.ts`) exposes the Draft's `updatedAt`; the Journey page passes `hasUnpublishedChanges` and that timestamp to `VersionList`.
- **Row.** In `src/components/journeys/version-list.tsx`, a first row "Draft" with a badge "Unpublished changes", "Last edited <time> UTC" in the same fixed format as the versions, and two actions: "Open editor" (switches to the editor tab through `UrlTabs`, so the tabs need a way to change from a sibling; the simplest is a link to `?tab=editor` that the page reads) and the existing Publish button. No restore on the Draft row.
- **Copy.** The empty state reads "Not published yet." beneath the Draft row rather than alone.
- **Specs.** `publish` gains `versions-tab-shows-draft`: publish, edit a Step title, open Versions, find the Draft row with "Unpublished changes" above "Version 1 · Live"; publish again and find no Draft row.

Acceptance criteria:

- [x] With unpublished changes the Versions tab lists the Draft first with its last-edited time, a way to the editor, and Publish; with none it lists only Published Versions.
- [x] A never-published Journey shows the Draft row and "Not published yet."
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 13.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/46 (base `staging`, comparison SHA `cf3d781`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Execution.** One session in the worktree `.claude/worktrees/feat+36-versions-tab-draft-row` (branch `feat/36-versions-tab-draft-row`, dummy env exported, e2e on port 3136 / `journeys_e2e_t36`). Spec first (`versions-tab-shows-draft`, watched fail on the missing row), then 6801d11 — `getDraftForMember` returns `{ document, updatedAt }`, `UrlTabs` reads the tab off the address (`useSearchParams`) so a link opens a tab in place, the Draft row in `VersionList`, `PublishButton` `size`, the restore spec's header assertions scoped; 707ade1 — review tidy-ups; 7dd93a7 — evidence.

**Verified run command (final tree, head 707ade1):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=versions-tab-shows-draft pnpm test:e2e` — every block `exit=0`; unit 386/386; e2e 91 passed in 1.8m, 0 flaky, retries 0. Docker Postgres :5436, production build, Chromium.

| Criterion | Verdict | Evidence |
|---|---|---|
| With unpublished changes the Draft is first with its last-edited time, a way to the editor, and Publish; with none only Published Versions | PASS | `versions-tab-shows-draft`: after a Step title edit the list is Draft (badge "Unpublished changes", `<time datetime>` equal to the `draft` row's `updated_at`) then "Version 1 · Live"; "Open editor" lands on the Editor tab at the plain address; Publish from the row leaves two version rows, Version 2 live, no Draft row; right after publishing, one row and no Draft; `test-results/versions-tab-shows-draft/versions-tab-shows-draft.png` (viewed) |
| Never-published Journey shows the Draft row and "Not published yet." | PASS | same spec, first section: one list item (the Draft) and the paragraph beneath it |
| `pnpm test:e2e` once in full at the end | PASS locally (91/91, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR checks |

**AI review (one pass, standards and spec axes, `origin/staging...HEAD`).** No correctness bugs. Fixed: stale header in `src/lib/tabs.ts`, README's Versions line, `Draft` type renamed `StoredDraft`, Suspense caveat on `UrlTabs`. Accepted: the five `getDraftForMember` callers repeat `stored.document`; `readTab` keeps its `string[]` input; `VersionList`'s `<ul>` guard is unreachable from the page's invariant but honest on its own props. Flagged for Paul: "Last edited" is the `draft` row's `updated_at`, which a title- or description-only change does not bump, so that Draft row can carry a time earlier than the live version's; two buttons on the Versions tab are named "Publish".

**Deviations.** (1) "Open editor" links to the plain address rather than `?tab=editor`: `withTab` never writes the default tab, and `readTab` reads both. (2) The tab switch is the address, not an `initialTab` prop: `useState(initialTab)` could not follow a link whose server-rendered tab equalled the first render's, so `UrlTabs` reads `useSearchParams`, and the Project page dropped its unused `readTab` call. (3) The Step title edit in the spec is written into the `draft` row, as the sibling specs do, rather than typed in the editor. (4) `pnpm build` ran on its own once before the spec run; the chain's `pnpm test:e2e` builds again.

**Next in Paul's order:** 37 (sweep 1), then 38 → 39 → 40 → 43.

### [CLOSEOUT] amendment 2026-09-23 — Claude Fable 5.1, after Paul's PR review

Paul (PR #46 review): "Ideally last edited would include the title, but I'll let you decide if the complexity is worth the gain." Done in 15b0088: `JourneySummary` exposes the Journey row's `updatedAt` (moved by a title or description edit, a Theme change, a publish, or an unpublish), and the page hands the row the later of the Draft's save and the Journey's write while the title or description is what is pending — so a publish or a Theme change never masquerades as an edit. `versions-tab-shows-draft` gained a final section: a description edit alone brings the Draft row back, and its `<time datetime>` equals the `journey` row's `updated_at`, later than the `draft` row's.

**A failed run, recorded.** The first rerun of the chain over the amended tree was `FAIL`: `prompts-participant-answers-and-author-reads` read the queue Step's Response as the earlier answer after a Back and a retype (90 passed, 1 failed, 3.3m; the machine carried two other sessions' suites and builds at once, load average 23 to 146, every test at two to four times its usual duration). Cause, from the trace and `react-dom-client`'s textarea init: React's hydration of a `<textarea>` with a non-empty default sets its value back to that default, so text typed before the bundle ran is discarded and the form submitted the old answer. Fixed at the cause in the spec (15b0088): before typing into a box that already shows an answer, wait for the bare step address, which `RunHistory` writes in its first effect after stripping `?at` or `?notice`. Boxes with an empty default are unaffected. The same reset can hit a real Participant on a slow connection; queued for Paul as a separate task rather than widened here.

**Verified run command (final tree, head 15b0088):** the same chain — every block `exit=0`; unit 386/386; e2e 91 passed in 2.3m, 0 flaky, retries 0 (`test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`, screenshot re-captured). AC 1 evidence now also covers the title/description case.
