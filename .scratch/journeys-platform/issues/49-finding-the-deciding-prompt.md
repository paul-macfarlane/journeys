# 49: Finding the deciding Prompt, and the judge in a demo

Status: in-progress
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

- [ ] An Author with a Prompt on any Step can see the deciding option and why it is or is not available; the copy says what a Participant will experience.
- [ ] The privacy page names the AI judge and what it receives, in wording Paul approved.
- [ ] A slow judge answer inside 20 s still advances the Run, and the Participant sees "Deciding…" while it runs.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 10, and ticket 43's closeout.

## Comments
