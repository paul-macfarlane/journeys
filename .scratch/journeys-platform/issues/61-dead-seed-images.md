# 61: Dead hotlinked images in the three seed cases

Status: done
Blocked by: 56
Owner: Claude (Fable 5.1), 2026-09-24
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

1. For each dead image, either replace the `src` with a working absolute URL of the same photo (the Wikimedia one is a thumbnail URL; the original file URL serves, but at 5 MB, so a resized copy under `public/seed/` is the better fix for that one), or with a re-hosted copy under `public/seed/` when the licence permits (CC BY-SA and public-domain sources), or remove the image and keep the credit paragraph only when neither is possible (the NYT and rawpixel ones are not redistributable).
2. Keep the credit paragraphs Medha wrote; edit only the images.
3. Re-run `pnpm seed:journey-stories <email>` locally to prove the documents still load; Paul re-seeds staging and production from his terminal (the seed is idempotent on the fixed ids, or say so if it is not).

Acceptance criteria:

- [x] Every `src` in the three documents returns 200 with an image content type from a plain `curl -A 'Mozilla/5.0 …'`; the check is captured as `test-results/ac-1-seed-images.txt` (a one-line-per-URL status list).
- [x] The `runner` spec's Case 1 walk still passes; `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.
- [ ] Paul re-seeds production before promotion or notes that it runs after.

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding C.

## Comments

### 2026-09-24 — [CLOSEOUT] Claude (Fable 5.1), `/implement` from a worktree

- **PR:** https://github.com/paul-macfarlane/journeys/pull/72 (`feat/61-dead-seed-images` → `staging`, base `df348ae`, with `chore/56-regression-pass` merged in so this ticket file is on the branch; the PR shrinks to its own commits once #70 merges). Worktree `.claude/worktrees/61/journeys`, `E2E_PORT=3161`, `E2E_DATABASE_NAME=journeys_e2e_61`, dummy env exported from a scratch script.
- **What was actually dead on 2026-09-24 ~19:20Z** (desktop Chrome user agent, plain curl and curl with the app's Referer and Sec-Fetch headers, and Node fetch, all agreeing): five image slots, four URLs. Case 1 "Wait w/ Broken Leg" (Wikimedia thumbnail, 400), Case 1 "Years go by" (WordPress blog, 410 Gone, no Wayback copy; Internet Archive was also offline during the run), Case 2 "Legal Org" and "Work" (one picryl URL, 403; picryl.com sits behind a Cloudflare bot check, not bypassed), Case 2 "Day 1 in Detention" (picryl, 403). The seven NYT, rawpixel, and mottodistribution slots the ticket's table lists answered `200 image/*` on every probe, so their hotlinks are unchanged; they flapped earlier the same day and are not redistributable, so the only alternative was removing working, permission-granted photos. They stay, flagged here and on the PR.
- **Delivered:** `public/seed/external-fixator.jpg` (Wikimedia Commons, CC BY-SA 4.0, resized 4592→1400 px), `caroline-phone.jpg` and `caroline-common-area.jpg` (DVIDS, Keith Gardner, public domain), `bluebonnet-cell.jpg` (DVIDS, Charles Reed, public domain), each linked at its raw GitHub address on `staging` with the same `/` escapes as `allotment.jpg`; the exact picryl frame could not be recovered (its CDN and page refuse every off-site request), so each Step got the frame from the same DVIDS set that fits its text. `public/seed/README.md` records source, licence, and reason per file. `src/lib/graph/validate.test.ts` expects 19 images in Case 1.
- **Commands** (`test-results/dod-1-commands.txt`, on the final commit): `pnpm lint`, `pnpm typecheck`, `pnpm test` (544), `E2E_EVIDENCE=runner-case-3-on-a-phone,runner-case-2-restored-choice pnpm test:e2e` — 107 passed in 2.2 min, all PASS. An earlier full run on the pre-review commit `1273929` passed 107/107.
- **A full run on the final commit was FAIL** (`test-results/dod-1-e2e-run-1-failed.txt`): `author-settings` hit its 30 s test timeout and `metadata-autosave` lost a Settings-tab click, with the machine at load average 47–65 while another session's suite ran; the ticket touches neither. The rerun cited above, started once the load fell, passed 107/107 and is the capture in `dod-1-commands.txt`. Local seed: `pnpm seed:journey-stories seed-61@example.com` against a freshly migrated `journeys_e2e_61` loaded all three cases and the demo Journey, and a second run reported the same rows (idempotent: the fixed ids upsert the Draft in place).
- **Evidence:** `test-results/ac-1-seed-images.txt` (39 sources; 35 answer 200 image/* at their stored address; the 4 raw GitHub sources name `staging` and answer 404 until this PR merges, and the same committed file answers 200 on the PR branch, printed beside each as `(branch)`); `test-results/runner-case-3-on-a-phone/` and `test-results/runner-case-2-restored-choice/` refreshed by the evidence run.
- **Acceptance criteria:** AC 1 (every `src` 200 with an image content type) — PASS on the PR branch, pending the `staging` path after merge, as the capture states. AC 2 — the `runner` spec has no Case 1 walk (its walks are Case 3 and Case 2); both passed with the full chain, PASS on that reading. AC 3 — Paul's (below).
- **AI Code Review** (one reviewer, Standards + Spec axes, on `1273929`):
  - Spec: no Case 1 runner walk exists (recorded above). Leaving the NYT/rawpixel/motto hotlinks is defensible under step 1 but leaves the flapping risk open (recorded above and on the PR). Keeping "Photo - Image is author owned." as a bare paragraph reproduced the ticket's own symptom (fixed: dropped with its image, see Deviations). The AC 1 capture's tally hid the pre-merge 404s (fixed: the tally names them). The ticket file was missing from the branch (fixed: merged `chore/56-regression-pass`).
  - Standards: hard — "credit" for what `CONTEXT.md` calls a Caption in the README and a test comment (fixed). Judgement — the test's "counts are the legacy content's own" comment now has one exception (the `images: 19` line says so). Escape convention, secret-scrub regex (`[A-Za-z0-9+/]{40,}`), README accuracy, and untouched JSON confirmed.
- **Deviations:** step 1 says to keep the credit paragraph when an image is removed; the "Years go by" caption was only "Photo - Image is author owned." (no source, no author) and would have sat under nothing, so it was removed with the image. Restoring it is a one-line edit if wanted.
- **Left for Paul:** merge (#70 first or together); the raw `staging` URLs resolve only after the merge. Re-seed staging and production with `pnpm seed:journey-stories <email>` (the Draft is upserted; nothing else changes), then **publish a new Version of Case 1 and Case 2** on each, because participants walk the Published Version and the seed writes Drafts only; do this before promotion or note it runs after (AC 3). Optional: re-host the four public-domain rawpixel photos from their CBP originals if the flapping worries you; the NYT and motto ones cannot be re-hosted.
