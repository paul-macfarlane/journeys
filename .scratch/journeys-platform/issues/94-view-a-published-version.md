# 94: Look at an older Published Version before restoring it

Status: in-progress
Blocked by: None
Owner: Claude (Opus 5.5), chunk 10 orchestrator, 2026-09-28
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract

**Why:** Paul, 2026-09-27, reading the guide's "Publish, restore, and Preview": "If I can restore an older version, I will probably need more information to make that decision. Perhaps a view only view and/or preview of that version." Today a row on the Versions tab offers only **Restore**, so a Member restores blind. Paul chose both: a read-only map and a Preview.

## What "fixed" means

- **View.** Each Published Version row on the Versions tab links to a read-only view of that Version. The view draws its map the way the canvas and Analytics do, laid out and fitted, with no Run counts. Selecting a Step shows its content, Choices, Prompt, and Outcome in a read-only panel. Nothing in the view can change the Draft or the Version.
- **Preview.** Each Published Version row also offers **Preview**. It walks that Version in the participant runner the way Preview walks the Draft, and records nothing: no Run, no Response.
- **Restore from where you look.** The view offers the existing Restore (the same `RestoreVersionDialog`, with the same stale-save guard from ticket 73), so a Member doesn't have to go back to the list.
- **An unreadable Version** (ticket 83) shows the existing cannot-be-read state in the view and in Preview, never a crash.
- Only Members reach either surface. Anyone else gets the same 404 the Journey page gives.

## Decisions to settle at the ticket's start

- Route shape: a Version segment under the Journey (`…/journeys/<id>/versions/<n>`) or a query on the Versions tab. The same question applies to Preview (`…/preview?version=<n>`).
- Whether the read-only map reuses the Analytics canvas with counts off, or the Draft canvas in a read-only mode. Prefer the one that adds less; ticket 86 is splitting those modules.
- Which Theme Preview of an old Version wears: the Theme as it is now, or as it was, if a Published Version snapshots it. Say which in the view.
- `CONTEXT.md`: **Preview** currently reads "An author walking the draft". Broaden it to "the draft or a published version" in this ticket.

## Acceptance

- An e2e spec publishes Version 1, edits and publishes Version 2, then opens Version 1's view: Version 1's Step titles and content are shown, and no control edits.
- Preview of Version 1 walks Version 1's text to an Ending, and the Journey's Run count is unchanged afterwards.
- Restore from the view puts Version 1's graph in the Draft.
- A signed-in non-Member gets a 404 for both the view and Preview.

## Comments

### 2026-09-28 — Claude, chunk 10 orchestrator

`[EXECUTION PLAN]` Chunk 10 is this ticket alone, on `feat/chunk-10-older-published-versions`, from one worktree.

**Decisions settled with Paul at the chunk's start (2026-09-28):**

- **Routes:** path segments. The view is `/projects/<p>/journeys/<j>/versions/<n>`, where `<n>` is the version number. Preview of it is `…/versions/<n>/preview` and `…/versions/<n>/preview/<stepId>`. The Analytics tab's `?version=` query is unaffected.
- **Map:** the Analytics canvas with its counts off. It gains Step selection, and a new read-only Step panel shows the selected Step. The Draft canvas is untouched.
- **Theme:** Preview of an older Version wears the Journey's Theme as it is now. A Published Version does not snapshot a Theme, and none is added. The view says so beside its Preview link. Paul first chose a snapshot, then withdrew it the same day.
- **`CONTEXT.md`:** Preview becomes "An author walking the draft or a published version in the participant runner."

**Deliverables (sequential, one worktree):**

- **D1 View.**
  - A by-number Published Version read in `src/db/versions.ts`.
  - The view route, with the same 404 as the Journey page and the cannot-be-read state for an unreadable row.
  - The Analytics canvas with counts optional and Step selection.
  - A read-only Step panel.
  - Restore through `RestoreVersionDialog`.
  - A **View** link on each Version row.
  - e2e for AC-1, AC-3, and the view half of AC-4, plus the unreadable view.
- **D2 Preview.**
  - Preview's loader and action take either the Draft or a Published Version.
  - The two Version Preview routes, which record nothing.
  - A **Preview** link on each Version row and on the view, with the Theme sentence on the view.
  - The `CONTEXT.md` change.
  - e2e for AC-2, the Preview half of AC-4, and the unreadable Preview.
- Sequential, because both edit `src/db/versions.ts` and `version-list.tsx`.

**Verification map** (`contract` route). Specs live in `e2e/version-view.spec.ts`, and every test writes one screenshot under `test-results/<test-name>/`:

| Criterion | Test / command | Evidence |
|---|---|---|
| AC-1 view shows Version 1, no control edits | `version-view` | screenshot + assertions |
| AC-2 Preview walks Version 1 to an Ending, Run count unchanged | `version-preview` (DB count of `run` rows before and after) | screenshot + assertions |
| AC-3 Restore from the view puts Version 1 in the Draft | `version-view-restore` (Draft row read back) | screenshot + assertions |
| AC-4 non-Member 404 for view and Preview | `version-view-not-member` | screenshot + assertions |
| Unreadable Version (ticket 83) in view and Preview | `version-view-unreadable` | screenshot |
| DoD | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then one full `pnpm test:e2e`; evidence run `E2E_EVIDENCE=version-view,version-preview,version-view-restore,version-view-not-member,version-view-unreadable` | `test-results/dod-1-commands.txt` |

Deployed check: a smoke on staging after Paul merges (open an older Version's view and Preview).
