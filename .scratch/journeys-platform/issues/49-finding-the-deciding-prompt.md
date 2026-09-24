# 49: Finding the deciding Prompt, and the judge in a demo

Status: done
Blocked by: None
Owner: claude (feat/49-deciding-prompt, 2026-09-23)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon 46 → 47 → 48 → **49** → 38 → 50 → 51; 52 is grilled in its own thread and may squeeze in; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call.
Route: polish

**Why:** Paul, 2026-09-23, item 10: "It's not clear to me where I can use the jev powered feature. What do I do to use that?" Two findings from the same read belong with it: the privacy page does not say Responses go to an AI judge, and ticket 43's closeout queued a timeout question that decides whether the feature works in a demo.

**What is true today (read on `staging` at `78a4e32`):**

- The control is a checkbox in the Step panel's Prompt section, "Let the response decide the next step" (`step-panel.tsx`, `PromptField`), shown only when the Step has a Prompt **and** two or more Choices. With one Choice it is simply absent, so an Author building a Step in order (Prompt first, Choices after) never sees it appear. Its helper line is the only explanation anywhere in the app; nothing on the Prompt field, the landing page, or `docs/` mentions the judge.
- `src/app/privacy/page.tsx` names Vercel, Neon, Google, and Discord as the services that see data and says journeys and runs are never used to train models. Since ticket 43 a deciding Prompt's Response, with the Step's text and Choice labels, is sent to the Vercel AI Gateway and the model behind jev. The page does not say so.
- `DECISION_TIMEOUT_MS` is 5000 in `src/lib/ai/decide.ts`. Ticket 43's real-model run found jev's latency bimodal: most calls about half a second, three of eight between 12 and 14 s. At 5 s the slow third fall back to "Choose for yourself", so in front of the judges the AI feature will look broken about a third of the time. The deciding form is a server-rendered `<form action>` in `step-view.tsx` with a plain "Continue" button and no pending state, so a longer wait shows nothing.

