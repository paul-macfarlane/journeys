# 34: Sticky navbar and tabs, the phone user menu, and a site footer

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (atlas-implement, 2026-09-23)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → **34** → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: polish

**Why:** The navbar scrolls away (item 16: "The navbar should be sticky on the top. The project and journey headers all the way up to and including the tabs debatably should be sticky too"). On a phone the user menu opens as a bottom sheet, which makes switching Theme awkward and hides Sign out (item 17: "we should just match what we do on larger screens"). The app has no GitHub link and no copyright line, unlike paulitakes and picks leagues (item 5).

**Decisions (Paul, 2026-09-22, grilled):**

- The navbar is sticky on every Author page. On the Project and Journey pages the row of tabs sticks directly beneath it from tablet width up; the page header (title, description, Publish and friends) scrolls away, because keeping it would cost a third of a phone's screen. At phone width nothing but the navbar sticks.
- Every dropdown menu is a popover anchored to its trigger at every width; the CSS-only bottom sheet in the vendored `DropdownMenuContent` (`src/components/ui/dropdown-menu.tsx`, the `max-sm:` rules and the scrim) goes. Menu rows keep their larger phone tap targets.
- One `SiteFooter` component everywhere, the runner included (Paul: "consistent throughout"): the wordmark linking to `/`, "© 2026 Paul Macfarlane", a GitHub link to `https://github.com/paul-macfarlane/journeys`, and the existing `LegalLinks`. It renders on the landing page, the sign-in page, the two legal pages, beneath every Author page (inside the two navbar layouts), and in `RunnerFrame`, whose "Made with Journeys" line it replaces. The runner ships no client bundle, so the footer stays a server component with plain anchors.

**What to build:**

