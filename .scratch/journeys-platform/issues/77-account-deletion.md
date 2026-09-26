# 77: Account deletion

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → 75 → 76 → **77** → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
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
