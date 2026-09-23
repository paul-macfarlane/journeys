# 42: SEO

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → **42** → 44 → 45. 14 stays available; 17 is post-hackathon. Not before 2026-09-25. Also listed on ticket 15. If ticket 44 renames the app, run this after it.
Route: polish

**Why:** Paul, 2026-09-22, item 8: "We should do some general SEO improvements (post hackathon is fine for this)." Today the root layout sets a title template and description, three pages set their own titles, and there is no `robots.ts`, no `sitemap.ts`, and no canonical URL.

**Decisions (Paul, 2026-09-22, grilled):**

- Indexable: the landing page, `/privacy`, `/terms`. Not indexable (`robots: { index: false }` in metadata and disallowed in `robots.ts`): `/sign-in`, everything under `/projects`, and `/api`.
- Public Journey (`/j/*`) and Project (`/p/*`) pages are `noindex` (Paul, Q13): discovery stays link-only. A per-Project "allow search engines" switch is a later ticket if an Author asks.

**What to build:**

- `src/app/robots.ts` and `src/app/sitemap.ts` (the three static pages, with `lastModified` from the build), `alternates.canonical` on every indexable page, a `description` on the landing page distinct from the tagline, JSON-LD `WebApplication` on the landing page, `lang` and heading order checked, and the `robots` metadata above.
- A Lighthouse SEO run against the production build (`pnpm build && pnpm start`, Chrome headless) captured as `test-results/ac-1-lighthouse-seo.txt` with a score of 95 or more.
- **Specs.** `landing` reads the canonical link and the JSON-LD script; `sign-in` reads `noindex`; a `robots-and-sitemap` test GETs both files.

Acceptance criteria:

- [ ] `/robots.txt` and `/sitemap.xml` answer with the decided policy; Author pages and sign-in carry `noindex`.
- [ ] Lighthouse SEO scores 95 or more on the landing page.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names plus the Lighthouse capture; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 8.

## Comments
