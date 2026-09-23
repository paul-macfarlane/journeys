# 34: Sticky navbar and tabs, the phone user menu, and a site footer

Status: ready-for-agent
Blocked by: None
Owner:
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
