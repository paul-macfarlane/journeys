# 75: Completion survives a backtrack; the latest Ending sets the Outcome

Status: done
Blocked by: None
Owner: Claude (chunk 3)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (Runs, schema, ADR-0002)

**Why:** ticket 66 finding 6. A Run that reached the Ending "Sunlit path" read as Starts 1, Completions 0, Abandoned 1 after the Participant pressed Back on that Ending. Completion is read off the path alone (ADR-0002, ticket 10), and `navigateTo` (`src/lib/graph/run.ts`) clears `endedAt` and `outcomeId` when leaving an Ending.

**Decisions (Paul, 2026-09-26, Q7 and Q9; `CONTEXT.md` "Completion" updated in the same grilling):**

- A Run is a **Completion** once it has reached an Ending, even once. A later backtrack does not undo it. A Run that never reaches an Ending is abandoned.
- The Run's Outcome is the Outcome of the **latest** Ending it reached. Backtracking keeps it; reaching a different Ending replaces it. A Run counts once, never towards several Outcomes.

**What to build:**

- Keep "where the Run is now" separate from "what the Run achieved". The reducer's current-Step state (`endedAt` means "resting on an Ending", which the runner reads when resuming) stays as it is. An additive column records completion, for example `completed_at` (set when an Ending is first reached, never cleared), and `outcome_id` becomes the latest Ending's Outcome and is no longer cleared on backtrack. If the reducer and the resume path read more cleanly with different names, choose them and record why.
- Analytics (ticket 10's queries) count Completions and the Runs-by-Outcome chart from the new state, not from the path's last entry. Abandonment is "never completed". The untagged-Ending grouping (ticket 24) follows the latest Ending.
- **Existing Runs** cannot be backfilled for a backtrack that already happened, because the path was truncated. Backfill `completed_at` from `ended_at` where it is set, and state in the closeout that older backtracked Runs keep their old reading.
- Amend ADR-0002's "Analytics contract for ticket 10" with this rule, and add a `[SCOPE CHANGE]` note to the spec.

Acceptance criteria:

- [ ] Reach an Ending, press Back, and leave: Analytics reads Completions 1, Abandoned 0, and the Ending's Outcome counts 1 (e2e, `analytics-backtrack-after-ending`).
- [ ] Reach Ending X, press Back, reach Ending Y: one Completion counted under Y only (reducer unit test plus the e2e above).
- [ ] Resuming a Run that backtracked off an Ending lands on the Step it is on, not the Ending (existing runner specs pass).
- [ ] The migration is additive and works with the previous code.

Verification follows `docs/agents/testing.md` (`contract`). Never include participant Responses or real run data; use seeded or fixture Journeys. Use `CONTEXT.md` vocabulary. Origin: ticket 66 finding 6; Paul's post-hackathon grilling, 2026-09-26.

## Comments

### 2026-09-26 — Claude (Opus 5.5), chunk 3

`[EXECUTION PLAN]` Chunk 3 is now 87 → 75, re-formed by Paul in this thread. This ticket is delivered by one worker in its own worktree, in parallel with 87; the two share no source files. The work: an additive `run.completed_at` column (migration 0013, nullable, backfilled from `ended_at`), set when an Ending is first reached and never cleared; `outcome_id` keeps the latest Ending's Outcome through a backtrack; `ended_at` keeps meaning "resting on an Ending". Analytics counts Completions and Runs-by-Outcome from `completed_at` and `outcome_id`/the latest Ending, not from the path's last entry. ADR-0002's analytics contract and the spec are amended. Evidence: reducer and analytics unit tests, the migration run against a fresh database and against the previous code's schema, and the new e2e `analytics-backtrack-after-ending` with its screenshot.

`[AI CODE REVIEW]` Two fresh reviewers (Opus) read the whole chunk diff (`49fc989..f3ff381`); the orchestrator adjudicated. No blocking findings. Resolved in f3ff381:
- Technical and spec conformity:
  - /about still described the AI-decided step (87 decision 3).
  - `playwright.config.ts` still blanked `AI_GATEWAY_API_KEY`.
  - Deploy window, a Completion lost: a Run the previous code left resting on an Ending (`ended_at` set, `completed_at` null) lost its Completion on the next Back. The reducer now reads it as completed there.
  - Deploy window, a stale Ending: a stale `ending_step_id` beat the Ending the Run rests on. The resting Ending now wins.
  - The dead `document` field on `PublishDraftResult`.
  - Stale Judge comments and a stale test name.
  - Stale analytics doc comments.
  - Missing reducer cases: rule 2, rule 6 onto a non-Ending, and the same Ending twice.
  - The evidence captures.
  - The Firewall rule scoped to Run creation (`^/j/[^/]+$`), so Prompt posts from one classroom IP are not throttled.
- Coding standards:
  - The migration comment trimmed.
  - The ADR-0002 amendment re-wrapped, including its split code span.
  - "Prompts, read by the members" (was "authors") in the feature grid.
  - The analytics-tab copy now says "latest ending".
  - `ending_step_id` asserted in the runner backtrack e2e.
- Accepted risk, not fixed: while the deploy is rolling out, the previous code may null `outcome_id` when it backtracks a Run the new code completed. Analytics never reads `outcome_id` (it groups through `ending_step_id` and the document), so no number changes.

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/106 (chunk 3, with ticket 87).
- **Worker:** delivered by one worker (Sonnet, worktree `journeys-d2`: commit cf5ea2e). Integrated, then fixed after review in f3ff381. Verified at f3ff381 on local `next start`.
- **Design:** `completed_at` and `ending_step_id` sit beside `ended_at`. `ended_at` keeps meaning "resting on an Ending", which is what resume reads, so resume is untouched. `outcome_id` follows the latest Ending.
- **Verdicts:**
  - AC-1 PASS: `test-results/analytics-backtrack-after-ending/` shows Completions 1, Abandoned 0, "Reached care" 1.
  - AC-2 PASS: `test-results/75-ac-2-latest-ending-unit.txt` plus the second half of that e2e.
  - AC-3 PASS: the runner specs in the full run (`test-results/chunk-3-commands.txt`, 121 passed).
  - AC-4 PASS: `test-results/75-ac-4-migration.txt` (0000–0012 as shipped, old-shaped rows, 0013 with its backfill, then the previous code's insert and update succeed).
- **Older Runs:** Runs that backtracked off an Ending before this change keep their old (abandoned) reading. Their path was truncated, so there is nothing to backfill from.
- **Parallel-run check:** this ran in parallel with 87. The overlap I predicted in `e2e/setup/documents.ts` merged cleanly. The one real conflict was `src/app/j/[journeyId]/actions.test.ts`, where 87 deleted the deciding tests that 75 had given its new fields to; the resolution took the deletion.
