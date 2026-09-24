# 46: Autosave for the title, description, and Theme forms

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (branch feat/46-metadata-autosave)
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

- [x] Typing into any Author metadata field and then reloading, closing the tab (after the browser prompt), or navigating within the app keeps the text, without the field ever being blurred.
- [x] Each form shows "Saving…" while a write is in flight and "Saved" once it lands, and the old static hint is gone.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 2.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/54 (base `staging`, comparison SHA `70f2998`; branched from `chore/round-4-tickets` so this ticket file is in history — once PR #53 merges the diff is this ticket's alone). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** 353668a (the loop in `src/lib/autosave.ts` with 11 clock-driven unit tests, `useAutosave`, `useBlurSavedForm` → `useAutosavedForm`, the five surfaces, the new spec and the three amended ones), 5a477bc (review fixes: mid-write adoption no longer strands "Saving…" and gained a twelfth unit test, records compare as the schema stores them so a trailing space is not written twice, `onSaved` on every layer, `Record` no longer shadowed, "Saving…" proved by holding the server action), 9295ee4 (canvas and step-editing specs scope their "Saved" wait to the Editor tab panel — the Journey header has a status line now), 671bc4b (evidence).

**Verified run command (code at 9295ee4):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=metadata-autosave,project-rename,journey-edit-and-delete,themes-settings pnpm test:e2e` — `test-results/dod-1-commands.txt`. Lint, typecheck exit 0; unit 498/498; e2e **98 passed in 1.9 min, 0 flaky, retries 0** (`dod-1-e2e.txt`). `pnpm format:check` exited 1 locally on Paul's untracked "Round 3 regression feedback.md" at the repo root only; `git ls-files | prettier --check` exit 0, recorded in the same capture. No build step of its own (`pnpm test:e2e` builds); no migration.

| Criterion | Verdict | Evidence |
|---|---|---|
| Typing into any metadata field and then reloading, closing the tab (after the prompt), or navigating within the app keeps the text, without the field ever being blurred | PASS | `metadata-autosave`: Journey description filled and never blurred (field asserted still focused), "Saved", row polled, reload reads it back; the leave guard asked directly — a synthetic `beforeunload` is cancelled while unsaved and not once saved (the real prompt is what the browser draws on the guard's `preventDefault`, as the Draft's is; a test cannot read it); Project title and rich-text description typed into then the tab switched at once (unmount), rows polled, read back after coming back; `test-results/metadata-autosave/metadata-autosave.png` (viewed) |
| Each form shows "Saving…" while a write is in flight and "Saved" once it lands, and the old static hint is gone | PASS | `metadata-autosave` holds the Journey title's server action with a route and reads "Unsaved changes" → "Saving…" → (released) "Saved"; `project-rename`, `journey-edit-and-delete`, `themes-settings` read "Saved" on their forms; `grep` finds no "Changes save when you leave a field" |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt`, `dod-1-e2e.txt` |

**AI code review** (one pass, two readers over `70f2998...353668a`: standards with the smell baseline, and spec conformity). Standards: no documented-standard breach; smells raised — the Draft editor still carries its own copy of the loop (out of the ticket's scope, left as a follow-up), the `.catch → "the server could not be reached"` shape repeats across three files (pre-existing pattern, left), `Record` shadowing in the test (fixed), `onSettled`/`onSaved` naming (fixed), `startAutosave` as a middle man (kept: a ref there trips the React compiler's "ref read during render" lint; the JSDoc says so). Correctness: adopt-during-write stranding "Saving…" (fixed, unit-tested); duplicate write after a trailing space (fixed); the unload write going through the async resolver (left: it starts within the same task as the event, and the spec's guard step polls the row after it). Spec: all four behaviours and a status line on every named surface, no scope creep beyond the unit tests; "Saving…" was unproven (now proved by the held write); evidence was uncommitted (now 671bc4b); a zod-refused edit stays "Unsaved changes" and keeps the leave prompt (intended: the old hook dropped it silently).

**Deviations.** None from the contract. Not done, by the ticket's own scoping: the Draft editor was not moved onto the shared loop.

