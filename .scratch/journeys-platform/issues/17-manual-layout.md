# 17: Manual layout

Status: ready-for-agent
Blocked by: 16, 21
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: last of the graph tidy-up series (18 → 16 → 19 → 21 → 17).

**Scope change:** the spec lists "manual canvas layout" as out of scope and ADR-0001 says the canvas lays itself out. Paul decided on 2026-09-21 to support dragging boxes. Record a `[SCOPE CHANGE]` on the spec and an amendment to ADR-0001 as part of this ticket; the graph document's reserved nullable `position` field is what this ticket fills.

**What to build (hybrid layout):** The map lays itself out with dagre until the Author first drags a box. On that first drag every box's current computed position is written into its Step's `position` and the map is thereafter "arranged by hand": dragging moves one box and stores its position; a Step created afterwards is placed just below its parent (or below the lowest box, for an unconnected Step) and stored; deleting a Step stores nothing. An "Auto-arrange" button on the canvas clears every `position` (after a confirmation naming what it discards) and the map lays itself out again. Positions live in the Draft document only; publishing copies them with the document and nothing reads them at run time. Positions are saved through the same autosave as every other edit.

- [ ] Dragging a box moves it, persists across a reload, and does not move any other box.
- [ ] After the first drag, adding a next Step from a box places the new box just below it; "Add step" places it below the lowest box.
- [ ] "Auto-arrange" asks, then clears every position and lays the map out with dagre; the row read back has `position: null` on every Step.
- [ ] A Draft with positions still validates and publishes; the runner ignores positions.
- [ ] Case-3: after dragging one box, the other 35 stay where dagre put them.
- [ ] Seam B: drag, reload, auto-arrange, publish. Screenshots and a recording under `test-results/`.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's usage feedback on PR #19, 2026-09-21.

## Comments

### Note from the ticket 21 decision (Paul, 2026-09-21)

Ticket 21 adds a per-Journey `layoutDirection` to the document. Stored positions belong to the direction they were placed in: switching direction while positions exist asks with this ticket's Auto-arrange confirmation and clears every position, so the map lays itself out again in the new direction. Auto-arrange itself stays as written here (Paul: a hand-arranged map must always be able to go back to auto layout "in case they find themselves making a mess").
