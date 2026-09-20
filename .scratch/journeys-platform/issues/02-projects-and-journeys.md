# 02: Projects and Journeys

Status: ready-for-human
Blocked by: 01
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-19
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A signed-in Author creates a Project, sees it in their list, renames it, and deletes it; inside a Project they create Journeys with a title, slug, and short description, see their publish state, rename them, and delete them. The creator is the Project's first Member and membership gates every read and write.

Slugs are globally unique and auto-generated from the title; Journey slugs are editable until first publish (no publish exists yet, so editable throughout this ticket). Deleting is a hard delete after confirmation. A Project cannot lose its last Member (enforced here even though removing Members arrives in ticket 13). Member `role` column exists, defaults to `member`, is never read.

- [ ] Author creates a Project; it appears in their projects list; non-Members cannot open it (404 or forbidden, consistently).
- [ ] Author renames a Project. *(Amended 2026-09-19: slugs dropped — see [SCOPE CHANGE].)*
- [ ] Author deletes a Project after confirmation; it and its Journeys are gone.
- [ ] Author creates a Journey with title and description; the Project page lists Journeys with state "never published". *(Amended 2026-09-19: no slug.)*
- [ ] Author renames a Journey and edits its description; deletes it after confirmation. *(Amended 2026-09-19: no slug.)*
- [ ] Seam B: an e2e spec covers create Project → create Journey → rename → delete.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
### [EXECUTION PLAN] 2026-09-19 — Atlas orchestrator

**Contract:** this ticket, unchanged. Criteria are AC-1..AC-6 in checklist order; the body's "a Project cannot lose its last Member" rule is DoD-3. Run surface: local + deployed (staging after merge, human-promoted).

**Availability note:** ticket 01 is `ready-for-human`, not `done` (PR #6 merged to `staging`; `CLAUDE.md` records Foundation as landed; post-01 human prerequisites are ticked). Claimed on the readiness definition "no Blocked by: line lists an unresolved issue file". Moving 01 to `done` is Paul's.

**Repository delivery:** `journeys`, base `staging` @ `5816b65`, branch `feat/02-projects-and-journeys`, direct checkout, no worktrees. Sequential D1 → D2: both predictably edit `src/db/schema.ts`, `drizzle/meta/_journal.json`, `src/app/projects/[projectSlug]/page.tsx`, `e2e/setup/session.ts`, and `README.md`; re-checked at closeout. The checkout's only dirty file is Paul's uncommitted `human-prerequisites.md` edit, left untouched.

**Resolved technical decisions (execution, not contract changes):**
- Tables in `src/db/schema.ts`, text ids from `crypto.randomUUID()` via `$defaultFn`, matching better-auth's id style. `project` (id, title, slug unique, created_at, updated_at). `member` (project_id → project cascade, user_id → user cascade, `role` text default `member` never read, created_at; primary key (project_id, user_id)). `journey` (id, project_id → project cascade, title, slug globally unique, description text default `''`, created_at, updated_at). No live-version pointer yet (ticket 05); the list shows "Never published" for every Journey until then. Draft creation is ticket 03. No project description or theme columns yet (tickets 07 and 11).
- DoD-3 last-Member rule is enforced in the database: migration `0001` appends a `BEFORE DELETE ON member` trigger that raises when the project row still exists and holds one member. Cascades from `project` deletion pass (the project row is already gone); cascades from `user` deletion are refused by design, so e2e cleanup deletes an Author's projects before the Author. Ticket 13 adds the UI and app-level message.
- Slugs: `src/lib/slug.ts` — `slugify` (NFKD, strip diacritics, lowercase, non-alphanumerics → `-`, collapse, trim, max 60, fallback `untitled`) and `slugSchema` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 60). Create: auto from title; a collision appends `-2`, `-3`, … via a pure `uniqueSlug(base, isTaken)`. Explicit slug edit that collides: refused with "That slug is already taken" (unique index is the real guard; pg `23505` maps to the same message). Rename dialogs carry a slug field prefilled with the current slug plus a "Regenerate from title" button — the slug changes only when the Author edits it or presses that button.
- Authorization: `src/lib/projects.ts` `getProjectForMember(slug, userId)` returns null for non-members and unknown slugs alike; pages `notFound()` → 404 consistently. Every server action re-checks membership server-side.
- Layout: data access `src/lib/projects.ts`, `src/lib/journeys.ts`; zod schemas shared by client and server in `src/lib/validation/{project,journey}.ts` (no `server-only`); `"use server"` actions in `src/app/projects/actions.ts` and `src/app/projects/[projectSlug]/journeys/actions.ts` returning `{ ok: true, ... } | { ok: false, error }`, then `revalidatePath` / `redirect`. Forms are client components with react-hook-form + `zodResolver`; shadcn base-nova `dialog`, `alert-dialog`, `input`, `label`, `textarea` added with `pnpm exec shadcn add` (no new dependencies; lockfile untouched). Deletes confirm in an alert dialog.
- Routes: `/projects` (list + New project), `/projects/[projectSlug]` (rename, delete, journeys list, New journey), `/projects/[projectSlug]/journeys/[journeySlug]` (title / slug / description form, delete). `src/proxy.ts` already matches `/projects/:path*`.
- Tests: Seam A `src/lib/slug.test.ts`; Seam B `e2e/projects-and-journeys.spec.ts` with the existing minted-session helper; `cleanup` in `e2e/setup/session.ts` deletes the Authors' projects first. ADR-0001 stays with ticket 03.

