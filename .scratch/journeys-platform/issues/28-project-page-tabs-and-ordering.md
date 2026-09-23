# 28: Project page tabs, Journey ordering, and Project settings

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → 26 → 27 → 10 → **28** → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: contract

**Why:** The Project page stacks Journeys, Members, and the title controls in one column; Paul wants tabs — Journeys, then Members, then Settings holding the title, a description, and delete — with the Journey page laid out the same way (ticket 26). Journeys should be orderable, and the members copy "they need to sign in once first" is clunky. Items 7, 10, and 24 of his 2026-09-21 notes.

**Decisions (Paul, 2026-09-21):** tabs in the order Journeys, Members, Settings. A Project gains a description. Journeys are ordered by the Author; up/down controls rather than drag, which is enough for the hackathon. The members refusal reads "No account has that email — they need to sign up first".

**What to build:**

- **Schema.** `project.description` text, not null, default `''`; `journey.position` integer, not null, default 0. One migration (`pnpm db:generate`) that adds both columns and backfills `position` per Project in `created_at` order (a `WITH ... ROW_NUMBER()` update in the SQL). Both additive with defaults, so the previously deployed code keeps working during the deploy window.
- **Ordering.** `createJourney` appends at `max(position) + 1` within the Project; `listJourneysForProject` orders by `position`, then `created_at`. New actions `moveJourney(projectId, journeyId, "up" | "down")` swap positions with the neighbour inside one transaction and are Member-only like every other write. Each Journey row in the list gets "Move up" / "Move down" icon buttons (disabled at the ends).
- **Tabs.** The Project page becomes a header (inline title as in ticket 26, status of nothing, the "New journey" button on the Journeys tab) plus shadcn `Tabs`: **Journeys** (the list with ordering), **Members** (`MemberList` and add-member form), **Settings** (inline title input and description textarea saving on blur through the update action, then a "Danger zone" holding `DeleteProjectDialog`). Selected tab in the URL as `?tab=members` / `?tab=settings`, default Journeys. `EditProjectDialog` is removed; its update action gains `description`.
- **Copy.** `src/app/projects/actions.ts`: "No account has that email — they need to sign up first".
- **Public Project page note.** Ticket 07 renders `project.description` and lists Journeys in `position` order; add one line to `07-public-project-page.md`.
- **Specs.** `project-rename` becomes an inline edit on the Settings tab; `members-*` specs open the Members tab first and read the new copy; `project-delete*` use the Settings tab; a new `journeys-reorder` spec creates three Journeys, moves the third up twice, reloads, and reads the order.

Acceptance criteria:

