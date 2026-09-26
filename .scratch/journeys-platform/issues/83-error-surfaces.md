# 83: Error pages and unreadable Published Versions

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: proposed by ticket 72 (2026-09-26); Paul to approve the order.
Route: polish (no schema or auth change; adds error routes)

**Why:** ticket 72, finding E1. `src/app` has no `error.tsx` and no `global-error.tsx`; only `not-found.tsx`. A thrown error anywhere reaches Next's default error page, which is unbranded and gives the Participant or Author no way back.

Every stored document is read with a throwing parse: `graphDocumentSchema.parse` or `contentSchema.parse`, at 8 sites in `src/db`. These are `drafts.ts:68`, `versions.ts:103, 270`, `analytics.ts:78`, `runs.ts:137, 250`, `projects.ts:60`, and `users.ts:208`. A Run's `path` is typed with `$type` and never validated (`runs.ts:223`). Ticket 73 takes the Draft (a recovery page offering Restore). This ticket takes everything else. The worst case is a Published Version that no longer parses: it breaks the public runner page and every live Run on it.

**What to build:**

- A root `src/app/error.tsx` and `src/app/global-error.tsx` in the app's layout and voice. They say something went wrong and offer "Try again" (`reset`) and a link home. They never show the error message or stack to the visitor. Log the error server-side with its digest.
- Reads of a Published Version (`getPublicJourney`, `getRunForJourney`, `getLiveVersion`, analytics) use `safeParse`. On failure:
  - The runner renders the same "This Journey isn't available" page an unpublished Journey gets.
  - The Author's Journey page shows a banner on the Versions and Analytics tabs naming the version that cannot be read. The Draft and the other versions still work.
  - The failure is logged with the Journey and version id, never the document.
- A Run whose `path` fails a `z.array(idSchema)` parse restarts from the Start, as a Run on a replaced version does today.

Acceptance criteria:

- [ ] A unit test per `safeParse` site: a bad row gives the fallback result, not a throw.
- [ ] e2e `unreadable-version`, seeded with a bad Published Version row: the runner shows the unavailable page (status 200, not 500), and the Journey page's Draft tab still loads.
- [ ] e2e `error-page`: a route forced to throw in the test server shows the app's error page with "Try again". If no route can throw without a test-only hook, prove it with a unit render instead and say so.
- [ ] One full `pnpm test:e2e`.

Verification follows `docs/agents/testing.md` (`polish`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 72; ticket 15 ("Corrupt-row handling", the non-Draft half).

## Comments
