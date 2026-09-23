# 37: Link previews for Journeys and Projects

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (`/implement`, worktree `.claude/worktrees/37-link-previews/journeys`, branch `feat/37-link-previews`)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → **37**; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: contract

**Why:** A Journey link pasted into a chat shows the generic app card. Paul, 2026-09-22, item 3: "For journey links, a customized preview would be good, kind of like what we do for league invites in picks leagues and blog posts in Paulitakes." The public Project page has a title and description but the same generic image.

**Decisions (Paul, 2026-09-22, grilled):**

- A preview shows what a Participant would see: the live Published Version's title and description, the Project's title, and the app mark, drawn in the Journey's Theme colours (Project Theme, Journey override). Never the Draft, never a Step's content, never a Run.
- A Journey that is unknown, never published, or unpublished gets the app's generic metadata and image, so a preview reveals nothing a Participant is not shown.

**What to build:**

- **Metadata.** `generateMetadata` on `src/app/j/[journeyId]/page.tsx` and on the Step page beneath it: `title`, a `description` cut with `contentPreview` to 160 characters as the public Project page does, `openGraph` (`type: "article"`, `url`, `siteName`), and `twitter: { card: "summary_large_image" }`. The Project page gains the same `openGraph` and `twitter` fields.
- **Images.** `src/app/j/[journeyId]/opengraph-image.tsx` and `src/app/p/[projectId]/opengraph-image.tsx` with `ImageResponse` (1200 × 630), reusing the Literata loader and layout from the root `opengraph-image.tsx` (extract it into `src/lib/og.tsx`); each reads its public data through the existing `getPublicJourney` / `getPublicProject` and falls back to the root image's content when the answer is unavailable. `dynamic = "force-dynamic"` like the pages they belong to, with a `Cache-Control` of a few minutes so a rename shows within a publish cycle.
- **Specs.** `runner` gains `journey-link-preview`: for a live Journey, read `og:title`, `og:description`, and `og:image` off the page and GET the image (200, `image/png`); unpublish and read the app name as `og:title` and the root image as `og:image`. `public-project` does the same for a Project.

Acceptance criteria:

