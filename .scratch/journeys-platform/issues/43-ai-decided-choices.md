# 43: Free text as the decision, judged by jev

Status: in-progress
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

## Comments
