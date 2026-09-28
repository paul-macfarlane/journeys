# 79: Authoring rough edges

Status: done
Blocked by: None
Owner: Claude (Fable 5.1), chunk 6 orchestrator, 2026-09-27
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** small authoring bugs and UX gaps from the regression passes (tickets 64, 66, 68), bundled because each is a few lines and they share the Step panel and Project surfaces.

**What to build:**

1. **Untitled step** (68 finding 3). A new Step's title field is empty, with "Untitled step" as its placeholder, and the map box reads "Untitled step" while the title is empty. This replaces pre-filled text that the Author types after.
2. **Adding a Choice to a new Step** (66 finding 7). Adding a Choice whose target is "New step" from the panel keeps the panel on the source Step, so a second "Add choice" lands where the Author expects. The new Step is selected on the map, and a one-line status offers "Edit <new step>".
3. **Image toolbar overlap** (64 finding 4). The "Edit image / Remove" bubble menu no longer covers the paragraph above the image.
4. **Restore acknowledgement** (68 finding 5). Restoring a Version always shows a one-line confirmation like Publish's, including when the content equals the Draft.
5. **Copy link fallback** (68 finding 6). When the clipboard is refused, show the address in a read-only, selected field beside the button.
6. **Local timestamps** (64 finding 6). Versions show the viewer's local time and zone, not UTC.
7. **Accent default** (64 finding 7). Ticking "Accent color" starts from the chosen preset's accent, not Trail's.
8. **Fit view on a small map** (64 finding 3). Cap `fitView` at a max zoom of about 1.25, so a one-Step map is not drawn at 40 px type.
9. **Copy link names** (64 finding 5). The Author page's Copy link is named "Copy author page link", not "Copy participant link".
10. **Members refusal copy** (64 finding 14). "No account has that email — they need to sign in once first."

Acceptance criteria:

- [x] Each item above has an e2e assertion or a unit test where one is meaningful (1, 2, 4, 5, 7, 9, 10). Items 3, 6, and 8 need one screenshot each in the closeout.
- [x] The existing Step panel, Versions, and settings specs pass.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 64 findings 3–7 and 14; ticket 66 finding 7; ticket 68 findings 3, 5, 6.

## Comments

### 2026-09-27 — Claude, chunk 6 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/112 (chunk 6, with ticket 57).

- **Workers:**
  - D1a (Opus, worktree `journeys-d1a`, f2a0f3b): items 1, 2, 3, 8.
  - D1b (Sonnet, worktree `journeys-d1b`, 216e904): items 4, 5, 6, 7, 9, 10. D1a and D1b ran in parallel.
  - Orchestrator fix 6b272fa: link previews read the preset primaries from the new `PRESET_ACCENTS`, so there is one table and `link-preview.test.ts` guards it against `globals.css`.
  - Review fixes R1 (Opus, b877359), after ticket 57's D2.
- **Deviations:**
  - Item 9 keeps ticket 78's name "Copy link to your Author page". The visible "Copy link" must be in the accessible name (WCAG 2.5.3), and it already no longer says "participant". It is now asserted in `author-page.spec.ts`. Open for Paul to overrule.
  - Item 6 formats with two `Intl.DateTimeFormat` calls, because `dateStyle`/`timeStyle` cannot combine with `timeZoneName`.
- **`[AI CODE REVIEW]`:** one reviewer (Opus) read the whole chunk diff `3bdd384..98bc156`.
  - Axis 1, technical and spec conformity. Blocking:
    - F1: item 1's empty stored title reached the participant runner as an empty `h1`.
    - Fixed: `StepView` renders `stepName`, and `runner-untitled-step-heading` asserts the heading plus no axe `empty-heading` violation.
  - Axis 1, non-blocking, all fixed in R1:
    - F2: the restore line could outlive the first edit, depending on render order. The acknowledgement now clears by Draft version, the publish and restore actions return `draftVersion`, and `restore-acknowledged` proves an edit clears it.
    - F3: a second `role="status"` in the Editor tabpanel. The autosave status is named "Draft save status" and `expectSaved`/`draftStatus` are scoped to that name. The Added line is always mounted and re-announces.
    - F5: the placeholder test showed no placeholder. It now clears the label and scrolls to the top.
    - F6: `local-timestamps` pins the `en-US` locale.
    - F7: screenshots predated HEAD. All were recaptured in the final chain.
    - F8: the Added line survived undo, redo, and adopt. It is lifted into `DraftEditor` and cleared with `mapOnlyStepId`.
    - F9: the comment was reworded.
    - F10: the fallback field focuses and selects on every refused click, with a screen-reader hint.
  - Axis 2, coding standards: stale and overlong comments were fixed (S1). Tracker state is brought current in this commit (S2).
  - Also fixed in R1: 57's placeholder, F4 (see 57's closeout).
  - No open findings.
- **Verified** at b877359 on local `next start` over Docker Postgres 18. `test-results/chunk-6-commands.txt` was captured by the orchestrator and sanitized (repository path and dotenv lines).
- **Verdicts:**
  - AC-1 PASS:
    - Item 1: `step-editing` and `canvas` assertions, plus `runner-untitled-step-heading`.
    - Item 2: `step-editing-add-choice-stays-on-step`, including `expectSaved` while the line shows and undo clearing it.
    - Item 3 screenshot: `step-editing-image-tools-clear-of-text`, which also asserts no overlap.
    - Item 4: `restore-acknowledged`.
    - Item 5: `copy-link-fallback`.
    - Item 6 screenshot: `local-timestamps`.
    - Item 7: `themes.spec`.
    - Item 8 screenshot: `canvas-fit-view-capped`, which asserts zoom ≤ 1.25.
    - Item 9: `author-page.spec`.
    - Item 10: `members.spec`.
  - AC-2 PASS: full suite 144 passed, 0 flaky (`test-results/chunk-6-commands.txt`).
- **Command chain:**
  1. `eslint --ignore-pattern '.claude/**'`
  2. `format:check`
  3. `typecheck`
  4. `db:migrate`
  5. `DB_INTEGRATION_URL=… pnpm test` (687)
  6. `build`
  7. `E2E_EVIDENCE=<the chunk's eleven names> pnpm test:e2e:prebuilt`
- **Run surface:** local. The deployed check is Paul's staging smoke after merge. There is no migration and no new variable.
- **Parallel-run check:** D1a and D1b were predicted disjoint. They merged with no conflict and share no file. D2 was held back for sharing `choice-list.tsx`, `draft-editor.tsx`, `rich-text-editor.tsx`, `step-panel.tsx`, and `step-editing.spec.ts` with D1a. Its real diff touches all five, so the sequencing prediction held.
