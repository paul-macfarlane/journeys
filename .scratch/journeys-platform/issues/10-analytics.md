# 10: Analytics

Status: ready-for-agent
Blocked by: 06, 09
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A Member opens a published Journey's analytics for a chosen Published Version and sees the canvas with numbers on it — percentage taking each Choice, Run count on each Ending, abandonment count on each Step — plus a Runs-by-Outcome chart and starts/completions totals. All computed from Run paths (no event table). Members-only.

- [ ] Seam A: aggregation functions produce hand-computed expectations for choice take-rate, ending counts, outcome distribution, abandonment, starts, completions; zero-run and all-abandoned cases; Runs from other versions excluded.
- [ ] Canvas overlay shows the numbers; switching version changes them.
- [ ] Outcome chart matches the overlay totals.
- [ ] Non-Members get 404/forbidden on the analytics route.
- [ ] Seam B: complete two Runs to different Endings → analytics shows both, with percentages.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### Note 2026-09-21 — analytics contract after ticket 18 (cycles allowed)

Published graphs may now hold cycles, so a Run's path is no longer a set of Steps (ADR-0002, `docs/adr/0002-cycles-and-back-navigation.md`): a path may repeat a Step, one entry per visit, and "current" is its last entry. For the aggregations in Seam A: abandonment counts a Run's **last** path entry only; choice take-rate counts **each traversal** of a Choice (a Choice walked twice in one Run counts twice); distinct-Steps-visited is a set over the path's values, not its length. Paths are capped at 500 entries. `backtrack_count` can be inflated by a Participant who forges the `?at` index, so treat it as noisy.
