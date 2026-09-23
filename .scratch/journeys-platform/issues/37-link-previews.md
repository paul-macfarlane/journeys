# 37: Link previews for Journeys and Projects

Status: ready-for-agent
Blocked by: None
Owner:
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

- [ ] A live Journey's page carries its title, description, and a per-Journey Open Graph image that renders at `/j/<id>/opengraph-image` in the Journey's Theme colours.
- [ ] An unknown, never-published, or unpublished Journey answers with the app's generic metadata and image.
- [ ] A Project's public page carries its own image at `/p/<id>/opengraph-image`.
- [ ] The two AI reviewers (correctness, contract) find no public data beyond what the runner already shows.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-2-unavailable-journey.txt` (the captured responses); never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 3.

## Comments
