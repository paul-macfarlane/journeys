# 04: Seed case-3 from the legacy site

Status: done
Blocked by: 03
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-20
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A development script that reads the live legacy site's prerendered step pages for case-3 (36 steps, entry step 7), converts them into a valid graph document — titles, rich content including images with their credit lines, choices, endings — assigns Outcomes from a hand-written mapping, validates, and inserts the Journey as a Draft in a seed Project whose Member is the existing account for `pauljosephmacfarlane@gmail.com`. The script never creates user rows: if no user has that email it exits with a clear message and writes nothing (Paul signs in once first, `human-prerequisites.md` §10). Idempotent: rerunning updates in place rather than duplicating. Images hotlink the legacy site; note this fragility in the script. Legacy step hrefs omit the trailing slash and the host 301s to `/N/`; the scraper must follow redirects (a bare `curl -s` returns an empty body).

- [ ] Running the seed against a database where the Author account exists produces a seed Project and a case-3 Journey whose Draft passes publish-time validation; against a database with no such user it exits non-zero with a message naming the email and creates nothing.
- [ ] Every legacy ending maps to an Outcome. Human-gated: prerequisite — the mapping file lists all 6 endings with proposed labels; action — Paul reviews and edits the labels in the mapping file; expected result — each label is a short phrase a Participant would recognize as the consequence they reached; post-check — the seed is rerun and the Journey's Outcomes match the mapping.
- [ ] Step count and choice counts match the legacy site (36 steps; 6 endings); a Seam A test asserts the seeded document validates (the real document becomes the second success-case fixture for ticket 03's validation suite).
- [ ] After seeding, signing in as that email (`human-prerequisites.md` §10) shows the seed Project in the projects list and opens the case-3 Journey.
- [ ] Rerunning the seed leaves exactly one seed Project and one case-3 Journey.
- [ ] The script is documented in the README under development commands.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [EXECUTION PLAN] 2026-09-20 — Atlas orchestrator

**Contract:** this ticket, unchanged. Criteria are AC-1..AC-6 in checklist order. Derived DoD from the footer and `docs/agents/testing.md`: DoD-1 verified run command green; DoD-2 every PASS artifact committed under `test-results/`, fixture data only, no participant data. Run surface: local + deployed. The deployed half is the seed run against the Neon staging branch, which is Paul's to run from his machine with `DATABASE_URL` pointed at it (README documents it); per Paul's 2026-09-20 decision there is no post-merge staging smoke gate, so no deployed criterion is defined here.

**Availability:** ticket 03 is `done` (PR #11 merged to `staging` at `c67202d`). Tickets 04, 05, 08, 13 were all available; 04 is first by number and next in the spec's priority order (3 Seed scraper).

**Repository delivery:** `journeys`, base `staging` @ `c67202d`, branch `feat/04-seed-case-3-from-the-legacy-site`, direct checkout, no worktrees (one deliverable, one worker, clean tree).

**Legacy facts confirmed by crawling the live site on 2026-09-20 (these are the numbers AC-3 checks against):**
- Step pages: `https://journey-stories.netlify.app/journeys/case-3/<N>` (not `/case-3/<N>`); the host 301s to `/journeys/case-3/<N>/`. Entry step 7 ("Preface"). Crawling from 7 reaches exactly steps 1–36.
- 36 Steps; 6 Endings (pages with no case-3 links): 10 "After a Wait", 20 "More Garlic", 29 "Give up", 30 "Poor medication adherence 2", 35 "Work to death!", 36 "Wow"; 50 Choices in total; 5 images (steps 1, 8, 9, 11, 31), each a `<figure><img src><figcaption>credit</figcaption></figure>` after the narrative; `img src` values carry a trailing space.
- Page shape: `<article>` → `<header><h1>title</h1></header>` → `<div class="narrative …">` of `<p>` (case-3 uses only paragraphs, but other cases use headings, lists, and italics, so the converter handles `h2`–`h6`, `ul`/`ol`/`li`, `em`/`i`, `strong`/`b`, `a href`, `br`, and HTML entities) → optional figures → either `<section aria-labelledby="decision-heading"><ul><li><a href="/journeys/case-3/N"><span>label</span>` (2–3 Choices, in order; step 14's three Choices all target 22 and stay three distinct Choices) or a nav `<a href="/journeys/case-3/N">Next</a>` (one Choice labelled "Next") or neither (an Ending).
- Listing blurb for case-3: "Goal: Maintain your health condition to the best of your ability before it manifests as serious complications." — used as the Journey description.

**Resolved technical decisions (execution, not contract changes):**
- Script lives in `scripts/seed-case-3/` and runs with the existing `tsx` devDependency via a new `package.json` script `seed:case-3` (`tsx scripts/seed-case-3/index.ts`). No new dependencies — the lockfile is human-only — so HTML is parsed by a small hand-written tokenizer for the closed set of elements above; the scraper is throwaway (decisions.md) and says so in its header. Modules: `index.ts` (CLI, exit codes), `scrape.ts` (fetch with redirects followed, bounded concurrency, crawl from step 7), `convert.ts` (page HTML → Step title, rich-text blocks, Choices; assemble the graph document), `outcomes.json` (the hand-written mapping Paul edits), `index.ts` wires them.
- Usage: `pnpm seed:case-3 <author-email> [--write-fixture]`. The email is required (decisions.md: the script takes the email as an argument). Order of operations: load `.env.local` with dotenv (no override, like `drizzle.config.ts`), connect with `pg` + Drizzle over `@/db/schema` only (never `@/db`, `@/lib/env`, or `@/lib/auth`: `server-only` throws outside React and env validation would demand OAuth values a seed never needs), look the user up by email and exit 1 with a message naming the email and writing nothing if absent; scrape; convert; `prepareDocumentForWrite` then `validateForPublish` and exit 1 listing problems if any; with `--write-fixture` write `src/lib/graph/fixtures/case-3.json`; then in one transaction upsert the Project, Member, Journey, and Draft. Prints host:port only, never the connection string.
- Idempotency by fixed ids: Project `00000000-5eed-4000-8000-000000000001` (title "Journey Stories"), Journey `00000000-5eed-4000-8000-000000000003` (title "Case 3", description = the listing blurb). Rerunning upserts the same rows (`ON CONFLICT DO UPDATE` for title/description/document/updated_at; Member `ON CONFLICT DO NOTHING`), so exactly one of each ever exists (AC-5). If the Project already exists but the named user is not yet a Member, the Member row is added.
- Document ids are readable: Steps `step-<N>` (Start `step-7`), Choices `step-<N>-choice-<i>` (1-based, page order), Outcomes from `outcomes.json`. Every field written out (`prompt: null`, `outcomeId`, `position: null`, `condition`/`effect: null`, `allowBack: true`, `schemaVersion: 1`).
- Rich text: each narrative `<p>` → `paragraph`; `<h2>`–`<h6>` → `heading` (level kept); lists → `bulletList`/`orderedList` of `listItem`; `em`/`i` → `italic`, `strong`/`b` → `bold`, `<a href>` → `link` mark (the sanitizer sets `rel`); `<br>` → a space; entities decoded; whitespace collapsed; empty runs dropped. Each `<figure>` → an `image` block with `src` trimmed and `credit` = the figcaption's text, whitespace-collapsed, verbatim otherwise; images hotlink the legacy site (fragility noted in the script header and README). Content passes through `prepareDocumentForWrite`, so what is stored is exactly the sanitized shape.
- `outcomes.json` (the human gate's artifact) lists every Outcome `{id, label}` and every Ending `{step, title, outcomeId}`. Proposed mapping, for Paul to edit: `outcome-died-in-emergency` "Died waiting for emergency care" ← 10; `outcome-died-of-complications` "Died from diabetes complications" ← 20, 29, 30, 35; `outcome-good-control` "Achieved good glycemic control" ← 36. The script refuses to run (exit 1) if an Ending is missing from the mapping, a mapped step is not an Ending, or an `outcomeId` is undefined.
- Seam A: `src/lib/graph/validate.test.ts` gains the case-3 fixture as the second success case (`validateForPublish` returns `[]`) plus count assertions: 36 Steps, 6 Endings (`step-10`, `-20`, `-29`, `-30`, `-35`, `-36`), 50 Choices, Start `step-7`, and each Ending's `outcomeId` matches `outcomes.json`. Converter unit tests live beside the script (`scripts/seed-case-3/*.test.ts`) on inline HTML snippets — `vitest.config.ts` `include` gains `scripts/**/*.test.ts`; Vitest's `env` already stubs the server env.
- Seam B: `e2e/seed-case-3.spec.ts`, test `seed-case-3`. Runs the script as a child process (`pnpm exec tsx scripts/seed-case-3/index.ts <email>`, `DATABASE_URL` = the e2e database, which `loadE2eEnv()` has already put in `process.env`): (1) with an email no user has → exit code 1, output names the email, no Project row with the seed id; (2) mint an Author with a unique `@example.com` email via `signInAs`, run the seed → exit 0; run it again → exit 0; the e2e database holds exactly one seed Project, one case-3 Journey, and its Draft parses with `graphDocumentSchema` at 36 Steps; (3) `/projects` lists "Journey Stories", its page lists "Case 3", the Journey page shows `36 steps · 3 outcomes` (the count follows `outcomes.json`) and the Start "Preface"; screenshot `test-results/seed-case-3/seed-case-3.png`. `afterAll` deletes the seed Project by id (cascades Member, Journey, Draft) and the minted Author. The spec never writes the fixture file.
- README: a "Seeding the legacy case-3 journey" subsection under development commands: the sign-in-first prerequisite (§10), the command, `--write-fixture`, idempotency, editing `outcomes.json`, running it against Neon staging by exporting `DATABASE_URL`, and the hotlinked-images caveat.

**Deliverables:**
- **D1 — Seed case-3 (whole vertical slice)** (worker: atlas-worker on `opus`): scraper, converter, mapping, CLI, package script, vitest include, case-3 fixture, Seam A additions, e2e spec, README. One worker because every piece shares the CLI contract and the fixture; nothing here parallelizes without inventing an interface first.

**Verification map (evidence committed under `test-results/`, root cleared at workspace prep):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | `pnpm seed:case-3 pauljosephmacfarlane@gmail.com` against the local dev database (Paul's user row exists there) then `psql` counts and `validateForPublish` over the stored Draft; `pnpm seed:case-3 nobody-<random>@example.com` → exit 1 naming the email, row counts unchanged; plus e2e `seed-case-3` steps (1)–(2) | local; docker Postgres `journeys`; live legacy site | seed Project + case-3 Journey + Draft with zero publish problems; negative run exits non-zero, names the email, writes nothing | `test-results/ac-1-seed-local.txt`, `test-results/ac-1-seed-no-user.txt`, `test-results/ac-4-e2e.txt` | after D1 | changes under `scripts/seed-case-3/`, `src/lib/graph/`, `src/db/schema.ts`, `drizzle/` |
| AC-2 | **Human gate, announced for later** (its prerequisite — the mapping file — is produced by D1). Prerequisite: `scripts/seed-case-3/outcomes.json` lists all 6 Endings with proposed labels. Action: Paul edits the labels. Expected: each label is a short phrase a Participant recognizes as the consequence reached. Post-check: `pnpm seed:case-3 <email>` rerun, then the stored Draft's Outcomes deep-equal the mapping (`psql` + jq, or the e2e's assertion) | local; docker Postgres | Outcomes match the mapping | `test-results/ac-2-outcomes.txt` (post-check output); Paul's edit is the human action | after D1 (raised at closeout if Paul has not reviewed) | edits to `outcomes.json` |
| AC-3 | `pnpm test` (`validate.test.ts` case-3 success case and counts; converter tests) | local, pure | 36 Steps, 6 Endings, 50 Choices, Start `step-7`, `validateForPublish` → `[]` | `test-results/ac-3-seam-a.txt` | after D1 | changes under `src/lib/graph/`, `scripts/seed-case-3/` |
| AC-4 | `pnpm test:e2e` test `seed-case-3` step (3): sign in as the seeded email, `/projects` shows the seed Project, open the case-3 Journey | local; docker Postgres `journeys_e2e`; e2e server on 3100; live legacy site | Project listed; Journey page shows `36 steps · 3 outcomes` | `test-results/ac-4-e2e.txt`, `test-results/seed-case-3/seed-case-3.png`; the local run in AC-1 shows the Member row for Paul's user id (his OAuth sign-in itself cannot be driven by an agent — noted as a follow-up, not a gate) | after D1 | changes under `src/`, `e2e/`, `scripts/`, `drizzle/` |
| AC-5 | rerun `pnpm seed:case-3 pauljosephmacfarlane@gmail.com` on the local dev database, then `psql` counts of Projects titled "Journey Stories" / Journeys with the seed id; e2e step (2) | local; docker Postgres | exactly 1 and 1 | `test-results/ac-5-idempotent.txt`, `test-results/ac-4-e2e.txt` | after D1 | as AC-1 |
| AC-6 | read `README.md` development commands | local | the seed command, prerequisite, flags, and caveats are documented | the committed README path | after D1 | README edits |
| DoD-1 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` | local; docker Postgres | all exit 0 | `test-results/dod-1-commands.txt` | after D1 | any source, config, or test change |
| DoD-2 | evidence review: every PASS artifact committed under `test-results/`; no participant data (the seeded document is authored legacy content, not Run data) | local | as stated | this ticket's closeout | closeout | — |

Human gates: AC-2 is the only one, announced for later; there is no actionable-now gate.

### [PROGRESS] 2026-09-20 — D1 integrated; aggregate review started

- D1 Seed case-3 (whole vertical slice) — atlas-worker on `opus` — `234b94e`. The worker finished every file but its shell died (Docker Desktop had stopped, taking the harness shell with it) before it could run the verification chain or commit. The orchestrator restarted Docker, ran the chain, and committed on its behalf. One orchestrator fix, recorded as such: the Atlas plugin's commit-time secret scrub refuses any unbroken 40+ character `[A-Za-z0-9+/]` run, and one legacy rawpixel image URL in the fixture carries a 74-character base64 path segment. Added `scripts/seed-case-3/fixture.ts` (+ tests): the fixture writer JSON-escapes one character in any such run, so the committed file text has no such run while the parsed document is byte-identical to what the seed stores. The fixture was regenerated through the script.
- Pieces: `scripts/seed-case-3/{scrape,convert,fixture,ids,index}.ts`, `outcomes.json`, `convert.test.ts`, `fixture.test.ts`; `src/lib/graph/fixtures/case-3.json`; case-3 success case + counts in `validate.test.ts`; `e2e/seed-case-3.spec.ts`; `vitest.config.ts` include; `package.json` `seed:case-3`; README section. No lockfile change.
- Candidate evidence at `234b94e` (working tree, committed with the closeout): `ac-1-seed-no-user.txt` (exit 1 naming the email; row counts unchanged), `ac-1-seed-local.txt` (seeded 36/50/6/3; stored Draft parses and `validateForPublish` → `[]`; stored Outcomes deep-equal `outcomes.json`), `ac-2-outcomes.txt` (post-check candidate; human gate still open), `ac-3-seam-a.txt` (104 unit tests), `ac-4-e2e.txt` + `seed-case-3/seed-case-3.png` (16 e2e passed, `seed-case-3` 8.6 s), `ac-5-idempotent.txt` (1|1|1|1|1|1|36|step-7 after two runs), `dod-1-commands.txt` (lint, format:check, typecheck, test, build all exit 0).
- Status `in-progress` → `ai-review`. Two review axes dispatched over `c67202d..234b94e`.

### [AI CODE REVIEW] 2026-09-20 — aggregate review of `c67202d..234b94e`, fixes in `3fdae5b`

Two fresh reviewers (one per axis, `opus`) read the complete diff against `c67202d` with the ticket, its execution plan, the spec, `CONTEXT.md`, ADR-0001, `docs/agents/testing.md`, and the neighbouring code as their only inputs; the orchestrator adjudicated every candidate from the cited hunks. **No blocking findings on either axis in the code**; one closeout item (T8). Fixes landed as one worker commit, `3fdae5b` (atlas-worker on `opus`, dispatched with a self-contained fix packet); every deviation below is approved by the orchestrator.

**Axis 1 — technical implementation and spec conformity** (9 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| T1 the crawl re-fetched steps already in the in-flight batch (41 requests for 36 pages) | non-blocking | `scripts/seed-case-3/scrape.ts` | resolved: a `requested` set marked at queue time |
| T2 `process.exit` could truncate piped stdout the e2e spec reads | non-blocking | `scripts/seed-case-3/index.ts` | resolved: `process.exitCode` |
| T3 `outcomes.json` cast, not validated, though it is the file Paul edits; duplicate outcome ids / duplicate ending entries silently collapsed | non-blocking | `index.ts`, `convert.ts` | resolved: `outcomeMappingSchema` (zod) parsed before the database lookup; duplicates reported as problems |
| T4 a missing `<h1>` or `.narrative` seeded an empty Step instead of failing | non-blocking | `convert.ts` | resolved: throws like the missing-`<main>` case |
| T5 a `<figure>` inside the narrative would be read twice; unknown containers flatten to one paragraph | non-blocking | `convert.ts` | resolved for figures (skipped in `blocksFrom`); container flattening accepted — throwaway scraper, today's markup never nests |
| T6 the e2e's AC-5 counts were primary-key lookups that cannot fail | non-blocking | `e2e/seed-case-3.spec.ts` | resolved: counts by title, which is what a non-idempotent rerun would duplicate |
| T7 Seam A comment claimed live numbers; the live path asserted only the step count | non-blocking | `validate.test.ts`, `e2e/seed-case-3.spec.ts` | resolved: comment describes a regression lock on the fixture; the e2e now asserts 50 Choices and the six Ending ids over the freshly scraped Draft |
| T8 the plan's seven text evidence artifacts were uncommitted at `234b94e` | blocking for closeout | `test-results/` | resolved: recaptured at `3fdae5b` and committed with this closeout |
| T9 `readArguments` accepted unknown flags and extra positionals | non-blocking | `index.ts` | resolved: `arguments.ts` (+ tests) refuses them with the usage line and exit 2 |

Conformity: AC-1, AC-3, AC-4, AC-6 conform; AC-2 conforms as a prerequisite (all six Endings mapped; the reviewer read every ending text against its label and found them apt; Paul's review outstanding); AC-5 conformed in behaviour and, after T6, in evidence. Scope conforms: development script only, no new dependency, no lockfile change.

**Axis 2 — coding standards** (11 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| S1 = T3 (inert cast) | non-blocking | `index.ts` | resolved |
| S2 a `src/` test imports `scripts/seed-case-3/outcomes.json` by relative path | non-blocking | `validate.test.ts` | deviation: the assertion must track the file Paul edits (AC-2); the script directory is committed and documented, and removing it is a deliberate change that updates this test |
| S3 unused `options` parameter and five unused exports | non-blocking | `scrape.ts`, `convert.ts` | resolved: parameter dropped, exports demoted |
| S4 README and script header said images "hotlink the legacy site"; they point at pexels, rawpixel, flickr, and one WordPress site | non-blocking | `README.md`, `index.ts` | resolved: reworded (the ticket's own premise was inexact) |
| S5 730-line converter with section banners | non-blocking | `convert.ts` | deviation: throwaway development script per decisions.md; not product code |
| S6 title cap restated and applied twice | non-blocking | `convert.ts` | resolved: cites `document.ts`; second slice dropped |
| S7 `CLAUDE.md` Structure list omits `scripts/` and says every `src/db` file is `server-only` (`schema.ts` is not) | non-blocking | `CLAUDE.md` | deviation: human-approved file — **for Paul** (see follow-ups) |
| S8 `docs/agents/testing.md` unit row omits `scripts/**/*.test.ts` | non-blocking | `docs/agents/testing.md` | deviation: team-owned Atlas-managed file — **for Paul** |
| S9 redundant `as unknown` with a wrong justification | non-blocking | `validate.test.ts` | resolved |
| S10 the seed printed the Author's display name into captured evidence | non-blocking | `index.ts` | resolved: prints the email only (the CLI argument, which the ticket itself names) |
| S11 `page` as the noun for the converted Step; `run()` colliding with Run | non-blocking | `convert.ts`, `index.ts`, tests | resolved: `ScrapedStep`/`scraped`, `main()` |

Both axes confirmed: `pnpm-lock.yaml` untouched, one `package.json` script line and no dependency; nothing under `scripts/` or `e2e/` imports `@/db`, `@/lib/env`, `@/lib/auth`, or `server-only`; vocabulary scan clean apart from S11; README row and subsection in the AC-6 location; e2e conventions (`afterAll` cleanup, unique suffixes, `test-results/<test-name>/<test-name>.png`, e2e database only) followed; the fixture holds authored legacy narrative only; the fixture serializer's escape is content-preserving (`JSON.parse` round-trips; every post-escape run ≤ 36 characters).

**Orchestrator fix recorded before the review** (in `234b94e`): `scripts/seed-case-3/fixture.ts` — see `[PROGRESS]` above.

**Remaining risks:** (1) the e2e spec and the seed depend on the live legacy host (two 36-page scrapes per run; `fetch` has no timeout or retry, so a slow Netlify response runs into Playwright's 300 s budget); (2) the tokenizer does no implicit-close recovery, so a markup change to unclosed `<p>`/`<li>` nests rather than fails — accepted for a throwaway scraper; (3) the seeded credit lines carry the legacy site's own run-together words ("Imageis", "associated:CC") verbatim; (4) `validate.test.ts` imports the mapping from `scripts/` (S2).

### [CLOSEOUT] 2026-09-20 — Atlas orchestrator

**PR:** https://github.com/paul-macfarlane/journeys/pull/13 (base `staging`, head `feat/04-seed-case-3-from-the-legacy-site`). Status `in-progress` → `ai-review` → `ready-for-human`.

**Repository delivery `journeys`:** base `staging` @ `c67202d`, direct checkout, no worktrees. One deliverable, one worker, so no parallelism was rejected on file-conflict grounds and there is no prediction to re-check.

**Deliverables:**
- D1 Seed case-3 (whole vertical slice) — atlas-worker on `opus` — `234b94e`. The worker finished every file but Docker Desktop had stopped and its harness shell died with it before verification or commit; the orchestrator restarted Docker, ran the chain, added `scripts/seed-case-3/fixture.ts` (+ tests) so the committed fixture text carries no 40+ character alphanumeric run (Atlas plugin `pre-commit-secret-scrub` false positive on a rawpixel image URL; parsed document unchanged), regenerated the fixture through the script, and committed on the worker's behalf.
- D1-review-fixes — atlas-worker on `opus` — `3fdae5b` (self-contained fix packet from the aggregate review; accepted on screen, no fixes needed).
- Orchestrator: ticket claim/plan `84f2620`, evidence and tracker records `eb83ec3`, this closeout.

**Verified run command:** `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` — every command exit 0 at `3fdae5b` (114 unit tests in 7 files; 16 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`; `seed-case-3` 7.4 s). Seed runs against the local dev database `journeys` on `localhost:5436` (Paul's user row exists there). No deployed-target check: per Paul's 2026-09-20 decision there is no post-merge staging smoke gate; seeding Neon staging is Paul's to run from his machine with `DATABASE_URL` exported (README).

**Criterion verdicts (evidence under `test-results/`, committed in `eb83ec3`, all at `3fdae5b`):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 seed with the Author account present produces a seed Project and a case-3 Journey whose Draft passes publish-time validation; no such user → exit non-zero naming the email, nothing written | PASS | `ac-1-seed-local.txt` (seeded 36/50/6/3; stored Draft parses with `graphDocumentSchema`; `validateForPublish` → `[]`), `ac-1-seed-no-user.txt` (exit 1 naming `nobody-4b9d02@example.com`; row counts 2|2|2|2|2 before and after; `--bogus` → usage, exit 2), `ac-4-e2e.txt` (the same two halves against the e2e database) |
| AC-2 every legacy Ending maps to an Outcome — human gate | BLOCKED (human gate open) | prerequisite met: `scripts/seed-case-3/outcomes.json` lists all 6 Endings (10, 20, 29, 30, 35, 36) with proposed labels; post-check candidate `ac-2-outcomes.txt` + `ac-1-seed-local.txt` (stored Outcomes deep-equal the mapping; every mapped Ending carries its `outcomeId`). Action for Paul: edit the labels, rerun the seed (with `--write-fixture` if changed), and the same post-check applies |
| AC-3 36 Steps, 6 Endings, choice counts match; Seam A success case on the seeded document | PASS | `ac-3-seam-a.txt` (`finds nothing wrong with the seeded case-3 journey`; 36 Steps at Preface; 50 Choices with step-14's three; Endings exactly step-10/20/29/30/35/36; per-Ending Outcome ids; 5 credited http(s) images) |
| AC-4 signing in as that email shows the seed Project and opens the case-3 Journey | PASS | `ac-4-e2e.txt` (`seed-case-3`: `/projects` lists Journey Stories → Case 3 → `36 steps · 3 outcomes`, Start "Preface"), `seed-case-3/seed-case-3.png`. The minted e2e Author stands in for the OAuth sign-in an agent cannot drive; `ac-5-idempotent.txt` shows Paul's own account is the Member locally |
| AC-5 rerun leaves exactly one seed Project and one case-3 Journey | PASS | `ac-5-idempotent.txt` (`1|1|1|1|1|1|36|step-7`: by id and by title), `ac-4-e2e.txt` (counts by title after two runs) |
| AC-6 documented in the README under development commands | PASS | `README.md` — Commands row + "Seeding the legacy case-3 journey" |
| DoD-1 verified run command green | PASS | `dod-1-commands.txt`, `ac-4-e2e.txt` |
| DoD-2 every PASS artifact committed; no participant data | PASS | this record; evidence scanned — only the documented local Postgres default, Paul's own email (the ticket's argument), and authored legacy narrative |

**Deviations:** the fixture serializer's JSON escape (above; content-preserving, tested); review deviations S2, S5, S7, S8, and the T5 container-flattening remainder as recorded in `[AI CODE REVIEW]`; the ticket's premise that images "hotlink the legacy site" was inexact — they point at the third-party hosts the legacy pages linked (README and script header say so); the `[EXECUTION PLAN]`'s AC-1 evidence originally named the seed's `Member <name> <email>` line, which review S10 reduced to the email.

**Human follow-ups:** (1) AC-2 — review the Outcome labels in `scripts/seed-case-3/outcomes.json`, rerun the seed if you change them; (2) review and merge PR #13, then run `DATABASE_URL=<Neon staging pooled string> pnpm seed:case-3 pauljosephmacfarlane@gmail.com` from your machine if you want case-3 on staging (sign in there once first, §10); (3) `CLAUDE.md`: add `scripts/` to the Structure list and soften "every file here is `server-only`" for `src/db` (schema.ts is not) — human-approved file; (4) `docs/agents/testing.md` unit row: add `scripts/**/*.test.ts`; (5) move this ticket to `done` after review. Notes for later tickets: `validate.test.ts` imports `scripts/seed-case-3/outcomes.json` (S2); the seed and its e2e spec depend on the live legacy host.

### [SCOPE CHANGE] 2026-09-20 — approved by Paul (PR #13 review)

Paul's decisions after reviewing PR #13:
1. **Seed all three legacy cases**, not only case 3, into the one `Journey Stories` Project (case-1: 47 Steps, 6 Endings; case-2: 64 Steps, 9 Endings; case-3: 36 Steps, 6 Endings).
2. **Read the legacy repo, not the live site.** The local clone at `~/Code/journey` holds each case as structured JSON (`src/data/cases/case-{1,2,3}.json`: `id`, `name`, `paragraphs`, `decisions[{text,pid}]`, `images[{src,caption}]`, `next{pid}`; the Start is the Step named "Preface"). A one-off converter run by the orchestrator turns those into three graph documents committed as static JSON; the converter is not kept — the legacy content never changes, so there is nothing to re-run. The scraper, tokenizer, `outcomes.json`, and their tests are removed.
3. **Keep a small seed command** (`pnpm seed:journey-stories <author-email>`) that reads the three committed documents, validates them for publish, and upserts the Project, three Journeys, and their Drafts under fixed ids — idempotent, and still refusing to run when no user has the email.
4. **No e2e spec for the seed** — it is a migration step, not a product feature. Seam A keeps one pure test that every committed document passes publish validation and holds the expected Step and Ending counts.

Consequences for the criteria: AC-1, AC-4, AC-5 are proven by real seed runs against the local dev database (captured output) instead of an e2e spec; AC-2's mapping file is replaced by the Outcome labels inside each committed document, which Paul edits directly; AC-3 covers all three documents. Supersedes decisions.md "Seeding real content" (throwaway scraper) — amended there. PR #13 is reworked in place; status `ready-for-human` → `in-progress` on Paul's instruction.

### [PROGRESS] 2026-09-20 — rework integrated (static documents, all three cases)

- Orchestrator converted `~/Code/journey/src/data/cases/case-{1,2,3}.json` once (one-off converter, not committed) into `scripts/seed/journey-stories/case-{1,2,3}.json`. Each document was run through `prepareDocumentForWrite` and `validateForPublish` before being written, and written with a JSON `\u` escape inside any 40+ character alphanumeric run (the commit-time secret scrub). Result: case-1 start `step-42`, 46 Steps, 69 Choices, 6 Endings, 4 Outcomes, 20 images; case-2 start `step-63`, 64 Steps, 102 Choices, 9 Endings, 5 Outcomes, 15 images; case-3 start `step-7`, 36 Steps, 50 Choices, 6 Endings, 3 Outcomes, 5 images.
- **Content deviation, assumed pending Paul's answer:** cases 1 and 2 loop on the legacy site and the publish contract forbids cycles and unreachable Steps. Dropped the minimal cycle-breaking set — case 1: step 46 "Detention 1" [Yes] → 1 (restart the journey); case 2: step 19 "Call Sponsor" [Call the legal organization] → 2, step 27 "I quit!" [Call your bunkmate's cousin's friend] → 32, step 52 "ER" [Go home, and try again later] → 53 — and omitted case-1 step 32 "Detention", which nothing links to in the legacy data. Every other Step stays reachable. Alternatives if Paul prefers: relax the no-cycles rule, or seed cases 1 and 2 as Drafts that do not pass publish validation.
- D2-static-seed — atlas-worker on `opus` — `d8a2d17`: `scripts/seed/journey-stories.ts` (`pnpm seed:journey-stories <email>`), Seam A `describe("the seeded Journey Stories documents")` in `validate.test.ts`, README section, `package.json` script, vitest include reverted; the scraper, its tests, `e2e/seed-case-3.spec.ts`, and the old fixture removed. Accepted on screen.
- D2-review-fixes — orchestrator — `cff9c1c` (see `[AI CODE REVIEW]` below).

### [AI CODE REVIEW] 2026-09-20 — aggregate review of the reworked PR `c67202d..d8a2d17`, fixes in `cff9c1c`

Two fresh reviewers (one per axis, `opus`) read the whole net diff with the ticket and its `[SCOPE CHANGE]`, the spec, `decisions.md`, `CONTEXT.md`, ADR-0001, `docs/agents/testing.md`, the neighbouring code, and — for fidelity — the legacy repo's own JSON; the orchestrator adjudicated every candidate from the cited hunks and applied the fixes inline. **No blocking findings in the code on either axis.** The earlier review of the scraper approach (above) is superseded.

**Axis 1 — technical implementation and spec conformity** (5 candidates). Fidelity was machine-checked per Step: 0 title, paragraph, image, or Choice mismatches against the legacy source across all 146 Steps; italic marks preserved; the four dropped Choices confirmed as the minimal cycle-breaking set; Journey titles and descriptions reproduce the legacy listing character for character; publish validation re-implemented independently → zero problems per document.

| # | Severity | Paths | Disposition |
|---|---|---|---|
| T1 case-2 Ending `step-59` "Time of death" is reached after release (workplace injury) but was tagged "Died in detention" | non-blocking (content, inside AC-2's gate) | `case-2.json`, `validate.test.ts` | resolved: own Outcome `outcome-died-working` "Died of a workplace injury after release"; Case 2 now has 5 Outcomes |
| T2 README gave a false reason for omitting case-1 step 32 | non-blocking | `README.md` | resolved: it is unreachable in the legacy data itself |
| T3 no evidence committed at `d8a2d17` | blocking for closeout | `test-results/` | resolved: recaptured at `cff9c1c`, committed with the closeout |
| T4 `decisions.md` amendment uncommitted | non-blocking | `.scratch/…/decisions.md` | resolved: committed with the closeout |
| T5 email lookup untrimmed and case-sensitive | non-blocking | `journey-stories.ts` | resolved: trimmed and lowercased |

Conformity (as amended): AC-1, AC-3, AC-5, AC-6 conform; AC-2 conformed except T1 (fixed; Paul's label review still open); AC-4 rests on captured seed output by design.

**Axis 2 — coding standards** (9 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| S1 header docstring understated the `\u` escapes (12 strings, 22 escapes, two in credit URLs) | non-blocking | `journey-stories.ts` | resolved |
| S2 image-host list inexact — 18 hosts, incl. NYT and ProPublica assets | non-blocking | `README.md`, `journey-stories.ts` | resolved: host count, no enumeration |
| S3 `CLAUDE.md` says "seed real content by scraping the live site" | non-blocking | `CLAUDE.md` | deviation: human-approved file — **for Paul** |
| S4 `CLAUDE.md` Structure omits `scripts/`; "every `src/db` file is `server-only`" is inexact | non-blocking | `CLAUDE.md` | deviation: **for Paul** |
| S5 `CASES` uses an avoid-listed word for our own concept | non-blocking | `journey-stories.ts` | resolved: `SEED_JOURNEYS` |
| S6 `one` as the element name | non-blocking | `journey-stories.ts` | resolved: `journey` |
| S7 documents parsed at module scope, so one bad edit fails the whole test file | non-blocking | `validate.test.ts` | resolved: parsed inside each test, plus a named parse case |
| S8 = T3 | | | resolved |
| S9 top-level catch dropped the stack | non-blocking | `journey-stories.ts` | resolved: `console.error(error)` |

Both axes confirmed: lockfile untouched and no new dependency; nothing under `scripts/` imports `server-only` modules; vocabulary scan clean apart from S5; README row and section in place; no leftover reference to the removed scraper; no sensitive data in the documents (authored legacy narrative, `paragraph`/`image` blocks and `italic` marks only). Provenance: the README now names the legacy repository. Deviation kept: `validate.test.ts` imports the documents from `scripts/seed/journey-stories/` — they are the single source of truth for the seed.

**Remaining risks:** (1) the seed command has no automated test of its write path — the Seam A test covers the documents; the four real runs in the evidence cover the CLI; (2) `resolveJsonModule` inlines ~8k lines of JSON into the typecheck twice (test and script) — not measurably slow today; (3) the `\u`-escape convention is enforced only by the commit hook; (4) any database seeded by the superseded scraper keeps its orphan `…0003` "Case 3" Journey (Paul's dev database was cleaned; staging was never seeded); (5) seeding with a second email adds a second Member and never removes one — documented.

### [PROGRESS] 2026-09-20 — PR #13 merged before the rework; rework is PR #14

Paul merged https://github.com/paul-macfarlane/journeys/pull/13 at `b4fc25e` (merge commit `9950b2b` on `staging`) while the rework was in progress, so `staging` currently holds the scraper-based `pnpm seed:case-3`. The rework — the three static documents, `pnpm seed:journey-stories`, and the removal of the scraper, its tests, the e2e spec, and the old fixture — is the same branch's three further commits (`d8a2d17`, `cff9c1c`, `85c5ae7`), opened as https://github.com/paul-macfarlane/journeys/pull/14 against `staging`. PR #13's description was restored to describe what it merged. Nothing on `staging` was seeded with the scraper version (Neon staging never ran either command).

### [CLOSEOUT] 2026-09-20 — Atlas orchestrator (rework)

**PRs:** https://github.com/paul-macfarlane/journeys/pull/13 (merged by Paul at `b4fc25e`: the scraper version) and https://github.com/paul-macfarlane/journeys/pull/14 (the rework: base `staging`, head `feat/04-seed-case-3-from-the-legacy-site`). Status `in-progress` → `ai-review` → `ready-for-human` → (rework) `in-progress` → `done` on Paul's instruction of 2026-09-20 ("make any final adjustments to the PR and move this to done") after he reviewed the migrated data, the cycle handling, and the Outcome labels.

**Repository delivery `journeys`:** base `staging` @ `c67202d`, direct checkout, no worktrees; one deliverable at a time, so no parallelism was rejected and nothing to re-check.

**Deliverables:**
- D1 (superseded) scraper seed — atlas-worker on `opus` — `234b94e`; D1-review-fixes — atlas-worker on `opus` — `3fdae5b`; merged as PR #13.
- Legacy documents — orchestrator — one-off converter over `~/Code/journey/src/data/cases/case-{1,2,3}.json`, not committed; output `scripts/seed/journey-stories/case-{1,2,3}.json` in `d8a2d17`.
- D2-static-seed — atlas-worker on `opus` — `d8a2d17`.
- D2-review-fixes — orchestrator — `cff9c1c`.
- Orchestrator: evidence and tracker records `85c5ae7`; this closeout with the e2e evidence and the `CLAUDE.md` update Paul approved.

**Verified run command:** `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` — every command exit 0 at `cff9c1c` (98 unit tests in 4 files; 15 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`). Seed runs against the local dev database `journeys` on `localhost:5436`. No deployed-target check (Paul's 2026-09-20 decision); seeding Neon staging is Paul's to run with `DATABASE_URL` exported.

**Criterion verdicts (as amended by the `[SCOPE CHANGE]`; evidence under `test-results/`, committed in `85c5ae7` and this closeout, all at `cff9c1c`):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 seed with the Author present produces the seed Project and Journeys whose Drafts pass publish-time validation; no such user → exit non-zero naming the email, nothing written | PASS | `ac-1-seed-local.txt` (three Drafts: 46/64/36 Steps, 6/9/6 Endings, 0 Endings without a defined Outcome, Start present; stored documents deep-equal the committed ones), `ac-1-seed-no-user.txt` (exit 1 naming `nobody-5d70aa@example.com`, row counts unchanged; no argument → usage, exit 2); publish validation of the same documents is `ac-3-seam-a.txt` |
| AC-2 every legacy Ending maps to an Outcome a Participant would recognise — human gate | PASS | prerequisite: 21 Endings mapped across 12 Outcomes; action: Paul reviewed the labels on 2026-09-20 ("outcome labels look good"); post-check `ac-2-outcomes.txt` (stored Outcomes and Ending→Outcome pairs per Journey match the committed documents) |
| AC-3 Step and choice counts match the legacy site; Seam A success case on the seeded documents | PASS | `ac-3-seam-a.txt` (98 tests; per document: parses, publishable, starts at Preface, Step/Choice counts, Ending→Outcome membership, credited http(s) images) |
| AC-4 signing in as that email shows the seed Project and opens the Journeys | PASS | `ac-4-member-rows.txt` (Paul's account is the Member; three Journeys with their Goal descriptions); Paul confirmed the migrated data looks fine on 2026-09-20 |
| AC-5 rerun leaves exactly one seed Project and one Journey per case | PASS | `ac-5-idempotent.txt` (`1|1|3|3|3|1` after two runs) |
| AC-6 documented in the README under development commands | PASS | `README.md` — Commands row + "Seeding the legacy Journey Stories cases" |
| DoD-1 verified run command green | PASS | `dod-1-commands.txt`, `dod-1-e2e.txt` |
| DoD-2 every PASS artifact committed; no participant data | PASS | this record; evidence holds the documented local Postgres default, Paul's own email (the command's argument), and authored legacy narrative only |

**Deviations (all approved):** four looping Choices dropped and one unreachable Step omitted (Paul: "cycle handling seems fine"); a dozen strings in the documents carry a JSON `\u` escape for the commit-time secret scrub (content-preserving); `validate.test.ts` imports the documents from `scripts/seed/journey-stories/`; PR #13 merged the superseded scraper version before the rework landed, so `staging` briefly carries `pnpm seed:case-3` until PR #14 merges; review deviations S3/S4 resolved by the `CLAUDE.md` update Paul approved.

**Human follow-ups:** (1) merge PR #14; (2) if you want the cases on staging, sign in there once (§10) and run `DATABASE_URL=<Neon staging pooled string> pnpm seed:journey-stories pauljosephmacfarlane@gmail.com`; (3) `docs/agents/testing.md` needs no change (the unit row's `src/**/*.test.{ts,tsx}` is accurate again). Notes for later tickets: the seed command's write path has no automated test (four real runs are the evidence); databases seeded by the scraper version keep an orphan `…0003` "Case 3" Journey (the local dev database was cleaned).
