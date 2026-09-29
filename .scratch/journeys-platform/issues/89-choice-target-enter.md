# 89: Choice target combobox: Enter retargets on open

Status: done
Blocked by: None
Owner: Claude, chunk 9 orchestrator (2026-09-28)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). The Choice target field in the Step panel opens its list on focus with the first option active, not the current target. Tabbing in and pressing Enter silently retargets the Choice to the first Step. The walk did exactly that to "Wait your turn" (→ "Border post"). It is keyboard-only data loss in the Draft, so the route is `contract` (it changes the graph document an Author did not mean to change).

**What "fixed" means:**

- On open, the active option is the current target, or the list does not open on focus.
- Enter without navigating keeps the target unchanged.
- Step titles can repeat, so the match is on Step id, never on the title.

Acceptance: an e2e test focuses a Choice's target field with the keyboard, presses Enter, and reads the Draft row: the target is unchanged.

## Comments

### 2026-09-28 — Claude, chunk 9 orchestrator

`[EXECUTION PLAN]` Chunk 9 is 88 → 89 → 90 → 91 → 92 (backlog rows 17–21), one branch `feat/chunk-9-accessibility-follow-ups`, one PR to `staging`. The chunk's route is `contract` (this ticket's), so the contract chain, one full `pnpm test:e2e`, and two reviewers run once at the end. The polish tickets write `[CLOSEOUT]` only; the chunk plan lives here.

Two worktrees, because the tickets split into two file sets that never meet:

