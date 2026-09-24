# 44: Renaming the app

Status: needs-info
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → **44** → 45. 14 stays available; 17 is post-hackathon. "This can happen after the hackathon." Also listed on ticket 15.
Route: polish

**Why:** Paul, 2026-09-22, item 2: "I might wanna rethink the name. Journeys is a decent name, but the domain name is almost certainly not available."

**Needs from Paul before this is ready:** the new name and the domain. Everything below is what a rename touches, gathered now so the decision can be made with the cost in view.

**What a rename touches:**

- **In the app.** `APP_NAME` and `APP_TAGLINE` in `src/lib/brand.ts` drive the title template, the manifest, the Open Graph images, the wordmark, the runner footer, and the legal pages; `docs/branding.md` and the mark itself (`JourneysMark`) carry the old name in code identifiers, which can stay. The `CONTEXT.md` glossary keeps "Journey" as the domain word whatever the app is called, unless Paul wants the product and the concept to diverge.
- **Cookies.** The names `journeys.participant` and `journeys.run.<id>` (`src/lib/run-cookies.ts`) are read by better-auth and the runner; renaming them logs every Participant out of their Runs. Recommendation: keep the cookie names.
- **Outside the repository.** The GitHub repository, the Vercel project and its domains, the Google and Discord OAuth application names and consent screens (item 6, Paul's), `BETTER_AUTH_URL` and the redirect URIs in `human-prerequisites.md` §3–5, and the memory and Atlas workspace names.
- **Order.** Run before ticket 42 (SEO) so canonical URLs and the sitemap are written once.

Acceptance criteria (to be completed once the name is chosen):

- [ ] The new name appears everywhere the old one did in the app, and the legal pages are re-approved by Paul.
- [ ] Participants keep their Runs across the deploy.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`). Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 2.

## Comments
