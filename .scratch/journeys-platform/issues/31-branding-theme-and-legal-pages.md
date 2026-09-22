# 31: Branding, app theme, and legal pages

Status: in-progress
Blocked by: None
Owner: Claude Fable 5.1 (`/atlas-implement`, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → 26 → 27 → 10 → 28 → 29 → 30 → **31** → 23; 17 is post-hackathon.
Route: polish

**Why:** "Right now this app feels very generic shadcn. It needs some more personality." Favicons are missing, and the Google and Discord OAuth consent screens need a privacy policy and terms of service before the app's name and logo can appear on them. Item 11 of Paul's 2026-09-21 notes. This is app branding; ticket 11 (per-Journey Themes for Participants) is a different thing and is untouched.

**Decisions (Paul, 2026-09-21):** one ticket covering favicons, an app theme, and the two legal pages. The legal text is drafted by the agent and signed off by Paul; updating the consent screens is Paul's.

**What to build:**

- **Identity.** A wordmark and a simple mark (SVG) for the app, used in the navbar (ticket 29), the sign-in page, the runner frame footer, and the favicon set: `icon.svg`, `favicon.ico`, `apple-icon.png`, and a web manifest through the Next.js metadata file conventions under `src/app/`; an Open Graph image via `opengraph-image.tsx` with the app name. Load the `frontend-design` skill before choosing the direction and record the chosen palette, type pair, and radius in `docs/branding.md`.
- **Theme.** Replace the stock neutral shadcn tokens in `globals.css` with the chosen palette for light and dark, one display or heading font plus one text font through `next/font`, and pass the runner and the canvas through it (the runner is Participant-facing; keep it calm and readable on a phone). No component API changes; every page picks the theme up from tokens.
- **Legal pages.** `/privacy` and `/terms` as static pages with plain-language text covering: what is stored (account email and name from Google or Discord, Projects and Journeys, anonymous Runs and free-text Responses with no identity), cookies (session and run cookies), no selling of data, contact email, and governing terms for Authors. Links to both in the sign-in page footer and the runner frame footer. Paul reviews the text before merge (human-gated).
- **Consent screens (human).** Paul sets the app name, logo, privacy, and terms URLs on the Google Cloud OAuth consent screen and the Discord application. Record the post-action check: the sign-in buttons show the app name and logo.
- **Specs.** `landing` and `sign-in` screenshots show the new identity; a `legal-pages` spec opens both pages and finds their headings and the footer links.

Acceptance criteria:

- [ ] The browser tab shows the favicon on every page; the OG image renders at `/opengraph-image`.
- [ ] Light and dark themes use the documented palette on the sign-in page, the Projects list, a Journey page with the canvas, and the runner on a phone viewport; contrast for body text meets WCAG AA (check with the browser's accessibility panel and record the ratios in `docs/branding.md`).
- [ ] `/privacy` and `/terms` render, are linked from the sign-in page and the runner footer, and their text is approved by Paul in a PR comment.
- [ ] Human-gated: the Google and Discord consent screens show the app name and logo (Paul confirms in the PR).
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, item 11.

## Comments
