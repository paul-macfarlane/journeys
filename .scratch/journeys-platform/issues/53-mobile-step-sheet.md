# 53: The Step panel as a sheet on narrow screens

Status: ready-for-agent
Blocked by: 48
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → 79 → **53** → 57 → 80; parked 44, 39, 45.
Route: polish

**Why:** Paul, 2026-09-23, item 7: "On mobile … editing a step in the canvas is a little inconvenient because you have to click then scroll down, I almost wonder if the step should slide up or a modal comes up. We should think through this at some point." Ticket 48 takes the cheap half (scroll the stacked panel into view); this is the rest.

**What is true today:** below `lg` (1024 px) `draft-editor.tsx` stacks the panel under a map that is at least 36 rem tall, so tablets and small laptops stack too, not only phones. `src/components/ui` has no sheet or drawer; adding shadcn's `sheet` (Base UI dialog) or `drawer` (vaul) is a lockfile commit, which is Paul's. The page-wide `dialogIsOpen()` guard matches any `role="dialog"`, so a dialog-based sheet would switch off Cmd/Ctrl+Z and Cmd/Ctrl+K while open, and ticket 26's unmount save runs when the panel leaves the tree.

**Decisions to settle before starting (think-through, Paul's words):**

- Sheet from the bottom, sized to the content with a drag handle, or a full-screen modal with a close button? A sheet keeps a strip of the map visible for orientation; a modal is simpler to make accessible.
- Which width switches: only phones (below `sm`), or everything that stacks today (below `lg`)? A tablet in landscape may prefer the side panel; measure before deciding.
- Does the sheet host the same `StepPanel` unchanged (one component, two containers), and how do undo, the command palette, and the unmount save behave while it is open?

**What to build (after the decisions):** the primitive, a `StepPanelHost` that picks the container from a media query, the `dialogIsOpen()` guard taught to ignore the sheet, and specs `canvas-phone-sheet` (375 × 667: tap a box, the sheet opens with the Step's title, edit the title, close, the box shows the new title) and a tablet check at the chosen boundary.

Acceptance criteria: completed after the decisions.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`); never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 7.

## Comments
