# 12: Prompts and Responses

Status: in-progress
Blocked by: 06, 08
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Route: contract

**What to build:** An Author attaches an optional free-text Prompt to a Step (label, required/optional) in the side panel and sees a one-line notice that Responses are anonymous and must not ask for identifying information. A Participant sees a textbox on that Step and answers before choosing (or skips if optional). Responses are stored per Run and step; Members read them in a plain per-step list; Participants never see others' Responses. `prompt.type` accepts only `free_text`.

- [ ] Prompt editing in the panel, with the notice; required flag enforced in the runner.
- [ ] Response saved with the Run and step id; skipping an optional Prompt saves nothing.
- [ ] Per-step Response list for Members, no participant identifiers; non-Members forbidden.
- [ ] Preview never stores Responses.
- [ ] Seam B: author adds a Prompt → participant answers → author reads it.

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
