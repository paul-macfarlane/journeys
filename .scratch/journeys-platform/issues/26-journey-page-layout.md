# 26: Journey page layout

Status: done
Blocked by: 25
Owner: Claude Fable 5.1
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → **26** → 27 → 10 → 28 → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: polish

**Why:** On staging the Publish button sits below the header in "a weird location", the title and description need a separate Edit dialog for two fields, there is no way to copy the link a Participant needs, and a Validate button duplicates what the map and the Publish dialog already show. Items 5, 6, 9, and 23 of Paul's 2026-09-21 notes. Ticket 28 gives the Project page tabs; this ticket gives the Journey page the same shape so the two read as one app.

**Decisions (Paul, 2026-09-21):** Publish belongs in the header with Preview and Delete. Title and description are plain fields at the top, no Edit dialog. A copy-to-clipboard share link is wanted now. The standalone Validate button goes: live validation on the map plus the problems list on Publish are enough.

**What to build:**

- **Inline title and description.** The header's `<h1>` becomes a borderless text input holding the title and the description becomes a borderless textarea beneath it (placeholder "Add a description"), both styled to read as headings until focused. Each saves on blur and on Enter (title only) through the existing update action `edit-journey-dialog.tsx` calls; a save that fails shows the error inline and keeps the text. `EditJourneyDialog` and its "Edit" button are removed. A one-line hint under the description: "Participants see the title and description from the last published version."
- **Header actions.** Right side of the header, in this order: Preview, Publish, Delete. Publish is the same button and dialog `publish-controls.tsx` renders today (problems list, confirmation), moved into the header. The status badge stays under the title; the "unpublished changes" notice and Unpublish move beside it as a compact line. `PublishControls` no longer renders a block between the header and the editor.
- **Share link.** When a Published Version is live, a "Copy link" button (link icon, `aria-label="Copy participant link"`) sits beside the status badge. It writes `${window.location.origin}/j/${journeyId}` to the clipboard and reads "Copied" for two seconds; the URL is also shown as plain text in a `title` so it can be selected by hand. Nothing is shown while no version is live.
- **No Validate button.** Remove the button, `validateError`, and the server round-trip in `draft-editor.tsx`. The header problem count ("Live problems") and the Publish dialog remain the two ways to read problems; the count keeps opening the "All problems" list.
- **Tabs.** Below the header: shadcn `Tabs` with "Editor" (the `DraftEditor`) and "Versions" (the `VersionList`), selected tab in the URL as `?tab=versions` so a reload or a shared link keeps it; default "Editor". Same component and placement ticket 28 uses on the Project page.
- **Specs.** `journey-edit-and-delete` becomes inline edits (type in the title field, blur, reload, read it back); `publish-*` specs find Publish in the header; `step-editing-*` and `canvas-*` specs that clicked Validate use the header count instead; a new `journey-share-link` spec publishes, copies (grant `clipboard-read`/`clipboard-write` in the Playwright context), and reads the clipboard back.

Acceptance criteria:

- [ ] Editing the title inline and blurring saves it; a reload shows the new title; the Project page's Journey list shows it too. Same for the description.
- [ ] Preview, Publish, and Delete are the only buttons in the header, in that order; publishing from the header succeeds and refuses with the problems list exactly as before.
- [ ] After a publish, "Copy link" is present, copies `/j/<journeyId>` on the current origin, and reads "Copied"; before any publish it is absent.
- [ ] No Validate button exists; the header problem count still opens the list of problems.
- [ ] The Versions tab lists versions and restore works from it; `?tab=versions` survives a reload.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 5, 6, 9, 10, 23.

