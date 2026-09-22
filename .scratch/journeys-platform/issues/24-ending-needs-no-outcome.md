# 24: An Ending needs no Outcome

Status: done
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

### [AI CODE REVIEW] 2026-09-22 — Atlas orchestrator (Claude Fable 5.1); two fresh Opus reviewers read the diff `4d4f2fc..9cf6bf8`, the orchestrator adjudicated

**Axis 1 — technical implementation and spec conformity.** Confirmed clean: `unknown-outcome` unchanged in code, message, and Step id; rule grouping and Step order preserved; nothing switches on `PublishProblemCode`; the editor's count, peek, and Step problems list all derive from `validateForPublish` (no second rule list); the runner renders nothing for an untagged Ending and `run.ts` / `db/runs.ts` record `outcomeId: null` unchanged; every rewritten spec asserts a real remaining problem; `publish-untagged-ending` proves AC-2 end to end with correct cleanup; unit cases are independent-expectation; docs match the ticket; no scope leak. Findings, all non-blocking: (1) `document.ts` `stepSchema` comment still said an Ending carries an Outcome — fixed; (2) `ac-4-docs.txt` not yet produced — produced by the orchestrator run; (3) README wrap — fixed; (4) `layout.test.ts` fixture comment misnamed the two problems — fixed; (5) bare `[SCOPE CHANGE]` references in `spec.md` — backticked; (6) no Seam A case for an untagged one-Step `startRun` — declined, the ticket says confirm, do not change `run.ts`/`run.test.ts`, and Seam B proves it; (7) `publish-invalid-draft` provokes two problems while describing one — comment and a second written-out assertion added.

**Axis 2 — coding standards.** Confirmed clean: `CONTEXT.md` vocabulary throughout; only ticket-named proof directories committed, proof root not cleared, no sensitive data; `dod-1-commands.txt` carries the full contract chain with no "flaky"; Playwright conventions kept (`retries: 0`, no skip/fixme/slow, role locators, fresh Participant context closed in `finally`); `Object.hasOwn` kept, no `next/link`; doc formats and commit hygiene fine. Findings, all non-blocking (the reviewer proposed the first as blocking; adjudicated non-blocking because the contract did not name `docs/adr`, but fixed because the ADR contradicted the code): (1) ADR-0001 still stated the withdrawn rule — "Amended by: ticket 24" line added and the clause corrected, per the ADR-0002 precedent; (2) `decisions.md` stated the rule twice — inline `Amended 2026-09-22` notes added; (3) README wrap and the dropped "rename" capability — fixed; (4) `ac-4-docs.txt` missing and the `ac-1` capture's filter swallowed by `vitest run --` — both regenerated; (5) two comments ran long — trimmed; (6) same as axis 1 (7) — fixed.

All fixes are orchestrator commits (31df5cc), not worker commits. Remaining risk: none blocking; the post-merge staging smoke is the only unproven surface.

### [CLOSEOUT] 2026-09-22 — Atlas orchestrator (Claude Fable 5.1)

PR: https://github.com/paul-macfarlane/journeys/pull/28 (base `staging`, comparison SHA `4d4f2fc`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Deliverables.** D1 docs and spec amendments — atlas-worker on claude-sonnet-5, commit c228ab0, accepted. D2 rule removal, runner ending screen, spec rewrites, evidence — atlas-worker on claude-opus-5, commit 9cf6bf8, accepted. Review fixes and refreshed evidence — orchestrator, commit 31df5cc. Closeout — this commit.

**Isolation re-check.** Sequential direct checkout as planned; the real diffs confirm the predicted file sets never overlapped (D1: `CONTEXT.md`, `README.md`, `.scratch/**`; D2: `src/**`, `e2e/**`, `test-results/**`). The parallel option was rejected on shared-checkout and hook-needs-`node_modules` grounds, not on a file conflict, and that reason held.

**Verified run command (orchestrator, final tree, before it was committed as 31df5cc; the capture headers therefore read head 9cf6bf8):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm test:e2e` — every block `exit=0`; unit 237/237; e2e 69 passed in 56.2s, 0 flaky, retries 0. Docker Postgres :5436, `next start` :3100, Chromium.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 Seam A | PASS | `test-results/ac-1-validate-unit.txt` (36/36 in `validate.test.ts`, incl. "accepts an Ending with no Outcome" and the unchanged `unknown-outcome` case); `pnpm test` block in `dod-1-commands.txt` |
| AC-2 brand-new Journey | PASS | `canvas-problems-readable` and `publish-untagged-ending` in `dod-1-commands.txt`; `test-results/publish-untagged-ending/publish-untagged-ending.png` (viewed: Step, "The end", "Start over", no Outcome line); `test-results/canvas-problems-readable/canvas-problems-readable.png` |
| AC-3 tagged Ending still shows its Outcome | PASS | `preview`, `runner-*`, `step-editing-build-and-publish` passing in `dod-1-commands.txt`; `runner.spec.ts` / `preview.spec.ts` unchanged |
| AC-4 docs | PASS | `test-results/ac-4-docs.txt` |
| AC-5 every existing spec passes | PASS locally (69/69, 0 flaky); PR CI is the durable proof and is pending at the moment of this commit | `dod-1-commands.txt`; PR #28 checks |
| DoD-1 command chain | PASS | `dod-1-commands.txt` |

**Deviations.** (1) D2's commit subject was shortened by the commit-msg hook's 100-character rule; no hook bypassed. (2) D2's co-author trailer names the Opus worker that wrote it. (3) `pnpm build` and `pnpm db:migrate` were not run separately: `pnpm test:e2e` builds the app and the ticket touches no schema. (4) The e2e runs rewrote 61 screenshots for specs this ticket does not name; the Atlas git-policy hook denies `git checkout -- <pathspec>` and `git restore` to agents, so they are left unstaged in the working tree for Paul to restore with `git checkout -- test-results` from his own terminal. Nothing in the PR depends on it.

**Human gate announced for later.** Post-merge staging smoke: create a Journey, publish it untouched, open its `/j/` link, Begin, read "The end" with no "Outcome:" line.