**Decisions (Paul, 2026-09-23, accepted the agent's recommendation):**

- The checkbox is visible whenever the Step has a Prompt, disabled with the reason "Needs two or more choices" until it can be turned on, and named for what it does: "AI decides the next step from the response", with the existing helper line kept and a short second line on how a Participant experiences it (they answer and press Continue; the Choices appear only when the judge is unsure).
- The privacy page gains one sentence under "Where it lives" naming the AI Gateway and that a Response to a deciding Prompt is sent to it, with the Step's text and Choice labels, to pick the next Step and for nothing else. Paul approves the wording in the PR (legal text is his sign-off, ticket 31).
- The timeout rises to 20 s and the deciding form's Continue button becomes a small client island (`useFormStatus`) that reads "Deciding…" and disables while the judge runs. This is the runner's first client component; keep it to that one button. The 0.5 threshold and the hedge finding stay queued on ticket 15.
- Paul confirms `AI_GATEWAY_API_KEY` is set on the Vercel staging and production projects (a missing key only warns at publish); that is his, in `human-prerequisites.md`.

**What to build:**

- `step-panel.tsx`: the always-present checkbox, its disabled reason, the new label and copy. `src/app/privacy/page.tsx`: the sentence. `decide.ts`: the constant, with `decide.test.ts` following. `step-view.tsx`: the `DecideSubmit` island for the deciding form only.
- **Specs.** `prompts-author-attaches-a-prompt` asserts the checkbox present and disabled with one Choice, enabled after a second; `legal-pages` reads the new sentence; `runner-deciding-prompt` asserts the button's pending text while the stubbed judge is slow (the spec already stubs the judge; add a delayed answer).

Acceptance criteria:

- [x] An Author with a Prompt on any Step can see the deciding option and why it is or is not available; the copy says what a Participant will experience.
- [x] The privacy page names the AI judge and what it receives, in wording Paul approved.
- [x] A slow judge answer inside 20 s still advances the Run, and the Participant sees "Deciding…" while it runs.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 10, and ticket 43's closeout.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish, from a worktree)

PR: https://github.com/paul-macfarlane/journeys/pull/58 (base `staging`, branched at `f93bdf2`). Status set to `done` in this commit; merging the PR is Paul's acceptance. The privacy sentence is in the PR description for Paul's approval.

**Commits.** 58620de (panel option, privacy sentence, 20 s timeout, `DecideSubmit` island, the three specs and their evidence), da8d5ea (review tidy-ups: the Step's question named in the sentence, "unsure or unavailable", unroute after the hold, the Fluid-compute prerequisite), fe2ceb5 (`unrouteAll({ behavior: "wait" })`: the default unrouted under the still-running held handler and its `route.continue()` threw), 06ddf6a (evidence and the DoD capture), then this closeout.

**Verified run command (code at fe2ceb5):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=prompts-author-attaches-a-prompt,legal-pages,runner-deciding-prompt pnpm test:e2e` — every block `exit 0`; unit 506/506; e2e 100 passed in 2.4m, 0 flaky, retries 0. Worktree on `E2E_PORT=3149`, `journeys_e2e_49`, CI dummy env (no `.env.local`), `AI_GATEWAY_API_KEY` unset. `pnpm build` ran inside `pnpm test:e2e`; no migration. One earlier full run (at da8d5ea) failed on `runner-deciding-prompt` with "Route is already handled"; recorded as FAIL, fixed at the cause in fe2ceb5, and the cited run is the green one after it.

| Criterion | Verdict | Evidence |
|---|---|---|
| An Author with a Prompt on any Step can see the deciding option and why it is or is not available; the copy says what a Participant will experience | PASS | `prompts-author-attaches-a-prompt`: option visible, disabled, unchecked and "Needs two or more choices." with no Choice and with one; enabled after the second; checked and the Draft autosaves `decides: true`; the Participant line asserted by text; `test-results/prompts-author-attaches-a-prompt/prompts-author-attaches-a-prompt.png` (viewed) |
| The privacy page names the AI judge and what it receives, in wording Paul approved | PASS pending Paul's wording sign-off | `legal-pages` asserts the sentence under "Where it lives"; `test-results/legal-pages/privacy.png`; the sentence is in the PR description for approval |
| A slow judge answer inside 20 s still advances the Run, and the Participant sees "Deciding…" while it runs | PASS | `decide.test.ts`: `DECISION_TIMEOUT_MS` is 20 000 and a late answer inside the signal is returned un-aborted; the existing `actions.test.ts` cases advance the Run on a confident decision; `runner-deciding-prompt` holds the server-action POST and reads the disabled "Deciding…" button, `test-results/runner-deciding-prompt/deciding.png` (viewed); `step-view.test.tsx` pins the idle markup as an enabled "Continue" |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt` |

**AI review (one reader, both axes, diff `origin/staging...58620de`).** Approve. *Spec:* every decision delivered, nothing extra; the ticket's "the spec already stubs the judge" was wrong about the code (the e2e server blanks the key, so the judge answers `none` before jev is called), and holding the `next-action` POST with `page.route` was read as the right proof, with AC 3's "advances" half proven by composition at the unit seams. *Correctness:* `useFormStatus` inside an RSC-rendered `<form action>` reads pending correctly, no hydration mismatch (server and first client render both idle); the click cannot fire a native document POST once React's fiber is on the button, since a submit on a dehydrated root is replayed through the action; the checkbox's `disabled={!canDecide && !decides}` keeps a stale "on" switchable off and the `aria-describedby` target renders under the same condition. *Findings, all non-blocking, all applied:* (1) nothing confirmed the runner's server action may run 20 s on Vercel — a non-Fluid function is cut at 10 s — recorded as a human prerequisite in `human-prerequisites.md` §6; (2) `buildDecision` also sends the Prompt's question, so the sentence now names it (deviation from the ticket's brief wording, flagged in the PR for Paul); (3) the two helper lines disagreed on "unavailable", now "unsure or unavailable"; (4) `unrouteAll` after the hold for parity with the "Saving…" spec — which then needed `behavior: "wait"`.

**Deviations.** (1) The privacy sentence names "its question" beside the Step's text and Choice labels, because that is what the judge is sent; Paul's wording sign-off covers it. (2) The panel's second line reads "unsure or unavailable" rather than the ticket's "unsure", to match the helper line and the no-key fallback. (3) The pending state is proven by holding the action's POST, not by a slowed judge, since there is no judge in e2e to slow; the 20 s wait is proven at the `gatewayJudge` seam. (4) `RunHistory` was already a client component on the runner page; `DecideSubmit` is the first, and only, client island in `StepView`.

**Queued for Paul (human prerequisites, non-blocking for the merge).** `AI_GATEWAY_API_KEY` on the Vercel Production and Preview environments; Fluid compute confirmed on the project (the default) so a server action can wait the judge's full 20 s. The worktree at `.claude/worktrees/49-deciding-prompt/journeys` and its `journeys_e2e_49` database are left for removal after the merge.

**Next in Paul's order:** 38 → 50 → 51; 52 in its own thread; post-hackathon sweep 3 (41 → 42 → 44 → 45, 53).
