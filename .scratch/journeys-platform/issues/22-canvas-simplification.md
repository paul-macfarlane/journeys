# 22: Canvas simplification — feedback round 1

Status: ready-for-agent
Blocked by: 21
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: next after 21 (Paul, 2026-09-21): 21 → 22 → 23 → 17; 20 at any time. "Anything we can do to simplify the canvas and make it less buggy would be good."

**Why:** Paul used the canvas after tickets 16–21 and found it moves the view when he did not ask, shows more than he needs, and fights him on a large map (case-3). This ticket removes what did not earn its place and makes every viewport move one the Author asked for.

**Decisions (Paul, 2026-09-21):** the map never zooms all the way out on its own after the first render — not when the panel comes back for an opened Step, not when a Step is added; it zooms to the Step instead. The box toolbar shows only after the Author clicks a box, and is compact until expanded. The Ending colour bar and the legend go. The Choice target picker is searchable. Undo/redo is ticket 23. "Leads here from" goes. A Choice dragged into empty space makes a new Step. Clicking an arrow never moves focus or scrolls the page away from the canvas. Outcomes stay a concept (analytics in ticket 10 still group Endings by Outcome), but the dedicated Outcomes section beneath the map goes and an Outcome is made, chosen, and renamed from the Ending itself.

**What to build:**

- **The view stays where the Author put it.** The map fits itself only on first render, on a direction change, and on "Hide panel" / "Show panel". Opening a Step that reveals the hidden panel keeps the viewport (the frame narrows; nothing re-fits) and then makes the "Zoom to step" move on the opened Step (`fitView({ nodes: [{ id }], maxZoom: 1, duration: 200 })`). "Add step", "Add next step", "Duplicate", and a Choice dropped on empty map (below) zoom to the new Step the same way; ticket 16's "a Step added or removed fits the whole map" is withdrawn — a removal leaves the view alone too. Ticket 21's fit on Hide/Show stays.
- **A compact box toolbar, only on a click.** The toolbar appears on a box only after the Author clicks that box on the map (not for the Step the panel holds on page load, not for a Step opened from "Find step", a problem entry, or an arrow), as one small button on the box labelled "Step actions" (an ellipsis icon, `aria-expanded`) that expands to the five moves (Add next step, Duplicate, Zoom to step, Make this the start, Delete step); Escape or a click elsewhere collapses it; the panel footer keeps its own Duplicate / Make this the start / Delete step.
- **No Ending colouring.** Remove the Outcome colour bar on Ending boxes, `data-outcome-index`, `OUTCOME_COLORS`, and the legend panel entirely (Start and Problem read from the badges and rings). Ticket 10 may reintroduce colour if analytics need it.
- **Searchable Choice target.** The target `<select>` in a Choice row becomes a combobox in the "Find step" pattern: the field shows the current target's title; clicking or typing opens a listbox of every Step in map order (the current Step included, ticket 18), filtered by title as the Author types; Enter or a click retargets the Choice through `updateChoice`. Same ARIA shape as `find-step.tsx`; extract the shared pieces rather than copying them.
- **The selected arrow is the one you can take hold of.** Every arrow into a box ends on the same handle, so their heads stack. Only the selected arrow is `reconnectable`, and the selected arrow is drawn above the others (React Flow `zIndex` or ordering), so dragging a head always moves the Choice the Author selected.
- **"Leads here from" removed** from the panel.
- **Drop a Choice on empty map to make a Step.** Dragging from a box's connect dot and releasing on bare map creates a new Step and the Choice leading to it in one motion (`addChoiceToNewStep`), opened with the title focused, the map zoomed to it. Until ticket 17 lands the new Step is placed by dagre; 17 may use the drop point.
- **Clicking an arrow stays on the canvas.** Selecting an arrow opens its Step in the panel and marks that Choice's row (`aria-current="true"`, a ring) but moves no focus and scrolls nothing. The same for a Choice drawn by dragging: the Step opens with the new row marked, focus stays on the map; ticket 16's "label field focused" is withdrawn. `SelectStepOptions.focusChoiceId` becomes `markChoiceId`.
- **Outcomes from the Ending.** Remove `OutcomeList` and the "Outcomes" heading beneath the map. The Ending's Outcome field in the panel becomes a combobox: it lists every Outcome with its Ending count; typing a label no Outcome has offers "Create outcome “<label>”", which adds it and tags the Ending; choosing one tags the Ending; "No outcome" clears it. A "Rename" button beside the field turns the label into an inline input that renames the Outcome for every Ending sharing it (`renameOutcome`). An Outcome no Ending uses any longer is removed from the document (`removeOutcome`) when the last Ending drops it — no explicit remove. The "n steps · m outcomes" summary stays; the seed documents, `validateForPublish`, the runner, and analytics are unchanged.
- **Specs and docs.** Every e2e spec that relied on the withdrawn behaviours (fit on add, label focus after a drag, the Outcomes section, "Leads here from", the legend, `data-outcome-index`, the toolbar on the initial Step) is rewritten to the new ones — never skipped. README's editor paragraph and `CONTEXT.md` (Canvas) are updated. No spec `[SCOPE CHANGE]` is needed: the spec never mandated the legend, the Outcomes section's placement, or the viewport rules.

Acceptance criteria:

- [ ] On case-3 zoomed in to a box with the panel hidden, clicking another box on the map shows the panel and leaves the zoom no lower than before, with the clicked box fully on the map; "Add next step" from a box on case-3 zoomed in leaves the zoom no lower than before and the new box fully on the map; deleting a Step leaves the viewport transform unchanged.
- [ ] On page load no toolbar and no "Step actions" button is on the map; clicking a box shows "Step actions" on that box; expanding it shows the five moves; Escape collapses it; opening a Step from "Find step" shows no toolbar.
- [ ] No `[data-outcome-bar]`, no `data-outcome-index`, and no "Legend" list on the map, on case-3 with its three Outcomes.
- [ ] In a Choice row, typing part of another Step's title in the target field lists it; choosing it retargets the Choice; the `draft` row read back holds the new target; the arrow's accessible name names the new target.
- [ ] With two Choices from two Steps into one box, selecting the second arrow and dragging its head onto a third box retargets that Choice and leaves the first unchanged (the `draft` row read back).
- [ ] No "Leads here from" group in the panel.
- [ ] Dragging from a box's connect dot onto empty map creates a Step and a Choice to it; the panel opens on the new Step with its title focused; the new box is fully on the map; the `draft` row holds both.
- [ ] Clicking an arrow opens its Step with that Choice's row marked current; the document's active element stays inside the Canvas region; `window.scrollY` is unchanged.
- [ ] No "Outcomes" section beneath the map. On an Ending, typing "Reached care" in the Outcome field and choosing "Create outcome" tags it and the summary reads "1 outcome"; a second Ending picks it from the list; renaming it renames both (the `draft` row read back); clearing it on both Endings removes it and the summary reads "0 outcomes".
- [ ] Seam B: build a three-Step branch by dropping two Choices on empty map, tag both Endings with one Outcome made from the panel, publish, walk it in the runner. Screenshots and a recording under `test-results/`; every existing canvas, draft, step-editing, and publish spec passes.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's feedback after using the canvas, 2026-09-21.

## Comments
