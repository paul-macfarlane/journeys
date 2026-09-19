# 09: Canvas

Status: ready-for-agent
Blocked by: 04, 08
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** The editor's map: React Flow (`@xyflow/react`, MIT) with `@dagrejs/dagre` auto-layout renders every Step as a node and every Choice as an edge; the Start is distinct; Endings are distinct and colored by Outcome; clicking a node opens the side panel from ticket 08; a new Step can be added from the canvas; validation problems are highlighted on the affected nodes/edges; the graph stays navigable at 60 steps with pan, zoom, and fit-to-view. No manual positions are stored; layout is recomputed on change.

- [ ] Seeded case-3 renders fully laid out with no overlapping nodes; after fit-to-view every node is inside the viewport.
- [ ] Clicking a node opens that Step in the panel; adding a Choice in the panel adds the edge live.
- [ ] Validation problems mark the exact nodes/edges; fixing one clears its mark.
- [ ] Add Step from the canvas creates a node and opens it in the panel.
- [ ] Seam B: build a branch via canvas + panel, verify the edge count, publish. Screenshot evidence of the case-3 map under `test-results/`.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
