# 72: Codebase design review

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`. Run in its own thread. 73 and 74 wait for it; its findings may reshape anything after it.
Route: polish (no code; findings become tickets)

**Why:** Paul, 2026-09-26: the hackathon is over and the priority is "bug fixes, stability, and a clean technical design", with no new bloat. Seventy tickets were delivered fast, one thread at a time; nobody has read the codebase as a whole since the Foundation.

**What to do:** one read-only review of the codebase using the `mattpocock-skills:codebase-design` skill, then write findings and tickets. Nothing is implemented on this ticket.

Scope:

1. **Module boundaries.** `src/db` (per-table access; `server-only`), `src/lib` (pure helpers), `src/app` server actions, `src/components`. Where does logic live in the wrong layer, and where do two modules do the same job?
2. **The write path.** Draft saves, Project and Journey settings, and the shared autosave loop (`src/lib/autosave.ts`, `src/components/autosave.ts`, `src/components/autosaved-form.ts`). Ticket 73 adds refusal of stale saves to all of them: recommend where the version check lives so it is written once.
3. **Dead code and leftovers.** AI-authoring remnants (ticket 14 is cut; its code never merged, but check env, docs, and `human-prerequisites.md`), reserved-but-unused fields (`position`, `condition`, `effect` in the graph document), unused exports and dependencies.
4. **Testability.** Unit coverage of the pure core (`src/lib/graph`), e2e specs that fail under load (tickets 60–63, 65, 69 record `metadata-autosave` and friends), helpers duplicated across specs.
5. **Ticket 15's open questions** that are design, not product: explicit Step order in the document, jsonb querying, corrupt-row handling (73 takes the product side), rate limiting and abuse protection on Runs and on the Judge.

Output, as the `[CLOSEOUT]` on this ticket:

- A findings list, each with file references, severity, and a recommendation.
- Each finding worth acting on becomes a ticket numbered from 81 (or an amendment to 73–80 when it belongs there), with a place in Paul's order proposed but not assumed.
- Anything not worth acting on becomes a `wontfix` line with its reason.

Acceptance criteria:

- [ ] The findings list covers all five scope areas, including any that turned up nothing.
- [ ] Tickets 73 and 74 carry a comment naming the design they should follow.
- [ ] Paul has approved the proposed ticket order.

Use `CONTEXT.md` vocabulary. Origin: Paul's post-hackathon grilling, 2026-09-26 (Q6, Q15).

## Comments
