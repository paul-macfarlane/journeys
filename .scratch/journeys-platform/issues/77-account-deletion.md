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
