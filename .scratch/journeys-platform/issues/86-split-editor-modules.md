# 86: Split the canvas, the Draft editor, and the layout module

Status: ready-for-agent
Blocked by: 81
Owner:
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
