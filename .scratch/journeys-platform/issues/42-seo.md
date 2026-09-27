# 42: SEO

Status: in-progress
Blocked by: None
Owner: Claude (Fable 5.1), chunk 5
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`. Run after 44 only if the rename happens first; it does not wait for it.
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

### 2026-09-27 — Claude (Fable 5.1), chunk 5

`[EXECUTION PLAN]` Chunk 5 is 42 → 78 (backlog rows 11 and 12), one branch `feat/chunk-5-public-pages-and-accessibility`, one PR to `staging`. The chunk's route is `contract` (this ticket's), so the contract chain, one full `pnpm test:e2e`, and two reviewers run once at the end. Three deliverables:

- **D1 (this ticket, 42)** — one worker (Sonnet) in worktree `journeys-d1`, e2e on port 3142 over `journeys_e2e_d1`.
- **D2 (78, items 1–4 and ACs 1–3)** — one worker (Sonnet) in worktree `journeys-d2`, e2e on port 3178 over `journeys_e2e_d2`, in parallel with D1: the predicted file sets are disjoint (D1: `layout.tsx`, `env.ts`, `link-preview.ts`, `robots.ts`, `sitemap.ts`, the `/j`, `/p`, `/sign-in`, `/authors` pages, `runner-frame.tsx`, the seed, `e2e/seo.spec.ts`; D2: the Author Project and Journey pages, `draft-editor.tsx`, `step-panel.tsx`, `globals.css`, `runner/rich-text.tsx`, `rich-text/extensions.ts`, `e2e/accessibility.spec.ts`). Re-checked at closeout.
- **D3 (78, item 5, the walk)** — after D1 and D2 are integrated, one worker (Opus) on the chunk branch.

Resolved decisions for D1 (the 2026-09-26 `[SCOPE CHANGE]` applied as written; the orchestrator took the recommended option where the ticket left one open, each queued for Paul):

1. **Indexable set:** `/`, `/about`, `/guide`, `/privacy`, `/terms` — the two prose pages that arrived after the 2026-09-22 decision join the three it named, since they are the same kind of page. Each carries `alternates.canonical`; `sitemap.ts` lists the five with `lastModified` fixed at build time. `robots.ts` allows `/` and disallows `/sign-in`, `/projects`, and `/api`, with the sitemap named.
2. **`noindex`:** `/sign-in` (page metadata), everything under `/projects` (the `(list)` and `[projectId]` layouts' metadata), and the three link-only public pages `/j/*`, `/p/*`, `/authors/*` through the `Metadata` that `src/lib/link-preview.ts` builds, so the unit tests read it. `/authors/*` is treated as `/p/*`: it post-dates the decision and discovery there is link-only too. The link-only pages stay crawlable (no robots disallow) so link previews still resolve.
3. **`metadataBase`:** a pure `resolveMetadataBase` in `src/lib/metadata-base.ts` returns `https://<VERCEL_PROJECT_PRODUCTION_URL>` when `VERCEL_ENV` is set and is not `production` and that variable is set, and `BETTER_AUTH_URL` otherwise (production, local, CI). "Protected alias" is read as "any non-production Vercel deployment", since protection itself is not visible to the app. `env.ts` gains the two optional variables; `robots.ts` and `sitemap.ts` build their absolute URLs from the same function. Unit test on the four cases.
4. **404s:** `/j/[journeyId]` calls `notFound()` for `unavailable` as well as `null`, in `generateMetadata` and the page; a segment `not-found.tsx` beside it renders the existing copy ("This journey isn't available" / "It has been taken down or hasn't been published yet.") in a `RunnerFrame` in the app's own `trail` Theme (a segment not-found has no params, so the Journey's Theme cannot be read there). `/p/[projectId]` does the same when the Project has no live Journey, with its segment `not-found.tsx` reading "This project isn't available" / "It has no published journeys right now, or the link is wrong." The unknown-id case renders the same screens, so a link says nothing about whether the row exists. The live-Journey list read is `cache()`d so `generateMetadata` and the page share it.
5. **Blank Project description:** `projectLinkMetadata` falls back to `APP_TAGLINE` when the preview is empty; a Journey's `description` is a required string already.
6. **Seed:** every seed Project gets a `descriptionContent` document, written on insert and on conflict (the seed is the source of truth, 68 finding 1), and every seed Journey an explicit `position` in the listed order.
7. **Header:** `RunnerFrame` takes a `home` variant of its sticky header — the wordmark linking to `/` at the left, the "Dark mode" button at the right — rendered by the public Project page and the Author page. The runner is unchanged.
8. **Sign-in:** "By signing in you agree to the [terms of service] and [privacy policy]." with the two links; "below" goes.
9. **Specs:** `landing` asserts the canonical link; `sign-in` asserts `noindex` and the two links (tests `sign-in-links`); a new `e2e/seo.spec.ts` holds `seo-robots-and-sitemap` and `seo-public-404s` (unknown and never-published Journey, Project with no live Journey: status 404 and copy; the Author's own unpublished Journey still previews). Existing assertions on the unavailable copy in `runner`, `public-project`, and `unreadable-version` are updated to expect 404.

Verification map (route `contract`): AC-1 (robots, sitemap, noindex) → `seo-robots-and-sitemap` and `sign-in-links` screenshots plus the unit tests; the 404s → `seo-public-404s`; `metadataBase` → `src/lib/metadata-base.test.ts` in the chain; the blank-description fallback → `src/lib/link-preview.test.ts`; the seed → `pnpm seed:journey-stories` against the e2e database in the chain capture (`test-results/42-ac-seed.txt`); AC "Lighthouse" is dropped by the scope change; AC-3 → the chunk's full run in `test-results/chunk-5-commands.txt`. Run surface: local; the deployed check is Paul's staging smoke after merge.
