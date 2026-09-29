# 94: Look at an older Published Version before restoring it

Status: ready-for-agent
Blocked by: None
Owner:
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
