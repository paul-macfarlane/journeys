# 16: Canvas authoring

Status: ready-for-agent
Blocked by: 09
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: first of the graph tidy-up series (Paul, 2026-09-21): 16 → 19 → 17; 18 is a decision Paul makes alongside.

**What to build:** Turn the ticket-09 canvas from a viewer into the place an Author edits structure. Everything that connects Steps happens on the graph where possible; problems are readable, not just counted; the layout crosses itself less; and the step list under the canvas follows the map's order.

- **Add a next step from a box.** The selected box shows a small toolbar (React Flow `NodeToolbar`) with "Add next step", "Make this the start", and "Delete step". "Add next step" creates a Step reachable through a new Choice on the selected Step (`addChoiceToNewStep`), opens it in the panel with the title focused, and the map fits to show it. The canvas-level "Add step" stays for a deliberately unconnected Step.
- **Connect by dragging.** Boxes are connectable: dragging from a box's bottom anchor onto another box adds a Choice from the source Step to the target (empty label), selects the source Step, and focuses the new Choice's label in the panel. Dragging the end of an existing arrow onto another box retargets that Choice. A drop onto nothing does nothing. A connection that would close a loop is allowed and marked as a cycle problem, exactly as the panel allows it today — refusal at drop time waits on ticket 18.
- **Arrows are selectable.** Clicking an arrow selects its source Step and focuses that Choice's label in the panel; the selected arrow is drawn heavier. Delete/Backspace on a selected arrow removes the Choice after the same confirmation the panel's "Remove choice" gives (none today, so none here).
- **Problems are readable.** The panel gains a "Problems" section for the selected Step listing every live problem message that names it (node or one of its Choices); a Choice's problem is also shown inline under that Choice row. The editor header shows a live count ("2 problems") that toggles the full live list, each entry a button that selects the Step; "Validate" keeps its server-side role as the publish gate. The hover-only tooltip on the box stays.
- **Fewer crossings.** Source anchors on a box are ordered by the target box's x position rather than Choice order; `ranksep` widens to 96; arrows follow dagre's routed points (a custom edge rendering the polyline dagre returns, smoothed) so its crossing minimization shows. Selecting a box highlights its incoming and outgoing arrows and dims the rest.
- **Locate on map.** Selecting a Step from the list, a problem entry, "Leads here from", "Open", or a Choice's target centers the canvas on that box (`fitView` on the one node, capped zoom) when it is off-screen.
- **Legend shows Outcomes.** The top-right legend lists each Outcome with its color plus Start and Problem, replacing the generic Ending swatch.
- **Step list follows the map.** The list beneath the canvas is ordered by map position (top to bottom, then left to right, from `layoutGraph`), and "Not reachable from the start" goes away because unreachable Steps are marked on the map and listed under Problems. The list is collapsed by default behind a "Steps" disclosure.

Acceptance criteria:

- [ ] "Add next step" on the selected box creates a Step reachable from it, opens it in the panel with the title focused, and the new box is inside the viewport.
- [ ] Dragging from one box to another adds a Choice (edge count +1) and the panel focuses its empty label; dragging an arrow's end to a third box retargets it; the row read back holds the new target.
- [ ] Clicking an arrow selects its source Step and focuses that Choice's label; Delete removes the Choice and the arrow.
- [ ] A Step with an Ending-without-Outcome problem shows the message in the panel's Problems section; the header count reads "1 problem"; assigning the Outcome clears both.
- [ ] Case-3: the number of crossing arrow pairs, measured from the rendered paths, is lower than at ticket 09's `f24a106` (record both numbers in the evidence); selecting a box dims every arrow not attached to it.
- [ ] Selecting a Step from the collapsed list or a problem entry brings its box into the viewport.
- [ ] The legend lists every Outcome with the same color its Endings carry.
- [ ] The step list order matches the boxes' top-to-bottom, left-to-right order on the map for case-3.
- [ ] Seam B: build a three-Step branch entirely by dragging on the canvas and typing labels in the panel, publish it, and walk it in the runner. Screenshots and a recording under `test-results/`.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's usage feedback on PR #19, 2026-09-21.

## Comments
