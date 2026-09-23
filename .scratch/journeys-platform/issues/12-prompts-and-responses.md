# 12: Prompts and Responses

Status: done
Blocked by: 06, 08
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Route: contract

**What to build:** An Author attaches an optional free-text Prompt to a Step (label, required/optional) in the side panel and sees a one-line notice that Responses are anonymous and must not ask for identifying information. A Participant sees a textbox on that Step and answers before choosing (or skips if optional). Responses are stored per Run and step; Members read them in a plain per-step list; Participants never see others' Responses. `prompt.type` accepts only `free_text`.

- [x] Prompt editing in the panel, with the notice; required flag enforced in the runner.
- [x] Response saved with the Run and step id; skipping an optional Prompt saves nothing.
- [x] Per-step Response list for Members, no participant identifiers; non-Members forbidden.
- [x] Preview never stores Responses.
- [x] Seam B: author adds a Prompt → participant answers → author reads it.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [EXECUTION PLAN] 2026-09-22 — /implement (Claude Fable 5.1)

**Contract:** this ticket as written; no scope change. Criteria in checklist order: AC-1 Prompt editing in the panel with the notice, required flag enforced in the runner; AC-2 Response saved with the Run and step id, skipping an optional Prompt saves nothing; AC-3 per-step Response list for Members with no participant identifiers, non-Members forbidden; AC-4 Preview never stores Responses; AC-5 Seam B end to end. Derived DoD: DoD-1 the `contract` command chain green (`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate`, then one `E2E_EVIDENCE=<the prompts spec's tests> pnpm test:e2e`); DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only, never a real Response. No dependency or lockfile change expected.

**Availability:** `Blocked by` 06 and 08 are both `done` on `staging`; no other claim. Branch `feat/12-prompts-and-responses` from `staging` at `dbf055b`, direct checkout, no worktrees.

**Decisions resolved from the spec and `CONTEXT.md`** (the ticket leaves them open):

- The graph document already carries `step.prompt` (`type: "free_text"`, `label`, `required`) since ticket 03, so the Draft, Published Versions, publish validation, and the seed need no change. A Prompt exists on a Step exactly when its label is non-blank: the panel's "Prompt" field writes `null` for a blank label, and "Required" is offered only while there is a Prompt to require.
- A new `response` table: `(run_id, step_id)` primary key, `text`, `created_at`, `updated_at`; `run_id` cascades from `run`, so deleting a Journey or Project takes its Responses with it (spec 12b, 180). Keyed by Run and step id as spec 167 says: a Participant who backtracks to a Step and answers again replaces their answer, and a revisit shows what they wrote. Adding a table is compatible with the code deployed before it, so the Migrate action and the Vercel build may land in either order.
- The textbox travels with the Choice: a Step with a Prompt offers its Choices as one form (the shape the Start Step already uses since ticket 27), posting the answer and the chosen Step together to a runner action that saves the Response and moves the Run. A blank answer to an optional Prompt writes nothing; a blank answer to a required one is refused by the browser (`required`) and, for a crafted request, by the server, which returns to the Step with a notice. Responses are capped at 2000 characters. An Ending with a Prompt offers a "Save response" button instead; the Start Step of a live Journey offers its Prompt only while it has Choices, because a Run exists only once a Choice is taken.
- Preview renders the same form against an action that only redirects: nothing is written, the banner already says so.
- Members read Responses on a "Responses" tab of the Journey page: one section per Step that carries a Prompt in the Draft, plus any Step id Responses were recorded against, each a plain list of answers oldest first with no Run or Participant identifier; the read is Member-checked like every other `src/db` read, so a non-Member gets the page's 404.

**Structure:** one session, seams in order. (1) Schema and migration 0008. (2) Pure seams by TDD: `readResponse` in `src/lib/graph/prompt.ts` (answered / skipped / missing / too long), `updateStep` accepting a `prompt` patch, and the per-Step grouping for the Responses tab. (3) Data access: `src/db/responses.ts` and a Response written in the same transaction as the first-Choice Run. (4) Runner: the form, the actions, the notices, prefill. (5) Preview action. (6) Panel Prompt field and notice. (7) Responses tab. (8) Seam B: `e2e/prompts.spec.ts`.

