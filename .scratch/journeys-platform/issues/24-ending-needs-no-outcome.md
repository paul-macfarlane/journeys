# 24: An Ending needs no Outcome

Status: in-progress
Blocked by: 22
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-22
Parent: `.scratch/journeys-platform/spec.md`
Priority: **next** after the harness simplification (Paul, 2026-09-21: "fix the current bug with the journeys where it is requiring an outcome that can't be set" before any canvas polish). Then 25 → 26 → 27 → 10 → 28 → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: contract

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

### [EXECUTION PLAN] 2026-09-22 — Atlas orchestrator (Claude Fable 5.1)

Route: contract. Run surface: local + deployed (deployed = post-merge smoke on staging, a human gate outside this PR's acceptance). Repository delivery: `journeys` on `feat/24-ending-needs-no-outcome`, comparison SHA `4d4f2fc` (staging). Direct checkout, no worktrees: the two deliverables run sequentially, and a parallel worktree would need `node_modules` for the husky/lint-staged commit hook for a gain of a few minutes against D2's full e2e run. Predicted file sets do not overlap (D1: `CONTEXT.md`, `README.md`, `.scratch/**`; D2: `src/**`, `e2e/**`, `test-results/**`); re-checked at closeout.

**Deliverables (sequential, D1 → D2):**

- **D1 — Docs and spec amendments** (worker: claude-sonnet-5). `CONTEXT.md` Ending entry; `spec.md` `[SCOPE CHANGE]` (story 26 withdrawn; 33 and 37 amended; publish-time validation paragraph and unit-test list amended); `10-analytics.md` untagged-Ending note; README editor and runner paragraphs. No code; no seam to test-drive.
- **D2 — Rule removal, runner ending screen, and every spec that leaned on the rule** (worker: claude-opus-5). `validate.ts` + `validate.test.ts` + `layout.test.ts`; `step-view.tsx`; `e2e/publish.spec.ts` (refusal leg rewritten to a dangling Choice target via `writeDraftDocument`; new `publish-untagged-ending` spec that publishes a brand-new Journey and walks it to "The end" with no "Outcome:" line); `e2e/step-editing.spec.ts`; `e2e/canvas.spec.ts` (`canvas-content-peek`, `canvas-validation-marks`, `canvas-problems-readable`, and any initial-count assertion). Evidence captured and committed by the same worker.

**Verification map (resolved against `docs/agents/testing.md`, contract route):**

| Criterion | Command / action | Surface | Real deps | Expected | Evidence | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|---|---|---|
| AC-1 Seam A | `pnpm test` (whole unit suite; `validate.test.ts` carries the new "accepts an Ending with no Outcome" case and the unchanged rule cases) | local, Vitest | none | all green; no `ending-without-outcome` anywhere in `src/` | `test-results/ac-1-validate-unit.txt` | D2 integrated | any change under `src/lib/graph/` |
| AC-2 brand-new Journey | `pnpm test:e2e` → `canvas-problems-readable` (reads "No problems" on load, `data-problems="0"`, no Step problems region) and `publish-untagged-ending` (Publish succeeds; Participant walks to "The end"; no "Outcome:" text) | local, Playwright vs production build on :3100 | `journeys_e2e` Postgres (docker :5436) | both specs pass | `test-results/canvas-problems-readable/*.png`, `test-results/publish-untagged-ending/*.png`, run summary in `test-results/dod-1-commands.txt` | D2 integrated | any change under `src/`, `e2e/` |
| AC-3 tagged Ending still shows its Outcome | `pnpm test:e2e` → existing `runner.spec.ts` and `preview.spec.ts` assertions on "Outcome: …" | as AC-2 | as AC-2 | pass | run summary in `test-results/dod-1-commands.txt` (existing `test-results/preview/` left as the last work package left it) | D2 integrated | change to `step-view.tsx` or runner routes |
| AC-4 docs | `grep -n` over `CONTEXT.md` (no "exactly one outcome"), `spec.md` (new `[SCOPE CHANGE]`), `10-analytics.md` (untagged-Ending note), README | local, static | none | expected strings present / absent | `test-results/ac-4-docs.txt` | D1 integrated | any edit to those files |
| AC-5 every existing canvas, draft, step-editing, publish, preview, runner spec passes | one full `pnpm test:e2e` at the end (0 retries; a flaky run is a FAIL) + CI on the PR | as AC-2 | as AC-2 | all specs pass, no flaky | `test-results/dod-1-commands.txt`; PR CI | D2 integrated | any change under `src/`, `e2e/` |
| DoD-1 command chain | `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (which builds; no schema change so `db:migrate` is not in play) | local | as above | all exit 0 | `test-results/dod-1-commands.txt` | D2 integrated | any change |

Human gates: none before the PR. Announced for later: post-merge staging smoke (walk a one-Step Journey on staging and read "The end" with no "Outcome:" line) — Paul, after merging.
