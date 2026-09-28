# 86: Split the canvas, the Draft editor, and the layout module

Status: done
Blocked by: 81
Owner: Claude (Fable 5.1), chunk 7 orchestrator, 2026-09-27
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish (behaviour-preserving; no schema, auth, or route change)

**Why:** ticket 72, findings S1–S4. Three modules hold most of the editor, and each mixes jobs that change for different reasons:

- `src/components/journeys/journey-canvas.tsx` (1739 lines):
  - `CanvasFlow` alone runs about 800 lines (L837-1639).
  - `StepNode` is L410-677.
  - `JourneyCanvasProps` (L756-788) has 27 props, 17 of them callbacks, so the interface is nearly as wide as the implementation. That makes it a shallow module.
- `src/components/journeys/draft-editor.tsx` (1078 lines). After 81 removes the save loop, it still holds:
  - the adopt rule;
  - undo/redo (L624-660);
  - panel visibility and its browser preference (L459-580);
  - about ten edit wrappers (L708-855);
  - problem derivation (L857-905).
- `src/lib/graph/layout.ts` (894 lines):
  - `layoutGraph` is one function of about 275 lines (L578-853).
  - The file also exports `problemsByAddress` (L870), which is about publish problems, not layout.
  - The `"<stepId>:<choiceId>"` key is built in `layout.ts` (~L599, L887) and taken apart by prefix-stripping in `draft-editor.tsx:895-905`.
  - `problemsByAddress` runs twice on the same data (`draft-editor.tsx:868`, `journey-canvas.tsx:860`).
- `src/components/journeys/canvas-shared.ts` holds pure geometry (`smoothPath`, `midwayAlong`, `selfLoopRoute`, `arrowPoints`, `labelPoint`) beside a React hook. The geometry has no unit tests.

**What to build:**

