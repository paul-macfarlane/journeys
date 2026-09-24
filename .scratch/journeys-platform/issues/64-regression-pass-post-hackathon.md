# 64: Post-hackathon findings from the staging regression pass

Status: needs-triage
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon (56's regression pass, 2026-09-24): none of these is visible in a judge's first two minutes. Triage into sweep 3 after 2026-09-26; several are one-line fixes that can ride along with 57 or 53.
Route: polish

**Why:** ticket 56 walked staging as a stranger and as an Author on 2026-09-24. Everything a judge would hit became tickets 59–63; this ticket holds the rest so nothing is lost. Each item names its screen under `test-results/56-regression-pass/` where one exists.

**Findings (post-hackathon):**

1. **Page titles.** The Project page and the Journey page have `<title>` "Journeys" alone; every other page has "Something · Journeys" (Projects list, Settings, the runner, the Author page). Give them the Project's and the Journey's title.
2. **Editor accessibility (axe, signed in, dark).** The React Flow attribution link fails contrast (4.24:1, `#999999` on `#2f3835` at 10 px); the Journey page has no `h1` (the title is an input) and jumps to an `h4`; a `heading-order` and a `page-has-heading-one` violation. Consider an `sr-only` `h1` and restyling the attribution.
3. **Fit view on a one-Step map.** A new Journey's canvas fits its single Start box at the maximum zoom, so below about 700 px the box fills the map with 40 px type (`local-375-dark-new-journey.png`; at 1280 it is merely large, `local-1280-light-new-journey.png`). Cap `fitView` at `maxZoom` 1.25 or so.
4. **Image bubble menu overlaps the previous line.** With an image selected in the Step panel, the "Edit image / Remove" toolbar sits over the paragraph above it.
5. **Settings "Copy link" for the Author page** carries the accessible name "Copy participant link" (the runner's control reused); rename per surface.
6. **Versions timestamps are in UTC** ("Sep 24, 2026, 6:38 PM UTC"); show the Author's local time, or at least the zone the browser is in.
7. **Accent colour default ignores the preset.** Ticking "Accent color" after choosing Dusk starts at Trail's `#095b41`; start from the chosen preset's accent.
8. **Empty-state copy in the panel.** The Step content editor and the Choice label textbox have no placeholder, so a first-time Author sees two blank boxes (ticket 57 covers the teaching copy; this is the placeholder pair).
9. **Public pages have no header.** The runner, the public Project page, and the Author page show only the Theme stripe and the footer, so a stranger has no "Journeys" link except in the footer. Deliberate for the runner; decide for the Project and Author pages.
10. **Deep link to `/j/<id>/step-N` without a Run** lands on the Start silently. Fine, but a one-line "Starting from the beginning" status would explain it.
11. **Sign-in copy** says "the terms of service and privacy policy below" without linking them; "below" means the footer.
12. **Link preview on staging** points `og:image` at the protected git-branch alias because `metadataBase` is `BETTER_AUTH_URL`. Production is correct; documented in 59. Consider `VERCEL_PROJECT_PRODUCTION_URL` as a fallback so branch deployments do not depend on the variable.
13. **Hero video in the desktop app's browser pane** autoplayed for about a second and paused (`play()` resumed it); headless Chromium and Playwright showed it playing. Probably the pane's media policy; watch once in real Chrome and Safari.
14. **Members refusal copy** "No account has that email — they need to sign up first" is correct but "sign up" is not a thing Journeys has; "sign in once" matches the guide.
15. **Deciding Prompt in Preview** shows "The judge picked "Go home" (100%) — a live run would have advanced." and then the Choices. Good, but the 100 % reads as a confidence the judge did not compute; consider dropping the number when the judge returns a single pick.

**No finding, recorded so nobody re-checks:** zero axe violations on every public page in four viewport/theme combinations; no horizontal scroll or clipped text at 375 px anywhere, including the 14 632 px tall Guide; console clean; drag-to-create, direction, fit, undo, redo, rich text with image and credit, quote and list, deciding Prompt (judge answered in 0.8–1.3 s and picked correctly three times), Theme preset and accent, publish, Preview, anonymous play in a fresh context, analytics with two Runs drawn, restore with its confirm dialog, Members refusal, Author page on/off, delete Journey and Project with confirms, all worked.

Acceptance criteria: triage each numbered item into its own ticket or a `wontfix` line here; nothing is implemented on this ticket.

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`.
