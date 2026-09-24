# 43: Free text as the decision, judged by jev

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (`/atlas-implement`, claimed 2026-09-23)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → **43**; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon. Paul, Q22: "nice to have for hackathon, but not required."
Route: contract

**Why:** Paul, 2026-09-22, item 11: "what would be really cool is if free text could be used as a decision maker using something like 'jev' to convert the text to a decision." jev is TypeSafe AI's evaluation model on the Vercel AI Gateway (`typesafe-ai/jev`, https://vercel.com/ai-gateway/models/jev): fast structured decisions — `boolean`, `choice`, and `score` questions over a state — through the AI SDK's `experimental_evaluate`, 32k context, about $0.04 per million input tokens. A `choice` question over a Step's Choice labels is exactly this decision.

**Scope change:** the graph document's Prompt gains `decides: boolean` (default `false`, zod default so every stored document parses): a deciding Prompt is required, and the Step's Choices are not shown as buttons until the judge has answered. Record a `[SCOPE CHANGE]` on the spec and an amendment in `decisions.md`. Runs are unchanged: the Run records the Choice that was taken, exactly as if the Participant had pressed it, plus the Response.

**Decisions (Paul, 2026-09-22, grilled):**

- Wiring: the Vercel AI Gateway with a static `AI_GATEWAY_API_KEY` (Q18; `human-prerequisites.md` §6), the `ai` package's `experimental_evaluate` with `model: "typesafe-ai/jev"`, tagged `feature:decide`. Shared with ticket 14; whichever lands first adds the `ai` package, and the lockfile commit is Paul's.
- The judge sees what the Participant sees and nothing more (Q21): the Step's plain text, each Choice's label and id, and the Participant's Response. Never the Endings or Outcomes behind the Choices, never another Participant's Response, never the rest of the Journey.
- Confidence (Q20): when the chosen answer's probability is 0.5 or more, the Run advances along it. Below that, the runner shows the Choices as buttons with jev's pick preselected and "Choose for yourself"; the threshold is a constant tuned in Preview.
- Fallback (Q15): no key, a failed or rate-limited call, or an answer that names no Choice of the Step shows the Choices as buttons with nothing preselected. A Run is never stuck. A deciding Prompt on a Draft with no key is a publish-time warning, not a refusal.
- Preview behaves as the live runner, records nothing, and shows jev's pick and its probability so an Author can tune their Choice labels.

**What to build:**

- **Contract.** `prompt.decides` in `src/lib/graph/prompt.ts` and the sanitizer; a deciding Prompt forces `required`. Unit tests for round trips and defaults.
- **Editor.** The Step panel's Prompt section gains "Let the response decide the next step", shown only when the Step has two or more Choices, with one line of help text.
- **Decision.** `src/lib/ai/decide.ts`: a pure function building the `state` and the `choice` question, and a thin caller around `experimental_evaluate` that the server action injects, so unit tests run against a stub and the e2e suite never calls the gateway. Per-Run rate limit of one decision per second in the action.
- **Runner.** In `src/app/j/[journeyId]/actions.ts`, the deciding form posts the Response; the action judges, then either advances the Run (recording the Choice and the Response) or redirects back with `?decide=<choiceId|none>` so the page renders the buttons, preselected or not. The runner stays JavaScript-free.
- **Specs.** `runner-deciding-prompt` in `runner.spec.ts` runs with the key unset and proves the deciding form, the fallback buttons, and the advance from a button; the judged path is proven by unit tests with a stub and by one manual run against the real model on a fixture Journey, captured as `ac-3-real-model.txt` with the agent's own text as the Response.

Acceptance criteria:

