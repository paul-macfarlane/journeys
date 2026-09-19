# 08: Step and Choice editing

Status: ready-for-agent
Blocked by: 03
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** An Author edits a Journey's Draft without a canvas: a step list plus a side panel where they edit a Step's title and rich-text content (Tiptap; headings, bold, italic, lists, links, image by URL with required credit), add/reorder/retarget/delete Choices, create the target Step in the same motion as a Choice, designate the Start, manage the Journey's Outcomes, assign an Outcome to an Ending, delete a Step and see which Choices broke, and run validation on demand to see the problem list. Optional Prompt editing arrives in ticket 12. Draft autosaves; last write wins.

- [ ] Author builds a 6-step branching journey with two Endings and two Outcomes entirely through the panel; it publishes.
- [ ] Deleting a targeted Step shows the affected Choices; validation then lists the broken targets.
- [ ] Image insertion refuses to save without a credit; content saved is Tiptap JSON and renders identically in Preview.
- [ ] Choice reorder and retarget persist; "create new Step from this Choice" opens the new Step in the panel.
- [ ] Outcome rename keeps its id (Seam A) and the Ending's assignment.
- [ ] Seam B: build → validate (see a problem) → fix → publish.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
