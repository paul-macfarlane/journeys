# 77: Account deletion

Status: ai-review
Blocked by: None
Owner: Claude (chunk 4)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (auth, schema cascades, a destructive action)

**Why:** Paul, 2026-09-26 (Q8): an Author cannot delete their account today, and a public product needs a way to. Leaving a Project already works: a Member can remove themselves, and only the last Member is refused (`removeMember` in `src/db/members.ts`).

**Decisions (Paul, 2026-09-26, Q10, option a):**

- **Projects where the Author is the only Member** are deleted, with every Journey, Draft, Published Version, Run, and Response in them. Their public links stop working.
- **Projects shared with other Members** keep everything; the Author is only removed as a Member.
- The Author page, profile fields, sessions, and linked OAuth accounts go with the user row.
- The confirmation lists the Projects that will be deleted by title, says shared Projects stay with their other Members, and requires typing the account's email to confirm. It cannot be undone.

**What to build:**

- A "Delete account" section at the bottom of the account Settings page (ticket 52), behind the confirmation above.
- One server action, one transaction. Lock the Author's memberships' Projects in id order (the lock order `removeMember` uses) and delete the Projects where the Author is the only Member. This relies on existing cascades, so check each one; the last-Member trigger must not refuse a Project being deleted whole. Delete the remaining memberships, then the user through better-auth's own deletion (or its tables directly if `disabledPaths` from ticket 52 closes it; say which). Finally sign out and land on `/` with "Your account was deleted."
- A race with someone adding the Author to a new Project mid-deletion is covered by the lock. Test it at the data layer.
- `/privacy` gains one sentence on deleting an account and what goes with it. Paul re-approves the legal copy.

Acceptance criteria:

- [ ] An Author with one sole-Member Project and one shared Project deletes their account. The sole Project, its Journeys, and its Runs are gone (row counts). The shared Project is intact with one fewer Member. The public link of a Journey in the deleted Project returns 404 (e2e `account-delete`).
- [ ] Deletion is refused without the typed email (e2e).
- [ ] The deleted Author's session no longer works, and signing in again with the same provider creates a fresh, empty account.
- [ ] Data-layer tests cover the cascade and the last-Member trigger.

