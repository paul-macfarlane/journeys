# 81: One autosave loop

Status: ready-for-agent
Blocked by: None
Owner:
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
