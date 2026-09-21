# 18: Allow cycles

Status: done
Blocked by: None
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-21
Parent: `.scratch/journeys-platform/spec.md`
Priority: first of the graph tidy-up series (Paul, 2026-09-21): 18 → 16 → 19 → 17.

**Decision (Paul, 2026-09-21):** cycles are allowed. "As long as we have a fix, we shouldn't limit users." This amends the spec's publish rule "the graph has no cycles" and its "Back navigation" section, and `decisions.md`'s "publish-time validation rejects cycles". Record the amendment as a `[SCOPE CHANGE]` on the spec and write `docs/adr/0002-cycles-and-back-navigation.md` as part of this ticket.

**Why the rule existed:** a Run's path is one linear route and the runner classifies a navigation by whether the target Step is already on the path (not on it → forward Choice, on it → backtrack). That only works if a Step appears at most once, which the no-cycles rule guaranteed; ticket 06 leaned on it again to resolve Choices taken from cached Back pages. Four legacy Choices were dropped in ticket 04 because of it.

**What to build:**

1. **Path with repeats and a position.** The Run's path keeps every visit, repeats included; the runner's notion of "current" is the last entry. Resolution of a navigation to Step X, in order: (a) X is a Choice target of the current Step → forward, append; (b) X is on the path → backtrack, truncate to its **latest** occurrence and count a backtrack; (c) otherwise refused, redirect to the current Step. Case (a) is checked before (b) so closing a loop by choosing is a forward move. Browser Back on a loop-closing Step is the one ambiguous case (X is both the previous entry and a Choice target): the runner writes the path index into `history.state` on every step page, and a navigation that arrives with an index earlier than the current one is a backtrack to that index, not a Choice. Cap the path at 500 entries; a forward move past the cap is refused with a short participant-facing message.
2. **Reducer.** `src/lib/graph/run.ts` implements the above; its doc comment stops citing the no-cycles guarantee. Seam A: a 2-cycle (A ⇄ B) walked forward three times yields a path of four; Back from the loop-closing Step truncates by index; a step URL for a Step both earlier on the path and a current Choice takes the Choice; the cap refuses the 501st entry; every existing case still passes.
3. **Validation.** Drop the `cycle` rule from `validateForPublish`, its `PublishProblemCode` member, and its Seam A cases; the canvas stops marking cycles automatically (`problemsByAddress` needs no change). Update the spec's rule list (story 37 stays as written; the "no cycles" sentence goes).
4. **Legacy journeys restored.** Put back the four dropped Choices in `scripts/seed/journey-stories/`: case-1 `step-46` "Detention 1" [Yes] → `step-1`; case-2 `step-19` "Call Sponsor" [Call the legal organization] → `step-2`, `step-27` "I quit!" [Call your bunkmate's cousin's friend] → `step-32`, `step-52` "ER" [Go home, and try again later] → `step-53`, each with its legacy label verbatim and in its legacy position among the Step's Choices (check `~/Code/journey/src/data/cases/case-{1,2}.json`). Case-1 `step-32` "Detention" stays omitted (unreachable in the legacy data itself, nothing to do with cycles). Update the Seam A counts in `validate.test.ts` (case-1 70 Choices, case-2 105) and the README's "Four choices and one step were left out" bullet to say one Step was left out and why.
5. **Analytics contract note** for ticket 10: paths may repeat a Step; abandonment counts the last entry only; choice take-rate counts each traversal.

- [ ] Seam A: the reducer cases in item 2, and `validateForPublish` returns `[]` for a document with a 2-cycle.
- [ ] Seam A: the three seeded documents validate; case-1 has 70 Choices and case-2 105; `step-46`, `step-19`, `step-27`, `step-52` carry the restored Choices with the legacy labels.
- [ ] Publishing a Draft with a loop succeeds.
- [ ] Seam B (`e2e/runner.spec.ts`, new test `runner-loop-and-back`): a published 3-Step Journey with a loop; choose around the loop twice (path length grows), press browser Back (path truncates to the previous index, backtrack count 1), choose the loop again (forward), reach the Ending; the `run` row's path matches. Screenshot under `test-results/`.
- [ ] Seam B: seeding case 2 and walking "I quit!" → "Call your bunkmate's cousin's friend" in the runner lands on `step-32`.
- [ ] ADR-0002 written; spec `[SCOPE CHANGE]` recorded; README updated.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's decision on 2026-09-21 after the canvas feedback.

