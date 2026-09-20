# 05: Publish, Preview, Unpublish, versions, and restore

Status: ready-for-human
Blocked by: 03
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-20
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** From a Journey's page an Author can Preview the Draft, Publish it, see the version list, Unpublish, and restore an older version as the new Draft. Publish validates and refuses with the problem list, otherwise snapshots the Draft into an immutable Published Version (next version number, timestamp, publishing Member) and points the Journey's live pointer at it. Later Draft edits never change a Published Version. Unpublish clears the live pointer; the version row stays. Restore copies a chosen version's document into the Draft after confirmation. Preview is Member-only; it renders the Draft through the runner components (built minimally here, completed in ticket 06) and never records a Run. Journey slug becomes frozen after first publish.

- [ ] Publishing a Draft that fails validation shows the problems and creates nothing.
- [ ] Publishing a valid Draft creates version 1; publishing again after an edit creates version 2 and leaves version 1's stored document unchanged — proven in Seam B by restoring version 1 and seeing the pre-edit content (not a Seam A test: immutability of an in-memory value proves nothing about the row).
- [ ] Journey list shows state published / unpublished / never published; Unpublish flips it and the live pointer is cleared.
- [ ] Version list shows number, publish time, and who published; restore replaces the Draft with the chosen version's document after confirmation.
- [ ] Preview walks the Draft from Start to an Ending; no Run row is created; a non-Member (or signed-out user) cannot open Preview.
- [ ] Slug editing is disabled once a version exists.
- [ ] Seam B: publish → edit → publish v2 → restore v1 flow.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [SCOPE CHANGE] 2026-09-19 — slugs dropped (see ticket 02)

Paul decided during PR #10 review that Projects and Journeys have no slug: every path parameter is the id. Read every "slug" in this ticket as the id (`/j/{journey-id}`, `/p/{project-id}`), and drop any "slug frozen at first publish" behavior. Recorded in ticket 02's [SCOPE CHANGE] and the spec's Comments.

### [EXECUTION PLAN] 2026-09-20 — Atlas orchestrator

**Contract:** this ticket as amended by its `[SCOPE CHANGE]` (slugs dropped). Criteria are AC-1..AC-7 in checklist order; AC-6 (slug frozen after first publish) is superseded by the scope change and is recorded as `SKIPPED` with that approved exception. Derived DoD from the footer, `docs/agents/testing.md`, and `CLAUDE.md`: DoD-1 verified run command green; DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only, no participant data; DoD-3 the migration is additive and safe against the previously deployed code, because the Migrate action and the Vercel build start together with no ordering guarantee. Run surface: local + deployed; per Paul's 2026-09-20 decision there is no post-merge staging smoke gate, so no deployed criterion is defined.

