# 46: Autosave for the title, description, and Theme forms

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon **46** → 47 → 48 → 49 → 38 → 50 → 51; 52 is grilled in its own thread and may squeeze in; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call; 17 and 39 stay where they are.
Route: polish

**Why:** Paul, 2026-09-23, item 2: "waiting for me to focus on another field can lead to refreshes or leaving the page and assuming a save happens when it really doesn't … the main priority for me is just making sure saves don't get lost. An indicator the text was saved could help too."

**What is true today (read on `staging` at `78a4e32`):** the Draft editor (`src/components/journeys/draft-editor.tsx`) already has the whole model: a 600 ms debounce after an edit, a flush when focus leaves the editor, a save on unmount, a `beforeunload` guard that fires a best-effort save and shows the browser's leave prompt, and a `role="status"` line reading "Saved", "Saving…", or "Unsaved changes". The metadata forms have none of it. `useBlurSavedForm` (`src/components/blur-saved-form.ts`) saves only on blur (Enter blurs a title field), shows only an error, and a refresh or tab close before blur drops the text silently. The forms on it: Journey title and description (`journey-title-fields.tsx`), Project title (`project-settings-fields.tsx`), Theme preset and accent (`theme-fields.tsx`). The rich-text Project description (`project-settings-fields.tsx`, its own refs) also saves only on blur. The static hint "Changes save when you leave a field" is not a status.

**Decisions (Paul, 2026-09-23, accepted the agent's recommendation):**

- The metadata forms adopt the Draft editor's model, not a new one: debounce while typing (the Draft's 600 ms is fine; a shared constant), flush on blur, save on unmount, guard `beforeunload` while an edit is unsaved, and one status line per form replacing the static hint. Words match the Draft's: "Saved", "Saving…", "Unsaved changes", and the existing "Couldn't save: …" on failure.
- The router refresh after a save runs only once typing is idle and nothing is left to write, as the Draft editor does, so a refresh never lands under a half-typed word. The existing adopt-server-values dance in the hook stays.
- Last write wins between two Members stays as it is (ticket 15, "Concurrent Draft writes" covers the Draft; the metadata forms get the same treatment there, not here).

**What to build:**

- **Hook.** `useBlurSavedForm` grows the timer, the flush, the unmount save, the unload guard, and a `status` it returns; consider renaming it (`useAutosavedForm`) since blur is no longer the trigger. The rich-text Project description either moves onto the hook or gets the same four behaviours through the same shared helper, whichever keeps the Tiptap `onChange` path simple; do not fork the logic.
- **Forms.** Journey title and description, Project title and description, Theme accent: the status line beside the fields, one per form, `role="status"`. Theme preset and the accent toggle already save on change; they only gain the status.
- **Specs.** New `metadata-autosave` in `e2e/projects-and-journeys.spec.ts`: type into the Journey description, never blur, wait for "Saved", reload, read the text back; type into the Project title, click straight to another tab or link (unmount), land, come back, read it back; type into the rich-text Project description and do the same. Reuse ticket 07's lesson: poll the row after "Saved" before reloading. `project-rename`, `journey-edit-and-delete`, and `themes-settings` follow the new status text where they waited on a blur.

Acceptance criteria:

- [ ] Typing into any Author metadata field and then reloading, closing the tab (after the browser prompt), or navigating within the app keeps the text, without the field ever being blurred.
- [ ] Each form shows "Saving…" while a write is in flight and "Saved" once it lands, and the old static hint is gone.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 2.

## Comments
