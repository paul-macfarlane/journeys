# 13: Members

Status: ready-for-human
Blocked by: 02
Owner: Atlas orchestrator (Claude Fable 5.1), session of Paul Macfarlane, claimed 2026-09-21
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A Member adds another Author to a Project by the email of an existing account, sees the Member list, and removes a Member. All Members are equal. The last Member cannot be removed. No invitation emails, no pending state, no roles.

- [ ] Add by email succeeds for an existing account and fails clearly for an unknown email.
- [ ] Added Member sees the Project in their list and can edit its Journeys.
- [ ] Remove works; removing the last Member is refused.
- [ ] Seam B: two minted Authors — one adds the other, the other opens the Project.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [EXECUTION PLAN] 2026-09-21 — Atlas orchestrator

**Contract:** this ticket as it stands (no scope changes on file). Criteria are AC-1..AC-4 in checklist order. Derived DoD from the footer, `docs/agents/testing.md`, and `CLAUDE.md`: DoD-1 verified run command green; DoD-2 every PASS artifact committed under `test-results/`, fixture data only (minted `Test Author` accounts and invented Projects), no participant data. Run surface: local + deployed; per Paul's 2026-09-20 decision there is no post-merge staging smoke gate, so no deployed criterion is defined. No new dependency and no migration: the `member` table, its `role` column, and the last-Member trigger (`project_keeps_last_member`, migration 0001) already exist, so the Migrate action has nothing to apply and no human gate is needed.

**Availability:** 05 and 08 are `ready-for-human`, not `done`, so 06, 07, 09, 10, 11, 12, and 14 are blocked; 13 is the only available ticket (blocked only by 02, which is `done`).

**Repository delivery:** `journeys`, base `staging` @ `508c5b6`, branch `feat/13-members`, direct checkout, no worktrees. One deliverable (D1), one worker, so no parallelism decision arises; the single e2e port (3100) and the one `journeys_e2e` database would serialize verification anyway. Proof root cleared at workspace prep.

**Resolved technical decisions (execution, not contract changes):**

