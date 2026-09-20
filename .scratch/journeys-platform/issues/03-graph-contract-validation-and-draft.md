# 03: Graph contract, validation, and Draft

Status: ready-for-human
Blocked by: 02
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-19
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** Every Journey has a Draft holding one validated graph document, created with a single Start step when the Journey is created. The graph document is the contract every later ticket depends on; this ticket makes it real and proves it with Seam A tests on a real-sized fixture. Also write ADR-0001 (graph as one JSON document per Draft/Published Version) in `docs/adr/`.

The document contains: schema version; Start step id; Steps by stable id (title, Tiptap-JSON content, ordered Choices, optional Prompt); Outcomes by stable id (label); Endings (steps with no Choices) carry an outcome id; reserved `allow_back` (default true). Each Choice: stable id, label, target step id, reserved nullable `condition`/`effect`. Each Prompt: `type` accepting only `free_text`, label, required flag. Nullable step position fields reserved. Write-time validation is structural (zod). Publish-time validation additionally enforces: exactly one Start; every Choice target exists; every Step reachable from Start; every Ending has an existing Outcome; no cycles (no Choice targets a Step that can reach it); returns structured problems with step/choice ids. Content sanitization runs server-side at every write and allows only paragraph, headings, bold, italic, bullet/ordered lists, links, and an image node with URL + required credit; link `href` and image `src` must be absolute http(s) URLs (anything else, including `javascript:`/`data:`, is stripped) and rendered links carry `rel="noopener noreferrer"`.

- [ ] Creating a Journey creates a Draft with one Start step; the Draft round-trips through save/load unchanged.
- [ ] Seam A: each publish-time rule (including cycle) has a failing test case and the success case passes on a hand-authored 40+ step fixture committed with the tests (ticket 04 adds the real case-3 document as a second success case); sanitization strips disallowed nodes/marks, rejects images without credit, and strips `javascript:` and non-http(s) link/image URLs.
- [ ] Publish-time validation is exposed as a callable operation (no UI required yet) returning the structured problem list.
- [ ] ADR-0001 exists in `docs/adr/` with context, decision, alternatives (relational steps/edges; event-sourced graph), and consequences.
- [ ] `CONTEXT.md` terms are used in type and function names (Step, Choice, Ending, Outcome, Draft) — no `node`/`edge` outside canvas code.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [EXECUTION PLAN] 2026-09-19 — Atlas orchestrator

**Contract:** this ticket, unchanged. Criteria are AC-1..AC-5 in checklist order. Derived DoD from the footer and `docs/agents/testing.md`: DoD-1 verified run command green and migrations `0000`–`0002` apply to an empty database; DoD-2 every PASS artifact committed under `test-results/`, fixture data only; DoD-3 post-merge staging smoke (human gate). Run surface: local + deployed (staging after merge, human-promoted).