**Review:** `/code-review` (two fresh readers, standards and spec), as `contract` requires. **Red team:** not run — this implements the spec's own Response table and runner design (spec 167, 184, 200) on the existing action seam; it changes no part of the graph model, publishing, Run semantics, auth, or the deploy path.

### [AI CODE REVIEW] 2026-09-22 — two-axis review of `dbf055b..424c391`, fixes in `a312a05`

Two fresh readers (opus, `/code-review`: standards and spec) read the whole diff against the ticket, its execution plan, `CLAUDE.md`, `CONTEXT.md`, `docs/agents/testing.md`, `docs/agents/issue-tracker.md`, spec stories 54–60, 66a, 12b, and the Data model, Publishing, Analytics, and Non-goals sections, plus the neighbouring runner, data-access, panel, and e2e code the change mirrors. **No blocking finding on either axis.**

**Standards** (1 hard, 1 correctness, 5 smells, 1 e2e): evidence not yet committed at review time (expected; committed at closeout) — resolved; "answer" and "question" in Participant- and Author-facing copy where `CONTEXT.md` says Response and Prompt — **resolved (`a312a05`)**, the notices say "response" and the panel placeholder no longer says "question"; the step action's comment claimed Back parity with `navigateTo` that the form, carrying no path index, does not have — **resolved (`a312a05`)**, the comment now says a form is a Choice, never a Back, and why that is enough; the refusal-redirect pair repeated in three actions — **resolved (`a312a05`)**, one `refusalNotice` rule with a unit test; `ResponseRow` and `PromptField` each naming two unrelated things — **resolved**, the e2e row is `StoredResponse` and the runner's field `ResponseField`; `{ label, required }` re-declaring the Prompt's shape — **resolved**, `Omit<Prompt, "type">`; the form-or-links selection written at four call sites with two conditions — left, the four sites differ in what they bind and a helper would hide the Start's "no Run yet" rule; two `toHaveURL` assertions on the URL the page was already at — **resolved**, replaced by the `validity.valueMissing` check they were guarding.

