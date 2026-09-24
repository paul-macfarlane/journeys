# 59: Production promotion gate: seed, publish, and domains

Status: ready-for-human
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: blocks-promotion (56's regression pass, 2026-09-24): Paul's runbook step 0 and step 5, checked before the form is submitted at 10:00 ET 2026-09-25.
Route: polish (no code; a human checklist)

**Why:** 56 found that the splash's "Play a Journey — no account needed" link only works where the seed Project exists *and* its cases are published. On staging, before Paul seeded, `/p/00000000-5eed-4000-8000-000000000001` was a bare Next 404 (`test-results/56-regression-pass/1280-light-keyboard-project.png`); after the seed but before publishing, it reads "No journeys are available right now" (`test-results/56-regression-pass/1280-light-seed-project.png`). Production (`journeys-ten-virid.vercel.app`, `main` at `c0fc678`) has the three cases published today, but that is the *old* build; the splash and About ship with the promotion.

**What is true today (2026-09-24, 15:00 ET):**

- `journeys.paul-macfarlane.com` resolves in DNS (216.198.79.195) but is not attached to the Vercel project (only the two `vercel.app` domains are), so it never connects. `journeys-staging.paul-macfarlane.com` has no DNS record at all.
- `metadataBase` is `BETTER_AUTH_URL` (`src/app/layout.tsx`), so the link-preview image follows that variable; on staging it points at the protected git-branch alias, so no crawler can fetch it there. Production's preview works today at the `vercel.app` origin (`test-results/56-regression-pass/preview-home-production.png`, 1200 × 630).
- Staging is behind Vercel Deployment Protection; 56 used a share link. Judges never see staging.

**What to do (Paul, in order):**

1. Attach both custom domains under Vercel → Project → Settings → Domains; set `BETTER_AUTH_URL` per environment to the new origin; add both origins' `/api/auth/callback/google` and `/discord` to the OAuth clients (54's Comments).
2. Promote `staging` → `main`.
3. On production: `/p/00000000-5eed-4000-8000-000000000001` lists Case 1, 2, and 3 (publish them from each Journey's Versions tab if not); `/` Play link lands there; `/about` and `/guide` are 200; `curl -s <origin>/ | grep og:image` names the production origin.
4. Sign in once on the new domain; create, publish, and play a throwaway Journey with a deciding Prompt; delete it.

Acceptance criteria:

- [ ] The four checks in step 3 pass on `journeys.paul-macfarlane.com` (or on the `vercel.app` origin if the domain move is deferred, in which case the form's URL is that origin).
- [ ] The form is submitted with a URL that serves the splash.

No verification chain and no evidence directory: this is a human gate. Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding A.
