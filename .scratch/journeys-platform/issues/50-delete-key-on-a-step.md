# 50: The Delete key on a Step box

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon 46 → 47 → 48 → 49 → 38 → **50** → 51; 52 is grilled in its own thread and may squeeze in; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call. If Friday arrives first, this slides to post-hackathon.
Route: polish

**Why:** Paul, 2026-09-23, item 8: "hitting the delete key when a step or choice is focused on the canvas, should delete the step or choice."

**What is true today (read on `staging` at `78a4e32`):** half of it works. Delete and Backspace on a selected arrow remove that Choice through React Flow's `deleteKeyCode` and `onEdgesChange` (`journey-canvas.tsx`, `DELETE_KEYS`), and `canvas-arrow-select-and-delete` proves it. Step boxes are deliberately not selectable (ticket 22: "a selected node would also be one the Delete key took with it"), the box's key handler (`boxKeyDown`) knows only the arrows and Escape, so Delete on a focused box does nothing. Deleting a Step today goes through `DeleteStepDialog`, an `AlertDialog` that lists the Choices that would be left dangling, opened from "Step actions" or the panel foot; its open state is local to each instance. The Start can never be deleted (`deleteStep` refuses it).

**Decisions (agent, 2026-09-23, on Paul's "good with all of these decisions"; Paul may override in the PR):**

- Delete or Backspace on a focused box opens the same confirmation dialog the menu opens, so the key and the menu behave alike and the dangling Choices are still shown. Undo (ticket 23) already covers the delete itself; the dialog stays for the information, not for safety.
- On the Start the key does nothing, silently; the menu already offers no delete there.
- The key never fires from a text field, the ProseMirror editor, or while any dialog is open, following the `dialogIsOpen()` guard the undo listener uses.

**What to build:**

- `journey-canvas.tsx`: `boxKeyDown` handles Delete and Backspace by asking the parent to open the delete dialog for that Step; the dialog's open state is hoisted (or `DeleteStepDialog` takes a controlled `open`) so a key press and the menu share one instance per Step. `draft-editor.tsx` wires it through the existing `removeStep`.
- **Specs.** New `canvas-delete-key-step` in `e2e/canvas.spec.ts`: focus a box with a Choice pointing at it, press Delete, the dialog names the dangling Choice, confirm, the box is gone, Cmd/Ctrl+Z brings it back; Delete on the Start does nothing; Backspace inside the panel's title field deletes a character and no Step (the existing input guard at the arrow test's end shows the pattern).

Acceptance criteria:

- [ ] Delete or Backspace on a focused Step box opens the delete confirmation for that Step; confirming removes it and undo restores it.
- [ ] The Start ignores the key, and no key press inside a text field or an open dialog ever deletes a Step or a Choice.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 8.

## Comments