## Comments

### [EXECUTION PLAN] 2026-09-21 — Atlas orchestrator

**Contract:** this ticket as it stands, plus the spec's `[SCOPE CHANGE] 2026-09-21 — cycles allowed` (already on file from PR #20) and `decisions.md`'s amended Back-navigation bullet. Criteria are AC-1..AC-7 in checklist order (AC-1 reducer and validation Seam A; AC-2 seeded documents Seam A; AC-3 publishing a loop; AC-4 `runner-loop-and-back`; AC-5 the case-2 walk; AC-6 ADR-0002, spec, README). Derived DoD from the footer, `docs/agents/testing.md`, and `CLAUDE.md`: DoD-1 verified run command green; DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only, no participant data. No dependency changes are expected, so no lockfile gate. Run surface: local + deployed; per Paul's 2026-09-20 decision there is no post-merge staging smoke gate. No human gates: nothing here needs a key, a deploy approval, or a lockfile commit.

**Resolved decisions (execution, not contract):**

- Navigation resolution, in this order, for a request to Step X with an optional path index `at`: (0) X is not a Step → refused. (1) `at` names an index earlier than the current one and `path[at] === X` → backtrack to that index (truncate to `at + 1`, count one backtrack); `at` equal to the current index with `path[at] === X` → stay; any other `at` is ignored. (2) X is the current Step → stay. (3) X is a Choice target of the current Step → forward: append (refused with reason `path-full` when the path already holds 500 entries). (4) X is on the path → backtrack to its **latest** occurrence, count one. (5) X is offered by an earlier Step on the path (ticket 06's cached-page rule) → truncate to the latest such Step, count one, append. (6) otherwise refused. Steps 3 before 4 is the ticket's "closing a loop by choosing is a forward move"; step 5 is kept because the ticket requires every existing reducer case to keep passing, and it is strictly more permissive than refusing.
- The index travels as a query parameter `?at=<n>` on the step URL. The step page renders a client component that, on every render, writes `{ pathIndex }` into `history.state` (merged with whatever Next.js keeps there) and strips `?at` from the address bar with `replaceState`. On a back/forward navigation (`performance` navigation type `back_forward`, or `pageshow` with `persisted`) it replaces the location with `?at=<history.state.pathIndex>` instead of the plain reload it does today, so the server learns which entry the Participant came back to. The in-app Back link also carries `?at=<current index − 1>`, because on a loop-closing Step the previous Step is also a Choice target. This replaces `ReloadOnRestore`.
- A refused forward move past the cap redirects to the current Step with `?notice=path-full`, and the step page shows one short sentence ("This journey has gone on too long to continue; start over to keep going" or similar) above the Choices.
- `choice-list.tsx` stops excluding a Step's own Step from Choice targets — that exclusion existed only because a self-loop was a cycle problem.
- Restored Choices take their legacy position and the Step's Choice ids are renumbered `step-<N>-choice-<i>` in legacy page order (the seed's own convention), so case-1 `step-46` reads Yes = `choice-1`, No = `choice-2`. Drafts are replaced wholesale on reseed, so no stored id is load-bearing.
- The spec's rule list (line "Publish-time validation additionally enforces…") loses its no-cycles sentence and its "The no-cycles rule is what makes Back navigation unambiguous…" sentence; the "Back navigation" paragraph gains a pointer to the scope change and ADR-0002; the Seam A test list drops "cycle". Story 37 stays as written. ADR-0001 gets one "Amended by ADR-0002" line under its status; its text is otherwise left as the record of what was decided then.
- The ticket-10 analytics note is written by the orchestrator as a comment on ticket 10 in the closeout commit.

