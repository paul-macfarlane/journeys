# 60: A Journeys not-found page

Status: ready-for-agent
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (56's regression pass, 2026-09-24): a judge who follows a stale or mistyped link, or opens a Journey that was unpublished, sees Next's bare 404.
Route: polish

**Why:** every missing route renders Next's default not-found page: a black or white screen with "404 | This page could not be found.", no app shell, no link home, and no `<main>` landmark (axe `landmark-one-main` and `region` on every 404 in 56's tour). The title is also inconsistent: `/nope` keeps the app title "Journeys" while `/p/<missing>` shows "404: This page could not be found.". Screens: `test-results/56-regression-pass/1280-light-nope.png`, `test-results/56-regression-pass/375-dark-nope.png`, `test-results/56-regression-pass/1280-dark-allotment-project.png`.

**What is true today:** `src/app/` has no `not-found.tsx`; `notFound()` is called from `src/app/p/[projectId]/page.tsx`, `src/app/j/[journeyId]/page.tsx`, and `src/app/authors/[userId]/page.tsx`, and unknown routes fall through to the framework default. The legal pages render through `ProsePage` (`src/components/prose-page.tsx`), which already gives a page the header, the prose column, and the footer.

**What to do:**

1. Add `src/app/not-found.tsx` rendering through `ProsePage`: title "Page not found", one sentence ("There is nothing at this address. A Journey or a Project is found only by the link its Authors hand out."), a link to `/`, and the Play link from `src/lib/demo.ts`. `metadata.title` "Page not found" (the layout template appends the app name).
2. Keep the participant-facing wording in `CONTEXT.md` vocabulary; no mention of ids or routes.
3. Both themes and 375 px, no horizontal overflow.

Acceptance criteria:

- [ ] `/nope`, `/p/<unknown>`, `/j/<unknown>`, and `/authors/<unknown>` all render the new page with status 404, the app header, the footer, and a `<main>` landmark; the `branding` or a new `not-found` spec asserts the title, the heading, the home link, and status 404, with screenshots in light, dark, and at 375 px.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e` pass; evidence per `docs/agents/testing.md` ("Proportional verification", `polish`).

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding B.
