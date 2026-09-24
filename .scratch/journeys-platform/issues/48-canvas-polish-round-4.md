# 48: Canvas polish — feedback round 4

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon 46 → 47 → **48** → 49 → 38 → 50 → 51; 52 is grilled in its own thread and may squeeze in; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call.
Route: polish

**Why:** Paul, 2026-09-23, items 9, 11, and the cheap half of 7: "The currently selected layout … should be indicated that it is selected … it doesn't work well in dark mode." "In left to right, when there are 2 choices, the choice text overlaps." "On mobile … editing a step in the canvas is a little inconvenient because you have to click then scroll down."

**What is true today (read on `staging` at `78a4e32`):**

- **Direction toggle.** `DirectionControl` (`src/components/journeys/direction-control.tsx`, shared by the editor and the Analytics tab) marks the checked radio with `bg-accent` only. The outline button variant in `src/components/ui/button.tsx` also carries a `dark:` background at 30 % of `--input`, which the `dark` custom variant wins over, so in dark mode both options paint the same. In light mode `--accent` and `--background` are so close that the mark is faint too. Ticket 35 fixed React Flow's controls, not this.
- **Left-to-right labels.** `src/lib/graph/layout.ts` adds every arrow to dagre with no label width, height, or `labelpos`, so dagre reserves no cross-axis room; each arrow's midway point (`midwayAlong` in `canvas-shared.ts`) sits on dagre's dummy point between ranks, about ten units from its neighbour, and two 24 px labels overlap. The anchors are 24 px apart on a 72 px box side as well.
- **Stacked panel.** Below the `lg` breakpoint (1024 px, so tablets and small laptops too) the Step panel renders under the map in `draft-editor.tsx`, the map is at least 36 rem tall, and `selectStep` never scrolls, so the panel starts below the fold and nothing brings it into view. The only scroll today is the title's `autoFocus` on a newly created Step.

**Decisions (Paul, 2026-09-23, accepted the agent's recommendation):**

- The checked direction is styled from `aria-checked`, in both schemes, with a token that reads at a glance (the primary or secondary pair), not with a `!important` or a `.dark` special case. Both maps get it through the shared component.
- Labels get room from the layout, not from a nudge after the fact: pass the label box (`EDGE_LABEL_MAX_WIDTH` × `EDGE_LABEL_HEIGHT`, `labelpos: "c"`) to dagre and place each label at dagre's label point, so top-to-bottom gains the same guarantee. Canvas screenshots will shift; that is expected.
- At a stacked width, clicking a box scrolls the panel into view (respecting the map's `preventScroll` focus and ticket 12's Playwright scroll-anchoring lesson). The bottom sheet is ticket 53, post-hackathon.

**What to build:**

- **Toggle.** `direction-control.tsx`: the checked state through `aria-checked:` utilities; a check icon is optional.
- **Layout.** `layout.ts`: label dimensions on `setEdge`, label placement from the dagre edge result threaded through `arrowPoints` / the `ChoiceEdge` in `journey-canvas.tsx`; `layout.test.ts` gains a case asserting two arrows from one Step in left-to-right have label centres at least a label height apart.
- **Panel.** `draft-editor.tsx` or `selectStep`: when the panel is stacked (a matched media query, not a window width read at render), scroll the panel's top under the sticky rows after a box click; never on keyboard navigation between boxes.
- **Specs.** `canvas-dark-controls` gains an assertion that the checked radio's painted background differs from the unchecked's in both schemes (the canvas pixel probe ticket 31 and 35 used); new `canvas-lr-labels-apart` in `e2e/canvas.spec.ts`: a Step with two Choices in left-to-right, read both label boxes, assert no intersection; new `canvas-stacked-panel-scroll`: viewport 800 × 900, click a box, assert the panel's top is inside the viewport.

Acceptance criteria:

- [ ] The selected direction is visibly marked on the editor and the Analytics tab in light and dark.
- [ ] Two Choice labels from one Step never overlap in either direction.
- [ ] Below the stacked width, clicking a box brings the Step panel into view.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, items 7, 9, and 11.

## Comments
