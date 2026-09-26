# 81: One autosave loop

Status: done
Blocked by: None
Owner: Claude Opus 5.5 (chunk 1, `feat/chunk-1-saves-and-unreadable-rows`)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish (no schema, auth, or route change; behaviour-preserving)

**Why:** ticket 72, finding W1. The Draft editor keeps its own copy of the autosave loop (`src/components/journeys/draft-editor.tsx:155-375`: `savingRef`, `queuedRef`, `timerRef`, `lastSavedRef`, `save`, `flushSave`, `applyDocument`'s debounce, the unmount save, and the `beforeunload` write). The metadata forms use the shared one (`createAutosave` in `src/lib/autosave.ts`, wrapped by `useAutosave` in `src/components/autosave.ts`). `src/components/autosave.ts:16` says so: "the Draft editor keeps its own copy of the same loop." Ticket 73 adds a terminal `stale` state to the loop. With two loops it is written twice and tested twice, so this ticket merges them first.

**What to build:**

- Widen the loop's `write` contract so it covers what the Draft editor needs today and what 73 will add. Today `write` resolves to a boolean (`src/lib/autosave.ts:69`). Change it to a result the loop can act on:
  `write(value: T, baseline: T) => Promise<{ kind: "saved"; saved?: T } | { kind: "refused"; error: string; stepId?: string }>`.
  `baseline` is the loop's `lastSaved`, the value the edit was made against. Nothing reads it until 73; it is here so 73 changes no signature. `saved`, when given, becomes `lastSaved`. This is how a write hands back server-owned state (73's Draft version). `refused` carries the Draft's `error` and `stepId`.
- The loop reports a refusal through a new `onRefused(result)` handler. The Draft editor uses it for `setSaveError` and to open the Step named by `stepId`. The metadata forms map it onto their field error, as `useAutosavedForm` does now.
- Move `DraftEditor` onto `useAutosave`. Keep its adopt rule. Today it adopts an incoming `draft` only when nothing is unsaved and no save is running (`draft-editor.tsx:314-326`), and it clears the undo history on adoption. Express that through `adopt` and the loop's `isDirty`, not a second set of refs.
- **Unload writes go through the loop** (72 finding W5). `unload()` (`src/lib/autosave.ts:190`) and the editor's `beforeunload` (`draft-editor.tsx:367`) call `write` directly, alongside any write already in flight. Route the unload write through the same single-flight path, or skip it when a write is in flight and let the in-flight write's queue carry the edit. Record which in the closeout.
- **Stable unmount save** (72 finding W6). The editor's "unmount" cleanup depends on `[clearTimer, save]`, and `save` changes identity with `router`, `projectId`, and `journeyId` (`draft-editor.tsx:240, 352-358`). A new `router` identity runs the cleanup mid-life. `useAutosave` already creates the loop once and runs `dispose` only on unmount; moving onto it fixes this. Keep a unit test that proves it.

Acceptance criteria:

- [ ] `draft-editor.tsx` holds no save loop of its own: no `savingRef`, `queuedRef`, `timerRef`, or `lastSavedRef`, and no direct `saveDraftAction` call outside the `write` handed to `useAutosave`.
- [ ] `src/lib/autosave.test.ts` covers the widened contract: a refusal with detail reaches `onRefused`, a `saved` value replaces `lastSaved`, `baseline` is the last saved value, and the unload write never runs beside an in-flight write.
- [ ] The existing Draft, undo/redo, canvas, and metadata specs pass unchanged, plus one full `pnpm test:e2e` at the end.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 72.

## Comments

### [CLOSEOUT] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 1, Route: polish within a contract chunk)

PR: https://github.com/paul-macfarlane/journeys/pull/101 (base `staging`, comparison SHA `ebb8178`), shared with tickets 73 and 83 (chunk 1). Status set to `done` in this commit; merging the PR is Paul's acceptance. State log: ready-for-agent → in-progress → ai-review → ready-for-human → done (this commit).

**Deliverable.** D1, one worker (opus): commit 03fd38e. Review follow-ups for the shared loop landed with 73's fixes (5adb888).

**Unload choice (asked for above).** `unload()` goes through the single-flight path. While a write is in flight it sets the loop's queue flag, so the running write goes round once more with the newest value, and returns true. Otherwise it starts the loop's save without waiting and returns true. It never calls `write` directly.

**Stable unmount (W6).** Proven by `src/components/autosave.test.tsx`: a re-render with new handler identities keeps the loop and writes nothing, and unmount writes the unsaved edit.

| Criterion | Verdict | Evidence |
|---|---|---|
| `draft-editor.tsx` holds no save loop of its own | PASS | `test-results/81-ac-1-no-own-loop.txt` (only the import and the call inside `write`) |
| `autosave.test.ts` covers the widened contract (refusal → `onRefused`, `saved` replaces `lastSaved`, `baseline` is the last saved value, no unload write beside an in-flight one) | PASS | `test-results/81-ac-2-autosave-unit.txt` (26/26 at e29037d) |
| Existing Draft, undo/redo, canvas, and metadata specs pass unchanged, plus one full `pnpm test:e2e` | PASS | `test-results/chunk-1-commands.txt` (120/120, 0 flaky) |

**Reviewer verdict.** The chunk's two AI readers found no defect in 81's slice. Two accepted deviations: a `refusedBySchema` ref tells a schema refusal from a server one in `useAutosavedForm`, and the adopt effect sets state from the ref it just wrote, to satisfy the React compiler lint.

**Verified run command.** `sh node_modules/.atlas-c1/run.sh sh chain.sh` (format:check, lint, typecheck, test, db:migrate, `E2E_EVIDENCE=… pnpm test:e2e`), every step `exit=0`.
