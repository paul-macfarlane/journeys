# 31: Branding, app theme, and legal pages

Status: done
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

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/atlas-implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/36 (base `staging`, comparison SHA 9043afb). Status set to `done` in this commit; merging the PR is Paul's acceptance. Two criteria stay human-gated on the PR (below).

**Deliverables (one deliverable, orchestrator-implemented on a direct checkout of `feat/31-branding-theme-and-legal-pages`, no workers; the frontend-design skill was loaded before choosing the direction).** 913b70e — the identity (`src/components/brand.tsx`: `JourneysMark` tile/line, `Wordmark`, `LegalLinks`; `src/lib/brand.ts`; `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, `manifest.ts`, `opengraph-image.tsx`; `viewport.themeColor`), the theme (`globals.css` tokens for both schemes, `--radius` 0.375rem, `h1`–`h3` in the display face, React Flow variables for the canvas; Literata + Atkinson Hyperlegible Next via `next/font`), the wordmark in the navbar, on the sign-in page, the landing page, and the runner footer ("Made with Journeys"), `/privacy` and `/terms` on a shared `LegalPage` shell with footer links on the sign-in, landing, and runner frames, `docs/branding.md`, `e2e/branding.spec.ts` (`legal-pages`, `theme-light-and-dark`). 2e589f5 — review fixes (privacy: session record with browser/IP/provider tokens, cookie names and the session lifetime, the participant id shared across journeys; `next/font` variable renamed so it no longer shadows Tailwind's `--font-display`; `BRAND_COLORS.paper` for the OG fork; `scripts/contrast.mjs` and `scripts/make-icons.mjs` committed so the doc is reproducible; manifest/viewport theme-color note). e3446c0 — evidence.

**Verified run command (final tree, head 2e589f5):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; E2E_EVIDENCE=landing,sign-in,legal-pages,theme-light-and-dark pnpm test:e2e` — every block `exit=0`; unit 297/297; e2e 74 passed in 1.7m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium. A candidate run at 913b70e was also fully green (74/74).

| Criterion | Verdict | Evidence |
|---|---|---|
| The browser tab shows the favicon on every page; the OG image renders at `/opengraph-image` | PASS | `theme-light-and-dark` asserts `link[rel=icon]` and `og:image` on the page and GETs `/icon.svg`, `/favicon.ico`, `/apple-icon.png`, `/manifest.webmanifest`, `/opengraph-image` (200 + content type); `test-results/dod-1-e2e.txt`; the built OG PNG viewed (tile, "Journeys" in Literata, tagline) |
| Light and dark themes use the documented palette on the sign-in page, the Projects list, a Journey page with the canvas, and the runner on a phone; body text meets WCAG AA, ratios in `docs/branding.md` | PASS | `test-results/theme-light-and-dark/{sign-in,projects,journey,runner}-{light,dark}.png` (viewed); ratios read from Chromium's painted colours by the spec — body 16.02:1 light / 15.64:1 dark, muted 6.74:1 / 7.90:1 on every surface — and asserted ≥ 4.5:1; the token-computed table in `docs/branding.md` "Contrast" |
| `/privacy` and `/terms` render, are linked from the sign-in page and the runner footer, and their text is approved by Paul in a PR comment | Spec PASS; approval BLOCKED (human gate, PR #36 item 1) | `test-results/legal-pages/privacy.png`, `terms.png`, `legal-pages.png` (runner footer at 390px, viewed); the spec follows Privacy from the sign-in footer, Terms from the privacy footer, and Terms from the runner footer as a Participant |
| Human-gated: the Google and Discord consent screens show the app name and logo | BLOCKED (human gate, PR #36 item 2; needs `/privacy` and `/terms` live on staging, i.e. after merge) | Paul's confirmation on the PR |
| `pnpm test:e2e` passes once in full at the end | PASS locally (74/74, 0 flaky); PR CI is the durable proof | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR #36 checks |

**AI code review (one Opus reader over `9043afb..913b70e`, both axes in one prompt per the polish route).** 0 blocking, 11 non-blocking. Axis 1 (technical/spec): (1) evidence and closeout not yet committed — done here; (2) `docs/branding.md` cited a scratchpad script — both scripts now under `scripts/`; (3) privacy omitted the session record's IP/user agent and the provider tokens — bullet added; (4) participant cookie understated as a same-device id when it is shared across journeys — rewritten; (5) both pages describe Responses the code does not store yet — deviation, ticket-mandated, flagged to Paul; (6) cookies not named — names and the session lifetime added; (7) `--font-display` defined twice on `<html>` — `next/font` variable renamed; (8) bare hex in the OG image — `BRAND_COLORS.paper`; (9) manifest `theme_color` differs from viewport theme-color, no 192/512 PNG — documented as deliberate; (10) contrast probes are structurally coupled to the fixtures — deviation, they fail by name rather than flake. Axis 2 (standards): clean; the `eslint-disable` on the runner footer anchor is genuinely needed (unused-directive check passed). The reviewer also asked for a conscious yes on publishing Paul's Gmail as the contact address — on the PR.

**Deviations.** (1) The landing page also carries the legal links and the mark; the ticket names only the sign-in and runner footers (the landing page is the public root, and the ticket asks its screenshot to show the identity). (2) The theme AC is proven by a fourth spec, `theme-light-and-dark`, in `e2e/branding.spec.ts`, beside the three the ticket names; its screenshot directory is committed with them. (3) The OG image fetches Literata from Google Fonts at build time with a fallback rather than committing a font file; the fallback renders the name in the default serif. (4) The two legal pages describe free-text Responses ahead of the code (ticket asks; ticket 07/14 stores them). (5) Isolation prediction re-checked against the real diffs: the single deliverable touched `src/app/layout.tsx`, `src/app/globals.css`, `src/app/sign-in/page.tsx`, and `src/components/runner/runner-frame.tsx` as predicted, but `e2e/sign-in.spec.ts` was never edited (the dark sign-in screenshot moved into the new spec); the sequential choice stands on the four real overlaps.

**Queued for Paul (non-blocking, also on the PR).** (1) Contact email on both legal pages is his Gmail (`CONTACT_EMAIL`, one edit). (2) No governing jurisdiction and no named operator in the terms; add if wanted. (3) Consent-screen update after merge, then a confirmation comment.

**Next in Paul's order:** 23 undo/redo; 17 post-hackathon.

### [CLOSEOUT] amendment 2026-09-22 — Claude Fable 5.1

Paul approved the `/privacy` and `/terms` text in conversation on 2026-09-22 ("the legal stuff is approved"), keeping the contact address and the wording as delivered; the legal-text criterion is therefore PASS (approval recorded here rather than as a PR comment). The consent-screen criterion remains the one open human gate, actionable after PR #36 merges. Paul also asked that any further tweaks be opened as a separate ticket.