**Deliverables:**
- **D1 — Projects and Members.** `project` + `member` tables, trigger, migration `0001`, slug module + unit tests, project validation/data access/actions, `/projects` list with create dialog, `/projects/[projectSlug]` with rename (title + slug) and confirmed delete, shadcn components, e2e cleanup extension, e2e tests for create/list, non-member 404, rename + slug collision error, confirmed delete. Proves AC-1, AC-2, AC-3 (project half), DoD-3.
- **D2 — Journeys.** `journey` table + migration `0002`, journey validation/data access/actions, journeys list on the project page with "Never published", create dialog, journey page with edit + confirmed delete, e2e flow create Project → create Journey → rename → delete plus the cascade check (delete Project → journey page 404), README routes note. Proves AC-3 (cascade), AC-4, AC-5, AC-6.

**Verification map (evidence committed under `test-results/`, cleared once at the start of this work package):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | `pnpm test:e2e` tests `project-create` and `project-non-member` | local; docker Postgres `journeys_e2e` | new Project listed for its creator; a second minted Author gets 404 on its URL | `test-results/ac-6-e2e.txt`, `test-results/project-create/`, `test-results/project-non-member/` | after D1 | changes under `src/`, `e2e/`, `drizzle/` |
| AC-2 | `pnpm test:e2e` test `project-rename` | as above | title changes with slug kept; changed slug moves the URL; a taken slug shows "That slug is already taken" | `ac-6-e2e.txt`, `test-results/project-rename/` | after D1 | as above |
| AC-3 | `pnpm test:e2e` tests `project-delete` (D1) and `project-delete-cascade` (D2) | as above | confirm dialog, then project URL 404s; journey URL 404s too | `ac-6-e2e.txt`, `test-results/project-delete/`, `test-results/project-delete-cascade/` | after D2 | as above |
| AC-4 | `pnpm test:e2e` test `journey-create` | as above | Journey listed with auto slug and "Never published" | `ac-6-e2e.txt`, `test-results/journey-create/` | after D2 | as above |
| AC-5 | `pnpm test:e2e` test `journey-edit-and-delete` | as above | title, description, slug edited; confirmed delete removes it | `ac-6-e2e.txt`, `test-results/journey-edit-and-delete/` | after D2 | as above |
| AC-6 | `pnpm test:e2e` test `author-flow` (create Project → create Journey → rename → delete) | as above | passes end to end in one browser context | `ac-6-e2e.txt`, `test-results/author-flow/` | after D2 | as above |
| DoD-1 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`; plus `pnpm db:migrate` against an empty `journeys_verify` | local; docker Postgres | all exit 0; `0001`/`0002` apply cleanly | `test-results/dod-1-commands.txt`, `test-results/dod-1-migrate-fresh.txt` | after D2 | any source, config, or migration change |
| DoD-2 | evidence review: every PASS artifact committed under `test-results/`; no participant data | local | as stated | this closeout | closeout | — |
| DoD-3 | psql against `journeys_verify`: insert project + one member, `DELETE FROM member` → error; `DELETE FROM project` → cascade succeeds | local; docker Postgres | trigger refuses the last member; project delete passes | `test-results/dod-3-last-member.txt` | after D1 | changes under `drizzle/`, `src/db/` |
| DoD-4 | **Human gate, announced for later.** Prerequisite: PR merged to `staging` and the Migrate action green. Action: Paul opens the staging domain, signs in, creates and deletes a Project. Expected: works on staging. Post-check: `curl -s -o /dev/null -w '%{http_code}' https://staging-journeys-ten-virid.vercel.app/projects` → 307 signed out; run by the next work package or Paul | deployed (Vercel staging, Neon staging branch) | as stated | recorded in `[CLOSEOUT]` as pending human action | after merge | — |