- **Data access** `src/db/members.ts` (`server-only`, mirroring `src/db/projects.ts`): `MemberSummary = { userId, name, email }`; `listMembers(projectId)` joins `member` to `user`, ordered by `member.createdAt` ascending (the first Member first) — the page has already checked the caller's membership via `getProjectForMember`, as it does before `listJourneysForProject`; `addMemberByEmail(projectId, email, actorUserId)` → `{ ok: true, userId } | { ok: false, reason: "no-project" | "unknown-email" | "already-member" }` — the actor must be a Member (`getProjectForMember`, else `no-project`), the account is matched with `lower(user.email) = lower(email)` so a differently cased email still finds the account, an existing `member` row is `already-member`, otherwise the row is inserted with the default role; `removeMember(projectId, userId, actorUserId)` → `{ ok: true } | { ok: false, reason: "no-project" | "not-a-member" | "last-member" }` — in one transaction: actor membership (else `no-project`), then the Project's member count (`<= 1` → `last-member`, refused before any delete), then the delete (zero rows → `not-a-member`); as the backstop for a race between two removals, an error thrown by the delete whose own or `cause` message contains `must keep at least one member` (the trigger's `RAISE`) is returned as `last-member`, never rethrown. Nothing reads `member.role`.
- **Validation** `src/lib/validation/member.ts` (no `server-only`): `addMemberSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Enter an email address")) })` plus `AddMemberInput`; Seam A `member.test.ts`: trims and lowercases, a blank and a non-address both fail with "Enter an email address".
- **Server actions** added to `src/app/projects/actions.ts` (the Project actions file; Members are Project-scoped), each re-reading the session and returning `ActionResult` with `id` = the Member's user id: `addMemberAction(projectId, input: unknown)` parses with `addMemberSchema` (`firstIssue` on failure) and maps reasons to "That project no longer exists" / "No account has that email — they need to sign in once first" / "Already a member of this project"; `removeMemberAction(projectId, userId)` maps to "That project no longer exists" / "That member has already been removed" / "A project must keep at least one member". Both revalidate `/projects` and `/projects/[projectId]` (`"page"`).
- **UI** `src/components/projects/member-list.tsx` (`"use client"`), props `{ projectId, currentUserId, members: MemberSummary[] }`, rendering `<section aria-label="Members">` with heading `<h2>Members</h2>`, placed on the Project page (`src/app/projects/[projectId]/page.tsx`) below the Journeys section; the page loads `listJourneysForProject` and `listMembers` together with `Promise.all`. Inside: `<ul role="list" aria-label="Members">`, one `<li>` per Member showing the name, the email (`text-muted-foreground text-sm`), a `Badge` "You" on the signed-in Author's row, and a "Remove" button (`variant="outline"`, visible text exactly "Remove"). When the list holds exactly one Member that row's "Remove" is `disabled` and the row shows the hint "A project keeps its last member". "Remove" opens an `AlertDialog` titled "Remove <name>?" whose description is "They lose access to every journey in this project. You can add them again by email." (or, on the signed-in Author's own row, "You lose access to every journey in this project. Another member can add you again by email."), with "Cancel" and a destructive "Remove member" confirm (disabled while pending; server error `role="alert"` inside the dialog). On success removing someone else: close and `router.refresh()`; on success removing yourself: `router.push("/projects")` then `router.refresh()`. Below the list, an add form (react-hook-form + `zodResolver(addMemberSchema)`, like `edit-project-dialog.tsx`): `Label` "Email" for `Input id="add-member-email" type="email" autoComplete="off"`, a "Add member" submit button (disabled while submitting), field and server errors as `role="alert"`; on success reset the form to an empty email and `router.refresh()`. Author-facing copy uses `CONTEXT.md` words (Member, Project, Journey, Author).
- **README:** the `/projects/<project-id>` route bullet also says the page lists the Project's Members, adds one by the email of an account that has signed in before, and removes one — never the last.
- **Seam B** `e2e/members.spec.ts` (`test.setTimeout(90_000)` per test is acceptable; the existing `cleanup`, `closePools`, `signInAs`, `queryE2eDatabase`, `createProject`, `createJourney`, `uniqueSuffix` helpers; the second Author lives in `browser.newContext({ baseURL: E2E_BASE_URL })`, closed in `finally`; both minted ids pushed for cleanup). Test names are the evidence directories, screenshots at `test-results/<test-name>/<test-name>.png`:
  - `members-add-and-edit` (AC-1 success, AC-2, AC-4): mint B first (in the second context) so the account exists; A creates a Project and a Journey, opens the Project page, sees the Members list with exactly A's row (name, email, "You"); A types B's email in upper case into "Email" and clicks "Add member"; the list shows two rows and B's row shows the email in lower case; screenshot A's page; the `member` rows for the Project read back hold exactly A's and B's ids. Then B: `/projects` lists the Project; B opens it and sees two Members; B opens the Journey, clicks "Edit", fills "Title" (`{ exact: true }`) with a new title, "Save changes", and the heading shows it; A reloads the Project page and the Journey list shows the new title. Finally B removes themself (their own row's "Remove", "Remove member"): B lands on `/projects` and the Project is no longer listed there.
  - `members-add-refused` (AC-1 failure): A creates a Project; adding `nobody-<suffix>@example.com` shows the alert "No account has that email — they need to sign in once first" (screenshot here); adding A's own email shows "Already a member of this project"; adding `not-an-email` shows "Enter an email address"; the list still holds one row and the `member` rows read back hold one id.
  - `members-remove-and-last-refused` (AC-3): A creates a Project and adds B (minted first); A opens a second page in A's own context on the Project page, which shows two Members with both "Remove" buttons enabled — this is the stale page; B opens the Project page in B's context. On A's first page: "Remove" on B's row, "Remove member"; the list shows one row, A's own "Remove" is disabled, and "A project keeps its last member" is visible; screenshot. B reloads and gets a 404, and B's `/projects` no longer lists the Project. On A's stale second page: "Remove" on A's row, "Remove member" → the alert "A project must keep at least one member"; the `member` rows read back hold exactly A's id.
  - Every existing spec stays green; no existing selector should need to change (the Members list adds list items only on the Project page, none matching a Journey title).

**Deliverables:**
- **D1 — Members: data access, actions, UI, Seam B, README** (worker: atlas-worker on `sonnet`, tightly specified above). The whole vertical slice; no dependency on any other deliverable.

**Verification map (evidence committed under `test-results/`, root cleared at workspace prep):**

| Criterion | Command / action | Surface & real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC-1 | `pnpm test:e2e` tests `members-add-and-edit` (success) and `members-add-refused` (unknown email) | local; docker Postgres `journeys_e2e`; e2e server on 3100 | B's account is added by email (case-insensitively) and listed; an unknown email, an existing Member, and a non-address each get their own clear error; the rows read back match | `test-results/members-add-and-edit/members-add-and-edit.png`, `test-results/members-add-refused/members-add-refused.png`, `test-results/dod-1-e2e.txt` | after D1 | changes under `src/`, `e2e/` |
| AC-2 | `pnpm test:e2e` test `members-add-and-edit` | as AC-1 | B's `/projects` lists the Project; B opens it and renames its Journey; A sees the rename | as AC-1 | after D1 | as AC-1 |
| AC-3 | `pnpm test:e2e` test `members-remove-and-last-refused` | as AC-1 | B removed and 404'd; the last Member's "Remove" is disabled with the hint; the stale page's attempt is refused by the server with the alert; one row remains | `test-results/members-remove-and-last-refused/members-remove-and-last-refused.png`, `test-results/dod-1-e2e.txt` | after D1 | as AC-1 |
| AC-4 | the two-Author flow in `members-add-and-edit` (two minted Authors in two browser contexts) | as AC-1 | one adds the other, the other opens the Project | as AC-1 | after D1 | as AC-1 |
| DoD-1 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` | local; docker Postgres | all exit 0 | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt` | after D1 | any source, config, or test change |
| DoD-2 | evidence review: every PASS artifact committed under `test-results/`; fixture data only | local | as stated | this ticket's closeout | closeout | — |

**Human gates:** none. No dependency change (no lockfile gate), no migration, and no deployed smoke gate.

### [PROGRESS] 2026-09-21 — D1 integrated; aggregate review started

D1 (`src/db/members.ts`, `src/lib/validation/member.ts` + 3 Seam A cases, `addMemberAction`/`removeMemberAction`, `MemberList` on the Project page, `e2e/members.spec.ts` with the three planned tests, README) — atlas-worker on `sonnet` — `af251a7`, accepted after the orchestrator's screen of the diff and the spec: every planned assertion is present (case-insensitive add, both refusals, B's list and rename, self-removal, the last Member's disabled "Remove" with its hint, and the stale page's server-side refusal). Worker deviations, both test-only: rows are filtered by email rather than name because both minted Authors are named "Test Author"; no existing spec changed. Candidate evidence: the worker's verified run command all exit 0 at `af251a7` (153 unit tests in 8 files; 27 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`); the orchestrator is rerunning it for the durable record. Status `in-progress` → `ai-review`.

### [AI CODE REVIEW] 2026-09-21 — aggregate review of `508c5b6..af251a7`, fixes in `b11c09a`

Two fresh readers (both `opus`) read the whole diff, one per axis; the orchestrator adjudicated every candidate from the cited hunks. No blocking finding on either axis. Every non-evidence finding is fixed in `b11c09a` by the orchestrator, recorded here so the commit's provenance stays honest.

**Axis 1 — technical implementation and spec conformity** (reader verified the trigger-error detection against drizzle-orm 0.45's `DrizzleQueryError.cause` wrapping and confirmed the stale-page e2e drives a genuine server-side refusal):

| # | Severity | Path | Finding | Disposition |
|---|---|---|---|---|
| T1 | non-blocking | `src/db/members.ts` | Two concurrent removals of *different* Members could each count two, delete different rows, and both commit, leaving no Member; the trigger cannot see the other transaction's uncommitted delete either. | Fixed: the transaction locks the Project row (`FOR UPDATE`) first, so removals of one Project run one at a time and the count is trustworthy; comment narrowed to match. |
| T2 | — | `src/db/members.ts` | Trigger backstop reachable and correctly detected. | Verified, no change. |
| T3 | non-blocking | `src/db/members.ts` | Concurrent add of the same account escapes as an unhandled primary-key violation, which the form would swallow silently. | Fixed: pg `23505` on the insert maps to `already-member`. |
| T4 | non-blocking | `member-list.tsx` | `type="email"` without `noValidate` lets the browser's bubble intercept the first malformed submit, so "Enter an email address" never showed on that path (the e2e passed only because two valid submits had already flipped react-hook-form into revalidate-on-change). | Fixed: `noValidate` on the form. |
| T5 | non-blocking | `member-list.tsx` | A server error stayed on screen beside a later field error. | Fixed: editing the address clears the server error. |
| T6 | non-blocking | `member-list.tsx` | `disabled` was on the rendered Button rather than `AlertDialogTrigger`; worked only because render props merge last. | Fixed: `disabled` on the Trigger. |
| T7 | non-blocking | `e2e/members.spec.ts` | The "shown in lower case" check was case-insensitive and vacuous (the row read-back already proves the case-insensitive match). | Fixed: `{ exact: true }`. |
| T8 | non-blocking | `test-results/` | PASS artifacts not yet committed at `af251a7`. | Resolved by the evidence commit at closeout. |

Actions, README, scope, and vocabulary: clean; every AC and plan decision matched item for item; nothing dropped or built beyond scope.

**Axis 2 — coding standards:**

| # | Severity | Path | Finding | Disposition |
|---|---|---|---|---|
| S1 | non-blocking | `member-list.tsx` | The explicit `role="list"` lacked the house comment every other site carries. | Fixed. |
| S2 | non-blocking | `member-list.tsx` | Self-removal navigated without closing the dialog first, unlike `delete-project-dialog.tsx`. | Fixed: `setOpen(false)` on both branches. |
| S3 | non-blocking | `src/app/projects/actions.ts` | The `@/` import group is not alphabetical. | Approved deviation: the file's pre-existing order was already unsorted; the new line sits beside `@/db/projects`. |
| S4 | non-blocking | `test-results/` | Same as T8. | Resolved at closeout. |
| S5 | non-blocking | `src/db/projects.ts` | Header still claimed "Projects and their Members". | Fixed: points at `@/db/members`. |

`server-only` placement, vocabulary, shadcn `render` usage, Tailwind classes, accessibility labels, e2e conventions, README style, and the "expected values written out" test habit: all clean. ADR-0001 not engaged (no graph document touched).

**Coverage judgment:** both candidate sets are proportionate to a 744-line, 8-file diff; no region needed a direct orchestrator read beyond the cited hunks. **Remaining risk:** none identified beyond the evidence commit. Verification was rerun at `b11c09a` and is recorded in the closeout below.

### [CLOSEOUT] 2026-09-21 — Atlas orchestrator

**PR:** https://github.com/paul-macfarlane/journeys/pull/17 (base `staging`, head `feat/13-members`). Status `in-progress` → `ai-review` → `ready-for-human`.

**Repository delivery `journeys`:** base `staging` @ `508c5b6`, direct checkout, no worktrees, one deliverable; no parallelism decision was made, so there is no isolation prediction to re-check.

**Deliverables:**
- D1 the whole Members slice — atlas-worker on `sonnet` — `af251a7` (its Co-Authored-By names Sonnet, which is who wrote it).
- Review fixes — orchestrator — `b11c09a`. Evidence — orchestrator — `4d95e86`. This closeout record follows.

**Verified run command:** `DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && DATABASE_URL=postgresql://postgres:postgres@localhost:5436/journeys pnpm test:e2e` — every command exit 0 at `b11c09a` (153 unit tests in 8 files; 27 e2e specs, `[e2e] database: journeys_e2e on localhost:5436`), run by the orchestrator. No deployed-target check (Paul's 2026-09-20 decision); no migration and no dependency change in this ticket.

**Criterion verdicts (evidence under `test-results/`, committed in `4d95e86`, captured at `b11c09a`):**

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 add by email succeeds for an existing account; fails clearly for an unknown email | PASS | `members-add-and-edit/members-add-and-edit.png` (B's row listed after being typed in upper case), `members-add-refused/members-add-refused.png` (the unknown-email alert; the spec also asserts the already-a-member and not-an-address messages and the one-row read-back), `dod-1-e2e.txt` ✓ both |
| AC-2 added Member sees the Project in their list and can edit its Journeys | PASS | `dod-1-e2e.txt` ✓ `members-add-and-edit` (B's `/projects` lists it; B renames the Journey; A sees the rename) |
| AC-3 remove works; removing the last Member is refused | PASS | `members-remove-and-last-refused/…png` (one row, "Remove" disabled, "A project keeps its last member"), `dod-1-e2e.txt` ✓ (B's reload 404s; the stale page's attempt gets "A project must keep at least one member" from the server; one row read back) |
| AC-4 Seam B: two minted Authors, one adds the other, the other opens the Project | PASS | as AC-1 and AC-2 (two Authors in two browser contexts) |
| DoD-1 verified run command green | PASS | `dod-1-commands.txt`, `dod-1-e2e.txt` (dotenv tip lines and the repeated pre-existing Next dev console warning removed; the headers say so) |
| DoD-2 every PASS artifact committed; fixture data only | PASS | this record; the artifacts hold minted "Test Author" accounts and invented Project and Journey titles, nothing from a participant |

**Deviations:** S3 (import order in `actions.ts`, pre-existing) — orchestrator-approved, non-blocking, recorded in the review above. Worker deviations were test-only (rows filtered by email, since both minted Authors share a name).

**Human follow-ups:** (1) review and merge PR #17; (2) move this ticket to `done` after merging. Tickets 05 and 08 were moved to `done` in this same branch at Paul's direction, so 06, 07, 09, and 14 are already available; 06 is next by priority.
