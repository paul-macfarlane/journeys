# 62: The footer wraps onto two lines on the prose pages

Status: done
Blocked by: 56
Owner: Claude (Fable 5.1), /implement, worktree .claude/worktrees/62/journeys
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

## Comments

### 2026-09-24 — [CLOSEOUT] Claude (Fable 5.1), `/implement` from a worktree

- **PR:** https://github.com/paul-macfarlane/journeys/pull/75 (`feat/62-prose-page-footer` → `staging`, base `7a42d6d`). Worktree `.claude/worktrees/62/journeys`, `E2E_PORT=3162`, `E2E_DATABASE_NAME=journeys_e2e_62`, dummy env exported from a scratch script.
- **Decision (step 1):** option 1, the one-line fix the ticket itself recommends: `ProsePage` renders `<SiteFooter />` at page width, so `/about`, `/guide`, `/privacy`, and `/terms` match the landing page and sign-in. The runner keeps `width="prose"` (its whole frame is a prose column), so the prop stays. Nothing in the footer's landmarks changed (step 2). Paul did not rule between the two options in the ticket; if the prose-aligned footer is preferred, the alternative (tighter gaps, smaller copyright, or the mark alone) is a `SiteFooter` change with the same specs as proof.
- **Delivered:** `src/components/prose-page.tsx` (drops the narrowing, doc comment), `src/components/site-footer.tsx` (doc comment only), `e2e/setup/footer.ts` (`expectFooterOnOneRow`: the `<footer>` landmark is always page-wide, so the helper measures the content, mark-left to Terms-right, at least 1000 px, and that Terms shares the mark's row), called from the `about` spec (light), the `legal-pages` spec (privacy light and dark, terms), and the `guide` spec, with `privacy-dark.png` added.
- **Commands** (`test-results/dod-1-commands.txt`, on `0e7da4f`): `pnpm lint`, `pnpm typecheck`, `pnpm test` (544), `E2E_EVIDENCE=about,legal-pages,guide pnpm test:e2e` — 109 passed in 3.6 min, all PASS.
- **A first full run was FAIL** (`test-results/62-e2e-run-1-failed.txt`): `metadata-autosave` lost its Settings-tab click (108 passed, 1 failed), the same race tickets 60 and 61 recorded, with the machine at load average 23–27 from other sessions' suites; the ticket touches nothing near it. The rerun above started once the one-minute load fell below 8 and passed 109/109.
- **Evidence:** `test-results/about/` (light, dark, 375), `test-results/legal-pages/` (privacy light and dark, terms, the runner on a phone), `test-results/guide/` (light, dark, 375), all refreshed by the evidence run and showing the footer on one row across the page.
- **Acceptance criteria:** AC 1 (one row spanning the page on the four pages at 1280 px, asserted in the `about` and `legal-pages` specs with screenshots in both themes) — PASS; the `guide` spec asserts it too because the ticket's priority line singles `/guide` out and its committed screenshots would otherwise still show the two-row footer. AC 2 (375 px unchanged, no horizontal overflow) — PASS by the existing 375 px overflow probes in the `about` and `guide` specs, which share `ProsePage` with the two legal pages; no new 375 px assertion was added for `/privacy` or `/terms`. AC 3 (command chain plus one full e2e) — PASS, capture above.
- **AI Code Review** (one reviewer, Standards + Spec axes, on `e01d502`):
  - Standards: no hard violations. Judgement — the helper's `minWidth` parameter was speculative (fixed: a named `MIN_FOOTER_SPAN` constant); "splash" in comments where `docs/branding.md` says "landing page" (fixed); the `ProsePage` comment narrated the regression (trimmed); the dark-scheme three-line shape now has a third copy across specs (left as the existing convention).
  - Spec: nothing missing against the letter; `/guide` had no assertion and stale screenshots (fixed, above); the 375 px criterion rests on inherited probes (recorded above); the helper measures content span rather than the `<footer>` box, which the reviewer confirmed is the right reading of "bounding box" since the landmark is always page-wide.
- **Deviations:** none from the ticket's steps. The `guide` evidence directory was recaptured beyond the two specs the AC names, for the reason above.
- **Left for Paul:** merge; confirm option 1 is the footer you want on the prose pages, or say so and the alternative is a small `SiteFooter` follow-up.
