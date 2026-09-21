# 16: Canvas authoring

Status: ai-review
Blocked by: 09, 18
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-21
Parent: `.scratch/journeys-platform/spec.md`
Priority: second of the graph tidy-up series (Paul, 2026-09-21): 18 → 16 → 19 → 17.

**What to build:** Turn the ticket-09 canvas from a viewer into the place an Author edits structure. Everything that connects Steps happens on the graph where possible; problems are readable, not just counted; the layout crosses itself less; and the step list under the canvas follows the map's order.

- **Add a next step from a box.** The selected box shows a small toolbar (React Flow `NodeToolbar`) with "Add next step", "Make this the start", and "Delete step". "Add next step" creates a Step reachable through a new Choice on the selected Step (`addChoiceToNewStep`), opens it in the panel with the title focused, and the map fits to show it. The canvas-level "Add step" stays for a deliberately unconnected Step.
- **Connect by dragging.** Boxes are connectable: dragging from a box's bottom anchor onto another box adds a Choice from the source Step to the target (empty label), selects the source Step, and focuses the new Choice's label in the panel. Dragging the end of an existing arrow onto another box retargets that Choice. A drop onto nothing does nothing. A connection that closes a loop is simply allowed: ticket 18 removes the no-cycles rule, so there is nothing to mark or refuse.
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

### [EXECUTION PLAN] 2026-09-21 — Atlas orchestrator

**Contract:** this ticket as it stands (no scope changes on file). Criteria are AC-1..AC-9 in checklist order. Derived DoD from the footer, `docs/agents/testing.md`, and `CLAUDE.md`: DoD-1 verified run command green; DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only, no participant data. No dependency or migration change is expected, so no lockfile gate and no migrate step. Run surface: local + deployed; per Paul's 2026-09-20 decision there is no post-merge staging smoke gate. No human gates at plan time.