Verification follows `docs/agents/testing.md` (`contract`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: Paul's post-hackathon grilling, 2026-09-26.

## Comments

### 2026-09-26 — Claude (Opus 5.5), chunk 4

`[EXECUTION PLAN]` Chunk 4 is 82 → 77, one branch `feat/chunk-4-membership-and-accounts`, one PR to `staging`. This ticket is deliverable D2, one worker (Sonnet) in worktree `journeys-d2`, in parallel with 82 (D1): the two share no source files. Paul's decisions above are taken as written; the one human gate is his re-approval of the `/privacy` sentence, raised once the draft exists.

Resolved decisions for D2:

- **The data layer.** `src/db/account.ts`: `previewAccountDeletion(userId)` lists the Author's Projects split into the ones that go (sole Member) and the ones that stay (shared), by title, for the confirmation; `deleteAccount(client, userId)` is one transaction on the client it is handed (the app passes `db`; the integration test passes its own): read the Author's memberships, lock those Project rows in id order with `SELECT … FOR UPDATE`, delete the Projects whose Member count is 1 (their Journeys, Drafts, Published Versions, Runs, and Responses cascade; the last-Member trigger allows a cascade from a deleted Project), then delete the `user` row, which cascades the remaining memberships, sessions, and linked OAuth accounts and nulls `published_version.published_by`. A `member` insert racing the deletion waits on the Project's `FOR UPDATE` (a foreign-key insert takes `FOR KEY SHARE`) or on the `user` row, so it lands either before the read or after the commit; the integration test holds such an insert open across a deletion to prove it.
- **better-auth's own deletion is not used.** Its `/delete-user` endpoint is off (`user.deleteUser.enabled` defaults to false, so it is a 404 like `/update-user`), and its flow runs outside our transaction. The `user` row is deleted directly inside it; afterwards the action calls `auth.api.signOut` (which deletes the cookie whether or not a session row is found) and redirects to `/?notice=account-deleted`, where the landing page says "Your account was deleted."
- **The action and the confirmation.** `deleteAccountAction(input)` in the Settings actions parses `{ email }`, compares it to the session's email case-insensitively after trimming, and refuses a mismatch with "Type your account's email to confirm" before touching the database. The dialog (an `AlertDialog` like the Project's) lists the Projects that will be deleted by title, says shared Projects stay with their other Members, holds an email field, and enables "Delete account" only when the field matches. It sits in a "Delete account" section at the bottom of Settings.
- **Tests.** `src/db/account.integration.test.ts` runs against a real database when `DB_INTEGRATION_URL` is set and is skipped otherwise; CI sets it to its migrated service database, and the local chain sets it to the e2e database. It covers: the sole Project and everything in it gone by row count, the shared Project intact with one fewer Member, `session`/`account` rows gone, `published_by` nulled on a shared Project's version the Author published, a bare `DELETE FROM member` of a sole Member still refused by the trigger, and the race above. `e2e/account-delete.spec.ts` covers AC 1 to 3 through the browser; the same-provider sign-in is proved by minting a session for the same email afterwards (a new id with no Projects), since OAuth itself is never driven.
- **Copy.** `/privacy`'s "Deleting things" paragraph loses "email us and we will do it" and gains the account sentence; the draft goes to Paul for approval before the PR.

Evidence: `test-results/account-delete/account-delete.png` and `test-results/account-delete-refused/account-delete-refused.png`, `test-results/77-ac-4-data-layer.txt` (the integration test with `DB_INTEGRATION_URL` set), and the chunk's full run in `test-results/chunk-4-commands.txt`.

`[AI CODE REVIEW]` Two fresh reviewers (Opus) read the whole chunk diff (`8da2dd0..9300bb7`); the orchestrator adjudicated from the cited hunks. One blocking finding, fixed with the rest in 2698b30 (one worker, Opus):
- **Blocking, fixed:** `deleteAccount` read the Author's memberships before locking and never re-checked them. If another Member removed the Author from a shared Project while the deletion waited on its lock, the Project counted one Member and was deleted, with that other Member's Journeys and Runs. Now: the user row `FOR UPDATE` first, then the memberships, then the Projects `FOR UPDATE` in id order, then one grouped re-read of each Project's Member count and whether the Author is still in it; only a Project the Author is still the only Member of is deleted.
- Correctness and spec, fixed:
  - A Project the Author created mid-deletion tripped the last-Member trigger and threw; the user-row lock makes the deletion wait for it and delete it as a sole Project.
  - The Response row-count assertion filtered by a version id and could never fail; it now asserts the Run's Response exists before and is gone after.
  - The server-side email refusal was untested: `confirmsAccountEmail` in `src/lib/validation/author.ts` is shared by the dialog and the action, and `settings/actions.test.ts` proves a wrong or missing email refuses before any delete, and a match deletes, signs out, and redirects in that order.
  - The dialog refuses to close, and Cancel is disabled, while the delete is pending.
  - `docs/agents/testing.md` says how to run the database integration suite (`DB_INTEGRATION_URL`).
- Coding standards, fixed: the race tests wait on `pg_stat_activity` (blocked by the racing client's pid), not a sleep; the e2e uses `fill`, not a value-setter; a real Response row stands in for run history; the second Member is minted, not given a browser; "Owner" naming gone; one `schema` import; the lock-order and `schema.ts` comments rewritten plainly.
- Deviations: better-auth's disabled `/delete-user` answers 403 (the route exists, the feature is off), not 404; the e2e adds the second Member by SQL, since the Members tab is `members.spec.ts`'s.
- Accepted risk: an Author deleting their account while publishing in their own sole Project can deadlock the two transactions; Postgres aborts one, nothing is half-written, and the Author can retry.