- [x] A live Journey's page carries its title, description, and a per-Journey Open Graph image that renders at `/j/<id>/opengraph-image` in the Journey's Theme colours.
- [x] An unknown, never-published, or unpublished Journey answers with the app's generic metadata and image.
- [x] A Project's public page carries its own image at `/p/<id>/opengraph-image`.
- [x] The two AI reviewers (correctness, contract) find no public data beyond what the runner already shows.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-2-unavailable-journey.txt` (the captured responses); never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 3.

## Comments

### [EXECUTION PLAN] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: contract)

Direct work in the worktree `.claude/worktrees/37-link-previews/journeys` on `feat/37-link-previews` (off `origin/staging` at `cf3d781`), so Paul's main checkout stays free. No worker delegation: one author, TDD at the seams below, `pnpm typecheck` and the touched unit files after each slice, one full `pnpm test:e2e` at the end on port 3137 against `journeys_e2e_t37` (the worktree has no `.env.local`; a scratchpad file exports the docker-compose `DATABASE_URL` and CI's dummy auth values).

**Seams under test.**

1. Unit, `src/lib/graph/content.ts`: `textPreview(text, limit)` — the cut `contentPreview` already makes, exported so a Journey's plain-text description is cut the same way (`content.test.ts`).
2. Unit, `src/lib/link-preview.ts` (new, pure): `linkPreviewPalette(theme)` — the sRGB hex of each preset's light `--background`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground` (converted from `globals.css` with the same maths as `scripts/contrast.mjs`), with an accent standing in for primary as `themeStyle` does; `journeyLinkMetadata` and `projectLinkMetadata` — the `Metadata` a live answer gets (title, 160-character description, `openGraph` with `type`, `url`, `siteName`, `twitter.card = "summary_large_image"`) and the app's generic metadata for an unknown or unavailable one (`link-preview.test.ts`).
3. e2e, `runner.spec.ts` → `journey-link-preview`: a published Journey on a `tide` Project reads `og:title`, `og:description`, `og:url`, `og:image`, `twitter:card` off `/j/<id>`; the image GETs 200 `image/png`, 1200 × 630, a short `Cache-Control`, and its background pixel is the preset's paper (probed through a canvas); after unpublishing, `og:title` is the app name, `og:description` the tagline, and the image is byte-identical to an unknown id's image and differs from the live one. The captured responses are written to `test-results/ac-2-unavailable-journey.txt` when the run names the test.
4. e2e, `public-project.spec.ts` → `project-link-preview`: the same for `/p/<id>` (Project title, description cut from the rich text, the Project's Theme colours, `/p/<id>/opengraph-image`).

**Code.** `src/lib/og.tsx` takes the Literata loader (memoised per process, so a request-time image does not refetch the face) and the card layouts out of the root `opengraph-image.tsx`, which keeps its exports and renders the brand card through it. `getPublicJourney` gains the Project's title for the live shape and a `cache()` wrapper so page and metadata share one query. `generateMetadata` lands on the Journey page, the Step page, and the Project page through the pure builders; `src/app/j/[journeyId]/opengraph-image.tsx` and `src/app/p/[projectId]/opengraph-image.tsx` render the themed card for a live answer and the brand card otherwise, `dynamic = "force-dynamic"`, `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=60` passed explicitly (the `ImageResponse` default is a year, immutable). `e2e/setup/evidence.ts` gains `capturePath` for a root-level `ac-<n>-<slug>.txt`.

**Verification.** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && E2E_EVIDENCE=journey-link-preview,project-link-preview pnpm test:e2e` captured to `test-results/dod-1-commands.txt`; two `/code-review` readers (standards and spec) over the branch diff; `[CLOSEOUT]` with `Status: done`; PR to `staging`.

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/48 (base `staging`, comparison SHA `cf3d781`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Execution.** One author in the worktree `.claude/worktrees/37-link-previews/journeys` on `feat/37-link-previews`, no `.env.local` (a scratchpad file exported the docker-compose `DATABASE_URL` and CI's dummy auth values), e2e on port 3137 against `journeys_e2e_t37`. Commits: bfd5e4b (the feature: `src/lib/link-preview.ts`, `src/lib/og.tsx`, the three `generateMetadata`s, the two `opengraph-image.tsx` routes, `getPublicJourney` with the Project title under `cache()`, `textPreview`), 0486e23 (`journey-link-preview`, `project-link-preview`, `e2e/setup/link-preview.ts`, `capturePath`), 31e7d36 (evidence), 017f6e7 (review tidy-ups), da1a0bc (evidence over the final tree).

**Verified run command (final tree, head da1a0bc; code at 017f6e7):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=journey-link-preview,project-link-preview pnpm test:e2e` — every block `exit=0`; unit 400/400; e2e 92 passed in 6.1m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3137, Chromium. `pnpm build` was not run on its own: `pnpm test:e2e` builds the app. No migration: the schema is untouched.

| Criterion | Verdict | Evidence |
|---|---|---|
| A live Journey's page carries its title, description, and a per-Journey Open Graph image at `/j/<id>/opengraph-image` in the Journey's Theme colours | PASS | `journey-link-preview`: `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type = article`, `twitter:card = summary_large_image` read off `/j/<id>`; the card GETs 200 `image/png`, 1200 × 630, `Cache-Control` with `max-age=300`; its paper pixel (40, 600) and stripe pixel (600, 8), read through a canvas, equal the dusk override's background and primary while the Project is set to tide; a fresh load of the Step URL carries the same `og:title` and an `og:url` naming the Journey; `test-results/journey-link-preview/journey-card.png` (viewed: dusk paper, plum stripe, mark and Project kicker, Literata title, muted description) |
| An unknown, never-published, or unpublished Journey answers with the app's generic metadata and image | PASS | same spec after `live_version_id = NULL`: `<title>` and `og:title` are the app name, `og:description` the tagline; the card is 200 PNG 1200 × 630, differs from the live card, and is byte-identical to `/j/<unknown>/opengraph-image`; `/j/<unknown>` is 404; `test-results/ac-2-unavailable-journey.txt`, `unavailable-card.png` (viewed: the brand card) |
| A Project's public page carries its own image at `/p/<id>/opengraph-image` | PASS | `project-link-preview`: tags off `/p/<id>` (title, the rich-text opening as description, `og:url`, `og:site_name`, `twitter:card`), card 200 PNG 1200 × 630 with `max-age=300`, ember paper and the Author's `#ffcc00` accent on the stripe; unknown id 404s and its card differs from the Project's; `test-results/project-link-preview/project-card.png` (viewed) |
| The two AI reviewers (correctness, contract) find no public data beyond what the runner already shows | PASS | below |
| `pnpm test:e2e` passes once in full at the end | PASS locally (92/92, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR checks |

**AI review (two Opus readers, `/code-review`, diff `cf3d781...31e7d36`).** *Standards:* no blocking findings. Non-blocking, fixed in 017f6e7: `generateMetadata` doc blocks had landed under the page's own doc block (moved above); `docs/branding.md` still said the root image fetched Literata at build time and listed one card (updated); import order in the two image routes and `og.tsx` (reordered); `capturePath` copied `evidencePath`'s root choice (one `evidenceRoot`); `metaContent` duplicated across the two specs (shared in `e2e/setup/link-preview.ts`); `PRESET_PALETTES` hand-copied from `globals.css` with only a comment holding them together (a unit test now derives every preset from the stylesheet with the `scripts/contrast.mjs` maths); the description cut twice, once in the route and once in the card (the route cuts, the card cuts only title and kicker, the kicker limit named); the font memo could reset and let a card name a face the renderer was not given (the font loads once in `ogResponse`, which hands the face to the card); the Step assertion read tags left over from the Start page (the spec now loads the Step URL afresh); a comment in `runs.ts` read oddly (reworded). Accepted: async card components (now sync, taking `face`); the possible streaming-metadata flake was judged not to apply — every runner navigation is a full document load and `getAttribute` auto-waits. *Spec:* no blocking findings; every field traced to `getPublicJourney` / `getPublicProject` (Published Version title and description, Theme with override, Project title); the document, Draft, Steps, Runs, Responses and Author names never reach a preview; a pasted Step URL ignores `stepId` and the Run cookie. Non-blocking, accepted and recorded for Paul: the Project's title on the Journey card is sanctioned by the ticket's Decisions but is the one thing the runner itself never shows; `og:type` is `website` on the Project page and `article` on the Journey's; the unpublished Journey's `og:image` stays at `/j/<id>/opengraph-image` (Next's file-based image always wins over config metadata) and serves the brand card, asserted byte-identical to an unknown id's card rather than to the build-time root image.

**Deviations.** (1) `og:type` on the Project page is `website`, not `article`. (2) The unavailable-Journey assertion compares the card with an unknown id's card, not with `/opengraph-image` (above). (3) `pnpm build` ran inside `pnpm test:e2e` rather than on its own. (4) The card's description and kicker are set in Literata as well as the title: Satori is given one face, as the root card always was.

**Queued for Paul (non-blocking, also in the PR).** The Project's title on the Journey card; `og:type` on the Project page; the fallback `og:image` URL.

**Next in Paul's order:** 38 → 39 → 40 → 43 (sweep 2), then 41 → 42 → 44 → 45.

