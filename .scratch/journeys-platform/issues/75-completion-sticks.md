# 75: Completion survives a backtrack; the latest Ending sets the Outcome

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → **75** → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
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
