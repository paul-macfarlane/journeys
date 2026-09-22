# 24: An Ending needs no Outcome

Status: ready-for-agent
Blocked by: 22
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: small; slot anywhere after 22 merges (Paul, 2026-09-21).

**Why:** After ticket 22 Paul asked how a Step becomes a final Step with an Outcome. The answer is that an Ending is implicit — any Step with no Choices (`isEnding`) — and Paul is fine with that. What he is not fine with is the publish problem `Ending "…" has no outcome`: an Ending is an outcome in itself, and an Author who does not group their Endings should not be blocked from publishing. This ticket removes that rule and everything that leans on it.

**Decisions (Paul, 2026-09-21):** an Ending stays "any Step with no Choices" — no explicit "make this an ending" move and no stored flag. An Ending may carry an Outcome or not; an Outcome is a grouping for analytics, never a requirement. Spec story 26 ("every Ending to require exactly one Outcome") is withdrawn; stories 33 and 37 lose their "Endings missing an Outcome" clause; `[SCOPE CHANGE]` recorded in `spec.md` by this ticket's plan commit.

**What to build:**

- **Validation.** Remove the `ending-without-outcome` rule and its code from `validateForPublish` and `PublishProblemCode` in `src/lib/graph/validate.ts`. Keep `unknown-outcome` (an Ending tagged with an Outcome the document no longer defines is still broken data). The module doc comment and the rule list follow. `validate.test.ts`: the "reports an Ending with no Outcome" case becomes "accepts an Ending with no Outcome" (a one-Step Draft publishes clean); the expected-code lists in `validate.test.ts` and `layout.test.ts` drop the code.
- **Runner.** The ending screen (`src/components/runner/step-view.tsx`) shows the "Outcome: <label>" line only when the Ending carries one; nothing is shown for an untagged Ending — "No outcome yet" was authoring state leaking to a Participant. `run.ts`/`run.test.ts` already treat the Run's outcome id as optional; confirm, do not change.
- **Editor.** Nothing changes in the panel or on the map: the Outcome field stays on every Ending as ticket 22 built it, "No outcome" stays its empty value, the box keeps its "Ending" badge and its "No outcome" text. The problem count, the peek, and the Step problems list simply no longer carry the rule.
- **Analytics (note for ticket 10, not built here).** Add one line to `10-analytics.md`: the Runs-by-Outcome chart groups untagged Endings each by its own Step title, so "40% reached 'Turned back'" still reads.
- **Specs.** Every spec that relied on the rule is rewritten to a problem that still exists, never skipped: `e2e/publish.spec.ts` (the refusal leg uses a dangling Choice target written to the `draft` row via `writeDraftDocument`, or an unreachable Step); `e2e/step-editing.spec.ts` (the two "has no outcome" expectations go; the surrounding assertions on the problems list use what remains); `e2e/canvas.spec.ts` `canvas-content-peek` ("Empty tent" carries one problem, the unreachable one) and `canvas-problems-readable` (the brand-new Draft has no problem; make one — an "Add step" that nothing leads to — and read it on the panel, in the header count, and in the live list); `canvas-validation-marks` if it counted the rule. A brand-new Journey now reads "No problems" on load, which `canvas-step-actions`, `canvas-node-opens-panel-and-edge-appears`, and any other test asserting the initial count must follow.
- **Docs.** `CONTEXT.md` Ending: "A step with no choices. It may carry an outcome that groups it for analysis; one without is an ending on its own." `spec.md`: the `[SCOPE CHANGE]` (story 26 withdrawn; 33 and 37 amended; the publish-time validation paragraph and the unit-test list amended). README's editor paragraph: "tag an ending with an outcome if you want endings grouped" in place of any wording that implies a requirement; the runner paragraph, if it names the outcome line.

Acceptance criteria:

- [ ] Seam A: a one-Step Draft (the Start, no Choices, no Outcome) validates with no problems; an Ending tagged with an Outcome the document does not define still reports `unknown-outcome`; every other rule is unchanged (the existing cases pass).
- [ ] A brand-new Journey's page reads "No problems" on load with no mark on its box and an empty Step problems list; publishing it succeeds and the runner walks its one Step to "The end" with no "Outcome:" line.
- [ ] An Ending tagged with an Outcome still shows "Outcome: <label>" on the runner's ending screen (the existing runner spec).
- [ ] `spec.md` carries the `[SCOPE CHANGE]`, `CONTEXT.md`'s Ending entry no longer says "exactly one outcome", and `10-analytics.md` carries the untagged-Ending note.
- [ ] Every existing canvas, draft, step-editing, publish, preview, and runner spec passes.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's feedback on PR #26, 2026-09-21.

## Comments
