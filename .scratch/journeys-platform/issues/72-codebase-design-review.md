# 72: Codebase design review

Status: done
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

- [x] The findings list covers all five scope areas, including any that turned up nothing.
- [x] Tickets 73 and 74 carry a comment naming the design they should follow.
- [ ] Paul has approved the proposed ticket order.

Use `CONTEXT.md` vocabulary. Origin: Paul's post-hackathon grilling, 2026-09-26 (Q6, Q15).

## Comments

### [CLOSEOUT] 2026-09-26

Read-only review of `src/`, `e2e/`, `scripts/`, the docs, and the tracker. The frame is `mattpocock-skills:codebase-design`: depth, seams, the deletion test. Nothing was implemented. Four read-only explorer agents swept the five scope areas in parallel, and the orchestrator checked each finding it kept against the code. Two were corrected:

- Publish *is* preceded by the editor's blur flush, so W8 is low.
- The run cookie is a sufficient bearer credential, so A4 is `wontfix`.

Severity: **H** means it causes or will cause a defect or blocks a planned ticket. **M** means it costs locality or duplicates a rule. **L** is tidiness.

#### 1. Module boundaries

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| M1 | M | The membership check is not one seam. About 15 `src/db` functions repeat `getJourneyForMember(...)`. Three separate membership joins exist. `createJourney`, `listJourneysForProject`, and `listMembers` trust the caller, which contradicts `projects.ts:20` ("every read and write re-checks it"). | `journeys.ts:144, 204-208, 246`, `members.ts:30`, `drafts.ts:46`, `projects.ts:132` | **82** |
| M2 | M | `getJourneyForMember` has no `cache()`, so the Journey page repeats the membership join about six times per render (each plus a version count). `publishDraft` checks twice. | `[journeyId]/page.tsx:56-123`, `versions.ts:153-156` | **82** |
| M3 | M | Five failure shapes across db and actions (`null`, `false`, `reason`, `conflict`, `stepId`), so "no longer exists" is hand-mapped at 19 sites. | `src/lib/action-result.ts`, `members.ts:39-41`, `versions.ts:111`, `journeys/actions.ts:166, 191` | **82** |
| M4 | M | Rules in the wrong layer: publish-state rules are computed in a page (`page.tsx:124-139`); Content is sanitised in an action for Projects (`projects/actions.ts:83`) but in the db layer for Drafts (`drafts.ts:106`). | as cited | **82** |
| M5 | L | Duplicate db helpers: `isUniqueViolation` (`versions.ts:118`, `members.ts:176`), the Project row lock (`journeys.ts:132`, `members.ts:113-117`), the Draft upsert (`drafts.ts:110`, `versions.ts:273`), and inline `revalidatePath` pairs (`projects/actions.ts`). | as cited | **82** (the Draft upsert goes in 73) |
| S1 | M | `journey-canvas.tsx` (1739 lines): `CanvasFlow` is about 800 lines, and `JourneyCanvasProps` has 27 props (17 callbacks), so the interface is nearly as wide as the implementation. | L756-788, L837-1639 | **86** |
| S2 | M | `draft-editor.tsx` (1078 lines) mixes save, adopt, history, panel preference, edit wrappers, and problem derivation. | L155-905 | **81** (the save loop), **86** (the rest) |
| S3 | L | `layout.ts` (894 lines): one 275-line function; `problemsByAddress` does not belong there, and its key encoding leaks into `draft-editor.tsx:895-905`; it is computed twice. | L578-853, L870 | **86** |
| S4 | L | Pure geometry is in `src/components/journeys/canvas-shared.ts`, beside a hook, with no tests. | L25-236 | **86** |
| M6 | L | `src/lib` is not wholly pure: `auth.ts` imports `db`; `session.ts` and `ai/judge.ts` are `server-only`, and `judge.ts` holds a mutable map. | `src/lib/auth.ts:7-8`, `judge.ts:20` | `wontfix`, and document it instead: `CLAUDE.md`'s `src/lib` line gains "plus the server-only auth, session, env, and Judge modules". Moving them buys nothing, because `server-only` already enforces the rule the layer exists for. Folded into **85**'s doc edits. |

