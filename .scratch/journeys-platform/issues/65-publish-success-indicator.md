# 65: A clear acknowledgement when a Journey is published

Status: done
Blocked by: 56
Owner: Claude (Fable 5.1), 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (Paul, 2026-09-24, after 56's pass): "I'd like a more clear indicator of publish success when publishing a journey. Right now it's not clear."
Route: polish

**Why:** publishing is the moment an Author hands a Journey to Participants, and the page barely reacts. Paul, 2026-09-24: "Right now its not clear."

**What is true today:** `PublishButton` (`src/components/journeys/publish-controls.tsx`) publishes on one click, no confirm. On success the only changes are indirect: the button disables (`!hasUnpublishedChanges`), the status badge flips from "Never published" or "Unpublished changes" to "Published", and "Copy link" and "Unpublish" appear in the header. The one `role="status"` line the button owns shows only the ticket-43 warning (a deciding Prompt with no gateway key). Nothing says "you just published", nothing names the new Version, and nothing offers the link at the moment the Author wants it. The Versions tab does mark the new row "Live". 56 saw exactly this: after Publish the pane showed "Published · Copy link · Unpublish" and a greyed button, and the walk had to read the Versions tab to be sure.

**What to do:**

1. On a successful publish, render one visible acknowledgement beside the header controls, in the same `role="status"` line the warning uses: "Published Version N — participants see it now." with the Copy link control inline (reuse the existing copy button). `N` is the `versionNumber` that `publishJourneyAction` already returns on success (`src/app/projects/[projectId]/journeys/actions.ts`); the button currently discards it. When the ticket-43 warning also applies, show both sentences in that line.
2. The line stays until the Draft changes again (when the badge turns to "Unpublished changes") or the page is left; it is not a toast and needs no library.
3. Give the "Published" badge a short entrance (the `animate-in fade-in` already used on the splash, `motion-reduce:animate-none`) so the change registers; nothing that moves the layout.
4. Same treatment for the `sm` button on the Versions tab's Draft row.
5. Copy in `CONTEXT.md` vocabulary: Published Version, Participants.

Acceptance criteria:

- [ ] The `publish` spec asserts the status line "Published Version 1 — participants see it now." after the first publish and "Published Version 2 …" after the second, that the copy control inside it copies the participant link, and that the line disappears after a Draft edit; screenshots `publish-acknowledged-{light,dark}.png`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.

Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, on ticket 56's PR; recorded in 56's `[FINDINGS]`.

## Comments

### 2026-09-24 — [CLOSEOUT] Claude (Fable 5.1), `/implement` from a worktree

- **PR:** https://github.com/paul-macfarlane/journeys/pull/73 (`feat/65-publish-acknowledgement` → `staging`). Branched from `chore/56-regression-pass` at `88ab95a` because this ticket file exists only there; until PR #70 merges the PR also carries 56's docs commits. Worktree `.claude/worktrees/65/journeys`, `E2E_PORT=3165`, `E2E_DATABASE_NAME=journeys_e2e_65`, dummy env exported from a scratch script.
- **Delivered:** `src/components/journeys/publish-controls.tsx` — `PublishScope` (holds the acknowledgement of the last publish for both Publish buttons; clears it when `hasUnpublishedChanges` turns true, adjusted during render so a publish's own re-render can land in either order), `PublishAcknowledgement` (the header's `role="status"` line: "Published Version N — participants see it now.", the ticket-43 warning when it applies, and `CopyLinkButton` inline), `PublishButton` acknowledging through the scope instead of keeping the warning itself (the Versions tab's Draft row unmounts on success, which used to lose that warning). `journey-status-badge.tsx` is a client component whose `entrance` plays `animate-in fade-in duration-500 motion-reduce:animate-none` only when the state differs from the one it mounted with. `ui/badge.tsx` takes a `className`. The Journey page wraps its main in `PublishScope`, renders the line beneath the header controls (the cluster wraps), and asks the badge for its entrance. `e2e/publish.spec.ts` gains `publish-acknowledged`; `journey-share-link` picks the badge row's copy control over the line's.
- **Commands** (`test-results/dod-1-commands.txt`, tree `c6f68a4`): `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (544), `E2E_EVIDENCE=publish-acknowledged pnpm test:e2e` — 108 passed in 2.1 min, retries 0. All PASS.
- **A first full run was FAIL** (`test-results/dod-1-e2e-run-1-failed.txt`): `metadata-autosave` lost its Project-page "Settings" tab click. The trace shows a full document navigation to the plain Project address about half a second after the Project title's unmount autosave (`project-settings-fields.tsx` calls `router.refresh()` after an action that already revalidated, with the tab switch having rewritten the address by `replaceState`); the click landed on the new document before hydration, while the machine sat at a 15-minute load average of 42 (the document took 1.5 s to stream; the run took 7.4 min against 2.1 for the rerun). Not this ticket's page; filed as a task for its own thread. The rerun, cited above, passed clean.
- **Evidence:** `test-results/publish-acknowledged/publish-acknowledged-light.png`, `publish-acknowledged-dark.png` (the header after Version 1: the line, the copy control, the "Published" badge).
- **Acceptance criteria:** "Published Version 1 …" after the first publish, "Published Version 2 …" after the second, the copy control in the line copies the participant link, the line gone after a Draft edit, both stills — PASS (`publish-acknowledged`; it also proves Version 3 from the Versions tab's Draft row, the line gone on reload, and the badge entrance present after the publish and absent after the reload). Command chain — PASS.
- **AI Code Review** (one reviewer per axis, Standards and Spec, on `47c8475`; findings applied in `c6f68a4`):
  - Standards: no documented-standard violations; lint and typecheck pass; copy names real controls; `evidencePath` throughout; the setState-during-render reset is React's own "storing information from previous renders" recipe and `react-hooks/set-state-in-render` permits the conditional form; a `<button>` inside `<p role="status">` is valid; the two unscoped `main header` status locators in `projects-and-journeys.spec.ts` are on never-published Journeys, so the new line cannot collide. Judgement calls, all applied: `wasUnpublished` read like the `unpublished` state (now `sawUnpublishedChanges`); the two-buttons rationale was in two places (now one, the page points at `PublishScope`); the copy control's `aria-live` span sits inside the status (noted in the component); the `journey-share-link` locator comment was garbled (rewritten); `toHaveClass(/animate-in/)` couples the spec to a utility class (kept: a still cannot prove motion).
  - Spec: nothing missing. Item 4 ("same treatment for the `sm` button") cannot be literal because the Draft row unmounts on success; routing its acknowledgement to the header line meets the intent and is proven (Version 3). Not asked for and fixed: the entrance played on every load of an already-published Journey (now only on a change under the Author), and the class assertion could not tell a load from a flip (now asserted after the publish and denied after the reload). Flagged, not changed: item 5 wants `CONTEXT.md`'s "Participants" while item 1 and the AC fix the literal "participants see it now."; the literal copy won, matching "Copy participant link". Persistence traced: publish and re-render in either order, edit then exact revert (stays cleared), unpublish, restore, concurrent Members, tab switches (`replaceState`, no remount) all behave; one edge — a publish clicked while an autosave is still in flight is never acknowledged, because the re-render carries "Unpublished changes" and the line yields to it by the ticket's own rule.
- **Deviations:** none from the ticket. The Draft-edit criterion is proven with a description edit, the same `revalidateJourneyPaths` path a Step edit takes.
- **Left for Paul:** merge #70 then #73; the vocabulary call above; the Project-page reload task; the worktree branch and `.claude/worktrees/65/` can go once merged.
