# 10: Analytics

Status: in-progress
Blocked by: 06, 09
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Route: contract

**What to build:** A Member opens a published Journey's analytics for a chosen Published Version and sees the canvas with numbers on it — percentage taking each Choice, Run count on each Ending, abandonment count on each Step — plus a Runs-by-Outcome chart and starts/completions totals. All computed from Run paths (no event table). Members-only. The Runs-by-Outcome chart groups untagged Endings each by its own Step title, so "40% reached 'Turned back'" still reads (from ticket 24, 2026-09-22). A Journey whose Start Step is an Ending records no Run at all — a Run is created by the Participant's first Choice, and such a Journey offers none — so its starts, completions, and Ending counts read zero however many people open it (from ticket 27, 2026-09-22).

- [ ] Seam A: aggregation functions produce hand-computed expectations for choice take-rate, ending counts, outcome distribution, abandonment, starts, completions; zero-run and all-abandoned cases; Runs from other versions excluded.
- [ ] Canvas overlay shows the numbers; switching version changes them.
- [ ] Outcome chart matches the overlay totals.
- [ ] Non-Members get 404/forbidden on the analytics route.
- [ ] Seam B: complete two Runs to different Endings → analytics shows both, with percentages.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### Note 2026-09-21 — analytics contract after ticket 18 (cycles allowed)

Published graphs may now hold cycles, so a Run's path is no longer a set of Steps (ADR-0002, `docs/adr/0002-cycles-and-back-navigation.md`): a path may repeat a Step, one entry per visit, and "current" is its last entry. For the aggregations in Seam A: abandonment counts a Run's **last** path entry only; choice take-rate counts **each traversal** of a Choice (a Choice walked twice in one Run counts twice); distinct-Steps-visited is a set over the path's values, not its length. Paths are capped at 500 entries. `backtrack_count` can be inflated by a Participant who forges the `?at` index, so treat it as noisy.

### [EXECUTION PLAN] 2026-09-22 — /implement (Claude Fable 5.1)

**Contract:** this ticket as written; no scope change. `Route: contract` added above — the ticket predates the proportional harness and carried no route line; a new Member-only surface reading Runs is contract work by `docs/agents/testing.md`'s definition. Criteria in checklist order: AC-1 Seam A aggregation with hand-computed expectations (take-rate, Ending counts, Outcome distribution, abandonment, starts, completions; zero-run and all-abandoned; other versions excluded); AC-2 the canvas overlay shows the numbers and switching version changes them; AC-3 the Outcome chart matches the overlay totals; AC-4 non-Members get 404 on the analytics route; AC-5 Seam B, two Runs to different Endings shown with percentages. Derived DoD: DoD-1 the `contract` chain green (`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`, then one `E2E_EVIDENCE=<the analytics spec's tests> pnpm test:e2e`; no `pnpm db:migrate`, the schema is untouched); DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only, never real run data.

**Availability:** `Blocked by` 06 and 09 are both `done` on `staging`; no other claim. Branch `feat/10-analytics` from `staging` at `2f61ab0`, in a worktree at `.claude/worktrees/10-analytics/journeys` (Paul is working ticket 11 in a parallel session). The worktree carries no `.env.local`; the chain runs with throwaway values for the OAuth pairs and the auth secret, the same way ticket 16's baseline measurement did.

**Decisions resolved from the spec, `CONTEXT.md`, ADR-0002, and the 2026-09-21 comment** (the ticket leaves them open):

- Analytics live on an "Analytics" tab of the Journey page (`?tab=analytics`), beside Editor, Versions, and Responses, so the Member check and the 404 are the page's own. The Published Version is named in the address too (`&version=<id>`), chosen from a "Version" select of the Journey's versions newest first; the default is the live version, or the newest when none is live; a `version` that names none of this Journey's versions falls back to the default, so a foreign id can never read another Journey's Runs. A never-published Journey shows "Not published yet."
- Every metric is computed in one pure function, `analyticsForVersion` in `src/lib/analytics.ts`, from the version's document and its Run rows (`path`, nothing else is needed): a Run is a start; it is completed when its last path entry is an Ending of the document and abandoned otherwise, which is the spec's rule (line 196) read off the path alone; abandonment is counted on the Run's last entry only, per the 2026-09-21 comment. A Choice's take-rate counts every traversal — each consecutive pair of path entries that is one of the source Step's Choices — over every visit to the source Step (every path entry naming it), so a Step's Choices plus the Runs that stop on it account for every visit exactly once. Two Choices of one Step leading to the same Step are indistinguishable in a path, so they share the pair's number; the rate is null (shown as "—") for a Step no Run has visited. The Outcome chart groups completed Runs by the Ending's Outcome id and its label from the version's document, an untagged Ending under its own Step title (ticket 24's rule), plus an "Abandoned" group, so the bars sum to the starts and the Outcome bars sum to the Ending counts on the map (AC-3). Runs from other versions are excluded by the pure function as well as by the query, so the rule is testable by hand.
- The map is a read-only React Flow canvas of its own, `AnalyticsCanvas`, laid out by the same `layoutGraph` as the editor and drawn with the editor's own arrow geometry and box styling, moved out of `journey-canvas.tsx` into `canvas-shared.ts` for both to import. Boxes are not buttons — nothing opens — and carry the count: "N runs" on an Ending, "N abandoned" elsewhere; each arrow carries its Choice label and its take-rate and traversal count, and is drawn thicker the more it is taken. Pan, zoom, and fit-to-view as the editor. Totals (starts, completions, abandoned, completion rate) sit above the map as a row of tiles; the Outcome chart is a horizontal bar table beneath it, one hue for Outcomes and a muted bar for Abandoned, each bar directly labelled with its count and share, so the table is its own accessible reading.
- Data access is `getAnalyticsForMember` in a new `src/db/analytics.ts`: Member-checked through `getJourneyForMember` like every other read, the version constrained to the Journey, the Run rows selected by `version_id` (the index ticket 06 left for this). Nothing here ever touches `src/db/runs.ts`, whose contract is the anonymous runner's.
- `.claude/worktrees/**` is added to ESLint's ignores: a worktree's `.next/` sits under the main checkout and the top-level `.next/**` ignore does not reach it, so `pnpm lint` in the main checkout would otherwise scan this worktree's build output.

**Structure:** one session, seams in order. (1) Seam A by TDD: `src/lib/analytics.ts` and its test. (2) Data access. (3) `canvas-shared.ts` extraction, no behaviour change, the canvas spec untouched. (4) `AnalyticsCanvas`, the totals, the chart, the version select, the tab. (5) Seam B: `e2e/analytics.spec.ts` — two Participants to different Endings and a third who stops, then a second version with an untagged Ending, the select switched between them, and a non-Member's 404.

**Review:** `/code-review` (two fresh readers, standards and spec), as `contract` requires. **Red team:** not run — this reads Runs the spec already defines (lines 165–200) into a Member-only page; it changes no part of the graph model, publishing, Run semantics, auth, the schema, or the deploy path.
