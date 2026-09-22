# 25: Canvas polish — feedback round 2

Status: in-progress
Blocked by: 24
Owner: Claude (Fable 5.1), 2026-09-22
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → **25** → 26 → 27 → 10 → 28 → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: polish

**Why:** Paul regression-tested staging after PR #26 and found five things on the map that read wrong or get in the way: Choice order on the map is the reverse of the panel, the fixed controls and the box toolbar layer over each other, the minimap earns nothing, the Start Step offers a delete it then refuses, and long Choice labels do not fit their arrows in left-to-right. Items 1, 3, 4, 12, and 22 of his 2026-09-21 notes.

**Decisions (Paul, 2026-09-21):** manual layout (ticket 17) is deferred past the hackathon — "it could introduce more complexity than worth it" — so nothing here prepares for stored positions. The minimap goes. The fixed controls "should ideally always be there, but never conflict or be layered on top of" the toolbar.

**What to build:**

- **Choice order on the map follows the panel.** The boxes a Step's Choices lead to sit in Choice order along the cross axis: in `"TB"` the first Choice's target is leftmost, in `"LR"` it is topmost. dagre's ordering phase does not promise this, so add a post-pass in `src/lib/graph/layout.ts`: for every Step whose targets share a rank, reassign those targets' cross-axis coordinates among themselves in Choice order (a target reached by several Steps keeps whichever assignment the earliest Step in map order gives it). `sourceAnchors` already orders by target position, so the anchors follow. Unit-test the pass on a three-way branch in both directions and on case-3.
- **The fixed controls own a row.** Move the `Panel position="top-left"` contents (direction toggle, Find step, Add step, Hide/Show panel, and whatever else lives there today) out of the React Flow pane into a toolbar row rendered above the map, in normal flow, so no `NodeToolbar` or edge can layer over or under it. The map's height shrinks by that row; the fit-on-first-render still fits. Keep the React Flow `Controls` (zoom) where they are.
- **No minimap.** Remove `<MiniMap>` and its import.
- **The Start Step never offers Delete.** Hide "Delete step" in the box toolbar and the panel footer when the Step is the Start; `delete-step-dialog.tsx` loses its "Make another step the start first" branch. The guard in `src/lib/graph/edit.ts` stays as the last line of defence (its unit test stays).
- **Long labels fit their arrows.** In `"LR"` widen the rank separation so a label of reasonable length sits between boxes, and truncate the label drawn on the arrow at a fixed width with an ellipsis; the full label is the arrow's accessible name (`aria-label`) and its `<title>`, and the panel row shows the whole text as it does today. Apply the same truncation in `"TB"` for consistency. Pick the width from case-3's longest Choice.
- **Specs.** `canvas-layout-direction`, `canvas-add-next-step-left-to-right`, and any spec that reads the minimap, the top-left panel, or "Make another step the start first" follow. Add one assertion to a left-to-right spec that the first Choice's target box is above the second's, and one to a top-down spec that it is to the left.

Acceptance criteria:

- [ ] On a Step with three Choices, the target boxes read in Choice order: left to right in `"TB"`, top to bottom in `"LR"`; the layout unit tests cover both and case-3 still lays out without a dagre throw.
- [ ] With a box selected near the top of the map, its "Step actions" toolbar and the fixed controls never overlap at the default viewport; the fixed controls remain visible when the map is scrolled or zoomed.
- [ ] No minimap is on the map.
- [ ] The Start Step's toolbar and panel footer show no "Delete step"; another Step's still do.
- [ ] On case-3 in `"LR"`, every arrow label is drawn within the gap between its boxes, and the longest Choice's full text is readable from the arrow's accessible name and in the panel.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 1, 2, 3, 4, 12, 22.

## Comments
