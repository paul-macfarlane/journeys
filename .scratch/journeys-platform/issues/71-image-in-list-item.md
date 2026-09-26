# 71: An image inside a list item is never silently dropped

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): **71** → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45. First because it is confirmed data loss and self-contained; it does not wait for 72.
Route: contract (the rich-text contract's editor side)

**Why:** ticket 68 finding 2 (reproduced twice on production) and ticket 15's "Rich-text contract gaps" (review finding F9, ticket 03). An image inserted while the cursor sits inside a list item shows in the editor as a figure inside the `<li>`, the panel reads "Saved", and the figure is gone when the Step is reopened. Cause: the stored content shape gives a list item paragraphs only, but `CaptionedImage` (`src/lib/rich-text/extensions.ts`) is still in the `block` group, so the editor admits it where the sanitizer drops it. Ticket 40 fixed the same trap for quotes by giving `ParagraphQuote` a group of its own.

**What to build:** make the editor's schema agree with the stored shape, so what the Author sees is what is saved.

- Inserting an image (toolbar, paste, or drop) while the selection is inside a list item places the image as a top-level block directly after the list, as a quote is placed; if the insertion path cannot do that cleanly, the Image control is disabled inside a list item with a tooltip saying why. Pick whichever keeps `extensions.ts` one schema for editor and sanitizer; record the choice in the `[CLOSEOUT]`.
- Pasting HTML with an `<img>` inside an `<li>` lifts the image out the same way rather than dropping it.
- Stored Drafts and Published Versions are unchanged: nothing is migrated, the sanitizer keeps dropping a nested image it is handed.

Acceptance criteria:

- [ ] Inserting an image with the cursor in a bullet or numbered list item leaves the image in the document after reopening the Step (e2e: insert, switch Steps, reopen, the figure is there) — or the Image control is disabled there, proven the same way.
- [ ] Pasting `<ul><li>text<img …></li></ul>` keeps the image as a top-level figure (unit test on the editor schema).
- [ ] Ticket 15's "Rich-text contract gaps" bullet is closed.

Verification follows `docs/agents/testing.md` (`contract`): the full command chain, one full `pnpm test:e2e` at the end, evidence for the one spec this ticket adds. Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 68 finding 2; ticket 15.

## Comments
