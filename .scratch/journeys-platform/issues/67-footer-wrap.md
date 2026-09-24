# 67: The footer wraps into two tidy rows on narrow widths

Status: done
Blocked by:
Owner: Claude (Fable 5.1), 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: pre-hackathon (66's production smoke test, 2026-09-24, finding 2): every page's footer on a phone, and the runner's at tablet widths.
Route: polish

**Why:** ticket 62 put the footer on one row at desktop widths by giving the prose pages the page-wide footer. Below about 700 px (every page at 375 px; the runner's prose-width footer at the desktop app's 646 px pane) the seven items still cannot share a row, and the container's `justify-between` spreads whichever items wrapped across the full width: at 375 the About page reads "Journeys · © 2026 Paul Macfarlane · About" pushed to the edges on row one and "Guide · GitHub · Privacy Terms" on row two, and the runner at 646 drops "Privacy Terms" alone at the left under the mark.

**What to do:** in `src/components/site-footer.tsx`, keep the outer `flex-wrap … justify-between` container and put its items into two groups — the mark and the copyright, and the five links (About, Guide, GitHub, and `LegalLinks`) — each a `flex flex-wrap items-center gap-x-6 gap-y-2` box. One row when the groups fit; otherwise the links group drops to a second row that starts at the same left edge. No breakpoints, no change to any link, name, or landmark, so the ticket-62 one-row proof and the "Legal" navigation the branding spec reads stay as they are.

Acceptance criteria:

- [x] At 375 px on `/about`, the mark and the copyright share the first row, About through Terms share the second, and both rows start at the same left edge; no horizontal overflow (`footer.spec.ts`, `footer-wrap`, one screenshot).
- [x] At 1280 px the footer is still one row across the page on About, the guide, the runner, and the sign-in page (the existing `expectFooterOnOneRow` calls in `about`, `guide`, and `branding`).

Verification follows `docs/agents/testing.md`, polish route: `pnpm lint`, `pnpm typecheck`, `pnpm test`, one full `pnpm test:e2e` at the end with `E2E_EVIDENCE=footer-wrap`; evidence is `test-results/dod-1-commands.txt` and `test-results/footer-wrap/`. Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 66, finding 2.

## Comments

### 2026-09-24 — Claude (Fable 5.1), `[CLOSEOUT]`

**PR:** https://github.com/paul-macfarlane/journeys/pull/77 (base `staging`, head `fix/67-footer-wrap`, commit `bc2e06e` plus this closeout). Route: polish; delivered in the main checkout on a branch, no worker delegation.

**Delivered:** `src/components/site-footer.tsx` groups the mark and copyright, and the five links, into two flex boxes inside the unchanged `justify-between` container; `e2e/setup/footer.ts` gains `expectFooterInTwoRows`; `e2e/footer.spec.ts` (`footer-wrap`) proves the two rows, the shared left edge, and no horizontal overflow at 375 px on `/about` with one screenshot; ticket 66 (the production smoke findings) rides on the same branch.

**Verification** (`test-results/dod-1-commands.txt`): `pnpm lint` exit 1 on the untracked, git-ignored `.claude/atlas-state/56/tour.ts` (ticket 56's scratch script, `no-explicit-any`; not touched), so the capture also holds `pnpm exec eslint --ignore-pattern '.claude/**' .` exit 0; `pnpm typecheck` exit 0; `pnpm test` 544 passed; `E2E_EVIDENCE=footer-wrap pnpm test:e2e` 111 passed of 111. Evidence: `test-results/footer-wrap/footer-375.png`. Both acceptance criteria hold: the new spec for 375 px, and the existing `expectFooterOnOneRow` calls in `about`, `guide`, and `branding` for 1280 px.

**AI review** (one reviewer, standards and spec): approve, no finding on either axis. Nit recorded: the runner's 646 px wrap has no spec of its own; the CSS is the one shared component and the runner's 1280 px one-row proof in `branding` still passes, so it was left as a nit.

**For Paul:** merge #77 to `staging`, promote to `main` for the form; triage ticket 66's post-hackathon items 3–9 after 2026-09-26.
