# 21: Canvas direction and a slidable panel

Status: ready-for-agent
Blocked by: 16, 19
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: between 19 and 17 in the graph tidy-up series (Paul, 2026-09-21): 18 → 16 → 19 → 21 → 17. It must precede 17 because stored positions belong to one direction.

**Scope change:** the graph document gains a Journey-level `layoutDirection` field (`"TB" | "LR"`, default `"TB"`, zod default so every stored document parses). Record a `[SCOPE CHANGE]` on the spec's document contract as part of this ticket. Positions are still never stored here (that is 17).

**Decisions (Paul, 2026-09-21):** the direction is a property of the Journey, not of the Author, so Members share one view and can switch it back and forth freely; it lives in the Draft document and autosaves like every other edit (last write wins). Publishing copies it with the document; nothing reads it at run time. Hiding and showing the panel is a way of reading, not content: it is remembered per browser, never stored on the Journey.

**What to build:**

- **Direction.** `layoutGraph` takes the document's `layoutDirection` as dagre's `rankdir`. In `LR` the boxes' target anchor is on the left and the per-Choice source anchors are spread along the right, ordered by the target box's y (centre) instead of x; the connect dot sits at the bottom-right corner in both; the box toolbar sits above the box in both. `mapOrder` stays top-to-bottom then left-to-right (the reading order of the map as drawn). A two-way control on the canvas beside "Add step" ("Top to bottom" / "Left to right", `role="radiogroup"` or a single toggle button naming the direction it switches to) writes the field through the same edit path as everything else and the map re-lays out; fit-to-all runs on a direction change. When 17 has landed and the Draft holds hand-placed positions, switching direction asks with 17's Auto-arrange confirmation and clears every position, since an arrangement made for one axis is not an arrangement for the other; until 17 lands there is nothing to clear.
- **Slidable panel.** A "Hide panel" button at the top of the Step panel slides it out (the canvas takes the full width and fits view); a "Show panel" button at the canvas's right edge slides it back. Opening a Step from anywhere (a box, an arrow, a problem entry, "Leads here from", "Open", Find step) shows the panel if it is hidden, so the editing gesture never changes; Escape with the canvas focused hides it. The choice is remembered in `localStorage` per browser, defaulting to shown; a hidden panel never blocks autosave or the Delete key.
- **Layout below the canvas.** With 19's step list gone, the Outcomes editor stays beneath the canvas at full width.

Acceptance criteria:

- [ ] Seam A: `layoutGraph` with `layoutDirection: "LR"` places every Choice's target box strictly to the right of its source box (x greater) for a tree document, and with `"TB"` strictly below (y greater); `sourceAnchors` in `LR` are ordered by target y; `mapOrder` is unchanged in shape; a document without the field parses as `"TB"`.
- [ ] Switching the direction on case-3 re-lays the map with no overlaps and every box inside the viewport after the automatic fit; the `draft` row read back holds `layoutDirection: "LR"`; a reload shows left-to-right; switching back restores top-down.
- [ ] Hiding the panel widens the canvas (its frame's width grows) and fits the map; clicking a box shows the panel with that Step; the hidden state survives a reload; Escape hides it again.
- [ ] Every existing canvas spec passes in both directions for the tests that build a branch (parameterise `canvas-add-next-step` and `canvas-connect-and-retarget-by-dragging` over the two directions, or add one left-to-right build test), so dragging to connect works with anchors on the sides.
- [ ] Seam B: build a three-Step branch left-to-right with the panel hidden and shown as needed, publish, walk it in the runner. Screenshots of both directions and a recording under `test-results/`.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's design discussion after ticket 16, 2026-09-21.

## Comments
