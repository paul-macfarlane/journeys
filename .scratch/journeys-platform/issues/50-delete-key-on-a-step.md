# 50: The Delete key on a Step box

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (/implement, worktree `.claude/worktrees/50-delete-key/journeys`, branch `feat/50-delete-key`)
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

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish, from a worktree)

PR: https://github.com/paul-macfarlane/journeys/pull/60 (base `staging`, branched at `b093869`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** 520692a (the key on a box, the hoisted confirmation, `dialogIsOpen` shared, the spec and its evidence, ticket claimed), 1b9ffc2 (review tidy-ups: `aria-haspopup` on the toolbar's plain button, the confirmation forgotten once its closing has played, the spec drives the toolbar's button through the same dialog), 6994f81 (the spec fits the whole map before opening the lower box's menu), 1413608 (evidence and the DoD capture from the run on 6994f81), then this closeout.

**Verified run command (code at 6994f81):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=canvas-delete-key-step pnpm test:e2e` — every block `exit 0`; unit 510/510; e2e 101 passed in 1.8m, 0 flaky, retries 0. Worktree on `E2E_PORT=3150`, `journeys_e2e_50`, CI dummy env (no `.env.local`). `pnpm build` ran inside `pnpm test:e2e`; no migration. Three full runs in all: at 520692a, 101 passed in 2.1m; at 1b9ffc2, FAIL — 100 passed and `canvas-delete-key-step` failed in the section the review added, because `clickBox("Clinic tent")` found the lower box below the fold after the full-page screenshot (a spec fault, not the app's; the key path needs no click and had passed), fixed at the cause in 6994f81 by fitting the whole map first as the other specs do; then the cited run on 6994f81.

**TDD.** The spec was written first and run against the unchanged build: it failed at the first Delete on a focused box (no dialog), with the field and Start guards already passing; the implementation turned it green. No unit seam: the change is keyboard wiring in a `"use client"` React Flow component with no pure function worth extracting, and the repository has no component-level unit tests.

| Criterion | Verdict | Evidence |
|---|---|---|
| Delete or Backspace on a focused Step box opens the delete confirmation for that Step; confirming removes it and undo restores it | PASS | `canvas-delete-key-step`: Delete on "Clinic tent" opens the alertdialog naming "Find the clinic on Border pos"; Backspace opens it again; confirm removes the box and leaves a placeholder with one problem edge; Cmd/Ctrl+Z brings the box back and opens it in the panel; the toolbar's button opens the same dialog and Cancel returns focus to it; `test-results/canvas-delete-key-step/canvas-delete-key-step.png` (viewed: dialog over the map with the arrow in hand) |
| The Start ignores the key, and no key press inside a text field or an open dialog ever deletes a Step or a Choice | PASS | Same spec: Delete and Backspace on the focused Start open nothing, remove nothing, and keep focus; Backspace in the title field types ("Border pos") and no box goes; with the arrow selected in React Flow's store, Delete on the box leaves the arrow and Delete/Backspace inside the open dialog leave arrow and boxes alike (`onBeforeDelete` exercised) |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt` |

**AI review (one reader, both axes, diff `origin/staging...520692a`).** Approve with non-blocking findings. *Spec:* everything in "what to build" delivered, nothing beyond it; dropping `document`/`step` from the node data and moving `dialogIsOpen` are consequences of the hoist. *Correctness:* the design facts checked against the sources — React Flow's `useKeyPress` is a document bubble-phase listener that never reads `defaultPrevented`, so `stopPropagation` on the box is what keeps an arrow in hand; `deleteElements` routes through `onBeforeDelete`; Base UI's popup returns focus to the previously focused element with no trigger; `choicesTargeting` with the deleted id still lists the now-dangling Choices, so the list never flashes while the dialog closes; the hoist also fixes the old dialog unmounting mid-confirm because it lived inside the node it removed. *Findings:* (1) no spec drove the toolbar's now-plain button to the dialog — applied, the spec expands "Step actions", clicks "Delete step", cancels, and expects focus back on it; (2) the plain button lost the trigger's `aria-haspopup="dialog"` — applied; (3) nit: `requestDeleteStep` reads `dialogIsOpen()` off the DOM, so a Delete inside the 100 ms exit animation after Cancel is dropped, the same window that already drops Cmd/Ctrl+Z — left as is, recorded here; (4) nit: the closed confirmation stayed mounted for the page's life — applied via `onOpenChangeComplete`; (5) documented behaviour change: Delete on a focused Start or placeholder with an arrow in hand used to remove the arrow through React Flow's listener and is now swallowed, because a key acts on the box it was pressed on; the arrow itself still takes Delete.

**Deviations.** None from the ticket's decisions. The confirmation is hoisted to the canvas (the ticket's first option) rather than made a controlled `DeleteStepDialog`; the panel's dialog is untouched.

**Queued for Paul.** Nothing blocking. The worktree at `.claude/worktrees/50-delete-key/journeys` and its `journeys_e2e_50` database are left for removal after the merge.

**Next in Paul's order:** 51; 52 in its own thread; post-hackathon sweep 3 (41 → 42 → 44 → 45, 53).
