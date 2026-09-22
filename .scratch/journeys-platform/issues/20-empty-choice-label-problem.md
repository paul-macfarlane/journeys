# 20: An empty Choice label is a publish problem

Status: ready-for-agent
Blocked by: 16
Route: contract
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: small; fits alongside 19 (Paul, 2026-09-21: "Yes, that should be a publish problem").

**Why:** since ticket 16 a Choice drawn on the map (or made with "Add next step") starts with an empty label, nothing stops a Draft with one from publishing, and the runner would render such a Choice as a link with no text and no accessible name. The canvas and the delete confirmation already read an empty label as "Untitled choice"; publishing should refuse it instead.

**What to build:**

- A new `validateForPublish` rule `empty-choice-label`: every Choice whose label is empty or whitespace-only yields a problem addressed by `stepId` and `choiceId` with the message `Step "<title>" has a choice with no label`, grouped after `dangling-choice-target` and before `unreachable-step`. Because it carries both addresses, `problemsByAddress` files it under the Step and the Choice with no further change, so it shows in the panel's Problems section, under the Choice's row, in the header count and live list, and as a mark on the arrow.
- Amend the spec's publish rule list ("every Choice has a label") with a `[SCOPE CHANGE]` on the spec naming this ticket; ADR-0001 needs nothing.
- The runner keeps rendering `choice.label` as is: a Published Version can no longer contain an empty one.

Acceptance criteria:

- [ ] Seam A: a document with one whitespace-only Choice label yields exactly one `empty-choice-label` problem with that Step's and Choice's ids; the three seeded documents still yield none.
- [ ] Seam B: dragging a Choice on the canvas shows the problem on the arrow, under the Choice row, and in the header count; typing a label clears all three; publishing while a label is empty is refused with the message in the Validation list.
- [ ] Spec `[SCOPE CHANGE]` recorded; README's publish sentence mentions labels if it lists the rules.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's answer to ticket 16's review question, 2026-09-21.

## Comments