- [ ] A Step with a deciding Prompt shows the textbox and no Choice buttons; a confident answer advances the Run along the judged Choice, and the Run's path and Response are recorded as for a pressed Choice.
- [ ] A weak answer shows the Choices with jev's pick preselected; no key, a failed call, or an invalid answer shows them with none; both let the Participant go on.
- [ ] Existing documents parse unchanged; Published Versions are never rewritten; the e2e suite makes no gateway call.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-3-real-model.txt`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 11, grilled the same day.

### [EXECUTION PLAN] 2026-09-23 — Claude Fable 5.1 (`/atlas-implement`, Route: contract)

Worktree `.claude/worktrees/43-ai-decided-choices/journeys` on `feat/43-ai-decided-choices` (off `origin/staging` at `14382c5`), dummy env exported inline (no `.env.local`), e2e on port 3143 against `journeys_e2e_t43`. Two sequential deliverables, one worker each, same branch, no integration worktree (D2 builds on D1's contract, and both touch `step-view.tsx`, `prompt.ts`, and `documents.ts`, so parallel work would collide there):

- **D1 — contract, decision module, editor.** `prompt.decides` (zod default `false`; `readResponse` treats a deciding Prompt as required; `setStepPrompt` forces `required: true` when `decides`), the `ai` package (`package.json` only — the lockfile commit is Paul's), `src/lib/ai/decide.ts` (pure `buildDecision`/`decideChoice(step, response, judge)` with `DECISION_THRESHOLD = 0.5`, plus `gatewayJudge` around `experimental_evaluate`, `model: "typesafe-ai/jev"`, gateway tag `feature:decide`, null on any failure or an answer naming no Choice of the Step), the Step panel's "Let the response decide the next step" checkbox (two or more Choices only), the "(optional)" label rule, and unit tests at those seams.
- **D2 — runner, Preview, publish warning, spec, amendments.** The deciding form (textbox and one "Continue" button, no Choice buttons) in `StepView`; `respondAndChooseAction` and `chooseFromStartAction` judge when the form carries no `to`, advance on a confident answer exactly as a pressed Choice, else redirect with `?decide=<choiceId|none>` (the Start also carries `response=` since no Run holds it yet) and the page shows the Choices, jev's pick marked, under "Choose for yourself"; per-Run rate limit of one decision per second (fallback, never an error); Preview always comes back with the pick and its probability and records nothing; `publishJourneyAction` returns a non-blocking warning when a deciding Prompt is published with no key; `playwright.config.ts` blanks `AI_GATEWAY_API_KEY` for the e2e server; `runner-deciding-prompt` in `runner.spec.ts` over a `decidingDocument()` fixture; `[SCOPE CHANGE]` on the spec and the `decisions.md` amendment.

Verification map (`local + deployed`; commands run inside the worktree with the dummy env): AC-1 — `pnpm test` over `decide.test.ts` and `actions.test.ts` (confident path records the Choice and the Response) plus `runner-deciding-prompt` (deciding form, no buttons, advance from a button) and one manual real-model run captured as `test-results/ac-3-real-model.txt`; AC-2 — the same unit files (weak → preselected, error/none/no key → none) plus the spec's fallback screen with the key blank; AC-3 — `ac-3-existing-documents.txt` (every fixture and the three legacy documents parse unchanged), the blank key in `playwright.config.ts`, and the unit test that `gatewayJudge` is never reached without a key; AC-4 — `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=runner-deciding-prompt pnpm test:e2e` captured as `dod-1-commands.txt` and `dod-1-e2e.txt`. Human gates: (H1) the `pnpm-lock.yaml` commit after D1 adds `ai` — PR CI is red until Paul pushes it; (H2) the real-model run needs the gateway key at hand in the worktree, which only Paul can place. Review: two frontier readers (spec conformity, standards) over `14382c5...HEAD`.

### [CLOSEOUT] 2026-09-23 — Claude Opus 5.5 (`/atlas-implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/52 (base `staging`, comparison SHA `14382c5`). Status set to `done` in this commit; merging the PR is Paul's acceptance. **The `pnpm-lock.yaml` commit for `ai@7.0.112` is Paul's; CI is red until it lands.**

**Deliverables.** D1, contract, decide module, and editor (Sonnet worker): 8f4e366, plus orchestrator fix 1812569 (the unit test no longer imports `e2e/setup`). D2, runner, Preview, publish warning, spec, and amendments (Opus worker): 9516c6e. R1, review fixes (Sonnet worker): 85c11b0, plus orchestrator fix 52e21a3 (`setStepPrompt` forces required only while the Prompt genuinely decides). Evidence: d90631e and the real-model commit. One worktree, sequential. Parallelism was rejected on predicted collisions in `prompt.ts`, `step-view.tsx`, and `e2e/setup/documents.ts`; the real D1/D2 diffs overlapped in `step-view.tsx`, `documents.ts`, and `package.json` (not `prompt.ts`), and D2 depended on D1's contract regardless.