- **Canvas:**
  - `step-node.tsx` (`StepNode`, `MissingNode`) and `choice-line.tsx` (the component keeps React Flow's `ChoiceEdge` name, because "edge" is React Flow's term, not the domain's).
  - A `useCanvasViewport` hook (fit, zoom, `bringOntoMap`, view requests) and a `useCanvasKeyboard` hook (focus movement, escape, box keys).
  - Replace the per-Step `on*` callbacks with one `onEdit(command)`, where `command` is a discriminated union of the edits in `src/lib/graph/edit.ts`. The canvas interface shrinks to the document, the layout, the selection, and that one handler.
- **Draft editor:** a `useDraftDocument` hook (document, history, `applyEdit`, undo, redo, adopt) and a `usePanelVisibility` hook. What stays in `DraftEditor` is composition.
- **Layout:**
  - Split `layout.ts` into the dagre input, edge routing (with `followMovedBoxes`), and label placement. `layoutGraph` stays the orchestrator and its interface is unchanged.
  - Move publish-problem indexing into `validate.ts`, behind `problemsForStep(stepId)` and `problemsForChoice(stepId, choiceId)`, so no caller sees the key encoding. Compute it once and pass the result down.
- **Geometry:** move the pure functions from `canvas-shared.ts` to `src/lib/graph/geometry.ts`, with unit tests (self-loop route, arrow points, label point).

Acceptance criteria:

- [ ] No file under `src/components/journeys` is over 700 lines, and `JourneyCanvasProps` has at most 8 members. A number above that is fine if the closeout says why.
- [ ] `geometry.test.ts` exists. `layout.test.ts` and `validate.test.ts` pass unchanged apart from import paths.
- [ ] The canvas, Draft, undo/redo, and step-editing specs pass unchanged, plus one full `pnpm test:e2e`.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 72.

## Comments

### 2026-09-27 — Claude, chunk 7 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/113 (chunk 7, with ticket 53).

- **Workers** (one worktree `chunk-7-editor-split-and-phone-sheet/journeys`, sequential, because both deliverables edit `journey-canvas.tsx`, `draft-editor.tsx` and `canvas-shared.ts`; confirmed at closeout, D2 rewrote all three after D1's edits):
  - **D1** (Sonnet, 98515f7):
    - `layout.ts` split into the orchestrator plus `layout-dagre.ts`, `layout-routing.ts`, `layout-labels.ts` and `layout-constants.ts`.
    - Geometry moved to `src/lib/graph/geometry.ts`, with `geometry.test.ts`.
    - `indexProblems` added to `validate.ts`, computed once in `DraftEditor`.
  - **D2** (Opus, 18c1be7):
    - Canvas split into `step-node.tsx`, `choice-line.tsx`, `canvas-elements.ts`, `use-canvas-viewport.ts` and `use-canvas-keyboard.ts`.
    - Editor state moved into the hooks `use-draft-document.ts`, `use-step-selection.ts` and `use-panel-visibility.ts`.
    - The canvas takes `onEdit(EditCommand)` (`runEditCommand` in `edit.ts`) and `onSelect(SelectCommand)`.
  - Review fixes **R-fix** (Opus, 75dd790) and the flake fix **F-flake** (Opus, e7cb526), shared with ticket 53.
- **Deviations:**
  - **AC-2:** the two `problemsByAddress` tests moved from `layout.test.ts` to `validate.test.ts` as `indexProblems` tests, with the same fixtures and expectations. The ticket's own "What to build" hides the key encoding. Paul approved this, 2026-09-27.
  - **AC-3:** two full-page screenshots in `step-editing.spec.ts` became viewport screenshots.
    - A full-page capture in Chromium passes through a 1×1 window. That matches ticket 53's phone query and remounts the panel.
    - Before the fix, 6 of 20 loaded runs failed. After it, 20 of 20 pass, and base passes 20 of 20.
    - No assertion changed.
  - `layout-dagre.ts` is 455 lines. The 700-line cap applies only under `src/components/journeys`.
  - `rich-text-editor.tsx` (703 lines) was already over the cap and was not touched.
- **`[AI CODE REVIEW]`:** one reviewer (Opus) read the whole chunk diff `1b52f52..75dd790^`. I adjudicated the findings.
  - Findings for 86, all non-blocking, all fixed in R-fix:
    - R6: `EditOutcome` gains `refused`, and `handleEdit` no longer repeats `deleteStep`'s Start rule.
    - R7 to R10: four stale comments; one of them leaked the Choice key encoding.
  - The reviewer checked the `handleEdit` follow-ups against the deleted wrappers, the adopt path, the viewport effects, and the moved components (compared with whitespace ignored). All were equivalent.
  - Ticket 53's findings are in its closeout.
  - No open findings.
- **Verdicts** at e7cb526, on local `next start` over Docker Postgres 18. Capture: `test-results/chunk-7-commands.txt`.
  - **AC-1 PASS:**
    - `journey-canvas.tsx` is 694 lines and `draft-editor.tsx` 583. Nothing else under `src/components/journeys` is over 700 lines, apart from the existing `rich-text-editor.tsx`.
    - `JourneyCanvasProps` has 8 members.
  - **AC-2 PASS:**
    - `geometry.test.ts` exists.
    - `layout.test.ts` changes only in its imports and the moved block; `validate.test.ts` gains the `indexProblems` block.
    - 712 unit tests pass.
  - **AC-3 PASS, with the deviation above:** `canvas.spec.ts` and `draft.spec.ts` are unchanged. The full suite gives 146 passed, 0 failed, 0 flaky.
- **Command chain** (`node_modules/.atlas-c7/chain.sh`, run once at the chunk's end): `pnpm lint`, `format:check`, `typecheck`, `test`, `build`, then `E2E_EVIDENCE=canvas-phone-sheet,canvas-tablet-stacked-panel pnpm test:e2e:prebuilt`.
- **Earlier run, recorded as FAIL at 75dd790:** 144 passed and 2 failed (`step-editing-image-caption-alt-and-preview` and `panel-outcomes-from-the-ending`). Both were diagnosed to the 1×1 cause above, from their traces, and neither run was rerun to pass.

### 2026-09-27 — Claude, chunk 7 orchestrator (CI fix)

`[SCOPE CHANGE]`: CI on PR #113 failed `a11y-journey-page`. axe's `document-title` rule fired on the Versions tab. The same failure appears on the `staging` run at 1b52f52, so it predates this chunk.

- **Cause:** found in the CI trace. The tab switch (`UrlTabs`, a `router.replace`) committed the new page with its `<title>`, 22 meta tags and 4 links stripped from the head. They were put back 0.6 s later, and axe read the head in between. Next 16 streams metadata after the page for every user agent it does not list as a bot.
- **Fix:** e27519d sets `htmlLimitedBots: /.*/` in `next.config.ts`, so metadata is resolved before the page. A local probe with 4× CPU throttling and a full-page screenshot before each switch shows the title removed and re-added in the same millisecond on every tab switch.
- **Verified:** the full chain passed at e27519d: 712 unit tests, and 146 e2e passed, 0 failed, 0 flaky (`test-results/chunk-7-commands.txt`).
