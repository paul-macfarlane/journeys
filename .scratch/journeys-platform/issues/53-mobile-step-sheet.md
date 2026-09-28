# 53: The Step panel as a sheet on narrow screens

Status: ready-for-agent
Blocked by: 48
Owner: Claude (Fable 5.1), chunk 7 orchestrator, 2026-09-27 (starts after 86 closes)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** Paul, 2026-09-23, item 7: "On mobile … editing a step in the canvas is a little inconvenient because you have to click then scroll down, I almost wonder if the step should slide up or a modal comes up. We should think through this at some point." Ticket 48 takes the cheap half (scroll the stacked panel into view); this is the rest.

**What is true today:** below `lg` (1024 px) `draft-editor.tsx` stacks the panel under a map that is at least 36 rem tall, so tablets and small laptops stack too, not only phones. `src/components/ui` has no sheet or drawer; adding shadcn's `sheet` (Base UI dialog) or `drawer` (vaul) is a lockfile commit, which is Paul's. The page-wide `dialogIsOpen()` guard matches any `role="dialog"`, so a dialog-based sheet would switch off Cmd/Ctrl+Z and Cmd/Ctrl+K while open, and ticket 26's unmount save runs when the panel leaves the tree.

**Decisions to settle before starting (think-through, Paul's words):**

- Sheet from the bottom, sized to the content with a drag handle, or a full-screen modal with a close button? A sheet keeps a strip of the map visible for orientation; a modal is simpler to make accessible.
- Which width switches: only phones (below `sm`), or everything that stacks today (below `lg`)? A tablet in landscape may prefer the side panel; measure before deciding.
- Does the sheet host the same `StepPanel` unchanged (one component, two containers), and how do undo, the command palette, and the unmount save behave while it is open?

**What to build (after the decisions):** the primitive, a `StepPanelHost` that picks the container from a media query, the `dialogIsOpen()` guard taught to ignore the sheet, and specs `canvas-phone-sheet` (375 × 667: tap a box, the sheet opens with the Step's title, edit the title, close, the box shows the new title) and a tablet check at the chosen boundary.

Acceptance criteria (settled with Paul, 2026-09-27; see Comments):

- [ ] Below `sm` (640 px) selecting a Step on the map opens the panel as a bottom sheet (`StepPanelHost`) hosting the same `StepPanel`; the sheet has a grab-handle strip and a Close button, is sized to its content up to about 85% of the viewport, and leaves a strip of the map visible above it.
- [ ] Closing the sheet is `hidePanel`: the unmount save runs and the box shows the edit. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z work while the sheet is open; Cmd/Ctrl+K stays off while it is open.
- [ ] At and above `sm` nothing changes: the tablet check at 768 px proves the stacked panel and ticket 48's scroll are still used, and the side-by-side layout above `lg` is untouched.
- [ ] Specs `canvas-phone-sheet` (375 × 667: tap a box, the sheet opens with the Step's title, edit the title, close, the box shows the new title) and `canvas-tablet-stacked-panel` (768 px) pass, plus the chunk's one full `pnpm test:e2e`.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`); never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 7.

## Comments
### 2026-09-27 — Claude, chunk 7 orchestrator

Decisions settled with Paul at the chunk's start (chunk rule):

- **Container:** a bottom sheet on the installed Base UI Dialog (`@base-ui/react`), styled as a sheet in `src/components/ui/sheet.tsx`. No new dependency, so no lockfile commit. Not vaul, not a full-screen modal.
- **Boundary:** phones only, below `sm` (640 px). Tablets and small laptops keep today's stacked panel with ticket 48's scroll-into-view.
- **Shortcuts:** the `dialogIsOpen()` guard learns to ignore the sheet for undo and redo, so an edit made in the sheet can be undone in place; Cmd/Ctrl+K stays off while the sheet is open, because Find step would open behind a modal. The sheet hosts the same `StepPanel` unchanged (one component, two containers); closing it is `hidePanel`, so ticket 26's unmount save already runs.

Owner recorded now; work starts after ticket 86's closeout, per the chunk rule.