**Verified run command (code at 52e21a3):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=runner-deciding-prompt pnpm test:e2e`, run with the CI dummy env, `AI_GATEWAY_API_KEY` unset, port 3143, and `journeys_e2e_t43`. Every block exited 0. Unit: 486/486. e2e: 97 passed in 1.8 min, 0 flaky, retries 0. No migration.

| Criterion | Verdict | Evidence |
|---|---|---|
| Deciding Step shows the textbox and no Choice buttons; a confident answer advances along the judged Choice, recording path and Response as for a pressed Choice | PASS | `test-results/runner-deciding-prompt/deciding-form.png`; `test-results/ac-1-2-judged-paths.txt` (runner and Start confident paths); `test-results/ac-3-real-model.txt` (real jev: "I keep my eyes down and hold out my papers." advances along Show your papers at 1; "I have waited long enough…" along Leave the queue at 1) |
| Weak → pick preselected; no key, failed call, or invalid answer → none; the Participant can go on | PASS | `test-results/runner-deciding-prompt/fallback.png` (key blank, then a pressed Choice advances); `test-results/ac-1-2-judged-paths.txt` |
| Existing documents parse unchanged; Published Versions never rewritten; the e2e suite makes no gateway call | PASS | `test-results/ac-3-existing-documents.txt`; `playwright.config.ts` blanks the key; no-key unit tests |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt` |
| Spec `[SCOPE CHANGE]` and `decisions.md` amendment | PASS | `spec.md` `[SCOPE CHANGE] 2026-09-23` with pointers in "Graph document" and "Public URL and runner"; `decisions.md` "Amendment for ticket 43" with Supersedes; `CONTEXT.md` Prompt and Judge |

**AI code review (two readers over `14382c5...9516c6e`, adjudicated by the orchestrator).**
- *Spec conformity.* Blocking, fixed in 85c11b0: `gatewayJudge` had no timeout and kept the SDK's two retries, so a stalled gateway stranded the Participant; it is now 5 s with `maxRetries: 0`. Blocking, fixed (raised by both readers): the Start Step keyed the rate limit on the Journey id, so first-time visitors shared one decision per second; the Participant id is now minted before judging. Non-blocking, fixed: a stale `decides` on a Step with fewer than two Choices (the new `isDeciding`, plus 52e21a3); Preview rounding 0.496 to "would have advanced" (it now floors); `step-view.tsx` importing the network module for one constant (`threshold.ts`); the `?response=` prefill ungated; tests added for the Preview action, `gatewayJudge`'s answer branches, and the Start rate key.
- *Coding standards.* All non-blocking, all fixed: one judge path in server-only `src/lib/ai/judge.ts` instead of two copies; import order; the missing Supersedes sentence in `decisions.md`; the missing spec pointer; lowercase "choice" in editor copy; the `CONTEXT.md` Prompt and Judge entries; a period; `Object.fromEntries` for `criteria`.
- Open, non-blocking: the rate-limit prune past 10k keys, the Step panel checkbox, and the PublishButton warning display are untested.

**Deviations (approved at review).** `scripts/decide-probe.ts` imports `src/lib/ai` (CLAUDE.md Structure updated); `e2e/prompts.spec.ts` expectations gained `decides: false`; Preview never advances; the Response travels in `?response=` on the Start and in Preview; `publishDraft` returns the document; the rate limit is per instance.

**Queued for Paul (non-blocking, also in the PR).** (1) jev's latency is bimodal (most calls ~0.5 s, 3 of 8 took 12–14 s); at the 5 s timeout the slow third fall back to the Choices. Keep it, or raise it? (2) A hedge ("I'm not sure…") scored 0.65–0.75, so at a threshold of 0.5 a live Run advances on it.

**Next in Paul's order:** sweep 3: 41 → 42 → 44 → 45.

## Comments