**Execution structure: sequential, direct checkout on `feat/18-allow-cycles`, no worktrees.** Parallelism was rejected on two grounds: D1 and D2 would both run `pnpm test:e2e`, which owns port 3100 and the `journeys_e2e` database (shared mutable state, cannot run twice at once); and the predicted file overlaps are `src/lib/graph/validate.test.ts` (D2 removes the cycle cases, D3 changes the seeded counts) and `e2e/runner.spec.ts` (D1 and D3 each add a test). The prediction is re-checked at closeout.

- **D1 — path with repeats and a history index** (`atlas-worker`, opus): `src/lib/graph/run.ts` and `run.test.ts` (the Seam A cases in item 2 plus the `at` and cap cases), `src/app/j/[journeyId]/[stepId]/page.tsx`, the client component that replaces `src/components/runner/reload-on-restore.tsx`, `e2e/setup/documents.ts` (`loopDocument()`), `e2e/runner.spec.ts` (`runner-loop-and-back`). Existing runner specs stay green.
- **D2 — cycles leave validation and the canvas** (`atlas-worker`, sonnet): `src/lib/graph/validate.ts` and `validate.test.ts`, `src/components/journeys/choice-list.tsx`, `e2e/canvas.spec.ts` (`canvas-validation-marks`: a loop adds an edge and no mark), `e2e/publish.spec.ts` (new `publish-draft-with-loop`).
- **D3 — legacy journeys restored, ADR, spec, README** (`atlas-worker`, sonnet): `scripts/seed/journey-stories/case-{1,2}.json`, the counts in `validate.test.ts`, `README.md`, the spec edits above, `docs/adr/0002-cycles-and-back-navigation.md`, the ADR-0001 amendment line, `e2e/runner.spec.ts` (`runner-case-2-restored-choice`: publish the case-2 document, walk the shortest route from the Start to "I quit!", choose "Call your bunkmate's cousin's friend", land on "Trafficking?" with the `run` row's path ending in `step-32`).

**Verification map (evidence committed under `test-results/`; the root is cleared once, immediately before the aggregate capture):**

| Criterion | Command / action | Surface and dependencies | Expected | Evidence | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 reducer cases; `validateForPublish` accepts a 2-cycle | `pnpm test` (`run.test.ts`, `validate.test.ts`) | local Vitest | all green, the named cases present | `test-results/ac-1-seam-a-reducer-and-validation.txt` | after D2 (reducer half after D1) | any change under `src/lib/graph/` |
| AC-2 seeded documents validate; case-1 70 Choices, case-2 105; the four restored Choices with legacy labels | `pnpm test` (`validate.test.ts`) plus a script that prints the four Steps' Choices | local Vitest | counts and labels as stated | `test-results/ac-2-seeded-documents.txt` | after D3 | `scripts/seed/journey-stories/*.json`, `validate.ts` |
| AC-3 publishing a Draft with a loop succeeds | `pnpm test:e2e` test `publish-draft-with-loop` | local; docker Postgres `journeys_e2e`; e2e server on 3100 | badge "Published", one `published_version` row | `test-results/publish-draft-with-loop/publish-draft-with-loop.png`, `test-results/dod-1-e2e.txt` | after D2 | `src/`, `e2e/` |
| AC-4 loop, browser Back, loop again, Ending; the row's path matches | `pnpm test:e2e` test `runner-loop-and-back` | as AC-3 | path grows around the loop, truncates by index on Back with `backtrack_count` 1, then reaches the Ending | `test-results/runner-loop-and-back/runner-loop-and-back.png`, `test-results/dod-1-e2e.txt` | after D1 | `src/lib/graph/run.ts`, `src/app/j/`, `src/components/runner/`, `e2e/` |
| AC-5 case 2: "I quit!" → "Call your bunkmate's cousin's friend" lands on `step-32` | `pnpm test:e2e` test `runner-case-2-restored-choice` | as AC-3 | heading "Trafficking?", path ends `step-27`, `step-32` | `test-results/runner-case-2-restored-choice/runner-case-2-restored-choice.png`, `test-results/dod-1-e2e.txt` | after D3 | `case-2.json`, runner code |
| AC-6 ADR-0002 written; spec `[SCOPE CHANGE]` recorded; README updated | static: `git diff --stat` of the docs plus a grep proving the no-cycles sentence is gone | local | files present, sentence gone | `test-results/ac-6-docs.txt` | after D3 | the named docs |
| DoD-1 verified run command green | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` | local; docker Postgres | every command exits 0 | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt` | after D3 | any source, config, or test change |
| DoD-2 every PASS artifact committed; fixture journeys only | evidence review at closeout | local | as stated | this ticket's `[CLOSEOUT]` | closeout | — |

### [PROGRESS] 2026-09-21 — D1–D3 integrated; aggregate review found a structural defect; D4 fixed it

- **D1** — `atlas-worker` on opus — `400c3a2`: reducer with repeats, index, and cap; `RunHistory` replacing `ReloadOnRestore`; `loopDocument()`; e2e `runner-loop-and-back`. Accepted on screen.
- **D2** — `atlas-worker` on sonnet — `8536675`: cycle rule and code removed from `validateForPublish`; loop cases replaced by "accepts a two-step loop" and "accepts a Choice that points at its own Step"; `choice-list.tsx` offers every Step as a target; `canvas-validation-marks` expects no mark on a loop; e2e `publish-draft-with-loop`. Accepted on screen.
- **D3** — `atlas-worker` on sonnet — `8e4c5da`: the four legacy Choices restored (verified against the legacy JSON, legacy order, ids renumbered); counts 70/105 plus a Seam A case for the labels; README; spec edits; ADR-0002; ADR-0001 amendment line; e2e `runner-case-2-restored-choice` (BFS route to "I quit!"). Accepted on screen.
- **Aggregate verification, first capture at `8e4c5da`:** 38 of 39 e2e passed; `runner-loop-and-back` failed under 5 parallel workers — the `run` row stayed at six entries for the whole poll, meaning a browser Back that reached the server was written as a forward Choice and the client-side `?at` correction never fired (hydration starved by the dev server). Not a flake: a structural dependency on hydration. Discarded that capture; the proof root was cleared again.
- **D4** — `atlas-worker` on opus — `9ad350f`: review fixes below. The worker's probe showed history entries left before hydration remembered no index at all, so the inline script now both records the index and corrects a misread Back; "Start over" is rendered beside the path-full notice. Full e2e green twice under load. Accepted on screen.
- Parallelism re-check against the real diffs: D1 and D3 both changed `e2e/runner.spec.ts` (disjoint hunks); D2 and D3 both changed `src/lib/graph/validate.test.ts` (disjoint hunks). The predicted overlaps existed but would have merged cleanly; the binding reason for sequencing was the shared e2e port and database, which held. The isolation record stands as written.

### [AI CODE REVIEW] 2026-09-21 — aggregate review of `0296893..8e4c5da`, fixes in `9ad350f`

Two fresh reviewers (one per axis, opus) read the whole diff against the ticket, the execution plan, `CONTEXT.md`, ADR-0001, the legacy JSON, and the neighbouring code; the orchestrator adjudicated every candidate from the cited hunks. Both reviewers confirmed the restored Choices label-for-label and target-for-target against `~/Code/journey`, the counts 70 and 105, module boundaries, vocabulary, and that no dead code was left by the rule removal.

**Axis 1 — technical implementation and spec conformity** (9 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| T1 the only aggregate capture failed AC-4; evidence at `8e4c5da` was ticket 09's | blocking | `test-results/` | resolved: D4 plus the recapture at `9ad350f` (see `[CLOSEOUT]`) |
| T2 the corrective `?at` navigation lived in a React effect and fired unconditionally; a Back that reached the server was written as a Choice first and depended on hydration to be undone | blocking | `run-history.tsx`, `page.tsx` | resolved: `RunHistoryScript`, an inline script that runs while the page parses, records the index and corrects a `back_forward` document when it came from cache or its remembered index differs from the rendered one; `RunHistory` keeps only the back/forward-cache case and the URL strip |
| T3 a Choice onto its own Step is a stay (rule 3 before rule 4) while ADR-0002 said it appends | non-blocking | ADR-0002, `run.test.ts` | resolved: ADR mirrors `run.ts` rules 1–7; test pins the stay |
| T4 spreading `history.state` copied Next's `__NA` marker, so its patched `replaceState` skipped syncing the router's canonical URL and could bring `?at` back | non-blocking | `run-history.tsx` | resolved: plain `{ pathIndex }` state |
| T5 10 s `expect.poll` budget for a second page load on a busy dev server | non-blocking | `e2e/runner.spec.ts` | resolved: 30 s on both Back tests |
| T6 Back-navigation paragraph lacked the pointer the plan promised; ticket 06's spec note still claimed "never ambiguous" | non-blocking | `spec.md` | resolved: pointer added; amendment line under the note |
| T7 no tests for out-of-range `at`, `parsePathIndex`, the self-loop stay, or the participant-facing cap | non-blocking | `run.test.ts`, `e2e/runner.spec.ts` | resolved: reducer cases added; `parsePathIndex` moved to `run.ts` and tested; e2e `runner-path-cap` grows a Run's path to 500 by SQL and proves the notice, the stay, and the Start over control |
| T8 a forged `?at` can inflate `backtrack_count` | non-blocking | ADR-0002 | resolved: Negative consequence added; ticket 10 told |
| T9 a self-targeting Choice renders as a zero-length edge on the canvas | non-blocking | `layout.ts` | deviation: cosmetic, dagre handles it, ticket 19's territory |

**Axis 2 — coding standards** (13 candidates, all non-blocking)

| # | Paths | Disposition |
|---|---|---|
| S1 `run` table comment still said "current linear route" | `schema.ts` | resolved |
| S2 page JSDoc orphaned by `parsePathIndex` placement | `page.tsx` | resolved |
| S3 ticket number in a test name; S5 broken rename "…together a problem"; S12 `(c)` parameter | `validate.test.ts` | resolved |
| S4 comment contradicted the removal step | `canvas.spec.ts` | resolved |
| S6 import order; S7 `queue.shift()!` | `e2e/runner.spec.ts` | resolved |
| S8 `searchParams` typed narrower than Next supplies | `page.tsx` | resolved: `string | string[]` narrowed |
| S9 ADR `Decided` line; S10 notice quoted inexactly; S11 two rule numberings | ADR-0002, `run.ts` | resolved: one numbering 1–7 |
| S13 `feat(seed)` scope undersells the D3 commit | `8e4c5da` | deviation: body enumerates the contents; an accepted commit is not rewritten |
| risk: ADR-0001's body keeps the withdrawn rule; `decisions.md` line 96 had no cross-reference | ADR-0001, `decisions.md` | ADR-0001 by design (amendment line under Status); cross-reference added |

**Remaining risks:** (1) the disambiguation rests on browsers restoring `history.state` per entry and on Next's `preserveCustomHistoryState` staying true — only the e2e would notice a regression; (2) a back/forward-cache restore still needs hydration to register `pageshow`, so a bfcache Back on a starved page is the one uncorrected path (Chromium never took bfcache in these runs); (3) `next dev` logs a React development-only "script tag while rendering" notice on step pages reached by a server-action redirect, where the inline script does not execute and `RunHistory` records the index instead — no effect in production builds, filtered from the e2e evidence; (4) ticket 10 inherits a path that is not a set (contract recorded on ticket 10 and in ADR-0002); (5) the 500 cap is arbitrary and reachable by a bot.

### [CLOSEOUT] 2026-09-21 — Atlas orchestrator

**PR:** https://github.com/paul-macfarlane/journeys/pull/21 (`feat/18-allow-cycles` → `staging`). Per the tracker rule Paul set on 2026-09-21, this closeout commit carries `Status: done`; merging the PR is the acceptance that lands it on `staging`.

**Repository delivery:** `journeys`, base `staging` at `0296893`, five commits: `400c3a2` D1 (opus), `8536675` D2 (sonnet), `8e4c5da` D3 (sonnet), `9ad350f` D4 review fixes (opus), `6fee81e` evidence and records (orchestrator). Direct checkout, no worktrees.

**Exact verified run command** (local; docker Postgres on 5436; evidence captured at `9ad350f`, committed in `6fee81e`):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e
```

Every command exits 0; Vitest 183 passed; Playwright 40 passed. The e2e evidence file notes the dev-only lines removed before commit (dotenv tips, the React development notice about the inline script, one Next dev "aborted" line).

**Criterion verdicts (evidence under `test-results/`):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 reducer cases (loop walked forward, Back by index, Choice preferred without an index, cap refuses the 501st, latest occurrence, self-loop stay, out-of-range index ignored); `validateForPublish` returns `[]` for a 2-cycle and a self-loop | PASS | `ac-1-seam-a-reducer-and-validation.txt` (60 tests) |
| AC-2 the three seeded documents validate; case-1 70 Choices, case-2 105; `step-46`, `step-19`, `step-27`, `step-52` carry the restored Choices with the legacy labels and targets | PASS | `ac-2-seeded-documents.txt` (19 tests plus the printed Choices) |
| AC-3 publishing a Draft with a loop succeeds | PASS | `publish-draft-with-loop/publish-draft-with-loop.png`, `dod-1-e2e.txt` ✓ |
| AC-4 `runner-loop-and-back`: loop twice, browser Back truncates to the previous index with `backtrack_count` 1, loop again forward, reach the Ending; row path `[start, queue, start, queue, start, queue, waved-through]` | PASS | `runner-loop-and-back/runner-loop-and-back.png`, `dod-1-e2e.txt` ✓ |
| AC-5 case 2 published from the committed document, BFS route to "I quit!", "Call your bunkmate's cousin's friend" lands on "Trafficking?" with the path ending `step-27, step-32` | PASS | `runner-case-2-restored-choice/runner-case-2-restored-choice.png`, `dod-1-e2e.txt` ✓ |
| AC-6 ADR-0002 written; spec `[SCOPE CHANGE]` on file (PR #20) and the rule list, Back-navigation paragraph, and Seam A list amended; ADR-0001 amendment line; README updated | PASS | `ac-6-docs.txt` |
| Path cap: forward move past 500 refused with the notice and a Start over control, nothing recorded (review addition) | PASS | `runner-path-cap/runner-path-cap.png`, `dod-1-e2e.txt` ✓ |
| DoD-1 verified run command green | PASS | `dod-1-commands.txt`, `dod-1-e2e.txt` |
| DoD-2 every PASS artifact committed; fixture journeys only, no participant data | PASS | `6fee81e`; the seeded case-2 walk and the loop fixtures hold authored narrative only |

**Deviations (all approved by the orchestrator under the plan):** ticket 06's Choice-from-an-earlier-page rule kept as rule 6 (the ticket requires every existing reducer case to pass); the restore correction and index recording run from an inline pre-hydration script rather than only the client component (the ticket names the mechanism — history state and a path index — not where it runs); "Start over" is offered beside the path-full notice; a self-targeting Choice renders as a zero-length canvas edge (cosmetic, ticket 19); the D3 commit's `feat(seed)` scope undersells its docs content; ADR-0002 is longer than the plan's estimate.

**Human follow-ups:** (1) review and merge PR #21; (2) if the seeded cases live on staging, rerun `DATABASE_URL=<Neon staging pooled string> pnpm seed:journey-stories pauljosephmacfarlane@gmail.com` after the merge so case 1 and case 2 regain their loops there; (3) ticket 16 (canvas authoring) becomes available once this PR merges, since it is blocked by 18.