- **Sticky.** `AppNavbar`'s `<header>` becomes `sticky top-0 z-40` with the page background (`src/components/navbar/app-navbar.tsx`). `UrlTabs` (`src/components/url-tabs.tsx`) takes an optional `sticky` prop that pins the `TabsList` under the navbar (`sm:sticky sm:top-14`, a background, a bottom border) and both pages pass it. Check the canvas editor: the sticky tab row must not overlap React Flow's controls or the Step panel, and `scroll-margin-top` on the tab content keeps anchored jumps visible.
- **Menus.** Delete the bottom-sheet variant; confirm the Project switcher, the user menu, "Step actions" on the canvas, and the analytics version select all open as popovers within the viewport at 375 px (Base UI's positioner already flips and clamps).
- **Footer.** `src/components/site-footer.tsx`; `src/lib/brand.ts` gains `REPOSITORY_URL` and `COPYRIGHT_HOLDER`. The year is the build year, never a client clock.
- **Specs.** `navbar` gains `navbar-sticky-and-phone-menu`: scroll a long Project page and assert the navbar's bounding box stays at `y = 0`; at 375 × 667 open the user menu and assert Light, Dark, System, and Sign out are all within the viewport, choose Dark, then Sign out lands on `/sign-in`. `landing`, `legal-pages`, and the runner screenshot show the footer.

Acceptance criteria:

- [ ] The navbar stays at the top while every Author page scrolls; from 640 px up the Project and Journey tab rows stay beneath it while the header scrolls away.
- [ ] At 375 px the user menu opens as a popover with Theme choices and Sign out fully visible; switching Theme and signing out both work.
- [ ] The same footer, with the wordmark, the copyright line, the GitHub link, and the legal links, renders on the landing, sign-in, legal, Author, and runner pages.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, items 5, 16, and 17.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/atlas-implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/45 (base `staging`, comparison SHA `747bcc8`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Execution.** Two deliverables in parallel, disjoint files (confirmed against the real diffs at closeout: no shared file between 764ecbf and cca9e3c). D1 (Opus worker, direct checkout; Paul paused the session mid-run, so the orchestrator finished it) 764ecbf — sticky `AppNavbar`, `UrlTabs` `sticky` on both pages, the document's scroll padding, the bottom sheet removed from `dropdown-menu.tsx`, `navbar-sticky-and-phone-menu`, the navbar spec's phone section as a popover, `phone-sheet.png` removed, and `toolbarOntoMap` in the canvas spec. D2 (Sonnet worker, worktree `.claude/worktrees/34-sticky-shell-and-footer/journeys` on port 3111 / `journeys_e2e_t34`) dc1d570, cherry-picked as cca9e3c — `SiteFooter`, the brand constants, the footer on every surface, `landing` and `legal-pages` assertions. Orchestrator f022ea0 — review fixes. f45fab6 — evidence.

**The canvas failure and its cause.** After D1's edits `canvas-keyboard-navigation` timed out clicking the top box's "Add next step": after a whole-map fit at zoom 2 the top box's moves hang above the frame's top edge, where the frame clips them under the Map controls row. The click had always landed on a 10 px sliver of the button still inside the frame, reached only by Playwright's last-resort `block: "start"` scroll putting the frame's top on the window's top edge; a sticky bar covers the window's top 56 px, so there was no sliver left to hit. Fixed in the spec: `expandStepActions` zooms the map out a notch through its own control until the moves sit inside the frame, and the opener is clicked as before.

**Verified run command (final tree, head f022ea0):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=navbar-sticky-and-phone-menu,navbar-switch-project-and-theme,landing,legal-pages pnpm test:e2e` — every block `exit=0`; unit 386/386; e2e 89 passed in 1.7m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium.

| Criterion | Verdict | Evidence |
|---|---|---|
| Navbar stays at the top while every Author page scrolls; from 640 px the tab rows stay beneath it while the header scrolls away | PASS | `navbar-sticky-and-phone-menu`: banner `y = 0` after a 600 px scroll, the tab band's top meets the banner's bottom (±1 px), the title field's bottom ≤ 0, the tab list below its resting position; at 375 px the tab row moves by exactly `scrollY` while the banner stays at 0; `test-results/navbar-sticky-and-phone-menu/sticky-tabs.png` (viewed: bar, tab band with border, header gone, map beneath) |
| At 375 px the user menu is a popover with Theme choices and Sign out fully visible; switching Theme and signing out work | PASS | same spec: Light, Dark, System, Sign out bounding boxes inside 375 × 667, Dark applies (`html.dark`), Sign out lands on `/sign-in`; `navbar-switch-project-and-theme` asserts the menu box is inside the viewport and not a full-width bottom sheet; `phone-menu.png` (viewed: popover under the avatar, all four rows in view) |
| The same footer (wordmark, copyright, GitHub, legal links) on landing, sign-in, legal, Author, runner pages | PASS | `landing` (all four parts), `legal-pages` (sign-in legal links, `/privacy` GitHub link, runner footer wordmark + copyright + GitHub on a phone), `navbar-sticky-and-phone-menu` (Journey page footer, exactly one `contentinfo`), `preview` (exactly one `contentinfo`); `test-results/landing/landing.png`, `test-results/legal-pages/legal-pages.png` (viewed: footer inside the themed runner frame) |
| `pnpm test:e2e` once in full at the end | PASS locally (89/89, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR checks |

**AI review (one Opus reader, both axes, diff `747bcc8..cca9e3c`).** 1 blocking: every Preview page rendered two footers (the `[projectId]` layout's and the runner frame's), two `contentinfo` landmarks — fixed by moving the footer into the Project and Journey pages and asserting one `contentinfo` on Preview and on the Journey page. 8 non-blocking: doubled scroll offsets (`scroll-mt-28` on the tab content plus the document's `scroll-padding-top`; the margin dropped), the "full-width band" comment overstated (reworded), `COPYRIGHT_YEAR` read at module load rather than build (now `BUILD_YEAR` inlined by `next.config.ts`), `cn()` instead of string concatenation and a dead `rel="noreferrer"` in the footer (fixed), stale comments about the `line` mark and the runner footer's muted tone (rewritten), the Author-page footer unasserted (asserted), and two accepted: landscape-phone viewports under 681 px tall cannot fit the 36 rem canvas frame under the sticky rows (follows the `sm` decision), and the footer spans `max-w-7xl` under the narrow landing and sign-in columns.

**Deviations.** (1) The document's `scroll-padding-top` (keyed off the navbar's and the tab band's `data-slot`) stands in for the ticket's `scroll-margin-top` on the tab content, which would have doubled it. (2) `e2e/canvas.spec.ts` gained `toolbarOntoMap` (above). (3) The Project layout renders no footer; the Project and Journey pages render their own, because Preview beneath that layout carries the footer inside the runner frame. (4) The spec scrolls the Journey page in place of "a long Project page" (a fresh Project page is too short to scroll at 720 px). (5) The runner's "Made with Journeys" line and the sign-in page's "Back to Journeys" link are replaced by the footer's wordmark. (6) `pnpm build` was not run on its own: `pnpm test:e2e` builds the app.

**Queued for Paul (non-blocking, also in the PR).** Landscape-phone frame height; footer width under the narrow landing and sign-in columns; the tile mark inside the themed runner footer.

**Next in Paul's order:** 35 → 36 → 37 (sweep 1), then 38 → 39 → 40 → 43.