**Availability note:** ticket 02 is `ready-for-human`, not `done` (PR #10 merged to `staging` at `09169bc`, CI and Migrate green). Claimed on the same reading ticket 02 used for ticket 01; moving 01 and 02 to `done` is Paul's.

**Repository delivery:** `journeys`, base `staging` @ `09169bc`, branch `feat/03-graph-contract-validation-and-draft`, direct checkout, no worktrees. Sequential D1 → D2: D2 imports D1's `src/lib/graph` module, so it cannot typecheck before D1 lands; their files are otherwise disjoint (D1: `src/lib/graph/**`, `docs/adr/`; D2: `src/db/**`, `drizzle/**`, `src/app/projects/**`, `src/components/journeys/**`, `e2e/**`, `README.md`), re-checked at closeout. Paul's uncommitted `human-prerequisites.md` edit stays untouched and unstaged. Clearing `test-results/` was denied by the permission classifier; ticket 02's evidence files remain (their headers name `a99258f`) until Paul clears them.

**Resolved technical decisions (execution, not contract changes):**
- Graph module `src/lib/graph/` (pure, no `server-only`, zod 4): `document.ts` (schemas, types, `createDraftDocument()`), `content.ts` (rich-text schema + `sanitizeContent`/`sanitizeDocument`), `validate.ts` (`validateForPublish` → `PublishProblem[]`), `fixtures/` (hand-authored 40+ step fixture), colocated `*.test.ts`.
- Document shape (`schemaVersion: 1`): `startStepId`, `allowBack` (default true), `steps` keyed by step id (key must equal `step.id`), `outcomes` keyed by outcome id. Step: `id`, `title`, `content`, `choices[]` (ordered), `prompt | null`, `outcomeId | null`, `position: {x,y} | null` (reserved). Choice: `id`, `label`, `targetStepId`, `condition`, `effect` (both `string | null`, default null, reserved, never read). Prompt: `type: "free_text"` only, `label`, `required`. Outcome: `id`, `label`. Ids are non-empty strings (`crypto.randomUUID()` in app code; readable ids allowed so the seed can use them). One `startStepId` pointer makes "more than one Start" unrepresentable; the publish rule "exactly one Start" therefore reduces to "the pointer names an existing Step".
- Rich text is Tiptap/ProseMirror JSON: `{type:"doc", content:[...]}`; blocks `paragraph`, `heading` (levels 1–6), `bulletList`/`orderedList` of `listItem` (paragraphs, nested lists), `image` (`attrs.src`, required non-empty `attrs.credit`, optional `alt`); inline `text` with marks `bold`, `italic`, `link` (`attrs.href`; sanitizer sets `attrs.rel = "noopener noreferrer"`). `sanitizeContent(unknown)` returns `{ok:true, content}` or `{ok:false, error}`: disallowed elements are removed with their subtree, disallowed marks and unknown attrs are dropped, a `link` whose `href` is not an absolute `http(s)` URL loses the mark (text kept), an `image` whose `src` is not absolute `http(s)` is removed, an `image` with no credit fails the whole write. In graph and draft code the words "node"/"edge" are not used at all (rich-text pieces are "elements"/"blocks"/"marks"); they are reserved for canvas code (ticket 09).
- `validateForPublish` problems `{code, message, stepId?, choiceId?}` with codes `missing-start`, `dangling-choice-target`, `unreachable-step`, `ending-without-outcome`, `unknown-outcome`, `cycle` (every Choice that closes a cycle, self-loops included). A non-Ending's `outcomeId` is ignored.
- Persistence: `draft` table (`journey_id` PK → `journey` cascade, `document jsonb`, `updated_at`), migration `0002` generated with `pnpm db:generate` plus a hand-written backfill inserting a default one-Start-step document for every existing Journey (`gen_random_uuid()` ids; same shape as `createDraftDocument()`), so the invariant holds on staging too. Adding a table is compatible with the deployed ticket-02 code. `createJourney` inserts Journey and Draft in one transaction. `src/db/drafts.ts`: `getDraftForMember`, `saveDraft` (structural parse → sanitize → write; returns the stored document or an error), `validateDraft`. Server actions `saveDraftAction` and `validateDraftAction` beside the Journey actions (AC-3's callable operation). The Journey page's placeholder card becomes a read-only Draft summary: step count, outcome count, and the step list with Start/Ending badges and choice counts (editing is ticket 08).
- Tests: Seam A in `src/lib/graph/*.test.ts`; Seam B `e2e/draft.spec.ts` test `journey-draft` — create Journey → page shows one Start step → the `draft` row parses with the schema → the fixture document is written into the row over SQL → page shows the fixture's step count and Start title → the row read back deep-equals the fixture (jsonb round trip on the real column). Server actions and data access are thin glue and are not tested in isolation (spec Testing Decisions).
- ADR-0001 `docs/adr/0001-graph-as-one-json-document.md` (MADR: context, decision, alternatives — relational steps/choices, event-sourced graph — consequences).

**Deliverables:**
- **D1 — Graph contract module and ADR** (worker: atlas-worker on `opus`): `src/lib/graph/**` with schemas, `createDraftDocument`, sanitizer, publish validation, the 40+ step fixture, Seam A tests, and ADR-0001. Proves AC-2, AC-3 (pure operation), AC-4, AC-5.
- **D2 — Draft persistence and journey page** (worker: atlas-worker on `opus`): `draft` table + migration `0002` with backfill, transactional Journey creation, `src/db/drafts.ts`, server actions, Draft summary on the Journey page, `e2e/draft.spec.ts`, README. Proves AC-1, AC-3 (callable operation), and completes AC-5.

**Verification map (evidence committed under `test-results/`):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | `pnpm test:e2e` test `journey-draft`; unit tests on `createDraftDocument` | local; docker Postgres `journeys_e2e` | new Journey shows one Start step; row parses; fixture written to the row reads back deep-equal | `test-results/ac-1-e2e.txt`, `test-results/journey-draft/journey-draft.png` | after D2 | changes under `src/`, `e2e/`, `drizzle/` |
| AC-2 | `pnpm test` (files `src/lib/graph/*.test.ts`) | local, pure | one failing case per publish rule incl. cycle; success on the 40+ step fixture; sanitizer strips disallowed elements/marks, rejects credit-less images, strips `javascript:`/non-http(s) URLs | `test-results/ac-2-seam-a.txt` | after D1 | changes under `src/lib/graph/` |
| AC-3 | `pnpm test` (validate tests) + `pnpm typecheck` showing `validateDraftAction` exported from the Journey actions | local | problem list is structured `{code, stepId?, choiceId?}`; action compiles and is reachable | `test-results/ac-2-seam-a.txt`, `test-results/dod-1-commands.txt` | after D2 | as above |
| AC-4 | read `docs/adr/0001-*.md` | local | context, decision, both alternatives, consequences present | the committed ADR path | after D1 | ADR edits |
| AC-5 | `grep -rnwiE 'node|nodes|edge|edges' src/lib/graph src/db/drafts.ts src/db/schema.ts src/app/projects docs/adr` | local | no identifier hits (only allowed: none) | `test-results/ac-5-vocabulary.txt` | after D2 | any change to those paths |
| DoD-1 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=... pnpm test:e2e`; plus `pnpm db:migrate` against an empty `journeys_verify` with a Journey inserted before `0002` and its backfilled draft parsed with the schema | local; docker Postgres | all exit 0; `0000`–`0002` apply; backfilled draft validates | `test-results/dod-1-commands.txt`, `test-results/dod-1-migrate-fresh.txt` | after D2 | any source, config, or migration change |
| DoD-2 | evidence review: every PASS artifact committed under `test-results/`; no participant data | local | as stated | this ticket's closeout | closeout | — |
| DoD-3 | **Human gate, announced for later.** Prerequisite: PR merged to `staging`, Migrate action green. Action: Paul signs in on the staging domain, creates a Journey, opens it. Expected: the Draft section lists one Start step. Post-check: `gh run view <migrate-run>` for the merge commit shows success and `0002` applied | deployed (Vercel staging, Neon staging branch) | as stated | recorded in `[CLOSEOUT]` as pending | after merge | — |

### [PROGRESS] 2026-09-19 — D1 integrated

- D1 Graph contract module and ADR — atlas-worker on `opus` — `abfcaa1` (one acceptance-screen fix, amended in place: the strict content schema rejects raw editor output — `rel: "noopener noreferrer nofollow"`, `hardBreak` — before the sanitizer could strip it, so `prepareDocumentForWrite` (loose parse → sanitize → strict parse) is now the only write-path entry point). `src/lib/graph/{document,content,validate}.ts`, 44-step / 6-Ending / 3-Outcome fixture `largeJourney`, 83 unit tests, `docs/adr/0001-graph-as-one-json-document.md`. Candidate evidence for AC-2 and AC-4 gathered at `abfcaa1` (`pnpm test` 83 passed, typecheck clean, vocabulary grep clean).
- D2 dispatched (atlas-worker on `opus`): `draft` table and migration `0002` with backfill, transactional Journey creation, `src/db/drafts.ts`, server actions, Draft summary on the Journey page, `e2e/draft.spec.ts`.

### [PROGRESS] 2026-09-19 — D2 integrated; aggregate review started

- D2 Draft persistence and journey page — atlas-worker on `opus` — `0249ab0`: `draft` table and migration `0002_ambiguous_doctor_spectrum.sql` with the hand-written backfill, transactional `createJourney`, `src/db/drafts.ts` (`getDraftForMember`, `saveDraft` via `prepareDocumentForWrite`, `validateDraft`), `saveDraftAction` and `validateDraftAction`, read-only `DraftSummary` on the Journey page, `e2e/draft.spec.ts` (`journey-draft`: create → one Start step → row parses → 44-step fixture written to the row → page shows `44 steps · 3 outcomes` → row deep-equals the fixture), helpers extracted to `e2e/setup/authoring.ts`, `queryE2eDatabase` in the session helper, README. Worker run: 83 unit tests, 15 e2e specs, build green. Accepted on screen; no fixes needed.
- Parallelism re-check against the real diffs: D1 touched only `src/lib/graph/**` and `docs/adr/`; D2 touched `src/db/**`, `drizzle/**`, `src/app/projects/**`, `src/components/journeys/**`, `e2e/**`, `README.md` — disjoint files, as predicted; sequential was right for the dependency reason (D2 imports D1), not for file conflicts.
- Status `in-progress` → `ai-review`. Two review axes dispatched over `09169bc..0249ab0`; aggregate verification (DoD-1 chain, migrate probe) running alongside.

### [AI CODE REVIEW] 2026-09-19 — aggregate review of `09169bc..0249ab0`, fixes in `cd1cc28`

Two fresh reviewers (one per axis, `opus`) read the complete diff against `09169bc` with the ticket, its execution plan, the spec, `CONTEXT.md`, and ADR-0001 as their only inputs; the orchestrator adjudicated every candidate from the cited hunks. **No blocking findings on either axis.** Orchestrator fixes landed as one commit, `cd1cc28`; every deviation below is approved by the orchestrator.

**Axis 1 — technical implementation and spec conformity** (10 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| F1 `saveDraft` UPDATE unchecked; reports success on zero rows | non-blocking | `src/db/drafts.ts` | resolved: `insert … onConflictDoUpdate` upsert |
| F2 a Journey created in the Migrate/Vercel deploy window has no Draft row | non-blocking | `src/db/drafts.ts`, `drizzle/0002_*.sql` | resolved for saves by the F1 upsert; reads 404 until then — rollout note below |
| F3 `sanitizeDocument` dead export duplicating `prepareDocumentForWrite` | non-blocking | `src/lib/graph/content.ts` (+test) | resolved: removed with its three tests (83 → 80 unit tests) |
| F4 `parseGraphDocument` unused while `getDraftForMember` uses the throwing parse | non-blocking | `src/lib/graph/document.ts`, `src/db/drafts.ts` | deviation: the loud throw on a corrupt row is deliberate; `parseGraphDocument` stays for ticket 05's restore read |
| F5 the `saveDraft` statement is not exercised; the e2e seeds the row over SQL | non-blocking | `e2e/draft.spec.ts` | deviation: data-access glue (spec Testing Decisions); write-path idempotence and the jsonb round trip are both proven; ticket 08's editor e2e drives `saveDraft` |
| F6 `missing-start` carried a `stepId` naming no Step | non-blocking | `src/lib/graph/validate.ts` | resolved: omitted, test asserts `undefined` |
| F7 docstring said "in Step order"; problems are rule-major, step-minor | non-blocking | `src/lib/graph/validate.ts` | resolved: comment and test name |
| F8 `Object.values(steps)` follows jsonb key order, not authored order | non-blocking | `src/components/journeys/draft-summary.tsx` | deviation: cosmetic for the read-only summary; **ticket 08 needs an explicit Step order** |
| F9 uncredited image nested in a list item refuses the write though a credited one is dropped | non-blocking | `src/lib/graph/content.ts` | deviation: fail-closed, unreachable from the editor |
| F10 the Journey page runs the membership join twice | non-blocking | `…/journeys/[journeyId]/page.tsx` | deviation: correct as written; ticket 08 reshapes the page |

Conformity: AC-1..AC-5 conform (F5 noted); DoD-1/DoD-3 not assessable from code; DoD-2 pending the evidence commit.

**Axis 2 — coding standards** (12 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| S1 `saveDraft` comment claimed the only write path | non-blocking | `src/db/drafts.ts` | resolved: reworded (backfill and `createJourney` write by construction) |
| S2 ADR said `graphDocumentSchema` is the only way a document enters storage | non-blocking | `docs/adr/0001-*.md` | resolved |
| S3 ADR said non-http(s) URLs are refused; code strips them | non-blocking | `docs/adr/0001-*.md` | resolved: matches `sanitizeContent` |
| S4 = F3 | non-blocking | `src/lib/graph/content.ts` | resolved |
| S5 `StepBadge` duplicated `JourneyStatusBadge` classes | non-blocking | `src/components/journeys/*` | resolved: shared `src/components/ui/badge.tsx` |
| S6 `saveDraftAction`/`validateDraftAction` have no UI caller | non-blocking | `…/journeys/actions.ts` | deviation: AC-3 requires the callable operation with no UI; both re-check session and membership |
| S7 path-prefixed zod messages can reach an Author via `saveDraftAction` | non-blocking | `src/lib/graph/document.ts` | deviation: only a structurally invalid document (which the editor cannot send) triggers it; the path is what ticket 08 needs |
| S8 test fixture under `src/lib/graph/fixtures` rather than `src/test` | non-blocking | `src/lib/graph/fixtures/large-journey.ts` | deviation: the ticket asks for the fixture "committed with the tests"; ticket 04 adds case-3 beside it |
| S9 new code hard-depends on the `draft` table during the deploy window | non-blocking | `drizzle/0002_*.sql`, page | deviation: inherent to the repo's deploy model (same as ticket 02's tables); Migrate takes ~20 s — rollout note below |
| S10 README mixed capitalised domain nouns into lowercase prose | non-blocking | `README.md` | resolved |
| S11 `document` prop shadowed the DOM global | non-blocking | `draft-summary.tsx` | resolved: `draft` |
| S12 `queryE2eDatabase` lives in the session helper | non-blocking | `e2e/setup/session.ts` | deviation: it must share the helper's pool so `closePools()` closes it |

Both axes confirmed: `package.json`/`pnpm-lock.yaml` untouched; `server-only` placement and pure `src/lib` respected; vocabulary clean; e2e conventions followed; migration 0002 additive, `ON CONFLICT DO NOTHING`, backfill shape identical to `createDraftDocument()`; cycle detection correct on self-loops, two-step loops, and merges.

**Remaining risks:** (1) rollout window — between the Vercel build going live and the Migrate action finishing, Journey pages 404/500 and a Journey created then has no Draft until its first save (upsert); (2) `hardBreak` is outside the contract's allowed set, so a Shift+Enter line break in the editor will be stripped at save — a contract decision, flagged for ticket 08; (3) the graph document has no explicit Step ordering (F8).

### [CLOSEOUT] 2026-09-19 — Atlas orchestrator

**PR:** https://github.com/paul-macfarlane/journeys/pull/11 (base `staging`, head `feat/03-graph-contract-validation-and-draft`). Status `in-progress` → `ai-review` → `ready-for-human`.

**Repository delivery `journeys`:** base `staging` @ `09169bc`, direct checkout, no worktrees. Parallelism re-check against the real diffs: D1 (`src/lib/graph/**`, `docs/adr/`) and D2 (`src/db/**`, `drizzle/**`, `src/app/projects/**`, `src/components/journeys/**`, `e2e/**`, `README.md`) touched disjoint files; sequential was right for the dependency (D2 imports D1), not for file conflicts — a future ticket with the same shape could overlap the two only by fixing the module API up front.

**Deliverables:**
- D1 Graph contract module and ADR — atlas-worker on `opus` — `abfcaa1` (one acceptance-screen fix: `prepareDocumentForWrite`, amended in place).
- D2 Draft persistence and journey page — atlas-worker on `opus` — `0249ab0` (accepted first pass).
- Orchestrator: review fixes `cd1cc28`, evidence and tracker records `ed36c74`, this closeout.

**Verified run command:** `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` — all exit 0 at `cd1cc28` (80 unit tests, 15 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`).

**Criterion verdicts (evidence under `test-results/`, committed in `ed36c74`):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 creating a Journey creates a Draft with one Start step; round-trips unchanged | PASS | `ac-1-e2e.txt` (`journey-draft`), `journey-draft/journey-draft.png`; `prepareDocumentForWrite(largeJourney)` deep-equals the fixture in `document.test.ts`; the 44-step fixture written to the `draft` row reads back deep-equal |
| AC-2 Seam A: a failing case per publish rule incl. cycle; success on the 44-step fixture; sanitizer strips/rejects as specified | PASS | `ac-2-seam-a.txt` (80 tests: 31 document, 20 content, 17 validate, 6 env… see file) |
| AC-3 publish-time validation as a callable operation returning structured problems | PASS | `validateForPublish` → `PublishProblem[]`; `validateDraft` + `validateDraftAction` compile (`dod-1-commands.txt` typecheck) and are covered by the validate tests |
| AC-4 ADR-0001 with context, decision, alternatives (relational rows; event-sourced), consequences | PASS | `docs/adr/0001-graph-as-one-json-document.md` |
| AC-5 `CONTEXT.md` terms in type and function names; no `node`/`edge` outside canvas code | PASS | `ac-5-vocabulary.txt` (only the Node.js runtime and the node-postgres driver match) |
| DoD-1 commands green; migrations `0000`–`0002` apply to an empty database | PASS | `dod-1-commands.txt`; `dod-1-migrate-fresh.txt` (also: `0002` on a database already at `0001` holding a Journey — backfilled Draft parses with the schema and matches `createDraftDocument()`) |
| DoD-2 every PASS artifact committed; fixture data only | PASS | this record; `test-results/` holds minted `Test Author` fixtures and the lighthouse fixture only |
| DoD-3 staging smoke after merge | BLOCKED (human gate) | after merge: `gh run list --workflow=Migrate --branch staging` green and its log applies `0002`; Paul signs in on staging, creates a Journey, and its page lists one Start step |

**Deviations:** ticket 02 claimed as a resolved blocker while still `ready-for-human` (PR #10 merged; `done` is Paul's); the proof-artifact root was not cleared (the delete was denied by the permission classifier — ticket 02's files remain, each naming `a99258f`); `hardBreak` is outside the contract's allowed set and is stripped at save (contract decision, flagged for ticket 08); review deviations F4, F5, F8, F9, F10, S6, S7, S8, S9, S12 as recorded in `[AI CODE REVIEW]`.

**Human follow-ups:** (1) merge, watch the Migrate action, then the DoD-3 smoke on staging; (2) move tickets 01 and 02 (and, after the smoke, 03) to `done`; (3) the staging domain answers with a 302 to Vercel SSO — if Deployment Protection on the staging domain is unintended, disable it so post-merge smoke checks can be observed unauthenticated; (4) optionally `git rm -r` ticket 02's files from `test-results/` (or allow that command for agents); (5) your uncommitted `human-prerequisites.md` edit on this checkout is untouched — commit it when convenient. Notes for ticket 08: the document has no explicit Step order (jsonb key order shows through), and `hardBreak` is stripped.
