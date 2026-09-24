# 62: The footer wraps onto two lines on the prose pages

Status: ready-for-agent
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (56's regression pass, 2026-09-24): About and Guide are the two pages the judges read after the splash, and their footers look broken next to the splash's.
Route: polish

**Why:** on `/about`, `/guide`, `/privacy`, and `/terms` at 1280 px the footer is squeezed into the prose column, so "Privacy" and "Terms" drop to a second row under the mark; the splash, the sign-in page, the runner, and the Author page spread the same footer across the full width on one line. Screens: `test-results/56-regression-pass/1280-light-privacy.png`, `test-results/56-regression-pass/1280-dark-about.png` (two rows) against `test-results/56-regression-pass/1280-light-sign-in.png` (one row).

**What is true today:** `ProsePage` (`src/components/prose-page.tsx`) renders `<SiteFooter width="prose" />` on purpose, aligning the footer to the `max-w-prose` column; the other pages render it full width. The six items (mark, copyright, About, Guide, GitHub, Privacy, Terms) no longer fit that column since 54 added About and Guide, so the last two wrap. At 375 px every page wraps the footer, which is fine.

**What to do:**

1. Either drop the `width="prose"` narrowing in `ProsePage` so the four prose pages match the splash at desktop widths, or keep the alignment and let the footer's items flow on one row at `max-w-prose` (tighter gaps, smaller copyright, or the mark without its wordmark). Paul's call; the first is the one-line fix.
2. Do not change the footer's own landmarks (ticket 29's lesson).

Acceptance criteria:

- [ ] At 1280 px the footer on `/about`, `/guide`, `/privacy`, and `/terms` renders on one row spanning the page like `/sign-in`; the `about` and `branding` (or `legal`) specs assert the footer's bounding box is at least 1000 px wide at the default viewport, with screenshots in both themes.
- [ ] 375 px unchanged (no horizontal overflow).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding D.