**Availability:** ticket 03 is `done` (PR #11), ticket 04 is `done` (PR #14 merged to `staging` at `184d179`). Tickets 05, 08, 13 were available; 05 is first by number and next in the spec's priority order (4 Publish, versions, unpublish).

**Repository delivery:** `journeys`, base `staging` @ `184d179`, branch `feat/05-publish-preview-versions-and-restore`, direct checkout, no worktrees. Two deliverables run **sequentially** (D1 then D2). Parallelism rejected on two grounds, to be re-checked at closeout: (1) both deliverables verify with `pnpm test:e2e`, which binds port 3100 with `reuseExistingServer` off and migrates the one shared `journeys_e2e` database, so two workers cannot verify at the same time; (2) both are expected to edit `src/app/projects/[projectId]/journeys/[journeyId]/page.tsx` (D1 adds the publish controls and version list, D2 adds the Preview link), and D2 reuses D1's status badge.

**Resolved technical decisions (execution, not contract changes):**
- **Schema, migration 0003 (additive only).** New table `published_version`: `id` text primary key (`crypto.randomUUID()` default like the other tables), `journey_id` text not null → `journey.id` on delete cascade, `version_number` integer not null, `document` jsonb not null (typed `GraphDocument`), `published_at` timestamptz not null default now, `published_by` text nullable → `user.id` on delete set null (a Member who later leaves keeps their name on the row while their account exists; the row survives the account); unique (`journey_id`, `version_number`). `journey.live_version_id` text nullable → `published_version.id` on delete set null (Drizzle circular reference via `AnyPgColumn`). Nothing already deployed reads either, so a build that goes live before the migration keeps working, and the migration keeps working under the old code.
- **Publish state is derived, never stored:** live pointer set → `published`; null with at least one version → `unpublished`; null with none → `never-published`. `publishStateOf({ liveVersionId, versionCount })` is a pure function in `src/lib/publish-state.ts` (no `server-only`) with a Seam A test; `listJourneysForProject` and `getJourneyForMember` return `publishState` from a version count and the pointer. `JourneyStatusBadge` takes the state and renders "Never published" / "Published" / "Unpublished".
- **Data access** in a new `src/db/versions.ts` (`server-only`, mirroring `@/db/drafts`): `listVersionsForMember(projectId, journeyId, userId)` → newest first `{ id, versionNumber, publishedAt, publishedByName (null when the account is gone), isLive }`, null for a non-Member; `publishDraft(projectId, journeyId, userId)` → membership check, read the Draft, `validateForPublish`; problems → `{ ok: false, problems }` and nothing written; otherwise one transaction: next `version_number` = max + 1 for the Journey (the unique constraint turns a race into an error rather than a duplicate), insert the snapshot with `published_by` = the Author, set `journey.live_version_id` → `{ ok: true, versionNumber }`; `unpublishJourney(...)` clears the pointer and leaves every row; `restoreVersion(projectId, journeyId, versionId, userId)` copies that version's document into the Draft (upsert like `saveDraft`; the stored document is parsed with `graphDocumentSchema`, not re-sanitized, because it entered storage sanitized). Publish never touches the Draft, and nothing ever updates a `published_version` row.
- **Server actions** added to `src/app/projects/[projectId]/journeys/actions.ts`: `publishJourneyAction` → `{ ok: true, versionNumber } | { ok: false, error, problems?: PublishProblem[] }`, `unpublishJourneyAction`, `restoreVersionAction`; each re-reads the session and calls `revalidateJourneyPaths()`.
- **Journey page UI.** `PublishControls` (client): a "Publish" button; on refusal it renders "This journey can't be published yet" with the problem messages as a `role="alert"` list and creates nothing; on success the page refreshes and the badge reads "Published". When live, an "Unpublish" button behind an `AlertDialog` ("Unpublish" → "Unpublish journey"), because it takes content away from participants. A `VersionList` section "Versions", newest first: "Version N", a `<time dateTime>` of the publish moment formatted on the server, "by <name>" (or "by a former member"), a "Live" badge on the live version, and a "Restore" button per version behind an `AlertDialog` ("Replace the draft with version N?" → "Restore version") that calls `restoreVersionAction` and refreshes. No versions → "Not published yet." A "Preview" link (D2) sits beside Edit.
- **Preview (D2).** Routes `src/app/projects/[projectId]/journeys/[journeyId]/preview/page.tsx` (start screen: Journey title, description, "Begin" → the Start Step) and `preview/[stepId]/page.tsx` (Step title, rendered content, Choices as links to sibling Step URLs; an Ending shows "The end", its Outcome label, and "Start over" back to the start screen; a Choice whose target does not exist renders as plain text marked "(missing step)"; an unknown `stepId` is a 404). Both call `requireSession` then `getDraftForMember`, so a non-Member gets the same 404 as an unknown Journey and a signed-out visitor is bounced to `/` by `src/proxy.ts`. A persistent banner reads "Preview — nothing you do here is recorded." The runner pieces live in `src/components/runner/` (`step-view.tsx`, `rich-text.tsx`) so ticket 06 reuses them for `/j/{journey-id}`; no Run or Response table exists yet, so Preview cannot record anything.
- **Rich text rendering.** `src/components/runner/rich-text.tsx` renders the closed `Content` type to React elements — paragraph, heading levels, bullet and ordered lists, links with `rel="noopener noreferrer"` and `target="_blank"`, image as `<figure><img alt><figcaption>credit</figcaption></figure>` — with no `dangerouslySetInnerHTML`. The spec names Tiptap's renderer, but Tiptap is not installed and lockfile commits are human-only, so the renderer is hand-written over the sanitized closed schema; ticket 08 may swap in `@tiptap/html` when it adds the editor's dependencies (queued question for Paul, non-blocking). Seam A test with `react-dom/server` `renderToStaticMarkup`.
- **Seam B.** `e2e/publish.spec.ts` with `publish-invalid-draft` (AC-1) and `publish-versions-and-restore` (AC-2, AC-3, AC-4, AC-7); `e2e/preview.spec.ts` with `preview` (AC-5 walk, plus a query proving no Run table exists) and `preview-non-member` (AC-5 access: a second minted Author gets 404, a signed-out context is redirected to `/`). The editor arrives in ticket 08, so documents are written straight into the `draft` row with `queryE2eDatabase`, from a small fixture in `e2e/setup/documents.ts` (Start → two Choices → two Endings with two Outcomes). Immutability is proven against the row: the version 1 document read back after publishing version 2 and after restoring version 1 deep-equals the document read back right after version 1 was published, and the Draft summary shows the pre-edit Step title. The existing `journey-create` assertion on "Never published" stays valid. Screenshots at `test-results/<test-name>/<test-name>.png`.
- README: the Routes list gains the preview route and the journey page entry mentions publish, versions, unpublish, and restore. No new dependency; lockfile untouched.

**Deliverables:**
- **D1 — Publish, Unpublish, versions, restore, publish state** (worker: atlas-worker on `opus`): migration 0003, schema, `src/db/versions.ts`, journey list state, actions, `PublishControls`, `VersionList`, status badge, `publish-state` + test, `e2e/publish.spec.ts`, `e2e/setup/documents.ts`, README.
- **D2 — Preview through minimal runner components** (worker: atlas-worker on `sonnet`, tightly specified): preview routes, `src/components/runner/`, rich-text renderer + test, Preview link on the Journey page, `e2e/preview.spec.ts`, README route line. Depends on D1 only for the page it edits.

**Verification map (evidence committed under `test-results/`, root cleared at workspace prep):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | `pnpm test:e2e` test `publish-invalid-draft`: a new Journey's Draft (one Start that is an Ending with no Outcome) → Publish → problem list shown; `published_version` count for the Journey is 0; badge still "Never published" | local; docker Postgres `journeys_e2e`; e2e server on 3100 | refused with the problems, nothing created | `test-results/publish-invalid-draft/publish-invalid-draft.png`, `test-results/dod-1-e2e.txt` | after D1 | changes under `src/`, `e2e/`, `drizzle/` |
| AC-2 | `pnpm test:e2e` test `publish-versions-and-restore`: publish v1 → edit the Draft row → publish v2 → restore v1 → Draft shows pre-edit content; the v1 row's document read back is unchanged throughout | as AC-1 | v1 and v2 exist; v1 document identical; Draft equals v1 after restore | `test-results/publish-versions-and-restore/publish-versions-and-restore.png`, `test-results/dod-1-e2e.txt` | after D1 | as AC-1 |
| AC-3 | same test: Project page badge reads "Published" after v1, "Unpublished" after Unpublish; `live_version_id` null and version rows intact after Unpublish; `journey-create` still shows "Never published" | as AC-1 | as stated | same screenshot, `test-results/journey-create/journey-create.png`, `test-results/dod-1-e2e.txt` | after D1 | as AC-1 |
| AC-4 | same test: "Versions" lists "Version 1" and "Version 2" with a `<time>` and the Author's name; Restore requires the confirmation dialog before the Draft changes | as AC-1 | as stated | same evidence as AC-2 | after D1 | as AC-1 |
| AC-5 | `pnpm test:e2e` tests `preview` and `preview-non-member`: Member walks start screen → Start → Choice → Ending with the Outcome label; `information_schema.tables` has no `run` table; another Author gets 404 on both preview routes; a signed-out context is redirected to `/` | as AC-1 | as stated | `test-results/preview/preview.png`, `test-results/preview-non-member/preview-non-member.png`, `test-results/ac-5-no-run-table.txt`, `test-results/dod-1-e2e.txt` | after D2 | changes under `src/`, `e2e/`, `drizzle/` |
| AC-6 | none — superseded by the `[SCOPE CHANGE]` of 2026-09-19 (no slugs) | — | `SKIPPED`, approved exception | this record | — | — |
| AC-7 | the `publish-versions-and-restore` flow above, end to end | as AC-1 | green | as AC-2 | after D1 | as AC-1 |
| DoD-1 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` | local; docker Postgres | all exit 0 | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt` | after D2 | any source, config, or test change |
| DoD-2 | evidence review: every PASS artifact committed under `test-results/`; fixture journeys only | local | as stated | this ticket's closeout | closeout | — |
| DoD-3 | read `drizzle/0003_*.sql`: only `CREATE TABLE`, `ADD COLUMN` (nullable), and constraints; `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm db:migrate` against the dev database, which already runs the previously deployed schema | local; docker Postgres `journeys` | additive; migrate exits 0 | `test-results/dod-3-migration.txt` | after D1 | changes under `drizzle/`, `src/db/schema.ts` |

Human gates: none. The only deployed step — the Migrate action on merge — is automatic.

### [PROGRESS] 2026-09-20 — D1 and D2 integrated; aggregate review started

D1 (publish, unpublish, version list, restore, derived publish state) — atlas-worker on `opus` — `10d22af`, accepted after the orchestrator's screen. The worker found and fixed a Drizzle quirk on the way: an interpolated column inside a join-free query renders unqualified, so the correlated version count compared two columns of the inner table and silently read 0 (a Journey with two versions showed "Never published" in the Project list); the count is now a grouped query shared by both Journey reads. D2 (Preview through minimal runner components) — atlas-worker on `sonnet` — `c65d286`, accepted. Candidate evidence: the screenshots under `test-results/` from both workers' e2e runs in this checkout (17, then 19 specs green) and `test-results/dod-3-migration.txt` captured by the orchestrator. Status `in-progress` → `ai-review`. Queued, non-blocking question for Paul: Preview's rich text is rendered by a hand-written React renderer over the sanitized closed schema because Tiptap is not installed and lockfile commits are human-only; the spec names Tiptap's renderer, and ticket 08 may swap in `@tiptap/html` when it adds the editor's dependencies.

### [AI CODE REVIEW] 2026-09-20 — aggregate review of `184d179..c65d286`, fixes in `06a9878`

Two fresh reviewers (one per axis, `opus`, read-only) read the whole diff against the fixed base with the ticket, its `[SCOPE CHANGE]` and `[EXECUTION PLAN]`, the spec's Publishing / Domain model / Testing Decisions sections, `CONTEXT.md`, ADR-0001, and `docs/agents/testing.md`; the orchestrator adjudicated every candidate from the cited hunks and applied the fixes inline in `06a9878`. **No blocking findings on either axis.**

**Axis 1 — technical implementation and spec conformity** (6 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| T1 PASS evidence not yet committed; `dod-1-*.txt` not yet captured | non-blocking (closeout work) | `test-results/` | resolved by the evidence commit at closeout — captured once, after the review fixes, at the verified commit |
| T2 Step and Outcome ids looked up with bare indexing / `in`, so an id such as `toString` finds a prototype method (Preview 500 instead of 404; a dangling Choice rendered as a link) | non-blocking | preview routes, `step-view.tsx` | resolved: `Object.hasOwn` in all three places; the same pattern in `src/lib/graph/validate.ts` predates this ticket and is noted as a follow-up |
| T3 the concurrent-publish unique violation the plan relies on surfaced as an unhandled rejection with no message | non-blocking | `versions.ts`, `actions.ts` | resolved: `publishDraft` catches `23505` (bare or as `cause`) and the action returns a worded error |
| T4 DoD-3's stated justification was wrong in the forward direction (the new build does read the new column and table) | non-blocking | `dod-3-migration.txt`, this ticket | resolved: the migration is additive and safe against the previously deployed code, which is the requirement; if the build wins the race with the Migrate action there is a brief error window inherent to the deploy model |
| T5 AC-2's e2e proved version rows unchanged after publishing v2 but not after restoring v1 | non-blocking | `e2e/publish.spec.ts` | resolved: assertion added |
| T6 the renderer trusted the http(s) rule the write path enforces; a document stored some other way could render a `javascript:` link | non-blocking | `rich-text.tsx` | resolved: scheme re-checked at render; non-http links keep their text, non-http images are dropped; unit test added |

Conformity: AC-1, AC-3, AC-4, AC-5, AC-7 conform; AC-2 conforms with T5 applied; AC-6 superseded by the `[SCOPE CHANGE]`; DoD-1/DoD-2 rest on the evidence captured at aggregate verification; DoD-3 conforms with T4's wording corrected.

**Axis 2 — coding standards** (8 candidates)

| # | Severity | Paths | Disposition |
|---|---|---|---|
| S1 stale "ticket 05 is what will act on that" on `validateDraft` | non-blocking | `drafts.ts` | resolved |
| S2 `saveDraft` docstring claimed to be the only Draft writer; `restoreVersion` is a second | non-blocking | `drafts.ts` | resolved: docstring names it and why it needs no re-sanitizing |
| S3 three tiny fixture builders duplicated from `large-journey.ts` | non-blocking | `e2e/setup/documents.ts` | deviation approved: the execution plan placed the spec-owned fixture there deliberately (readable ids); kept |
| S4 `preview-chrome.tsx` was the only non-route file under `src/app/` | non-blocking | preview routes | resolved: moved to `src/components/journeys/preview-chrome.tsx` |
| S5 `role="list"` comment gave a reason that did not apply | non-blocking | `publish-controls.tsx` | resolved |
| S6 problem-list React keys collide for two dangling Choices on one Step | non-blocking | `publish-controls.tsx` | resolved: Choice id in the key |
| S7 "visitor" is on the `CONTEXT.md` avoid list | non-blocking | `README.md`, `e2e/preview.spec.ts` | resolved |
| S8 Choices list lacked the convention's comment and an `aria-label` | non-blocking | `step-view.tsx` | resolved: `aria-label="Choices"` |

Both axes confirmed: `src/db/versions.ts` is `server-only`; `src/lib/publish-state.ts` touches no database; the migration is generated, additive, and matches its snapshot; lockfile untouched; e2e signs in by minting a session; screenshots follow `test-results/<test-name>/<test-name>.png`; fixture journeys only.

**Remaining risks (not findings):** the Journey page now makes about six queries, most re-checking membership and counting versions — fine at this scale; `restoreVersion` does not bump `journey.updated_at`; publish snapshots the zod-parsed document, so defaults (`allowBack`, `condition`, `effect`) are materialized for Drafts written by the 0002 backfill or the seed; no named test deletes a published Journey (the cascade is exercised only by e2e cleanup); no test covers a version id of another Journey (the guard exists); republishing an unchanged Draft creates an identical next version.

### [CLOSEOUT] 2026-09-20 — Atlas orchestrator

**PR:** https://github.com/paul-macfarlane/journeys/pull/15 (base `staging`, head `feat/05-publish-preview-versions-and-restore`). Status `in-progress` → `ai-review` → `ready-for-human`.

**Repository delivery `journeys`:** base `staging` @ `184d179`, direct checkout, no worktrees; D1 then D2 sequentially. Closeout re-check of the rejected parallelism: both deliverables edited `src/app/projects/[projectId]/journeys/[journeyId]/page.tsx` (overlapping hunks in the import block and the header actions row) and the same README paragraph, and both verify through the one e2e port and database — the prediction held, so the isolation record stands as written.

**Deliverables:**
- D1 publish, unpublish, version list, restore, derived publish state — atlas-worker on `opus` — `10d22af`.
- D2 Preview through minimal runner components — atlas-worker on `sonnet` — `c65d286`.
- Review fixes — orchestrator — `06a9878`. Evidence and records — orchestrator — `618286a` and this closeout.

**Verified run command:** `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` — every command exit 0 at `06a9878` (107 unit tests in 6 files; 19 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`). No deployed-target check (Paul's 2026-09-20 decision); the Migrate action applies `0003` on merge.

**Criterion verdicts (evidence under `test-results/`, committed in `618286a`, captured at `06a9878` unless noted):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 publishing an invalid Draft shows the problems and creates nothing | PASS | `publish-invalid-draft/publish-invalid-draft.png`, `dod-1-e2e.txt` (`publish-invalid-draft` ✓) |
| AC-2 v1 then v2; v1's stored document unchanged, proven by restoring it in Seam B | PASS | `publish-versions-and-restore/publish-versions-and-restore.png`, `dod-1-e2e.txt` (`publish-versions-and-restore` ✓, with the version rows re-read after the restore) |
| AC-3 list shows published / unpublished / never published; Unpublish flips it and clears the pointer | PASS | same, plus `journey-create/journey-create.png` |
| AC-4 version list shows number, time, who; restore replaces the Draft only after confirmation | PASS | same |
| AC-5 Preview walks Start → Ending; no Run row; non-Member and signed-out cannot open it | PASS | `preview/preview.png`, `preview-non-member/preview-non-member.png`, `ac-5-no-run-table.txt` (captured at `c65d286`; `drizzle/` unchanged since), `dod-1-e2e.txt` (`preview`, `preview-non-member` ✓) |
| AC-6 slug editing disabled once a version exists | SKIPPED | approved exception: superseded by the 2026-09-19 `[SCOPE CHANGE]` (no slugs) |
| AC-7 Seam B publish → edit → publish v2 → restore v1 | PASS | as AC-2 |
| DoD-1 verified run command green | PASS | `dod-1-commands.txt`, `dod-1-e2e.txt` |
| DoD-2 every PASS artifact committed; fixture data only | PASS | this record; the artifacts hold minted `Test Author` accounts, the invented border-post fixture, the documented local Postgres default, and nothing from a participant |
| DoD-3 migration additive and safe against the previously deployed code | PASS | `dod-3-migration.txt` (captured at `10d22af`; `drizzle/` unchanged since; wording corrected per review T4) |

**Deviations:** AC-6 skipped under the scope change; review S3 kept as an approved deviation (spec-owned fixture builders in `e2e/setup/documents.ts`); Preview's rich text is rendered by a hand-written React renderer over the sanitized closed schema rather than Tiptap's renderer, because Tiptap is not installed and lockfile commits are human-only — **open question for Paul**, carried in the PR description; ticket 08 may swap in `@tiptap/html`.

**Human follow-ups:** (1) review and merge PR #15; (2) answer the renderer question above; (3) outside this ticket, `src/lib/graph/validate.ts` looks Step and Outcome ids up with bare indexing, so an id such as `toString` passes validation — the runner now guards against it and validation should too; (4) if the build wins its race with the Migrate action on `staging`, the two authoring pages error until `0003` lands, which is inherent to the deploy model.

### [SCOPE CHANGE] 2026-09-20 — approved by Paul (PR #15 review)

Paul's review of PR #15, decided in the session of 2026-09-20:
- **Tiptap adopted.** Step rich text is rendered by Tiptap's own renderer (`@tiptap/html` `generateHTML` over the same extension set the editor will use), answering the open renderer question. Paul asked for the "never commit `pnpm-lock.yaml` from an agent session" rule to go ("it has caused more problems than it is worth"). It turned out to describe a real block: the Atlas plugin's commit-time secret scrub refuses any agent commit whose staged diff holds a 40+ character token, which every lockfile integrity hash is, and that plugin hook has no lockfile allowlist. The `CLAUDE.md` line now states that constraint; the agent ran `pnpm add`, and Paul commits `pnpm-lock.yaml` from his terminal. Changing the plugin hook is a separate, human decision.
- **Publish is disabled when there is nothing to publish**: while the live version's document equals the Draft, the button is disabled and says so. An unpublished or never-published Journey can always publish.
- **`PreviewChrome` renamed `PreviewFrame`** ("chrome" read as the browser).
- **Folded in:** the validator's bare-index lookups (review T2's upstream sibling) now use own-property checks, with tests; Paul asked whether it was a problem and whether it was tracked — it was not tracked, and the fix is small enough to land here.
- Confirmed as still to come, not gaps: Step and Choice editing is ticket 08; the public runner at `/j/{journey-id}` is ticket 06.

### [PROGRESS] 2026-09-20 — rework after Paul's PR #15 review

Applied by the orchestrator in `ca5efb4` (Tiptap `3.31.3` installed: `@tiptap/core`, `@tiptap/pm`, `@tiptap/html`, `@tiptap/starter-kit`, `@tiptap/extension-image`; the shared extension set is `src/lib/rich-text/extensions.ts` with a `CreditedImage` node rendering `figure`/`figcaption`; `RichText` now calls `generateHTML` over a hardened copy of the content, and its six unit assertions passed unchanged against Tiptap's output). Publish is disabled with "The live version already matches the draft." while `documentsEqual(draft, live)` holds — a canonical-JSON comparison in `src/lib/graph/document.ts` with tests — and the e2e asserts disabled after v1, enabled after the Draft edit. `PreviewChrome` → `PreviewFrame`. `validateForPublish` uses own-property lookups, with two tests (prototype names as missing ids; prototype names as real ids). Verified run command all exit 0 at `ca5efb4`: 111 unit tests in 6 files, 19 e2e specs (`[e2e] database: journeys_e2e on localhost:5436`); evidence recaptured under `test-results/`. The `pnpm-lock.yaml` change is Paul's commit (see the `[SCOPE CHANGE]`); CI's install needs it on the branch before the push.