#### 2. The write path (ticket 73's design)

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| W1 | H | Two autosave loops: the Draft editor keeps its own copy of `createAutosave`. Ticket 73 would write `stale` twice. | `draft-editor.tsx:155-375`; `src/components/autosave.ts:16` says so | **81**, before 73 |
| W2 | H | Publish reads the Journey and the Draft outside its transaction, with no lock, so a save landing between the read and the insert publishes the older document. | `versions.ts:153-164` | 73, comment point 4 |
| W3 | H | One version counter per row would make a Member stale against themselves: three loops write `project`, and six writers write `journey`. | `project-settings-fields.tsx:42, 60`, `project-theme-settings.tsx:36`, `versions.ts:188, 218`, `journeys.ts:371` | 73, comment point 2: a counter on `draft`; compare-previous-value per field on settings |
| W4 | H | `adopt` while dirty moves the baseline onto the other Member's value, which would defeat any stale check. | `src/lib/autosave.ts:176-180`, `autosaved-form.ts:151-157` | 73, comment point 3 |
| W5 | M | Unload writes bypass the single-flight loop and can land beside, or out of order with, a write in flight. | `autosave.ts:190-193`, `draft-editor.tsx:367` | **81** |
| W6 | M | The editor's "unmount" save runs whenever `save` changes identity (`router`, `projectId`, `journeyId`), not only on unmount. | `draft-editor.tsx:240, 352-358` | **81** |
| W7 | L | The Theme checkbox writes the `journey` row outside the Theme fields' loop. | `journey-theme-settings.tsx:40-61` | 73, comment point 7 |
| W8 | L | Publish depends on the editor's blur flush having dispatched the pending save before the publish action. It does (server actions run in order), but only implicitly. | `draft-editor.tsx:403-407`, `publish-controls.tsx` | `wontfix`: once 73 lands, publish sends the Draft version and refuses a mismatch, which makes the ordering explicit. |

The recommendation for 73 is written as a comment on ticket 73. "Written once" there means one data-layer helper (a guarded write that answers `stale` or `not-found`) and one terminal `stale` state in the one autosave loop. The helper takes two kinds of guard, because a single counter per row fails W3: a `version` counter for the Draft, and compare-previous-value for settings fields.

