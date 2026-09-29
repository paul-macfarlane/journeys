# 93: Home, guide, and legal pages: stills, copy, and the footer

Status: done
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


## Comments

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/118 (chunk 11, this ticket alone).

- **Delivery:** the chunk branch `feat/chunk-11-public-pages-copy` and a second worktree for the footer. D1 and D3 ran in parallel, then D2 ran after D1.
  - **D1** (Sonnet, 1d1baa5): the recording script and the re-recorded `public/demo/`, plus the `themes` still and the hue probe in the guide spec.
  - **D2** (Opus, 7da497c): items 2, 3, 4, 5 and 7, and the landing, guide and legal-pages assertions.
  - **D3** (Sonnet, d037d69, cherry-picked as 39c5c9a): the `FooterLink` island and the `footer-current-page` test.
  - **Review fixes** (orchestrator, 0e59677): see the review below.
- **Why D3 ran in parallel:** it touched no file D1 or D2 touched. The cherry-pick applied cleanly, which confirms that. D2 waited for D1 because both edit `e2e/guide.spec.ts`, and they did.
- **Choices left open by the ticket:**
  - The home page and the guide say "one screen holding text and images".
  - `APP_TAGLINE` reads "Branching experiences of text and images you can write, publish, and share."
  - The terms say "Add only Authors you trust".
  - The `themes` still is the demo Journey's Start Step in the runner, in Dusk.
  - The guide's "Build it" stage carries `h4` sub-stages, so `ProsePage` gained an `h4` style.
- **AI review** (one reviewer, both axes). Nothing blocking. Resolved:
  - legal-pages evidence re-captured;
  - Dusk restored even if the context fails to open;
  - one readback in the hue probe;
  - the guide spec asserts item 2;
  - Settings in the account menu told apart from the Project and Journey Settings tabs;
  - lower-case "participants" on /about;
  - two stale comments.

  Declined: trimming the `SiteFooter` comment, which is accurate. Follow-ups outside this ticket: `README.md` still says "text-based journeys", and the Rich text feature card says "edited in place on the canvas".
- **Evidence:**
  - **DoD-1:** `test-results/dod-1-commands.txt` holds the chain at 0e59677:
    - `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` (744 passed)
    - the full `pnpm test:e2e`: 156 passed, 0 failed, 0 retries

| Criterion | Verdict | Test and evidence |
|---|---|---|
| Item 1, stills | PASS | `guide` (themes still served; hue probe: `prompt-light.png` under 5% purple, `themes-light.png` over 30%); `public/demo/` read by eye, with `run` and `prompt` in Trail and `themes` as the runner in Dusk in both schemes |
| Items 2–5 | PASS | `landing` (`test-results/landing/landing.png`), `guide` (`test-results/guide/guide.png`), `legal-pages` ("Two kinds of users") |
| Item 6, footer | PASS | `footer-current-page` (`test-results/footer-current-page/footer-current-page.png`) |
| Item 7, terms | PASS | `legal-pages` (discretion clause, "Last updated 28 September 2026") |

- **Still owed:** a staging smoke after Paul merges. Open `/`, `/guide`, `/privacy` and `/terms`, and check the stills, the footer's current link, and the new terms date.
- **State log:** `ready-for-agent` → `in-progress` → `ai-review` → `ready-for-human` → `done`. `done` is set in this commit and becomes true on `staging` when Paul merges.