**Spec** (3 partial, 4 not-asked-for, 2 looks-wrong, 0 missing): evidence and checkboxes pending closeout — resolved here; the server-side `required` rule was unit-tested but not proved end to end — **resolved (`a312a05`)**, the spec now posts the form past the browser's check with `noValidate` and reads the notice and the unmoved Run; a Prompt on a Start that is also an Ending is never shown — left as designed (no Run exists to record against; noted as a follow-up below). Not asked for and kept, each recorded in the execution plan as a decision resolved from the spec: a Prompt on an Ending with its own "Save response" (spec 172 gives every Step an optional Prompt), showing a revisited Step's answer back (the consequence of spec 167's key), the 2000-character cap, walk-order listing with empty groups, and the notices. Looks wrong: an optional answer emptied on a revisit kept its old row while the box showed it — **resolved (`a312a05`)**, the blank submission takes the Response back with a "removed" notice, proved in the spec; the Responses query running for every tab — left, the tabs component renders every tab's content on the server and the list is small. Confirmed clean: no cross-Participant read; non-Members 404 on the tab, the data-access read, and the Preview action; the cascade `response → run → published_version → journey → project`; Preview writes neither Run nor Response; `prompt.type` is `z.literal("free_text")`; the key is `(run_id, step_id)`.

### [CLOSEOUT] 2026-09-22 — /implement (Claude Fable 5.1)

**PR:** https://github.com/paul-macfarlane/journeys/pull/40 (`feat/12-prompts-and-responses` → `staging`). Per the tracker rule Paul set on 2026-09-21, this closeout commit carries `Status: done`; merging the PR is the acceptance that lands it on `staging`. Status log: `ready-for-agent` → `in-progress` → `ai-review` → `done`.

**Repository delivery:** `journeys`, base `staging` at `dbf055b`, direct checkout, no worktrees, one implementer (this session), no delegation. Commits: `4d2a4eb` claim and execution plan; `dc773ad` the `response` table, migration 0008, and the pure seams (`readResponse`, `setStepPrompt`, `groupResponsesByStep`) by TDD; `d3ec7aa` the panel field and notice, the runner form and actions, Preview's action, the Responses tab; `98da692` Seam B (`e2e/prompts.spec.ts`); `424c391` walk-order listing (jsonb reorders keys); `a312a05` review fixes; `06d44a3` the two existing-spec fixes the full run demanded; `d8d773f` evidence and the review record; and this closeout. Structure as planned: the eight seams in order.

**Exact verified run command** (local; docker Postgres on 5436; captured over the `06d44a3` tree, committed in `d8d773f` as `test-results/dod-1-commands.txt`):

```
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate && E2E_EVIDENCE=prompts-author-attaches-a-prompt,prompts-participant-answers-and-author-reads,prompts-preview-stores-nothing pnpm test:e2e
```

Exit status 0; Vitest 342 passed in 23 files; migration 0008 applied; Playwright 84 passed (production build on port 3100, `retries` 0, nothing flaky). No dependency or lockfile change; no deployed-target check (Paul's 2026-09-20 decision) — the post-merge smoke on staging is the human gate.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 Prompt editing in the panel, with the notice; required flag enforced in the runner | PASS | `test-results/prompts-author-attaches-a-prompt/prompts-author-attaches-a-prompt.png` (field, notice, "Required"); the Draft row polled for the Prompt in the spec; the required rule refused by the browser and, posted past it, by the server with the notice (`prompts-participant-answers-and-author-reads`); `src/lib/graph/prompt.test.ts` |
| AC-2 Response saved with the Run and step id; skipping an optional Prompt saves nothing | PASS | `response` rows read back in the spec: none after the optional Start Prompt is skipped, one `(run_id, step_id)` row after the required answer, replaced on re-answer, removed when emptied; `test-results/prompts-participant-answers-and-author-reads/…-queue.png` |
| AC-3 Per-step Response list for Members, no participant identifiers; non-Members forbidden | PASS | `test-results/prompts-participant-answers-and-author-reads/prompts-participant-answers-and-author-reads.png`; the page text asserted free of the Run id and participant id; a second Author gets 404 on `?tab=responses`; `src/lib/response-list.test.ts` |
| AC-4 Preview never stores Responses | PASS | `test-results/prompts-preview-stores-nothing/prompts-preview-stores-nothing.png`; zero `run` and zero `response` rows for the version after a full Preview walk with every Prompt answered; `preview.spec.ts` re-proves it by rows |
| AC-5 Seam B: author adds a Prompt → participant answers → author reads it | PASS | `e2e/prompts.spec.ts`, three tests, all in the captured run |
| DoD-1 command chain green | PASS | `test-results/dod-1-commands.txt` |
| DoD-2 PASS artifacts committed, fixture journeys only, no real Response | PASS | `d8d773f`; every answer in the evidence is the spec's own fixture text |

**Deviations:** two existing specs changed, neither a change to what they prove — `preview.spec.ts` asserted the `response` table did not exist (ticket 05's placeholder for this ticket) and now asserts no rows; `canvas.spec.ts` turns Chrome's scroll anchoring off for its pages, since `canvas-problems-readable` failed deterministically on this branch: a full-page screenshot leaves a stale anchor that the next box hover restores, scrolling the page under the click, and this ticket's taller panel moved that page's anchor into the live problems list. Diagnosed with probes in the spec (hover alone scrolled the page 487→299; excluding the live problems list from anchoring stopped it); no Author's viewport is ever resized like that, so the app is untouched. **Red team:** not run, as the execution plan records. **Follow-ups:** a Prompt on a Start that is also an Ending is never offered (no Run exists to record against) and the panel does not say so — a candidate for a publish-time notice under ticket 15; the Responses tab's rows load on every Journey page view, which the tabs component renders server-side anyway — revisit if a Journey ever holds thousands of Responses.
