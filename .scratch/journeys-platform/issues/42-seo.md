# 42: SEO

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → 75 → 76 → 77 → **42** → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
Route: contract (public routes change status; see the 2026-09-26 comment)

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

### 2026-09-26 — Claude (Opus 5.5), post-hackathon triage

`[SCOPE CHANGE]` Paul, 2026-09-26 (Q4, Q5): narrowed to correctness, and widened to take the public-pages findings (theme E).

**Dropped:** the Lighthouse ≥ 95 run and its capture, and the JSON-LD `WebApplication` block.

**Kept:** `robots.ts` and `sitemap.ts` with the decided policy, `noindex` on sign-in and every Author page, `alternates.canonical` on the indexable pages.

**Added:**

1. An unpublished, taken-down, or unknown Journey at `/j/<id>`, and a Project with no live Journey at `/p/<id>`, answer **404** with the existing friendly copy (66 finding 4, 68 finding 7). Watch the streamed-metadata trap from ticket 60: call `notFound()` in `generateMetadata` too.
2. `metadataBase` falls back to `VERCEL_PROJECT_PRODUCTION_URL` (or the branch URL) when `BETTER_AUTH_URL` is a protected alias, so link previews never point at a protected origin (64 finding 12).
3. A Project with an empty description previews with the site description, so no link preview is blank (68 finding 1). The seed writes a description and explicit Journey `position` values for its Projects (66 finding 1, 68 finding 1).
4. The public Project page and the Author page get the slim app header with the "Journeys" home link; the runner stays as it is (64 finding 9).
5. Sign-in's "terms of service and privacy policy below" links both pages (64 finding 11).

Acceptance adds: e2e for the 404s (status and copy) and the sign-in links; a unit test on the `metadataBase` fallback. Route becomes `contract` (public routes change status). Run after 44 only if the rename happens first; it is not waiting for it.
