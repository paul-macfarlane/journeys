# 61: Dead hotlinked images in the three seed cases

Status: ready-for-agent
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (56's regression pass, 2026-09-24): a judge playing Case 1 to its most-taken ending sees a photo credit with no photo above it.
Route: polish (the seed documents and a re-seed; no app code)

**Why:** 12 of the 36 image URLs stored in `scripts/seed/journey-stories/*.json` no longer serve an image. `curl` with a desktop Chrome user agent, 2026-09-24:

| Case | Step | Host | Status |
|---|---|---|---|
| 1 | Purgatory 2 | static01.nyt.com | 403 |
| 1 | River | images.rawpixel.com | 400 |
| 1 | Wait w/ Broken Leg | upload.wikimedia.org (thumb) | 400 |
| 1 | Years go by | sienaamcvoices.files.wordpress.com | 410 |
| 2 | Detention Day 2 | mottodistribution.com | 404 |
| 2 | Legal Org, Work, Day 1 in Detention | cdn2.picryl.com | 403 |
| 2 | Solitary Confinement, Back to Work, It's going to be a long haul, Wait it out, Report Assault to CBP | images.rawpixel.com | 400 |
| 2 | Michigan, Cheetos | static01.nyt.com | 403 |
| 3 | Undocumented | images.rawpixel.com | 400 |

The Ending "Wait w/ Broken Leg" is what the first-Choice walk reaches: `test-results/56-regression-pass/prod-1280-light-walk-step-20.png` shows the credit paragraph with no image (the browser reported `ERR_BLOCKED_BY_ORB` because the host answers with an HTML error page). The other 24 images load. The remedy the demo Journey already uses is a committed file under `public/seed/` linked by its absolute raw-GitHub URL (ticket 58's lesson: stored image URLs must be absolute http(s)).

**What to do:**

1. For each dead image, either replace the `src` with a working absolute URL of the same photo (the Wikimedia one is a thumbnail URL; the original file URL serves), or with a re-hosted copy under `public/seed/` when the licence permits (CC BY-SA and public-domain sources), or remove the image node and keep the credit paragraph only when neither is possible (the NYT and rawpixel ones are not redistributable).
2. Keep the credit paragraphs Medha wrote; edit only the image nodes.
3. Re-run `pnpm seed:journey-stories <email>` locally to prove the documents still load; Paul re-seeds staging and production from his terminal (the seed is idempotent on the fixed ids, or say so if it is not).

Acceptance criteria:

- [ ] Every `src` in the three documents returns 200 with an image content type from a plain `curl -A 'Mozilla/5.0 …'`; the check is captured as `test-results/ac-1-seed-images.txt` (a one-line-per-URL status list).
- [ ] The `runner` spec's Case 1 walk still passes; `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.
- [ ] Paul re-seeds production before promotion or notes that it runs after.

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding C.
