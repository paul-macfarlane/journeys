# 76: The Judge can find a Response unclear

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → 75 → **76** → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
Route: contract (the deciding-Prompt contract in the spec)

**Why:** ticket 15, "Ticket 43 leftovers". A hedging Response such as "I'm not sure…" scores 0.65–0.75 against one Choice and advances a live Run at the 0.5 threshold, so the Judge decides for a Participant who did not decide.

**Decisions (Paul, 2026-09-26):** the Judge stays; it reads, it never writes (Q3). It may find a Response **unclear** (Q12, option b). An unclear Response falls back to the Participant choosing, the fallback that already exists for no answer, a timeout, or a rate limit. The threshold is not tuned. `CONTEXT.md` "Judge" was updated in the grilling.

**What to build:**

- `src/lib/ai/judge.ts` / `decide.ts`: the Judge's question offers an explicit "unclear or none of these" answer alongside the Step's Choice labels, and the instructions say when to use it (hedging, off-topic, or naming no Choice). An unclear verdict returns the same "no decision" result the fallback already handles, so the runner shows "Choose for yourself" without a pick marked.
- Preview says "The Judge found this unclear — a Participant would choose for themselves." Ticket 64 finding 15: drop the "(100%)" when the Judge returns a single pick with no computed confidence. Show a percentage only when one was computed.
- Tests: unit tests on the result mapping (unclear, a pick, a timeout). An e2e for a hedged Response cannot call the real model in CI; stub at the same seam the existing decide tests use. Ticket 43's missing coverage goes here too: the Step panel's deciding checkbox, and the Publish button's warning when there is no gateway key.
- Amend the spec's 2026-09-23 `[SCOPE CHANGE]` for deciding Prompts with a new `[SCOPE CHANGE]` note.

Acceptance criteria:

- [ ] A hedged Response ("I'm not sure, maybe either") returns unclear, and the runner shows the Choices with none marked (unit test with the model stubbed; plus a manual check against the real gateway recorded in the closeout, with a fixture Journey and no real Response).
- [ ] A clear Response still advances as before (the existing decide tests pass).
- [ ] Preview's unclear message and the percentage rule (e2e `preview`, stubbed).
- [ ] Ticket 15's "Ticket 43 leftovers" bullet is closed.

Verification follows `docs/agents/testing.md` (`contract`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 15; ticket 64 finding 15; Paul's post-hackathon grilling, 2026-09-26.

## Comments
