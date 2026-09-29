# 93: Home, guide, and legal pages: stills, copy, and the footer

Status: in-progress
Blocked by: 42, 78
Owner: atlas-implement (chunk 11)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** Paul read the home page (`/`), `/guide`, `/privacy`, and `/terms` on 2026-09-27 and sent nine notes. Eight of them are here. The ninth (looking at an older Version before restoring it) is ticket 94, and video in Steps is parked as ticket 95. The blocking edges are there because chunk 5 (42 public pages, 78 accessibility) changes the same files: `src/app/page.tsx`, the guide, the two legal pages, and the landing stills. Start from `staging` after chunk 5 merges.

Decisions Paul settled on 2026-09-27 (recorded here, not open):

- "Users" is the umbrella word for Authors and Participants together (`CONTEXT.md`, **User**, added with this ticket). It never replaces a role name.
- "Member" stays the term. The guide may gloss it once, as "the Authors you share a Project with". "Co-author" is not adopted.
- Video is out of scope here. The copy says what exists today: text and images.

## What "fixed" means

1. **Stills match the page, except for Themes** (notes 1 and 4). The Prompt card on the home page and the Prompt still in the guide show the demo Journey wearing its own Theme, Dusk (purple). That's because `scripts/record-landing-demo.ts` gives the Journey Dusk before it captures the Prompt still. Every runner still (`run`, `prompt`) should instead show the Project's Theme, Trail, which matches the site's own look, in each scheme. The `themes` still is the one place a different Theme appears. It should show the runner wearing Dusk, not the Settings tab it shows today. The guide's alt text for it already describes "A Journey in the runner with a Theme applied", so after this fix the alt text is true. Re-record with the script; stills are never captured by hand.
2. **"Text" doesn't undersell a Step** (note 2). The home page says "each step is one screen of text". Change it to say what a Step holds: text and images. Sweep the public copy (home, guide, about, the two legal pages, and page `description` metadata) for "text-based" and "screen of text", and keep a claim only where it is still accurate.
3. **"Choice" means only a Choice** (note 3). The guide's "Hide the panel … The choice is remembered in your browser" uses the domain word for something else. Reword it, for example "Your browser remembers whether the panel is hidden; it isn't saved on the Journey." Sweep the guide for any other generic "choice" or "choose" that could be read as a Choice.
4. **The guide follows an Author's lifecycle** (note 6). Reorder the "For Authors" section: sign in → create a Project → add Members → create a Journey → build it (the canvas, the Step panel, Prompts) → customise (Themes, Journey settings) → Preview → publish → share the link → edit after publishing (the Draft stays private, publishing again, restoring an earlier Version) → read Analytics and Responses → your Author page. "For Participants" and "Good to know" stay after it. The "On this page" list can name the lifecycle stages. Every claim still maps to a surface that exists.
5. **"Users", not "people"** (note 7). Privacy's "Two kinds of people" becomes "Two kinds of users". Sweep the public pages for "person" and "people" that mean Authors or Participants, and use "users" where both are meant or the role name where one is meant. A sentence about people in general, such as alt text "for people who cannot see it", stays.
6. **The footer marks the page you are on** (note 8). The footer's About, Guide, Privacy, and Terms links carry `aria-current="page"` on their own page. They also show a visible current state (foreground colour, not only an underline) in both schemes. `SiteFooter` is a server component with plain anchors on purpose (see its header comment), so either pass the current page in or add a small client island. It also renders inside the runner, where no link is current.
7. **Terms reserve the right to remove inappropriate content** (note 9). Add a clause to `/terms`: Journeys may remove any content, or suspend an account, that it judges inappropriate, at its discretion, even when no listed rule is broken. It will usually say why at the account's email address. Soften today's "We will tell you why" to match. Update the terms' date as "Changes to these terms" promises.

## Acceptance

- `e2e/landing.spec.ts` and `e2e/guide.spec.ts` assert the new copy for items 2–5 and a still per item 1 (the `prompt` still is not the Dusk one; the `themes` still is of the runner). One screenshot per spec, per `docs/agents/testing.md`.
- A footer check (in an existing public-page spec) asserts `aria-current="page"` on `/guide` and `/privacy`, and none in the runner.
- `/terms` contains the discretion clause and a new date.
