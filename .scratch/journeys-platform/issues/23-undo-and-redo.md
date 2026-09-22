# 23: Undo and redo in the Draft editor

Status: ready-for-agent
Blocked by: 22
Route: contract
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: after 22, before 17 (Paul, 2026-09-21).

**Why:** there is no undo in the editor. Cmd/Ctrl+Z inside rich text is Tiptap's own history; anywhere else it is the browser's native input undo, which replays old title values across Steps and, from the map, undoes nothing. Paul: "I'd expect undo to reset whatever action I just do"; a drawn Choice, a retarget, a delete, a direction switch, an Outcome change should each come back with one undo.

**Decisions (Paul, 2026-09-21):** one undo/redo over the whole document, with buttons on the canvas and the keyboard shortcuts.

**What to build:**

- **One history over the document.** `DraftEditor` keeps an undo stack and a redo stack of `{ document, selectedStepId }` snapshots (the document is one immutable value, so a snapshot is a reference). Every `applyEdit` pushes the state before the edit and clears the redo stack. Consecutive edits to the same text field (a Step title, a Choice label, an Outcome label, a Step's rich text) within 1 s of each other coalesce into one entry, so undoing typing restores the field in one step rather than a keystroke at a time. Cap at 100 entries. Not persisted; a Draft adopted from another Member's write or a restore clears both stacks.
- **Undo restores the whole edit.** Undo pops the stack, pushes the current state on the redo stack, sets the document through the ordinary save path (it autosaves like an edit), and opens the Step the undone edit belonged to — with no viewport move beyond ticket 22's "bring the box on if it is off the map". Redo is the mirror.
- **Rich text joins the one history.** `undoRedo: false` in the editor extensions (as the render-side already has), so Tiptap keeps no history of its own; content changes enter the document history coalesced like other typing, and the rich text surface is re-fed on undo through the existing `revision` mechanism.
- **Buttons and keys.** "Undo" and "Redo" buttons in the canvas's top-left panel beside "Add step", disabled when their stack is empty, with `aria-keyshortcuts`. Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z or Ctrl+Y redoes from anywhere on the Journey page — inside a text field or the rich text too, with the browser's native undo prevented, so there is exactly one undo — except while a dialog is open. The existing Cmd/Ctrl+K listener is the model; share its dialog guard.
- **Specs and docs.** README's editor paragraph; `CONTEXT.md` needs nothing.

Acceptance criteria:

- [ ] Seam A (pure): a history helper (`src/lib/graph/history.ts` or inside the editor's own module, pure and unit-tested) that pushes, coalesces same-field typing within the window, caps at 100, clears redo on a new edit, and round-trips undo/redo.
- [ ] Drawing a Choice by dragging, then Cmd/Ctrl+Z, removes the Choice (the `draft` row read back) and leaves the panel on the Step it was drawn from; Cmd/Ctrl+Shift+Z restores it.
- [ ] Typing "Clinic tent" into a Step title then one undo restores the previous title in one step; a second undo undoes the edit before that; typing after an undo clears redo (the Redo button is disabled).
- [ ] Undo of a rich text edit restores the previous content in the surface and the `draft` row; Cmd/Ctrl+Z pressed inside the title field undoes the document's last edit and never moves the panel to another Step unless that edit was on another Step.
- [ ] Deleting a Step, switching the layout direction, and retargeting a Choice each undo with one press; the Undo and Redo buttons on the canvas do the same and are disabled when nothing is left.
- [ ] Seam B: build a branch by dragging, undo three moves, redo two, publish what stands, walk it in the runner. Screenshots and a recording under `test-results/`.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's feedback after using the canvas, 2026-09-21.

## Comments