- [ ] The migration applies to a database holding existing Projects and Journeys; every existing Journey gets a `position` matching its `created_at` order within its Project, and `pnpm db:migrate` in CI passes.
- [ ] The Project page shows three tabs in the order Journeys, Members, Settings; `?tab=settings` survives a reload.
- [ ] Editing the title and description on the Settings tab and blurring saves them; the Projects list and the page header show the new title.
- [ ] Move up / Move down reorder Journeys, the order survives a reload, and a new Journey appears last.
- [ ] Adding a Member with an unknown email reads "No account has that email — they need to sign up first".
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-1-migration.txt`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 7, 10, 24.

## Comments

### [EXECUTION PLAN] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

Route: contract. Repository delivery: `journeys` on `feat/28-project-tabs-and-ordering`, comparison SHA `c04cd01` (staging). Direct checkout, one implementer (this session), no worktrees: every deliverable meets on the Project page and its actions.

**Reading of the header.** The header shows the Project title as a heading and the description beneath it; the editable title and description fields live on the Settings tab, as the acceptance criteria describe ("editing the title and description on the Settings tab … the page header show[s] the new title"). One editable copy, not two.

**Seams and order.** (1) Schema and migration: `project.description` and `journey.position`, one `pnpm db:generate` migration with a hand-written `ROW_NUMBER()` backfill (0-based, per Project, `created_at` then `id`). (2) Seam A, test first: a pure `moveInOrder(ids, id, direction)` in `src/lib/journey-order.ts` that returns the new order or null at the ends; `editProjectSchema` gains `description` (validation test). (3) Data access: `getProjectForMember` and `listProjectsForAuthor` return `description`; `editProject` writes it; `listJourneysForProject` orders by `position`, `created_at`; `createJourney` appends at `max(position) + 1`; `moveJourney` reads the ordered ids in a transaction, applies the seam, and writes `position = index` for every row whose position differs (normally the two swapped; ties left by the deploy window heal on the first move). (4) Actions: `editProjectAction` takes `description`; `moveJourneyAction(projectId, journeyId, direction)` in the journeys actions, Member-checked through `getProjectForMember`; members copy. Unit test for `moveJourneyAction` with doubles (non-Member refused, end of list is a no-op, moved). (5) UI: `ProjectPage` = header + `UrlTabs` over `["journeys","members","settings"]`; `JourneyList` client rows with "Move up"/"Move down" icon buttons; `MemberList` loses its own heading; `ProjectSettingsFields` (react-hook-form, blur-submitted, modelled on `JourneyTitleFields`) plus a "Danger zone" with `DeleteProjectDialog`; `EditProjectDialog` deleted. (6) Specs: `openTab` widened to the Project tabs; `project-rename` edits on Settings; `project-delete`, `project-delete-cascade`, `author-flow` delete from Settings; the three `members-*` tests open Members first and read the new copy; new `journeys-reorder`. (7) Docs: README Project page paragraph, CONTEXT.md untouched (a description is not a new concept), ticket 07 note.

**Verification map (contract route, `docs/agents/testing.md`):**

| Criterion | Command | Evidence |
|---|---|---|
| AC-1 migration backfills `position` per Project in `created_at` order; CI `pnpm db:migrate` | `pnpm db:migrate` against the local dev database holding seeded Projects/Journeys, then a `psql` read of `position` vs `created_at` rank | `test-results/ac-1-migration.txt`; PR CI migrate job |
| AC-2 three tabs in order; `?tab=settings` survives a reload | `E2E_EVIDENCE=… pnpm test:e2e` → `project-rename` (opens Settings, reloads, reads the tab) | `test-results/project-rename/` |
| AC-3 Settings title and description save on blur; list and header show the title | same → `project-rename` | `test-results/project-rename/` |
| AC-4 Move up / Move down, order survives reload, new Journey last | same → `journeys-reorder` | `test-results/journeys-reorder/` |
| AC-5 unknown-email copy | same → `members-add-refused` | `test-results/members-add-refused/` |
| AC-6 full e2e once at the end | `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm db:migrate; pnpm test:e2e` | `test-results/dod-1-commands.txt`; PR CI |

`pnpm test:e2e` builds the app. Review: two readers (correctness and contract) via the two-axis code review.

### [AI CODE REVIEW] 2026-09-22 — Claude Fable 5.1; two fresh Opus readers (standards, spec) read the diff `c04cd01..69b8b23`, this session adjudicated

**Standards axis.** Hard findings: (1) evidence not yet committed — the planned last step (this record, the capture, and the closeout follow); (2) `moveJourneyAction` hand-checked its direction and cast it instead of re-parsing with a schema like every sibling action — fixed: `moveDirectionSchema` (`z.enum(["up","down"])`) in `@/lib/validation/journey`, `firstIssue` for the message, no cast; the unit test now reads the schema's message. Smells (judgement calls): near-verbatim save routine in `ProjectSettingsFields` and `JourneyTitleFields` (the reset-with-`keepDirtyValues` effect, the unchanged-record guard, the unreachable-server fallback, the Enter-blurs handler) — fixed: both use `useBlurSavedForm` in `src/components/blur-saved-form.ts`, values memoized at the call sites; primitive obsession on the direction — moot with the schema. In passing: `createJourney` read `max(position)` inside its transaction with no lock, so two concurrent creates could number two Journeys the same — fixed: `lockProject` takes the Project row `FOR UPDATE` in both `createJourney` and `moveJourney` (the per-row lock on `moveJourney`'s select is gone, the Project lock covers it); `<section aria-label="Journeys">` wrapped `<ul aria-label="Journeys">` — the section is a plain `div` now; the reorder spec's reload assertion used `toContainText` (a subset match) without re-pinning the count — pinned.

**Spec axis.** Verdict: the ticket's contract is met; every named item present (append at `max+1`, order by `position` then `created_at`, Member-only transactional move, tab order and `?tab=` default, `journeys-reorder` as described, members specs on the Members tab reading the new copy, delete specs on Settings, ticket 07 note, `EditProjectDialog` gone, `description` on the edit action; migration columns, defaults, and backfill as specified). Findings, none blocking: (1) the parent spec's rich-text Project description (`spec.md`) is a plain textarea — ticket 28 says only "a Project gains a description" and the ticket 07 note records the deferral; (2) "New journey" sits in the Journeys tab panel rather than the header — the ticket's own wording ("the 'New journey' button on the Journeys tab"), noted for Paul; (3) the 500-character description cap mirrors the Journey's — kept for consistency; (4) `listProjectsForAuthor` returns `description` the Projects list does not render — one shared column set, kept; (5) the cross-Member adoption effect — same behaviour the Journey fields already had, now shared; (6) deploy window: a Journey inserted by the previously deployed build gets `position = 0` and sorts among the first until any move renumbers the list — one deploy window, self-correcting, recorded below; (7) existing Projects' lists flip from newest-first to oldest-first — what the ticket's backfill asks for, flagged for Paul.

Fixes landed as c1388db. Remaining risk: none blocking; the deployed surface is checked after Paul merges.

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/33 (base `staging`, comparison SHA `c04cd01`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Deliverables (all this session, direct checkout as planned).** 69b8b23 — migration 0006 (`project.description`, `journey.position`, `ROW_NUMBER()` backfill), the `moveInOrder` seam and `editProjectSchema` with their unit tests, `moveJourney` / position-ordered reads / append-last create, `moveJourneyAction` with doubles test, the members copy, the tabbed Project page (`JourneyList`, `ProjectSettingsFields`, `MemberList` trimmed, `EditProjectDialog` deleted), README, ticket 07 note, every spec change and the new `journeys-reorder`. c1388db — review fixes (`useBlurSavedForm` shared by both inline-field components, `moveDirectionSchema`, `lockProject` in both numbering transactions, section label, reload count). 686a826 — evidence and the review record. This commit — closeout.

**Verified run command (final tree, head c1388db):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm db:migrate; pnpm test:e2e` with `E2E_EVIDENCE` naming the ticket's specs — every block `exit=0`; unit 278/278; e2e 71 passed in 1.1m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 migration applies to a database holding existing Projects and Journeys; `position` matches `created_at` order per Project; CI `pnpm db:migrate` | PASS locally (2 Projects, 4 Journeys, 0 mismatches); CI migrate job pending at this commit | `test-results/ac-1-migration.txt`; PR #33 checks |
| AC-2 three tabs in the order Journeys, Members, Settings; `?tab=settings` survives a reload | PASS | `test-results/project-rename/project-rename.png` (viewed: Journeys, Members, Settings with Settings selected after the reload); `project-rename` in `dod-1-e2e.txt` |
| AC-3 Settings title and description save on blur; Projects list and page header show the new title | PASS | `test-results/project-rename/project-rename.png` (viewed: renamed heading, description under it, both fields holding the saved values); the list assertion in `project-rename` |
| AC-4 Move up / Move down reorder; order survives a reload; a new Journey appears last | PASS | `test-results/journeys-reorder/journeys-reorder.png` (viewed: the third-made Journey first after two moves, top row's Move up disabled); the post-reload and fourth-Journey assertions plus the `position` rows read from the database in `journeys-reorder` |
| AC-5 unknown email reads "No account has that email — they need to sign up first" | PASS | `test-results/members-add-refused/members-add-refused.png`; `members-add-refused` in `dod-1-e2e.txt` |
| AC-6 `pnpm test:e2e` once in full at the end | PASS locally (71/71, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR #33 checks |

**Deviations.** (1) `pnpm build` was not run on its own: `pnpm test:e2e` builds the app. (2) `ac-1-migration.txt` was captured at the base SHA `c04cd01` before the first commit, since the local dev database can only take migration 0006 once; the migration file has not changed since. (3) The first final capture lost its output to a broken `sed` escape in the capture script and was re-run in full; only the re-run is committed. (4) `project-delete`, `project-delete-cascade`, and `author-flow` screenshots came out byte-identical to the committed ones (they picture the 404 and the empty list after the delete), so git shows no change for them.

**Queued for Paul (non-blocking, also in the PR).** (1) Existing Projects' lists flip from newest-first to oldest-first, as the backfill asks. (2) During the deploy window a Journey made by the old build gets `position = 0` and sorts among the first until any move renumbers the list. (3) The description is plain text; ticket 07 can upgrade it. (4) "New journey" sits on the Journeys tab, not in the header.

**Next in Paul's order:** 10 (analytics) → 29 → 30 → 31 → 23.
