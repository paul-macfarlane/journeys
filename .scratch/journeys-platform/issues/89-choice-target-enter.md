# 89: Choice target combobox: Enter retargets on open

Status: in-progress
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