- **Worktree A** (`journeys-a`, port 3188): **D1** = ticket 88 (Opus), then **D2** = this ticket (Sonnet). Sequential, because both edit `choice-list.tsx` (88 moves focus onto a Choice row; 89 hands the row's target id to the combobox).
- **Worktree B** (`journeys-b`, port 3189, temporary branch `feat/chunk-9-b`, cherry-picked onto the chunk branch): **D3** = 91 (Sonnet), then **D4** = 92 (Sonnet), then **D5** = 90 (Opus). Sequential, because D4 and D5 both append to `e2e/accessibility.spec.ts`. Files predicted disjoint from A: the preview pages and spec, `runner/rich-text.tsx` and its test, `user-menu.tsx`, `segmented-control.tsx`, `dropdown-menu.tsx`, `navbar.spec.ts`, `accessibility.spec.ts`. Re-checked at closeout.

Resolved decisions (each ticket offered options):

- **88:** arrows stay focusable (React Flow's `role=group`, reachable by click and by script) but leave the tab order (`tabIndex: -1` through `domAttributes`, which React Flow spreads after its own `tabIndex`), so the tab order is the Step boxes alone; a focused arrow draws the app's focus ring; Enter or Space on a focused arrow opens the Choice in the Step panel and moves the keyboard onto its label field, never `body`.
- **89:** the list still opens on focus, with the current target as the active option, matched by Step id (`chosenId`), never by title; Enter without navigating closes the list and writes nothing. "Find step" (no value) is unchanged.
- **90:** the Theme row becomes three `menuitemradio` items in a `group`, drawn with the segmented control's own classes, choosing leaves the menu open; the menu's Up/Down walk them as items. Each menu's popup is placed inside the page's banner landmark so it sits inside a landmark.
- **91:** `generateMetadata` on both Preview pages reads `journeyForMember` (the cached read `loadPreview` uses) and calls `notFound()` itself; title `Preview: <Journey title>`, which the root template suffixes.
- **92:** the first rendered heading is `h2` whatever level it was written at, and every later heading renders at most one level below the heading before it; the editor is unchanged.

Verification map: 88 → `canvas-arrow-focus` (canvas.spec, both schemes); 89 → `panel-choice-target-enter` (step-editing.spec, reads the Draft row; capture `ac-1-choice-target-unchanged.txt`); 90 → `a11y-navbar-menus` (accessibility.spec, three menus, both schemes) and the updated `navbar.spec`; 91 → the `preview` test's title assertion; 92 → `rich-text.test.tsx` cases and `a11y-heading-order` (accessibility.spec). DoD → `pnpm lint`, `format:check`, `typecheck`, `test`, `build`, then `E2E_EVIDENCE=canvas-arrow-focus,panel-choice-target-enter,a11y-navbar-menus,preview,a11y-heading-order pnpm test:e2e:prebuilt`, captured to `test-results/chunk-9-commands.txt`. No migration: no schema change. Deployed check: the staging smoke after Paul merges, human.

### 2026-09-28 — Claude, chunk 9 orchestrator (closeout)

`[AI CODE REVIEW]` Two fresh reviewers (Opus) read the whole chunk diff (`9759ff8..38496f8`): one for correctness and spec, one for coding standards. I adjudicated each finding from the hunks it cited. Every fix landed in 566edd1 (one worker, Opus).

- **Correctness and spec** (no blocking findings as reported; I raised C2 to blocking):
  - **C2** (89, **blocking**, my call): typing into the field and clearing it made the first Step active again, so Enter retargeted. Clearing now returns the field to its untouched state.
  - **C3** (89): a Choice whose target Step was gone was retargeted by an untouched Enter. Enter is now a no-op until the Author presses an arrow key or types.
  - **C4** (88): the focus request for the label field was never cleared, so a panel remount stole focus again. It is now cleared once answered, or when the arrow is let go of.
  - **C5** (88): the phone sheet was untested. Added a check at 375×812. It passed without any focus change.
  - **C6** (88): a focused arrow with a problem lost its red. It now keeps it.
  - **C7** (88): the test asserted a visual tab order the app doesn't promise. It now asserts that no arrow is a tab stop and that every Step box is reached.
  - **C8** (88): React Flow's edge description said Enter selects the arrow. It now says Enter opens the Choice in the Step panel.
  - **C10** (88): Space on an arrow is now tested.
  - **C1** (91): an unknown Step or a missing Draft kept the Preview title over the 404. Fixed, and `preview.spec` asserts it.
  - **C9** (90): Left and Right do nothing in the Theme pill. **Approved deviation:** the execution plan chose Up and Down, which walk it as menu items.
  - The reviewer refuted risk (d): no page layer covers a menu portalled into the header.
- **Coding standards** (none blocking as reported; I raised S1 to blocking):
  - **S1** (89, **blocking**, my call): the new spec used the suite's only fixed sleep. It now counts `next-action` POSTs and asserts there are none.
  - **S2**: the capture printed the "before" version as the "after" reading. Fixed.
  - **S4**: comment on why the menu uses Base UI's `RadioItem` directly.
  - **S5**: import order.
  - **S7**: `darkContextFor` moved to `e2e/setup/session.ts`.
  - **S8**: new helper `setProjectDescription`, used by three specs.
  - **S9**: the heading-rule comment corrected, and heading state no longer threaded through lists and quotes.
  - **S3**: two commit subjects run 60 and 61 characters. Recorded only, not rewritten.
  - **S6**: the account menu calls light/dark/system "Theme", which `CONTEXT.md` reserves for the runner's look. It predates this chunk and ticket 90 names it the Theme row, so it is out of scope. It is a question for Paul in the PR.
- **Found by the full run, not by a reviewer:**
  - **E1**: `canvas-dark-controls` still expected the old Theme radio group.
  - **E2**: `step-editing-image-caption-alt-and-preview` still expected the old heading level.
  - Both were stale expectations left by tickets 90 and 92, and both are fixed.
- No open findings.

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/115 (chunk 9, with 88, 90, 91 and 92).

- **Workers:**
  - **D1** 88 (Opus, 4b3691f).
  - **D2** this ticket (Sonnet, 843e5eb): `Combobox` gains `chosenId`, matched by Step id, and choosing it again is a no-op.
  - **D3** 91 (Sonnet).
  - **D4** 92 (Sonnet).
  - **D5** 90 (Opus).
  - **R-fix** (Opus, 566edd1).
- **Isolation, checked against the real diffs:**
  - Worktree A ran D1 then D2. Both edit `choice-list.tsx` (the label-field focus, then `chosenId`), so the sequential order was needed.
  - Worktree B ran D3, D4, D5. D4 and D5 both append to `accessibility.spec.ts`, so that order was needed too.
  - B's commits cherry-picked onto A with no conflict, as predicted.
- **Verdict AC PASS:**
  - `panel-choice-target-enter` passes in the final run.
  - An untouched Enter, and typing then clearing then Enter, leave the Draft row at version 1 with 0 writes.
  - ArrowDown then Enter retargets (version 2).
  - With a missing target Step, an untouched Enter makes no write.
  - Capture: `test-results/ac-1-choice-target-unchanged.txt`. Screenshot: `test-results/panel-choice-target-enter/`.
- **DoD PASS:** the chain passed on 566edd1: lint, format:check, typecheck, unit (715), DB integration (721), build, and e2e 150 passed, 0 failed, 0 flaky (`test-results/chunk-9-commands.txt`).
  - Command: `E2E_EVIDENCE=canvas-arrow-focus,panel-choice-target-enter,a11y-navbar-menus,preview,a11y-heading-order pnpm test:e2e:prebuilt`.
  - Local `next start` over Docker Postgres 18.
  - **FAIL at 38496f8, recorded, not rerun:** 148 passed, 2 failed (E1 and E2 above).
- **Not verified here:**
  - CI on the PR.
  - The staging smoke after Paul merges: a Preview tab title, the account menu, and Enter on an arrow.
- No migration.
