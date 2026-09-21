# 18: Allow cycles

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: first of the graph tidy-up series (Paul, 2026-09-21): 18 → 16 → 19 → 17.

**Decision (Paul, 2026-09-21):** cycles are allowed. "As long as we have a fix, we shouldn't limit users." This amends the spec's publish rule "the graph has no cycles" and its "Back navigation" section, and `decisions.md`'s "publish-time validation rejects cycles". Record the amendment as a `[SCOPE CHANGE]` on the spec and write `docs/adr/0002-cycles-and-back-navigation.md` as part of this ticket.

**Why the rule existed:** a Run's path is one linear route and the runner classifies a navigation by whether the target Step is already on the path (not on it → forward Choice, on it → backtrack). That only works if a Step appears at most once, which the no-cycles rule guaranteed; ticket 06 leaned on it again to resolve Choices taken from cached Back pages. Four legacy Choices were dropped in ticket 04 because of it.

**What to build:**

1. **Path with repeats and a position.** The Run's path keeps every visit, repeats included; the runner's notion of "current" is the last entry. Resolution of a navigation to Step X, in order: (a) X is a Choice target of the current Step → forward, append; (b) X is on the path → backtrack, truncate to its **latest** occurrence and count a backtrack; (c) otherwise refused, redirect to the current Step. Case (a) is checked before (b) so closing a loop by choosing is a forward move. Browser Back on a loop-closing Step is the one ambiguous case (X is both the previous entry and a Choice target): the runner writes the path index into `history.state` on every step page, and a navigation that arrives with an index earlier than the current one is a backtrack to that index, not a Choice. Cap the path at 500 entries; a forward move past the cap is refused with a short participant-facing message.
2. **Reducer.** `src/lib/graph/run.ts` implements the above; its doc comment stops citing the no-cycles guarantee. Seam A: a 2-cycle (A ⇄ B) walked forward three times yields a path of four; Back from the loop-closing Step truncates by index; a step URL for a Step both earlier on the path and a current Choice takes the Choice; the cap refuses the 501st entry; every existing case still passes.
3. **Validation.** Drop the `cycle` rule from `validateForPublish`, its `PublishProblemCode` member, and its Seam A cases; the canvas stops marking cycles automatically (`problemsByAddress` needs no change). Update the spec's rule list (story 37 stays as written; the "no cycles" sentence goes).
4. **Legacy journeys restored.** Put back the four dropped Choices in `scripts/seed/journey-stories/`: case-1 `step-46` "Detention 1" [Yes] → `step-1`; case-2 `step-19` "Call Sponsor" [Call the legal organization] → `step-2`, `step-27` "I quit!" [Call your bunkmate's cousin's friend] → `step-32`, `step-52` "ER" [Go home, and try again later] → `step-53`, each with its legacy label verbatim and in its legacy position among the Step's Choices (check `~/Code/journey/src/data/cases/case-{1,2}.json`). Case-1 `step-32` "Detention" stays omitted (unreachable in the legacy data itself, nothing to do with cycles). Update the Seam A counts in `validate.test.ts` (case-1 70 Choices, case-2 105) and the README's "Four choices and one step were left out" bullet to say one Step was left out and why.
5. **Analytics contract note** for ticket 10: paths may repeat a Step; abandonment counts the last entry only; choice take-rate counts each traversal.

- [ ] Seam A: the reducer cases in item 2, and `validateForPublish` returns `[]` for a document with a 2-cycle.
- [ ] Seam A: the three seeded documents validate; case-1 has 70 Choices and case-2 105; `step-46`, `step-19`, `step-27`, `step-52` carry the restored Choices with the legacy labels.
- [ ] Publishing a Draft with a loop succeeds.
- [ ] Seam B (`e2e/runner.spec.ts`, new test `runner-loop-and-back`): a published 3-Step Journey with a loop; choose around the loop twice (path length grows), press browser Back (path truncates to the previous index, backtrack count 1), choose the loop again (forward), reach the Ending; the `run` row's path matches. Screenshot under `test-results/`.
- [ ] Seam B: seeding case 2 and walking "I quit!" → "Call your bunkmate's cousin's friend" in the runner lands on `step-32`.
- [ ] ADR-0002 written; spec `[SCOPE CHANGE]` recorded; README updated.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's decision on 2026-09-21 after the canvas feedback.

## Comments