**Availability:** `Blocked by` 09 and 18 are both `done` on `staging` (`45f4635`, PR #21 merged); Paul's priority order names 16 next.

**Repository delivery:** `journeys`, base `staging` @ `45f4635`, branch `feat/16-canvas-authoring`, direct checkout. One detached worktree at `.claude/worktrees/16-canvas-authoring/journeys/baseline-f24a106` (checkout of `f24a106`) exists only to measure the AC-5 baseline crossing count on the ticket-09 canvas; nothing is committed there and it is removed at closeout. Deliverables run **sequentially** because every implementation deliverable after D1 verifies through the one e2e port (3100) and the one `journeys_e2e` database, and because the predicted file overlaps are real: D2 and D3 both rewrite `src/components/journeys/journey-canvas.tsx` and `e2e/canvas.spec.ts`; D3 and D4 both touch `draft-editor.tsx`, `step-panel.tsx`, and `choice-list.tsx`. Re-checked at closeout against the real diffs.

**Resolved technical decisions (execution, not contract changes):**

- **Crossing measurement (AC-5).** `src/lib/graph/crossings.ts` (orchestrator, `b00615a`): `countCrossingPairs(polylines)` counts pairs of arrows whose sampled paths properly intersect farther than 6 path units from either arrow's ends, so arrows leaving neighbouring anchors or converging on one box's top anchor are not crossings; a pair counts once. Every spec samples each arrow's `path.react-flow__edge-path` with `getPointAtLength` every 4 units (at least 16 samples) in flow coordinates, which are zoom-independent. The baseline is the same sampling and count taken of the case-3 map in the `f24a106` worktree; both numbers go into `test-results/ac-5-crossings.txt` and the new number is asserted lower in the spec.
- **Layout module (D1).** `layoutGraph` runs dagre as a multigraph (one named dagre edge per Choice, so parallel Choices and self-loops each get their own route) with `ranksep` 96; each `CanvasEdge` gains `points: Array<{x, y}>` — dagre's routed points in the same coordinate space as node positions; each `CanvasNode` gains `sourceAnchors: string[]` — its Choice ids ordered by the target box's x (centre), ties in Choice order, a self-loop ordered by the node's own x; new `mapOrder(layout)` returns Step ids (never placeholders) sorted by y then x. `problemsByAddress` is unchanged. Existing tests stay green; Seam A cases cover points, anchors, `mapOrder`, and determinism.
- **Custom edge (D2).** One edge type `choice` rendered with React Flow's `BaseEdge` (keeping `path.react-flow__edge-path`), whose path starts at the source anchor, passes through dagre's interior points, ends at the target anchor, and is smoothed (quadratic curves through segment midpoints); the Choice label at the path's middle via `EdgeLabelRenderer` or `BaseEdge`'s label. Handle positions on a box follow `sourceAnchors`. Edge data carries `emphasis: "selected" | "attached" | "dimmed" | "plain"`: with a box selected, its incoming and outgoing arrows are `attached` (full stroke), every other arrow `dimmed` (reduced opacity), and a spec reads `data-emphasis` off the edge wrapper. Marks (destructive stroke, `data-problems`) stay as they are.
- **Locate on map (D2).** When `selectedStepId` changes and that box is not fully inside the canvas frame, `fitView({ nodes: [{ id }], maxZoom: 1, duration: 200 })`; a box already in view leaves the viewport alone. The existing fit-to-all on a change in the set of boxes stays, which is what AC-1 relies on.
- **Legend (D2).** Start, one entry per Outcome (its label, swatch `style.backgroundColor` equal to the colour its Endings carry, `data-outcome-id`), Problem; no generic Ending entry.
- **Toolbar (D3).** `NodeToolbar` on the selected Step box, `role="toolbar"` labelled "<title> actions", with "Add next step" (`addChoiceToNewStep` with an empty label; opens the new Step with the title focused), "Make this the start" (disabled on the Start), "Delete step" (disabled on the Start; opens the same confirmation as the panel — `DeleteStepDialog` moves to `src/components/journeys/delete-step-dialog.tsx` and both use it). Two spec lines that locate "Delete step" at page level (`e2e/step-editing.spec.ts`, `e2e/canvas.spec.ts`) are scoped to the Step panel region.
- **Connecting (D3).** Every Step box has one connectable source handle on its bottom edge (id `connect`), visually distinct from the per-Choice anchors, which stay non-connectable; the target handle accepts a drop anywhere on the box (a full-box target handle or `connectionRadius`, whichever the installed `@xyflow/react` resolves reliably, proven by the spec dropping at the box centre). `onConnect` adds a Choice with an empty label on the source Step, selects it, and focuses that Choice's label. `edgesReconnectable` with `reconnectable: "target"`; `onReconnect` retargets the Choice; a drop on nothing changes nothing. Self-loops and loops are accepted.
- **Arrow selection (D3).** Edges are selectable through React Flow (nodes stay `selectable: false`; the panel's selection is unchanged); the selected Choice is editor state and the derived edge carries `selected`, drawn with a heavier stroke. `onEdgeClick` selects the source Step and focuses the Choice's label. Delete/Backspace remove the Choice only when the keypress reaches the canvas (React Flow's `deleteKeyCode` handling, which ignores input fields, or an equivalent guard); typing in the focused label never deletes. Focusing a Choice's label travels through `SelectStepOptions.focusChoiceId` → `StepPanel` → `ChoiceList`.
- **Problems readable (D4).** `StepPanel` gains a "Problems" `section` listing every live problem whose `stepId` is the Step (from `problemsByAddress(liveProblems).steps`); `ChoiceList` shows a Choice's live problem message under its row (replacing the fixed dangling sentence). The editor header shows "N problem(s)" as a button toggling a live list (`aria-label="Problems"`) whose entries select the Step; "Validate" and its server-side list are unchanged.
- **Step list (D4).** `StepList` orders by `mapOrder(layoutGraph(document))`, drops the "Not reachable from the start" section and the "Not yet reached" list, and sits behind a "Steps" disclosure button (`aria-expanded`, collapsed by default). Specs that read the list (`draft.spec.ts`, `step-editing.spec.ts`, `publish.spec.ts`) open the disclosure first.

**Deliverables (all `atlas-worker`, direct checkout on `feat/16-canvas-authoring`):**
- **D1 — layout module** (sonnet): `src/lib/graph/layout.ts`, `layout.test.ts`.
- **D2 — canvas presentation** (opus): custom routed edge, anchor order, highlight/dim, locate on map, legend; `journey-canvas.tsx`, `draft-editor.tsx` (locate wiring only), `e2e/canvas.spec.ts` (AC-5, AC-6 list case, AC-7).
- **D3 — canvas structure editing** (opus): toolbar, connect, reconnect, arrow select/delete, `focusChoiceId`; `journey-canvas.tsx`, `draft-editor.tsx`, `step-panel.tsx`, `choice-list.tsx`, `editor-shared.ts`, new `delete-step-dialog.tsx`, `e2e/canvas.spec.ts` (AC-1, AC-2, AC-3, AC-9), README.
- **D4 — problems readable and the step list** (sonnet): `draft-editor.tsx`, `step-panel.tsx`, `choice-list.tsx`, `step-list.tsx`, `e2e/canvas.spec.ts` (AC-4, AC-8, AC-6 problem-entry case), the three specs that read the list.
- **B — baseline crossing count** (sonnet, in the `f24a106` worktree, nothing committed): the same sampling over the case-3 map at `f24a106`, reported as a number.

**Verification map (evidence committed under `test-results/`; the root is cleared once, immediately before the aggregate capture):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | `pnpm test:e2e` test `canvas-add-next-step` | local; docker Postgres `journeys_e2e`; production server on 3100 | "Add next step" adds a box and an arrow from the selected one; panel opens it with "Step title" focused; its box is inside the canvas frame | `test-results/canvas-add-next-step/….png`, `test-results/dod-1-e2e.txt` | after D3 | changes under `src/`, `e2e/` |
| AC-2 | test `canvas-connect-and-retarget-by-dragging` | as AC-1 | drag box→box: edge count +1, the empty "Choice label" focused; drag an arrow's end to a third box: the `draft` row's Choice holds the new target | `….png`, `….webm`, `dod-1-e2e.txt` | after D3 | as AC-1 |
| AC-3 | test `canvas-arrow-select-and-delete` | as AC-1 | click an arrow: source Step in the panel, its "Choice label" focused, arrow heavier; Delete on the canvas removes the Choice and the arrow | `….png`, `dod-1-e2e.txt` | after D3 | as AC-1 |
| AC-4 | test `canvas-problems-readable` | as AC-1 | the Ending-without-Outcome message in the panel's Problems section; header reads "1 problem"; assigning the Outcome clears both | `….png`, `dod-1-e2e.txt` | after D4 | as AC-1 |
| AC-5 | test `canvas-case-3-map` (crossing count printed and asserted below the baseline) and test `canvas-selection-dims-arrows`; Seam A `layout.test.ts` (routed points, anchor order); baseline B | as AC-1 plus the `f24a106` worktree | new count < baseline; with a box selected every arrow not attached to it is `dimmed` and every attached one is not | `test-results/ac-5-crossings.txt` (both numbers), `canvas-case-3-map/….png`, `canvas-selection-dims-arrows/….png`, `dod-1-e2e.txt`, `dod-1-commands.txt` | after D2 (B before D2) | as AC-1 |
| AC-6 | test `canvas-locate-on-map` | as AC-1 | after zooming in, selecting a Step from the collapsed list and from a problem entry brings its box fully inside the frame | `….png`, `dod-1-e2e.txt` | after D2 (list), D4 (problem entry, disclosure) | as AC-1 |
| AC-7 | test `canvas-legend-outcomes` | as AC-1 | one legend entry per Outcome whose swatch colour equals its Endings' bar colour; no Ending entry | `….png`, `dod-1-e2e.txt` | after D2 | as AC-1 |
| AC-8 | test `canvas-step-list-follows-map` (case-3) | as AC-1 | the list's titles in order equal the boxes sorted top-to-bottom then left-to-right; Seam A `mapOrder` | `….png`, `dod-1-e2e.txt`, `dod-1-commands.txt` | after D4 | as AC-1 |
| AC-9 | test `canvas-build-by-dragging-and-walk` | as AC-1 | three Steps wired only by dragging, labels typed in the panel, Outcome assigned, published, walked in the runner to an Ending | `….png`, `….webm`, `dod-1-e2e.txt` | after D3 | as AC-1 |
| DoD-1 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` | local; docker Postgres | all exit 0; no test retried | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt` | after D4 | any source, config, or test change |
| DoD-2 | evidence review at closeout | local | every PASS artifact committed; fixture journeys only | this ticket's `[CLOSEOUT]` | closeout | — |

### [PROGRESS] 2026-09-21 — D1–D4 integrated; aggregate review started

- **D0** — orchestrator — `b00615a`: `src/lib/graph/crossings.ts` (`countCrossingPairs`) and its nine Seam A cases.
- **B** — `atlas-worker` on sonnet, in a detached worktree at `f24a106` (removed afterwards, nothing committed): the case-3 map at ticket 09's canvas has **15 crossing arrow pairs** (36 boxes, 50 arrows; the same before and after fit view), measured with the same sampling the new spec uses.
- **D1** — `atlas-worker` on sonnet — `c58eb37` + `2168661`: dagre as a multigraph with `ranksep` 96, `CanvasEdge.points`, `CanvasNode.sourceAnchors` ordered by target x, `mapOrder`; 15 Seam A cases. Approved deviation at the acceptance screen: only the first two Choices between one ordered Step pair become dagre edges (a third reuses its sibling's route with an interior offset) because dagre 3.1.1 throws "Not possible to find intersection inside of the rectangle" on case-3 with all 50 named edges (`step-14` → `step-22` × 3) — reproduced by the orchestrator, clean with the cap.
- **D2** — `atlas-worker` on opus — `497d025`: custom `choice` edge along dagre's route, anchors by `sourceAnchors`, `data-emphasis` attached/dimmed, locate on selection, Outcome legend; e2e `canvas-case-3-map` (crossing pairs **15 → 5**), `canvas-selection-dims-arrows`, `canvas-locate-on-map`, `canvas-legend-outcomes`. 43 e2e green.
- **D3** — `atlas-worker` on opus — `d803e68`: box toolbar (`NodeToolbar`, shared `DeleteStepDialog`), connect by dragging (full-box drop handle), retarget by dragging the arrow head, arrow selection with `focusChoiceId`, Delete/Backspace on the canvas; e2e `canvas-add-next-step`, `canvas-connect-and-retarget-by-dragging`, `canvas-arrow-select-and-delete`, `canvas-build-by-dragging-and-walk` (published and walked by a Participant). 47 e2e green. Two page-level "Delete step" locators scoped to the panel.
- **D4** — `atlas-worker` on sonnet — `3099a87`: panel "Problems" section and inline Choice problems from the same live validation, header count toggling the live list, step list by `mapOrder` behind a "Steps" disclosure; e2e `canvas-problems-readable`, `canvas-step-list-follows-map`, the problem-entry case in `canvas-locate-on-map`; `draft`, `step-editing`, and `publish` specs open the disclosure. 49 e2e green twice.
- Every worker run is candidate evidence only; the aggregate capture follows the review. Status `in-progress` → `ai-review`.

### [AI CODE REVIEW] 2026-09-21 — aggregate review of `45f4635..3099a87`, fixes in D5

Two fresh reviewers (one per axis, opus) read the whole diff against the ticket, the execution plan, `CONTEXT.md`, ADR-0001, ADR-0002, `docs/agents/testing.md`, and the installed `@xyflow/react` source; the orchestrator adjudicated every candidate from the cited hunks. Both reviewers confirmed: every AC has code and a named e2e test; the "What to build" bullets hold (hover tooltip kept, canvas-level "Add step" kept, "Validate" untouched, drop on nothing does nothing, no confirmation on arrow delete, list collapsed by default); no scope leak; no flaky-test workaround (`retries` 0, no `slow`/`fixme`/`skip`/`waitForTimeout`); `src/lib/graph/*` stays pure; no canvas position is read or written (ADR-0001); Author-facing copy uses `CONTEXT.md` words.

**Axis 1 — technical implementation and spec conformity** (12 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| T1 `onEdgesChange` applies React Flow's one-call [deselect old, select new] batch against the stale `selectedArrow` prop; when the new arrow sits earlier in document order the selection ends `null`, so the second arrow is neither drawn heavier nor deletable (half of AC-3); the suite only ever built one arrow | **blocking** | `journey-canvas.tsx` | resolved in D5: the batch is resolved before any callback (last `select: true` wins; `null` only when nothing was selected and the current arrow was deselected); a two-arrow spec clicks A, B, A and deletes A |
| T2 the locate effect bails when the re-selected Step is the one already open, so choosing it from the list or a problem entry never brings it back (AC-6 has no such exception; the spec always picked a different Step) | non-blocking | `journey-canvas.tsx`, `draft-editor.tsx` | resolved in D5: a locate request counter bumped by `selectStep`; the spec re-selects "Lost tent" after panning away |
| T3 `layoutGraph` runs twice per document change (canvas and step list, even collapsed) | non-blocking | `step-list.tsx`, `journey-canvas.tsx` | resolved in D5: one layout in `DraftEditor`, passed to both (= S4) |
| T4 `removeStep` bypasses `selectStep`, leaving an arrow selection and a Choice focus request behind | non-blocking | `draft-editor.tsx` | resolved in D5 |
| T5 a Choice drawn on the map starts with an empty label, nothing blocks publishing it, and the runner renders it as a nameless link | non-blocking | `validate.ts`, `step-view.tsx` | deviation: the ticket asks for the empty label and a publish rule amends the spec; queued as a question for Paul (below) |
| T6 the dims test asserts `data-emphasis` only, not the rendered opacity | non-blocking | `canvas.spec.ts` | resolved in D5: computed opacity asserted for one dimmed and one attached arrow |
| T7 the baseline 15 is three bare literals and nothing re-derives it | non-blocking | `canvas.spec.ts` | resolved in D5: named constant citing `test-results/ac-5-crossings.txt`; the spec fails loudly if the fixture is no longer 36 Steps and 50 Choices (= S16) |
| T8 a11y: (a) `role="toolbar"` without roving tabindex; (b) focus falls to `body` after a toolbar delete; (c) connecting is mouse-only; (d) `aria-controls` gaps | non-blocking | `journey-canvas.tsx`, `draft-editor.tsx`, `step-list.tsx` | (a) resolved in D5: `role="group"` (= S13); (b) deviation, minor; (c) noted — the panel's "Add choice" is the keyboard path; (d) resolved in D5 by dropping `aria-controls` from the step list so both disclosures match (= S12) |
| T9 a self-loop Choice is routed through its own box | non-blocking | `journey-canvas.tsx`, `layout.ts` | deviation: cosmetic, ticket 19's territory (as recorded at ticket 18's review); D5 pins the self-loop route in a Seam A case |
| T10 `walkOrder` is dead production code | non-blocking | `edit.ts`, `edit.test.ts` | resolved in D5: deleted with its tests (= S8) |
| T11 AC-3's spec clicks the label chip and calls `focus()` before Delete | non-blocking | `canvas.spec.ts` | deviation: clicking an arrow focuses the panel's label by design, so Delete cannot follow a click without focus moving back to the arrow; `focus()` models Tab. D5's two-arrow case clicks the interaction path |
| T12 `step-editing.spec.ts` derives the expected count from `counted` and `validateForPublish` | non-blocking | `step-editing.spec.ts` | resolved in D5: literals (= S11) |

**Axis 2 — coding standards** (19 candidates, all non-blocking)

| # | Paths | Disposition |
|---|---|---|
| S1 README "clicking a node" inside the rewritten paragraph | `README.md` | resolved in D5 |
| S2 British spellings in new prose beside American identifiers | README, `journey-canvas.tsx`, `layout.ts`, `canvas.spec.ts` | resolved in D5 |
| S3 `choiceLabel` defined three times | three components | resolved in D5: one in `editor-shared.ts` |
| S4 second dagre run per document change | `step-list.tsx` | resolved in D5 (= T3) |
| S5 `Point` declared three times, inline shape four times | `crossings.ts`, `layout.ts`, canvas, spec | resolved in D5 |
| S6 `domAttributes` cast contradicts the file's `NodeMarks` convention; `node.data` cast | `journey-canvas.tsx` | resolved in D5: `EdgeMarks`, discriminate on `node.type` |
| S7 bare `28` for the overflow arrow offset | `layout.ts` | resolved in D5: `OVERFLOW_ARROW_OFFSET` |
| S8 dead `walkOrder` | `edit.ts` | resolved in D5 (= T10) |
| S9 `openStepList` copied into four specs | four specs | resolved in D5: exported from `e2e/setup/authoring.ts` |
| S10 `dimmingDocument` hand-rolls what `documents.ts` provides | `canvas.spec.ts` | resolved in D5: moved beside the other fixtures |
| S11 tautological expectations | `step-editing.spec.ts` | resolved in D5 (= T12) |
| S12 `aria-controls` to an unrendered id | `step-list.tsx` | resolved in D5 |
| S13 `role="toolbar"` without its keyboard contract | `journey-canvas.tsx` | resolved in D5: `role="group"` |
| S14 heading, disclosure button, and list all named "Steps" | `draft-editor.tsx`, `step-list.tsx` | deviation: three distinct roles; renaming the heading would churn every spec for no functional gain |
| S15 two D1 commits lack the trailer; `c58eb37` holds a NUL-byte blob of `layout.ts` (fixed in `2168661`); `b00615a` scoped `test(canvas)` for a `src/` module | commits | deviation: accepted commits are not rewritten; the PR description recommends a squash merge so the blob never reaches `staging` history |
| S16 baseline literals | `canvas.spec.ts` | resolved in D5 (= T7) |
| S17 `crossings.ts` under `src/lib/graph` with no production consumer | `crossings.ts` | confirmed by the orchestrator: pure, no `server-only`, resolved through the `@/` alias by the spec, bundled into no route |
| S18 `useMemo<CanvasActions>` never holds: handlers re-created each render | `draft-editor.tsx` | resolved in D5: `useCallback` |
| S19 `selectedArrow` state vs `liveArrow` derived | `draft-editor.tsx` | resolved in D5: `arrowSelection` / `selectedArrow` |

**Remaining risks:** (1) the three arrows between case-3's `step-14` and `step-22` share one dagre route with ±28-unit nudges, so they read as three close arrows rather than three routed ones; (2) two dagre passes were arithmetic, not measured — a 60-Step Draft has no sustained-typing timing; (3) with roughly ten Choices on one Step the last anchor lands near the connect dot; (4) no test drags a dangling arrow's head onto a real box (the natural repair of a "Missing step" placeholder), though the code path excludes placeholders on both ends; (5) a back/forward-cache restore and the other ticket-18 runner risks are unchanged.

**Queued question for Paul (gates nothing here):** should an empty Choice label become a publish problem (a `validateForPublish` rule shown in the new Problems section), now that a Choice drawn on the map starts empty and the runner would render such a Choice as a nameless link?
