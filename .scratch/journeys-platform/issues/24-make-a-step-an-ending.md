# 24: Make a Step an Ending

Status: needs-triage
Blocked by: 22
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: small; slot anywhere after 22 merges (Paul, 2026-09-21: "We should go for something simple").

**Why:** After ticket 22 Paul asked how to make a Step a final Step with an Outcome. Today an Ending is only ever implicit — a Step with no Choices (`isEnding`) — so a new Step is already an Ending and its Outcome field sits at the foot of the panel, but nothing in the panel says so or invites the tag, and a Step that has Choices can only become an Ending by removing each Choice by hand. The map's "Ending" badge is the only place the word appears.

**Decision to confirm (Paul):** "Make this an ending" removes every Choice on the Step, behind a confirmation that names them. The alternative — a stored "is an ending" flag that hides the Choices — changes the document contract (ADR-0001) and the runner, and is not the simple thing.

**What to build:**

- **An "Ending" section, always in the panel,** beneath the Choices and above the footer, with a small heading "Ending".
  - When the Step has no Choices: the line "This step is an ending — participants stop here." and the Outcome field (the ticket 22 combobox and its "Rename" button move into this section unchanged).
  - When the Step has Choices: the line "Participants walk on from this step." and one `Button` (`variant="outline" size="sm"`) "Make this an ending".
- **"Make this an ending"** opens a confirmation dialog in the shape of `delete-step-dialog.tsx` — title "Make this step an ending?", the sentence "Its choices will be removed:", the Choices listed by label (`choiceLabel`) and target title, Cancel / "Make this an ending" — and on confirm applies a new pure edit `makeEnding(document, stepId): GraphDocument` in `src/lib/graph/edit.ts` (identity when the Step is missing or already an Ending; otherwise the Step with `choices: []`, nothing else touched), then focuses the Outcome field so the tag is the next thing typed. Seam A cases in `edit.test.ts`.
- **Nothing on the map** changes: the box's "Ending" badge already follows `isEnding`, the "Step actions" toolbar gains no move.
- **Docs:** `CONTEXT.md`'s Ending entry gains "made from the panel's Ending section, which removes the step's choices"; README's editor paragraph gains one clause.

Acceptance criteria:

- [ ] On a Step with two Choices, the panel's Ending section reads "Participants walk on from this step." and offers "Make this an ending"; clicking it lists both Choices by label and target in the confirmation; confirming empties the Choices list, the box gains the "Ending" badge, the Outcome field is focused, and the `draft` row read back holds no Choices on that Step and every other Step unchanged.
- [ ] Cancelling the confirmation leaves the Choices and the `draft` row unchanged.
- [ ] A Step made by "Add next step" opens with the Ending section reading "This step is an ending — participants stop here." above the Outcome field.
- [ ] Adding a Choice to an Ending turns the section back into "Make this an ending"; the Outcome field is gone until the Step is an Ending again.
- [ ] Seam A: `makeEnding` empties the Choices, is identity on a missing Step and on an Ending, and touches nothing else.
- [ ] Every existing canvas, step-editing, draft, and publish spec passes.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's feedback on PR #26, 2026-09-21.

## Comments