## Comments

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/30 (base `staging`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** `da7d5ff` feature (inline title and description, header actions, refusal dialog, share link, no Validate, tabs, specs, map helpers). `12d0e89` review fixes (unmount save through `save()`, three cleanups). Closeout — this commit. All by Claude Fable 5.1 in the direct checkout; no worktrees.

**Verified run command:** `pnpm lint; pnpm typecheck; pnpm test; pnpm test:e2e` — every block exit 0; unit 249/249; e2e 70 passed in 1.0m, 0 flaky, retries 0. Docker Postgres :5436, `next start` :3100, Chromium. Capture: `test-results/dod-1-commands.txt`. An earlier full run of the chain failed `canvas-problems-readable` on an un-settled box click (FAIL, noted in the capture's header); fixed at cause with `clickBox`, then the cited run. After the review fixes (`12d0e89`) the app was rebuilt and `publish`, `projects-and-journeys`, `members`, and `step-editing` reran: 23 passed; the CI run on the PR is the whole-suite proof over the final head.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 title and description edit inline, save on blur, survive a reload, show in the Project's list | PASS | `journey-edit-and-delete`: title typed and Enter, description typed and blurred, row polled, reload reads both back, Project list shows both; `test-results/journey-edit-and-delete/journey-edit-and-delete.png` |
| AC-2 Preview, Publish, Delete are the header's action buttons in that order; publish from the header succeeds and refuses with the problems list | PASS | `page.tsx` header order; `publish-invalid-draft` reads the refusal dialog's "Publishing problems" list (two problems), `publish-untagged-ending` and `publish-draft-with-loop` publish from it; `test-results/publish-invalid-draft/publish-invalid-draft.png` (viewed). Copy link and Unpublish also sit in the header, under the title, as the build bullets place them |
| AC-3 "Copy link" absent before a publish, present after, copies `/j/<journeyId>` on the origin, reads "Copied" | PASS | `journey-share-link`: count 0 before, `title` is the URL, clipboard read back equals it, text "Copied" then "Copy link", gone after Unpublish; `test-results/journey-share-link/journey-share-link.png` (viewed) |
| AC-4 no Validate button; the header count still opens the problems list | PASS | no `"Validate"` in `src`; `validateDraftAction` and `validateDraft` removed; `step-editing-delete-and-validate` clicks "1 problem" and reads "All problems"; `canvas-problems-readable` |
| AC-5 Versions tab lists versions, restore works from it, `?tab=versions` survives a reload | PASS | `publish-versions-and-restore`: `openTab`, URL `?tab=versions`, reload keeps the tab selected, Restore from the tab; `test-results/publish-versions-and-restore/publish-versions-and-restore.png` |
| AC-6 full `pnpm test:e2e` once at the end | PASS | `dod-1-commands.txt`: 70 passed, 0 flaky |

**Evidence committed:** `test-results/dod-1-commands.txt` and the screenshot/video directories of the specs this ticket names or changes: `journey-edit-and-delete`, `author-flow`, `journey-share-link`, `publish-invalid-draft`, `publish-untagged-ending`, `publish-draft-with-loop`, `publish-versions-and-restore`, `step-editing-build-and-publish`, `step-editing-delete-and-validate`, `canvas-build-branch-and-publish`, `canvas-build-by-dragging-and-walk`, `canvas-build-by-dropping-and-walk`, `canvas-build-left-to-right-and-walk`, `canvas-problems-readable`, `canvas-step-actions`. The full run rewrote the other specs' screenshots; the agent git-policy hook denies `git checkout -- <pathspec>`, so they are left unstaged for Paul to restore with `git checkout -- test-results` from his terminal, as in PRs #28 and #29.

**Deviations.** (1) The ticket calls the refusal "the Publish dialog"; on `staging` it was an inline alert block. It is now an `AlertDialog` (title, problems list, Close), the reading that keeps nothing between the header and the editor. (2) The Draft editor unmounts when the Versions tab is open, so it now saves on unmount through its own `save()` (not in the ticket; a consequence of the tabs). (3) `VersionList` drops its `<h2>` because the tab is its heading. (4) The taller header moved the map's low boxes below the 720px test viewport's fold: `fitWholeMap` now puts the frame in view, every settle does, and the 16 direct box clicks go through `clickBox`, which settles first. Fixes at cause; no retries, timeouts, skips. (5) `step-editing-delete-and-validate` waits for "Saved" before reading the row, which the removed Validate click used to do implicitly. (6) Judgement call kept: a one-field blur sends both fields to the existing update action (the action's contract), so another Member's rename made between two refreshes can be overwritten by the Author's description blur, last write wins as before. (7) `pnpm build` ran inside `pnpm test:e2e`; no schema change, so no migrate. (8) The shadcn CLI added a stray `cn` package while generating `tabs.tsx`; reverted, the lockfile is untouched.

**Human gate announced for later.** Post-merge staging smoke: open a Journey, type a new title and press Enter, reload and read it back; publish, click "Copy link", paste the address in a private window and walk the Journey; open the Versions tab, reload, confirm it stays open.

**AI code review (one Standards reviewer, one Spec reviewer, both general-purpose agents reading `git diff staging...HEAD` at `da7d5ff`).** The one correctness bug is fixed in `12d0e89`; judgement calls are recorded and left.

*Standards reviewer:*

> **Evidence scope (hard, not yet in the diff but imminent).** Commit only the screenshot directories of the specs the ticket names; the working tree has ~70 modified `test-results/*` dirs. — **Honoured in this commit** (list above).
>
> **Flaky-tests rule.** `mapInView`/`clickBox` and the DB poll in `editJourneyField` are fixes at cause, not widened timeouts or retries. Compliant. **CONTEXT.md vocabulary** consistent. **`src/lib` purity**: `tabs.ts` pure and unit-tested.
>
> **Correctness 1 (real bug).** `draft-editor.tsx` unmount save calls `saveDraftAction` directly, never updating `lastSavedRef` or calling `router.refresh()`. Edit a Step, within 600 ms click Versions, click Editor: the editor remounts from the page's stale `draft` prop, the edit disappears on screen, Publish stays disabled, and the next edit writes old-document-plus-new-edit over the unmount save. — **Fixed in 12d0e89**: the cleanup calls `save()`, which queues behind a running save and ends with the refresh that hands the next mount the saved document.
>
> **Correctness 2 (judgement).** `journey-title-fields.tsx` sends both fields on a one-field blur; Member B's rename can be reverted by Author A's description blur without an intervening refresh. Spec says last write wins; the old dialog behaved the same. — **Left; recorded as deviation (6).**
>
> **3.** `url-tabs.tsx` `history.replaceState(null, …)` is safe with Next's patched router. **4.** `editJourneyField` DB poll then UI assertions: sound.
>
> **Baseline smells (judgement calls).** Misplaced doc comment in `copy-link-button.tsx` — **fixed**. SQL column interpolation in `authoring.ts` — **column map added**. Speculative generality in `url-tabs.tsx`/`lib/tabs.ts` for one consumer — left; ticket 28 is the second. Divergent change: `authoring.ts` header vs its database read — **header updated**. Duplicated `useRouter`/`useTransition`/refresh shape in `PublishButton`/`UnpublishButton` — left, small.

*Spec reviewer:*

> **(a) Missing/partial.** Evidence not yet committed — **this commit**. `UrlTabs` used only by the Journey page — fine as shared; `useState(initialTab)` + `replaceState` never re-syncs on back/forward — no history entry is pushed, so there is no back/forward between tabs; a navigation back to the page re-reads `?tab=` on the server. Stale comment in `journey-canvas.tsx:98` naming the Validate button — **fixed in 12d0e89**.
>
> **(b) Not asked for.** The unmount save (necessary consequence of mounting only the open tab), `version-list.tsx` heading drop, `src/lib/tabs.ts` + tests — supporting, fine.
>
> **(c) Implemented, checked concretely — all correct.** Title blur and Enter, description blur, inline error keeping the text; Edit dialog and button gone; header order; status line; no `PublishControls` block; copy link label, URL, two-second "Copied", `title`, live-only; Validate removed everywhere; count opens "All problems"; tabs with `readTab`/`withTab`. AC-2's "only buttons in the header" is literally false since Copy link and Unpublish are in `<header>`, but the build bullets put them there. The refusal as an `AlertDialog` is the faithful reading of "the Publish dialog".
>
> **e2e beyond the named specs.** `canvas.spec.ts` `mapInView`/`clickBox`: necessary (taller header, 720px fold). `members.spec.ts`, `author-flow`: used the removed Edit button. `expectSaved` before `readDraft`: necessary. `publish.spec.ts` waits and `openTab`: necessary. `journey-share-link` also proves Unpublish removes the link: small extra within "Nothing is shown while no version is live".

**Addendum 2026-09-22 (Paul's PR review).** Paul asked why the inline title and description did not use react-hook-form like the dialogs do. The repo's split is: submit-once dialogs use react-hook-form + zod; the editor's autosaving fields (Step title, Choice labels, Outcome rename) are plain inputs writing into the document. The inline fields had followed the editor pattern, but react-hook-form fits them better: `reset(values, { keepDirtyValues: true })` is the adopt-another-Member's-edit-into-untouched-fields rule, and `setError` is the inline server error, so the hand-rolled refs and save queue went. Each field's blur submits the whole record through `handleSubmit`; a blur while the other field is invalid shows that field's error and saves nothing. Rebuilt and reran `projects-and-journeys`, `members`, `publish` (16 passed); CI runs the whole suite.

**Addendum 2026-09-22 (CI flake on PR #30).** `canvas-step-actions` failed on CI (run on `fa05f8a`, passed on `12d0e89`) with a three-minute "element is outside of the viewport" loop on a box click. Cause, measured with a probe: after the test zooms in with the view on the Start, the middle box sits partly past the frame's bottom edge; Playwright's scroll-into-view briefly scrolls React Flow's pane and the click lands before React Flow scrolls it back locally, while on the CI runner React Flow wins that race every time. `clickBox` now first polls `nodeViews(...).clickable` (the box's middle hits the box) with a ten-second timeout and a message naming the box, which turned the same latent race in `canvas-validation-marks` and `canvas-problems-readable` into immediate, named failures; all three tests now ask for the whole map (`fitWholeMap`) after the move that pushed the box out. Canvas spec file: 30 passed locally. No retries, timeouts, or skips.