#### 3. Dead code and leftovers

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| D1 | M | AI-authoring text survives ticket 14's cut. `.env.example` calls the key an "Anthropic API key for AI authoring". The same leftovers are in `env.ts`, `README.md`, `human-prerequisites.md` §6, ADR-0001, and `spec.md`'s stories and "### AI" section. No code survives. | `.env.example:19`, `src/lib/env.ts:24-26`, `README.md:39`, `human-prerequisites.md:53-61`, ADR-0001 L33-34 and L112-113, `spec.md:140-148, 212-216` | **85** |
| D2 | M | `@tanstack/react-query` is a dependency nothing imports. | `package.json:41`; no import in src, e2e, scripts, or config | **85** (the lockfile is Paul's) |
| D3 | L | Dead exports: `parseGraphDocument` has only its own test. Four validation input types have no reference. `hasStep` is bypassed at 13 sites. `addNextStep` and `connectToNewStep` are identical. | `document.ts:217`, `validation/*`, `draft-editor.tsx:737, 813` | **85** |
| D4 | L | The reserved document fields `position`, `condition`, `effect`, `allowBack`, and `prompt.type` are validated and stored but never read. `position`'s reason (ticket 17) is `wontfix`. | `document.ts:28-29, 46, 78, 139`; `layout.ts:19-22` | Removing them is `wontfix`. Each needs two deploys (tolerate absence, then stop writing) for no user-visible gain, and zod strips nothing harmful. **85** rewords the stale comments. |
| D5 | L | The `project.description` text column is dead since ticket 07. | `schema.ts:113-119` | **85**, in two PRs (Drizzle inserts name every column) |
| D6 | L | Other unused columns: `project.themeCustomTokens`, `member.role` (both reserved), and `run.startedAt` (fetched, never used). | `schema.ts:140, 170, 314` | `wontfix`: they are nullable or defaulted and cost nothing. `run.startedAt` is real data worth keeping for a later "time to complete". |
| D7 | L | Unused shadcn parts (`DropdownMenuSub*`, `AvatarGroup*`, …), and `export` on types used only in their own file. | `src/components/ui/*` | `wontfix`: generator output, and re-running the generator would restore them; exported types cost nothing. |

No TODO, FIXME, or commented-out code; every file is imported; every `package.json` script resolves.

#### 4. Testability

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| T1 | M | The pure core is well covered: every `src/lib/graph` module has a test, and all 21 edit functions are tested. Gaps: `hasStep`, `hasOutcome`, `readStoredImageAttrs`, and `run-cookies.ts`. Nothing asserts results are independent of `steps` key order, which Postgres `jsonb` reorders. `validateForPublish` lists problems in raw key order. | `content.ts:158`, `validate.ts:58` | **85** |
| T2 | H | e2e patterns that are sensitive to load: a transient "Unsaved changes" assertion, `expectSaved` passing before the status leaves "Saved" ahead of a direct database write (about 12 sites), one-shot reads, immediate negative assertions, and two specs on 20 s `toPass` blocks under the 30 s default. | `projects-and-journeys.spec.ts:622, 652`; `canvas.spec.ts:287, 1153, 1520, 1901, 2130, 2628`; `analytics.spec.ts:349` | 74, comment |
| T3 | M | Spec helpers are copied: `readDraft` ×5 under three names, `startJourney` ×4, and the held-server-action route ×3, among about 10 others. | `canvas.spec.ts:91, 105, 113`, `prompts.spec.ts:58, 68`, `step-editing.spec.ts:53, 74, 82`, `projects-and-journeys.spec.ts:643, 767`, `runner.spec.ts:461`; the full list is in the comment on 74 | 74, comment |
| T4 | L | `src/db` has no unit tests; it is covered by e2e only. | `ls src/db` shows no `*.test.ts`; `vitest.config.ts` sets no coverage thresholds | `wontfix`: the e2e suite runs against a real database, which is the right seam. Mocking Drizzle would test the mock. 73 and 83 add unit tests where they add pure logic. |

#### 5. Ticket 15's design questions

| # | Sev | Question | Finding | Recommendation |
|---|---|---|---|---|
| Q-order | L | Explicit Step order in the document | `steps` is a record keyed by id (`document.ts:141`). Every order the app shows is derived: `mapOrder` (`layout.ts:853`, y then x), Choice order, and breadth-first from the Start (`response-list.ts:45-55`). Analytics sorts to be stable (`analytics.ts:198`). | `wontfix` for an explicit order field: every surface already derives a meaningful order, and a stored order would be a second truth to keep in sync. The one real risk, results changing with key order, is covered by **85**'s key-order invariance test and the `validate.ts` ordering fix. |
| Q-jsonb | L | jsonb querying | Production never queries inside a document; it loads whole rows. Analytics reads one version plus each Run's `path` through `run_version_id_idx` and computes in JS. | `wontfix`: the documents are small, and analytics is one version at a time. Revisit only if the Analytics tab measures slow on a real Journey; a GIN index then is additive. |
| Q-corrupt | H | Corrupt-row handling | Eight throwing parses in `src/db` and no `error.tsx` or `global-error.tsx`, so a bad row is Next's default 500. A bad Published Version breaks every live Run on it. A Run's `path` is never validated. | The Draft is 73 (comment point 5); everything else is **83**. |
| Q-abuse (A1–A3) | H | Rate limiting and abuse | An undecided Start Response travels in the address (`j/[journeyId]/actions.ts:131`). The Judge's only limit is 1/s per key in per-instance memory, keyed by free-to-mint cookies, with no per-Run cap or budget and uncapped model input (`judge.ts:19-20`, `decide.ts:67`). Run creation is unlimited. | **84**, with two decisions for Paul |
| A4 | L | The run cookie is not tied to the participant cookie | `respondAndChooseAction` treats the Run cookie as the whole credential. | `wontfix`: the cookie is a random UUID, `httpOnly`, scoped to its Journey's path (`run-cookies.ts:56-70`). Binding it to a second cookie from the same browser adds nothing against a thief who has both. |

#### Tickets written

- **81** One autosave loop (polish; 73 is now `Blocked by: 72, 81`)
- **82** One membership seam and one data-layer result shape (contract, because membership is the authorization rule)
- **83** Error pages and unreadable Published Versions (contract)
- **84** Abuse limits on Runs and the Judge, and no Response in the address (contract; `needs-triage`, two decisions for Paul)
- **85** Leftovers sweep: AI-authoring text, dead code, pure-core test gaps (contract, because `schema.ts` changes)
- **86** Split the canvas, the Draft editor, and the layout module (polish; blocked by 81)
- Comments on **73** (the design to follow) and **74** (flake suspects, shared helpers, chunk-load placement)

#### Proposed order (Paul to approve; nothing is reordered until then)

71 ✓ → 72 ✓ → **81** → 73 → 74 → **85** (+ its drop-migration follow-up after promotion) → **83** → **84** → 75 → 76 → **82** → 77 → 42 → 78 → 79 → **86** → 53 → 57 → 80. Parked: 44, 39, 45.

Why this order:

- 81 before 73, because 73 is written against one loop.
- 85 early, because it is cheap and removes docs that now mislead.
- 83 and 84 before the product tickets, because each closes a path from one bad row, or one script, to an outage or a bill.
- 82 before 77, because account deletion is membership work and should start on one seam.
- 86 after 79, because it is the largest refactor and nothing depends on it except 53, which gets easier once the panel is its own hook.

#### Record

- PR: https://github.com/paul-macfarlane/journeys/pull/99 (base `staging`).
- Route: polish, with no code changed. Commands run: read-only `grep`, `sed`, and `find`, plus `git fetch`. No test suite was run, because nothing executable changed.
- Evidence: this record plus the ticket files 81–86 and the comments on 73 and 74.
- Reviewer: the orchestrator re-read each kept finding at its cited lines. Then `/code-review` ran against `origin/staging` as two parallel sub-agents.
  - **Standards:** 8 findings. Fixed:
    - the dangling finding ids in 83 and 84;
    - "visitor" in 83;
    - `Route:` lines 82, 83, and 85 raised to `contract`;
    - "edge" in 86's file name;
    - 73 lacking a `Blocked by` edge on 81;
    - 82's open-ended union and its "or re-export";
    - 81's `detail: unknown`.

    Kept, with the reason stated in 81: 81's unused-until-73 `baseline` parameter. Kept as a judgement call for 86 to weigh: `onEdit(command)` switching on the command.
  - **Spec:** 7 findings. Fixed:
    - the 73 design now covers the Draft upsert's guard, restore beside the open editor, `stale` versus `not-found`, one `adopt` shape, and the A → B → A limit of a value compare;
    - "written once" is stated above;
    - T3 and T4 carry evidence.

    Kept: `Status: done` in this commit, as `docs/agents/issue-tracker.md` requires. Paul's approval of the order is still open (see the acceptance criteria).
- Acceptance criteria:
  - 1 met: all five areas are covered, including those that turned up little (Q-order, Q-jsonb).
  - 2 met: 73 and 74 carry the design comment.
  - 3 is **open**: Paul approves the order, or changes it, on the PR. If he changes it, the order above is amended before merge.

### 2026-09-26 — Claude (Opus 5.5), order approved as chunks

Acceptance criterion 3 is met. Paul approved the proposed order, grouped into chunks (one thread and one PR each), with three moves: 83 joins chunk 1 with 81 and 73 so the corrupt-Draft page and unreadable Published Versions share one design; 76 runs before 75 inside the runner chunk; 57 runs with 79 before 86 and 53. The backlog now holds the order; the chunk rules are in `docs/agents/issue-tracker.md` ("Priority", "Chunks").
