# 25: Canvas polish — feedback round 2

Status: done
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

### [SCOPE CHANGE] 2026-09-22 — Claude Fable 5.1

Three things the ticket did not ask for, each needed to land what it did:

1. `minZoom` on the map drops from 0.1 to 0.05. With the left-to-right rank gap widened for labels, case-3 running left to right needs a fit just under 0.1, and a floor above what the map needs left boxes off the edge of the frame (`canvas-layout-direction` faulted two boxes outside the Canvas).
2. The label drawn on an arrow is a `<foreignObject>` chip (`[data-edge-label]`) rather than React Flow's SVG `<text>`, because SVG text has no ellipsis. The arrow's new `<title>` also matches a Playwright text search, so `canvas-arrow-select-and-delete`, `canvas-node-opens-panel-and-edge-appears`, and both `canvas-connect-and-retarget-by-dragging*` read the chip by name (`arrowLabel`), and the first clicks the chip instead of React Flow's text wrapper. The chip takes the pointer so a click on it still selects the arrow.
3. `canvas-keyboard-navigation` asks for the whole map (`fitWholeMap`) before reaching for the Start a second time: the pane is a controls row shorter, and at the zoom a lone Start is fitted at, the Start now sat entirely above the map after "Add next step" zoomed to the new box.

And one refinement of the rule: the ticket's "reassign those targets' cross-axis coordinates among themselves in Choice order, earliest Step in map order wins" is implemented as one top-down sweep — each rank re-ordered by the middle of the boxes above that lead to it, dagre's own down-sweep, with each placer's siblings dealt out in Choice order and ties broken by Choice index — so a swapped branch carries its subtree across instead of crossing it. The literal rule cost about four times the crossings on case-3 (approx. 3 → 13); the sweep costs about twice (real count on the spec: 5 → 10, ceiling 15). "Map order" became rank order with the Start first in its rank, so another root beside the Start cannot place the Start's targets ahead of it.

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/29 (base `staging`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** `71e4ebc` feature (layout post-pass, controls row, no minimap, no delete for the Start, truncated labels, specs). `683a41e` review fix (single-parent tie-break, `targetNodeId`). Closeout — this commit. All by Claude Fable 5.1 in the direct checkout; no worktrees.

**Verified run command:** `pnpm lint; pnpm typecheck; pnpm test; pnpm test:e2e` — every block exit 0; unit 242/242; e2e 69 passed in 57.8s, 0 flaky, retries 0. Docker Postgres :5436, `next start` :3100, Chromium. Capture: `test-results/dod-1-commands.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 three Choices read in Choice order, both directions; case-3 lays out | PASS | `layout.test.ts` "layoutGraph Choice order" (three-way TB and LR, single-parent reversed insertion, case-3 both directions, no throw); `canvas-build-branch-and-publish` (first target left of second) and `canvas-build-left-to-right-and-walk` (first target above second) in `dod-1-commands.txt`; `test-results/canvas-build-branch-and-publish/canvas-build-branch-and-publish.png` (viewed: Waved through left of Turned back) |
| AC-2 toolbar and fixed controls never overlap; controls stay put on zoom | PASS | `canvas-step-actions`: Start's expanded moves vs the `Map controls` group have no overlapping rectangles; after zoom in the row is visible at the same offset in the Canvas; `test-results/canvas-step-actions/canvas-step-actions.png` (viewed) |
| AC-3 no minimap | PASS | `canvas-step-actions` asserts `.react-flow__minimap` count 0; `MiniMap` import gone |
| AC-4 Start shows no "Delete step"; another Step does | PASS | `canvas-step-actions`: Start's box toolbar and panel footer have none, Clinic tent's both do; `edit.test.ts` guard test untouched |
| AC-5 case-3 LR labels within their gaps; longest Choice readable | PASS | `canvas-layout-direction`: `labelsOutsideGaps` returns `[]` over all 50 arrows; the longest Choice (89 chars, on "Documented") is the arrow's `aria-label` prefix and its `<title>`, and the panel row's "Choice label" holds it in full; `test-results/canvas-layout-direction/canvas-layout-direction-left-to-right.png` |
| AC-6 full `pnpm test:e2e` once at the end | PASS | `dod-1-commands.txt`: 69 passed, 0 flaky |

**Evidence committed:** `test-results/dod-1-commands.txt` and the screenshot/video directories of the specs this ticket names or changes: `canvas-layout-direction`, `canvas-add-next-step-left-to-right`, `canvas-step-actions`, `canvas-build-left-to-right-and-walk`, `canvas-build-branch-and-publish`, `canvas-arrow-select-and-delete`, `canvas-node-opens-panel-and-edge-appears`, `canvas-connect-and-retarget-by-dragging`, `canvas-connect-and-retarget-by-dragging-left-to-right`, `canvas-keyboard-navigation`. The full run rewrote the other specs' screenshots; the agent git-policy hook denies `git checkout -- <pathspec>`, so they are left unstaged for Paul to restore with `git checkout -- test-results` from his terminal, as in PR #28.

**Deviations.** See `[SCOPE CHANGE]` above. Commit subjects were shortened to the commit-msg hook's 100-character rule; no hook bypassed. `pnpm build` ran inside `pnpm test:e2e`; no schema change, so no migrate. `EDGE_LABEL_MAX_WIDTH` is 160: case-3's longest Choice (89 characters) cannot fit any gap, so the width shows its opening five or six words with the rest under the ellipsis — Paul may want it wider or narrower.

**Human gate announced for later.** Post-merge staging smoke: open a seeded case-3 Journey, switch to Left to right, confirm the Start's Choices read top to bottom in panel order and every label sits between its boxes; click the Start's box, open its actions, confirm no "Delete step".

**AI code review (one Standards reviewer, one Spec reviewer, both general-purpose agents reading `git diff staging...HEAD` at `71e4ebc`).** Both findings that were bugs are fixed in `683a41e`; judgement-call smells are recorded and left.

*Standards reviewer:*

> **Genuine correctness bug (hard).** `orderTargetsByChoice` does not honour Choice order when a Step's targets tie on barycenter. For each rank, every box's sort key is the mean cross-position of its parents; the "deal" then assigns the sorted `wanted` keys back to siblings in Choice order. When all siblings have only one parent (a plain branch — the commonest case), the keys are identical, the deal is a no-op, and the final sort falls back to insertion order. Probe (Start with Choices → a, b, c; steps keyed s, c, b, a): TB cross(a,b,c) 520 268 16, LR 224 120 16 — reverse of Choice order. AC 1 fails. The unit fixture masks it: `z` gives t1/t3 a second parent. Fix: break ties by choiceIndex, add a single-parent fixture with steps keyed out of Choice order. — **Fixed in 683a41e** (tie-break by Choice index before dagre's order; new test "puts targets that share their one parent in Choice order").
>
> **Documented standards.** Flaky policy: no retries, timeouts, skip/fixme added; the `fitWholeMap` in keyboard-navigation accommodates the shorter map, not a lost interaction — acceptable. CONTEXT.md vocabulary consistent; `EDGE_LABEL_*`/`data-edge-label` use "edge" following the file's existing React Flow naming — judgement call. `src/lib/graph/layout.ts` stays pure. `minZoom` change justified for Route: polish.
>
> **Baseline smells (judgement calls).** Repeated Switches: `direction === "LR" ? node.y : node.x` six-plus times across the pass, `followMovedBoxes`, and the tests — an `axes(direction)` helper would remove it (left as is). Duplicated Code: `hasStep ? id : missingNodeId(id)` three times — **extracted as `targetNodeId` in 683a41e**. Mysterious Name: `keys`, `wanted`, `readers` (left; commented). Speculative Generality (mild): the pass re-sweeps every box in a rank, beyond the ticket's rule; defended in the doc comment. `CanvasFlow` still receives `findStep`, `onAddStep`, `onSetLayoutDirection` via `{...props}` it no longer uses (left; shared props type).
>
> **Minor risk.** `followMovedBoxes` shifts multi-rank routes linearly without re-ordering dagre's dummy positions, so a long arrow can pass through a box that moved in a middle rank; `assertNoOverlaps` checks boxes only. Case-3 LR has no backward or self-loop Choice.

*Spec reviewer:*

> **(c) Implemented but wrong.** Choice order fails whenever siblings share only one parent — same finding, same probe. This is the ticket's headline case and recurs the moment an Author reorders Choices in the panel. — **Fixed in 683a41e.** Minor deviation: "earliest Step in map order" implemented as rank → Start-first → cross; defensible, document it — **documented in `[SCOPE CHANGE]` and the module comment.**
>
> **(a) Missing/partial.** "Pick the width from case-3's longest Choice": `EDGE_LABEL_MAX_WIDTH = 160` was picked to show about five words of that 90-character label, not to fit it; AC 5 only needs the label inside the gap, which is asserted. Flag for Paul. No spec read "Make another step the start first", so that bullet's spec work is moot.
>
> **(b) Not asked for.** `minZoom` 0.1 → 0.05; `<foreignObject>` label and the four spec locator edits it forced; `fitWholeMap` in keyboard-navigation; about 55 lines added to `canvas-step-actions` (covers AC 2–4). Moving "Find step" into the row is in scope. Everything else matches the ticket.