### [PROGRESS] 2026-09-19 — D1 and D2 integrated

- D1 Projects and Members — atlas-worker on `opus` — `da71172`. shadcn's CLI wanted to add a `cn` npm dependency (lockfile is human-only), so the five base-nova components were vendored from the registry JSON with imports rewritten to this repo's aliases; no dependency change. DoD-3 candidate evidence gathered at `da71172` on a fresh `journeys_verify`.
- D2 Journeys — atlas-worker on `sonnet` — `8a73cfe`. `src/lib/db-errors.ts` now holds the shared slug-collision handling. D1's `dod-3-last-member.txt` rode along in this commit.
- Parallelism re-check against the real diffs: D1 and D2 both touched `src/db/schema.ts`, `drizzle/meta/_journal.json`, `src/app/projects/[projectSlug]/page.tsx`, `src/lib/projects.ts`, `e2e/projects-and-journeys.spec.ts`, and `README.md`; `e2e/setup/session.ts` was D1-only. Sequential was right.

### [AI CODE REVIEW] 2026-09-19 — aggregate review of `5816b65..8a73cfe`

Two fresh reviewers on `opus` read the full diff, one per axis; the orchestrator adjudicated every candidate by reading the cited hunks. Fixes landed in `9d92364`.

**Axis 1 — technical implementation and spec conformity.** Conformity table: AC-1..AC-6 and DoD-3 all `conforms` with file:line proof (authorization on every read and write path re-checks membership; `createProject` writes project + member in one transaction; the trigger's `EXISTS (project)` guard is the correct cascade discriminator; slug collisions auto-suffix on create and refuse in words on edit; cleanup deletes projects before Authors; `revalidatePath` uses the route pattern with `"page"`).

| Finding | Severity | Paths | Disposition |
|---|---|---|---|
| T-F1 command-output evidence (`ac-6-e2e.txt`, `dod-1-*.txt`) not on the branch | blocking | `test-results/` | resolved by aggregate verification (evidence commit below) |
| T-F2 non-Member read of the journey page untested; non-Member calls to server actions untested | non-blocking | `e2e/projects-and-journeys.spec.ts` | journey-page 404 added to `project-non-member`; direct action calls stay untested — deviation approved: spec Testing Decisions treat actions as thin glue covered by Seam B |
| T-F3 "Regenerate from title" never exercised | non-blocking | `e2e/projects-and-journeys.spec.ts` | resolved: `project-rename` asserts the button proposes the new slug |

**Axis 2 — coding standards.** Lint, format:check, typecheck green; no `any`, non-null assertions, or eslint-disable; migrations additive-only; no lockfile change; evidence contains fixture data only.

| Finding | Severity | Paths | Disposition |
|---|---|---|---|
| S-1 same as T-F1 | blocking | `test-results/` | as above |
| S-2 `cn-font-heading` undefined registry class | non-blocking | `src/components/ui/dialog.tsx`, `alert-dialog.tsx` | resolved: removed |
| S-3 `firstIssue` and the result union duplicated | non-blocking | both `actions.ts` | resolved: `src/lib/action-result.ts` |
| S-4 `SlugTakenError` reachable by two paths via a re-export | non-blocking | `src/lib/projects.ts` | resolved: re-export removed |
| S-5/S-6 import ordering and grouping | non-blocking | journeys `actions.ts`, vendored `ui/*.tsx` | resolved |
| S-7/S-8 vocabulary: "creator", `listProjectsForUser` | non-blocking | `src/lib/projects.ts`, `src/app/projects/page.tsx`, spec | resolved: `listProjectsForAuthor`, "Author" |
| S-9 `/j/<slug>` shown in the UI but absent from README routes | non-blocking | `README.md` | resolved: reserved-prefix line added |

Remaining risks: the last-Member trigger refuses deleting a `user` who is a sole Member (by design, documented; account deletion is out of scope); e2e `cleanup` removes every Project a minted Author belongs to (documented; no spec shares a Project with an unminted Author).

### [CLOSEOUT] 2026-09-19 — Atlas orchestrator

**PR:** https://github.com/paul-macfarlane/journeys/pull/10 (base `staging`, head `feat/02-projects-and-journeys`). Status `in-progress` → `ai-review` → `ready-for-human`.

**Repository delivery `journeys`:** base `staging` @ `5816b65`, direct checkout, no worktrees. Parallelism re-check against the real diffs: D1 and D2 overlapped on `src/db/schema.ts`, `drizzle/meta/_journal.json`, `src/app/projects/[projectSlug]/page.tsx`, `src/lib/projects.ts`, `e2e/projects-and-journeys.spec.ts`, and `README.md` — sequential was right, and for the predicted reasons (the predicted `e2e/setup/session.ts` overlap did not materialize; D2 needed no change there).

**Deliverables:**
- D1 Projects and Members — atlas-worker on `opus` — `da71172`.
- D2 Journeys — atlas-worker on `sonnet` — `8a73cfe`.
- Orchestrator: review fixes `9d92364`, evidence and tracker records `ea0e4e2`, this closeout.

**Verified run command:** `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` — all exit 0 at `9d92364` (27 unit tests, 14 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`).

**Criterion verdicts (evidence under `test-results/`, committed in `ea0e4e2`):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 create Project; listed; non-Member 404 (project and journey pages) | PASS | `ac-6-e2e.txt`, `project-create/`, `project-non-member/` |
| AC-2 rename; slug changes only by edit or "Regenerate from title"; taken slug refused in words | PASS | `ac-6-e2e.txt`, `project-rename/` |
| AC-3 confirmed delete; Journeys cascade | PASS | `ac-6-e2e.txt`, `project-delete/`, `project-delete-cascade/`, `dod-3-last-member.txt` (journey count 0 after project delete) |
| AC-4 create Journey with title, description, auto slug; listed "Never published" | PASS | `ac-6-e2e.txt`, `journey-create/` |
| AC-5 edit title, description, slug; confirmed delete | PASS | `ac-6-e2e.txt`, `journey-edit-and-delete/` |
| AC-6 Seam B author flow | PASS | `ac-6-e2e.txt`, `author-flow/` |
| DoD-1 commands green; migrations `0000`–`0002` apply to an empty database | PASS | `dod-1-commands.txt`, `dod-1-migrate-fresh.txt` |
| DoD-2 every PASS artifact committed; fixture data only | PASS | this record; `test-results/` holds minted `Test Author` fixtures and `u1`/`u2`/`p1` rows only |
| DoD-3 a Project cannot lose its last Member | PASS | `dod-3-last-member.txt` |
| DoD-4 staging smoke after merge | BLOCKED (human gate) | after merge: Migrate action green, Paul creates and deletes a Project on the staging domain; post-check `curl` staging `/projects` → 307 signed out, by the next work package |

**Deviations:** shadcn components vendored from registry JSON instead of the CLI (which wanted a new `cn` dependency; lockfile is human-only) — approved during D1 acceptance; `dod-3-last-member.txt` (D1 evidence) landed in the D2 commit; non-Member calls to server actions directly are untested per the spec's Testing Decisions (approved in review); ADR-0001 stays with ticket 03. Ticket 01 claimed as a resolved blocker while still `ready-for-human` (see the execution plan's availability note).

**Human follow-ups:** (1) merge, watch the Migrate action, then the DoD-4 smoke on staging; (2) move ticket 01 to `done` if you agree it is; (3) your uncommitted `human-prerequisites.md` edit on the `staging` checkout is untouched — commit it when convenient; (4) note the trigger refuses deleting a `user` who is a sole Member (documented, out of scope).

### [PROGRESS] 2026-09-19 — PR feedback from Paul applied

- Data access moved from `src/lib` to `src/db` (`projects.ts`, `journeys.ts`, `errors.ts`); `src/lib` now holds only pure, client-safe logic. `CLAUDE.md` structure lines updated to say so.
- `renameProject` / `renameProjectAction` / `RenameProjectDialog` renamed to `editProject` / `editProjectAction` / `EditProjectDialog`; the button reads "Edit", matching the Journey dialog.
- Verified run command rerun at `7c39e44`, all exit 0; evidence under `test-results/` refreshed from that run (migrate-fresh and trigger evidence unchanged in substance; `drizzle/` and `src/db/schema.ts` untouched by the refactor).
- Open question from Paul on whether slugs should be Author-editable at all (AC-2/AC-5 wording) — awaiting his decision; see the conversation.

### [SCOPE CHANGE] 2026-09-19 — slugs dropped, ids everywhere (approved by Paul)

Paul's PR #10 review: a user-editable slug is more than an Author should have to think about, and there is no strong reason to keep a slug in sync with a title when the id can be the path parameter. Decision (Paul, 2026-09-19, option "drop slugs, use ids everywhere" chosen over keeping hidden slugs): Projects and Journeys have no slug column; Author routes are `/projects/[projectId]` and `/projects/[projectId]/journeys/[journeyId]`; the public runner URL (ticket 06) becomes `/j/{journey-id}` and the public Project page (ticket 07) `/p/{project-id}`; ticket 05's "slug frozen at first publish" rule is void. Traded away: readable shareable links. AC-2, AC-4, and AC-5 above are amended in place with a marker; `spec.md` and `decisions.md` carry the same amendment in their Comments/Amendments sections, and tickets 05, 06, 07 carry a pointer.

Implementation: D3 — a fresh atlas-worker on `opus` reworks schema (single regenerated migration `0001`, since nothing on this branch is deployed), data access, actions, routes, dialogs, e2e, and README; the orchestrator re-verifies and refreshes the evidence.

### [PROGRESS] 2026-09-19 — D3 integrated (slugs dropped)

- D3 — atlas-worker on `opus` — `a99258f`: single regenerated migration `0001_tiny_maddog.sql` (project, member, journey, trigger; no slug columns), routes `/projects/[projectId]` and `/projects/[projectId]/journeys/[journeyId]`, title-only Project edit, title+description Journey edit, `src/lib/slug*` and `src/db/errors.ts` removed, e2e reads ids from link hrefs. Local `journeys` and `journeys_e2e` were reset (domain tables dropped, migration rows > 1 removed, re-migrated); better-auth tables and Paul's sign-in rows untouched. `staging` has only migration `0000`, so no deployed database needs reconciling.
- Verified run command rerun at `a99258f`: lint, format:check, typecheck, 6 unit tests, build, 14 e2e specs all green; fresh-database migrate and DoD-3 trigger probe rerun and evidence refreshed under `test-results/`.
