# 48: Canvas polish — feedback round 4

Status: done
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

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish, from a worktree)

PR: https://github.com/paul-macfarlane/journeys/pull/55 (base `staging`, branched at `78a4e32`, staging merged in at `c876d4e`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** 1ddf106 (toggle, layout labels, stacked-panel scroll, specs), edc6fd1 (review fixes: overflow labels outside the pair, cluster-centred spread, aligned move only between neighbouring ranks, grid's own media query, shared `labelPoint`), then evidence, then this closeout.

**Verified run command (code at edc6fd1):** `pnpm lint && pnpm typecheck && pnpm test && E2E_EVIDENCE=canvas-dark-controls,canvas-lr-labels-apart,canvas-stacked-panel-scroll pnpm test:e2e` — every block `exit status: 0`; unit 492/492; e2e 99 passed in 2.1m, 0 flaky, retries 0, load average 3–5. Worktree on `E2E_PORT=3148`, `journeys_e2e_t48`, dummy env (no `.env.local`). `pnpm build` ran inside `pnpm test:e2e`; no migration.

| Criterion | Verdict | Evidence |
|---|---|---|
| The selected direction is visibly marked on the editor and the Analytics tab in light and dark | PASS | `canvas-dark-controls` reads the checked and unchecked radios' painted backgrounds (one-pixel canvas) in the light theme and in the dark theme under both OS schemes and asserts they differ; the shared `DirectionControl` serves both maps; `test-results/canvas-dark-controls/canvas-dark-controls.png` (viewed) |
| Two Choice labels from one Step never overlap in either direction | PASS | `canvas-lr-labels-apart` reads both label chips' boxes top to bottom and left to right and asserts no shared area, `test-results/canvas-lr-labels-apart/canvas-lr-labels-apart.png` (viewed); `layout.test.ts` "edge labels": centres ≥ a label height apart in LR and ≥ a label width apart in TB, label box inside the gap, the swap case, three parallel Choices without overlap, and dagre's two routes unchanged by a third |
| Below the stacked width, clicking a box brings the Step panel into view | PASS | `canvas-stacked-panel-scroll` at 800×900: panel top ≥ 900 before the click, inside the viewport and under the sticky tab row after; `test-results/canvas-stacked-panel-scroll/canvas-stacked-panel-scroll.png` (viewed, viewport only) |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt` |

**AI review (one reader, both axes, `/code-review`, diff `origin/staging...1ddf106`).** *Standards:* no hard violations; smells noted as judgement calls — the duplicated label-point hunk in the two maps (fixed: `labelPoint` in `canvas-shared.ts`), repeated `direction === "LR"` axis switches across the layout helpers (accepted; the file's existing `orderTargetsByChoice` already reads that way, and one `axes()` helper is a refactor for its own ticket), the `{ shift, cross }` clump and `-1` as two sentinels (accepted). *Correctness:* one real find, reproduced on seeded case-3 TB `step-14 → step-22`: the 28-unit overflow nudge put a third label inside the spread's 168 minimum, and the one-way sweep pushed dagre's own label and route 159 units past the box. Fixed in edc6fd1: an overflow label goes outside the pair dagre placed (LR) or in the clearance below and above (TB), the spread centres each conflicting run about its own middle, and a unit test pins dagre's two routes as identical with and without the third Choice. Also fixed from the review: the aligned move is limited to routes between neighbouring ranks (a longer route's dummies lean as before, so a whole shift cannot carry one into a box dealt beside it); the label point is matched with a tolerance rather than float equality; the scroll reads the grid's own `(width >= 64rem)` query, so an engine that cannot read range syntax answers the same way for the grid and the scroll. *Spec:* the reviewer read the outline→secondary switch as compliant with the toggle decision (no `!important`, no `.dark` rule; the unchecked radio now paints `bg-secondary`, within the decision's latitude). Flagged and recorded below: the per-rank spread as a nudge after the fact, and the arrow click also scrolling.

**Deviations.** (1) The decision "labels get room from the layout, not from a nudge after the fact" is met for dagre's own placement; `spreadLabels` remains as a safety net for what the repo's own Choice-order post-pass undoes after dagre has spoken (a label lined up with its source meeting one lined up with a target dealt under that source). It never moves a label dagre placed that the deal left alone, and it is exercised only through the deal and the overflow case. (2) Label placement is threaded through `ChoiceEdge`'s `data.labelAt` rather than `arrowPoints`, whose job (the anchor-to-anchor route) is unchanged. (3) An arrow click scrolls the stacked panel as a box click does: the same map gesture with the same complaint. (4) `TB_RANK_SEPARATION` 96 → 72 and `LR_RANK_SEPARATION` 208 → 48 keep the visible gaps at 96 and 208 now that dagre reserves the label itself. (5) The Tailwind `dark` custom variant is emitted after `aria-checked`, so on the outline variant a plain `aria-checked:bg-primary` loses in dark; the radios use the secondary variant, which carries no dark background, instead of a `dark:` stack. (6) Overflow (third and later parallel) Choices are nudged across the map's direction rather than always on x, a fix in passing so left-to-right overflow arrows sit beside their sibling.

**Queued for Paul (non-blocking).** The `worktree-…` housekeeping does not apply this time (plain `git worktree add`), but the worktree at `.claude/worktrees/48-canvas-polish/journeys` and its `journeys_e2e_t48` database are left for removal after the merge.

**Next in Paul's order:** 49, then 38 → 50 → 51; 52 in its own thread.
