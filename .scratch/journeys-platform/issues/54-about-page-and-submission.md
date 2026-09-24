# 54: The splash page, the About page, and the hackathon submission paragraph

Status: ready-for-agent
Blocked by: 38
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: hackathon presentation (Paul, 2026-09-24, grilled the same evening): the form is due **10:00 ET on 2026-09-25** and Paul wants everything merged tonight. Order: Paul's domain change and production seed (see Comments) → 38 (recording plus stills) → **54** → 55 (guide, parallel to 54, first to cut) → 56 (regression pass) → Paul promotes `staging` → `main`, smokes production, submits the form → narrated video if time remains. 57 (in-app help) is post-hackathon.
Route: polish (new public pages with no stored data, no auth, no schema; `pnpm build` runs in the chain because new routes prerender)

**Why:** Paul, 2026-09-24: "I'd like to put some other hackathon specific tasks in the backlog, namely around presentation and sharing with judges. I want to make a splashy impression … there will be a google form to submit to judges and I believe we describe the app in a paragraph, so an airtight paragraph + a link to the site that goes more into detail about the app would be good. In general, hackathon agnostic, a more splashy page or a separate page about the history of the site and why it exists and what problems it solves and what features it offers would be great."

**What is true today (read on `staging` at `569320b`):**

- `src/app/page.tsx` is the landing page: the mark, the "Journeys" heading, a one-line tagline, two paragraphs of explanation, and one call to action (Sign in, or "Go to your projects" when signed in). No visuals, no feature list.
- There is no About, story, guide, or features page. Public content routes are `/`, `/sign-in`, `/privacy`, `/terms`, `/p/<projectId>`, `/j/...`, and `/authors/<userId>`. `SiteFooter` holds the wordmark, the repository link, and `LegalLinks`.
- `scripts/seed/journey-stories.ts` creates one `Journey Stories` Project with the fixed id `00000000-5eed-4000-8000-000000000001` and three Journeys (`…0011`, `…0012`, `…0013`) as Drafts only; publishing is done in the UI. The same ids exist on every environment that ran the seed, so a link to the Project needs no configuration. The three cases carry no Prompts, so the AI-decided Choice is not part of the anonymous demo.
- `/p/<projectId>` is public and anonymous: it lists the Project's Journeys that have a live Published Version and hides the rest.
- The OG image (`src/app/opengraph-image.tsx`, ticket 37) is inherited by every route without its own, so `/about` and `/guide` show it when pasted into the form or a chat.
- `README.md:213–214` still says every branch gets an ephemeral preview deployment, which contradicts the Ignored Build Step described two paragraphs later; the ticket PR (#63) fixed the line.
- The production domain is being changed tonight to `journeys.paul-macfarlane.com` (staging: `journeys-staging.paul-macfarlane.com`); steps are in Comments. No code references the domain (`BETTER_AUTH_URL` is an env var), so nothing in this ticket changes for it.

**Decisions (Paul, 2026-09-24, grilled):**

1. **Two pages.** `/` becomes the splash: hero, the canvas recording from 38, a six-card feature grid, "Play a Journey" and Sign in. `/about` tells the story. The form gets the root URL.
2. **Audience and voice.** Written for future Authors (educators, trainers, writers) first; judges read the same page. Product voice on `/`, first person from Paul on `/about`.
3. **The origin, on `/about`.** Named with Medha's permission: Paul's wife Medha, a family medicine doctor, wrote three branching cases for trauma-informed healthcare education so clinicians could feel what migrants go through before they ever reach a clinic. The cases were built in Twine and compiled to a static site (link journey-stories.netlify.app once); editing meant exporting JSON and redeploying; a journey's shape could only be seen by clicking through it; nothing recorded where participants went; only one person could practically author. The platform generalises it, and the three cases live on it as the demo. One sentence says it was rebuilt from the legacy site in September 2026, with no mention of how.
4. **No AI-tooling story on the pages.** Nothing about Claude Code, Atlas, or agents on `/` or `/about`; that lives in the judges' paragraph only (Paul: "normal users of the app need not know or care").
5. **The six feature cards** (the canvas is the video hero, not a card): immutable Published Versions with restore (05, 36); anonymous Runs with no account (06, 27); analytics drawn on the graph (10, 35); Prompts with an AI-decided Choice (12, 43, 49); Themes (11, 51); rich text with images and credits (30, 40). Members, Author pages, and link previews are one sentence on `/about`, not cards. If ticket 14 ships before this starts, AI authoring replaces Themes.
6. **Visuals come from 38's script.** Each card shows a still from `public/demo/<slug>-{light,dark}.png` written by `scripts/record-landing-demo.ts` (38's addendum names the six). No hand-captured screenshots anywhere on these pages.
7. **Play a Journey.** A button on the splash and a link on `/about` to `/p/00000000-5eed-4000-8000-000000000001`, labelled "Play a Journey — no account needed". The seed's Project id moves to a shared constant (`src/lib/demo.ts`, `SEED_PROJECT_ID`) that both the seed script and the pages import (`scripts/` may import `src/lib`). On an environment that never ran the seed the link 404s; that is accepted, and Paul seeds staging and production tonight. No demo account and no guided tour: authoring needs a Google or Discord sign-in, and `/guide` (ticket 55) is the help.
8. **Splash, moderate.** Large display type, the recording as the hero visual, the feature grid, and a single entrance fade that respects `prefers-reduced-motion`. The Trail palette and existing type; no new dependency; the authoring UI stays un-themed (round-4 ruling).
9. **Links.** `SiteFooter` gains About and Guide beside the repository link (55 adds the Guide page; 54 adds both footer links so 55 does not touch the footer). The splash links `/about` in the story teaser and `/guide` under the feature grid. Signed-in visitors still see "Go to your projects".
10. **The paragraph set** is in Comments below, approved by Paul at grilling: a tagline, a 50-word and a 120-word description, and three "look at this first" bullets. Nothing from it is published on the site.

**What to build:**

- `src/lib/demo.ts` exporting `SEED_PROJECT_ID` (and the three Journey ids), with `scripts/seed/journey-stories.ts` importing it.
- `src/app/page.tsx` rewritten as the splash per decisions 1, 5–9, keeping the current session branch. Keep the 38 `<video>` block (poster, reduced-motion fallback, per-theme sources) as the hero.
- `src/app/about/page.tsx` with `metadata` (title "About Journeys", a description) telling the story per decision 3, the feature sentence for Members/Author pages/link previews, the legacy link, and the Play link. Prose width, no cards.
- `SiteFooter` links to `/about` and `/guide`.
- Specs: `landing` asserts the hero video, the six feature headings, the Play link's href, and the About and Guide links; a new `about` spec asserts the heading, Medha's paragraph, the legacy link, and the Play link, each with screenshot evidence in both themes and at 375 px.

Acceptance criteria:

- [ ] `/` shows the recording, six feature cards with stills, "Play a Journey — no account needed" linking the seed Project, links to `/about` and `/guide`, and the sign-in or projects call to action; it renders for an anonymous visitor in both themes and at phone width.
- [ ] `/about` renders the story per decision 3 in Paul's voice, names Medha and her purpose, links the legacy site and the seed Project, and mentions no AI tooling.
- [ ] Both pages are linked from the footer.
- [ ] Paul has approved the paragraph set in Comments (done at grilling; re-approve only if the copy changes).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and one full `pnpm test:e2e` pass at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): one `dod-1-commands.txt` plus the `landing` and `about` screenshot directories, run with `E2E_EVIDENCE=landing,about`. Never include participant Responses or real run data (the stills and recording use the seed Project only). Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`; user story 6a still holds (the root explains Journeys and offers sign-in), so no amendment. Origin: Paul, 2026-09-24.

## Comments

### 2026-09-24 — grilled with Claude (Fable 5.1); decisions above

**Paragraph set (approved by Paul). Replace the URL if the domain changes.**

Tagline (one line):

> Branching, text-based journeys you write, publish, and share.

Short (about 50 words):

> Journeys is a platform for authoring branching, text-based experiences. Authors build a graph of steps and choices on a visual canvas, publish an immutable version, and share a link. Participants walk it anonymously, no account needed. Analytics are drawn onto the graph, and a step can ask a question that an AI reads to choose the path. https://journeys.paul-macfarlane.com

Long (about 120 words):

> Journeys is a platform for authoring and running branching, text-based experiences. It began as three hand-built interactive cases my wife Medha, a family medicine doctor, wrote for trauma-informed healthcare education: clinicians walk in a migrant's shoes before ever meeting them in a clinic. Those cases could only be edited by exporting JSON and redeploying, and nobody could see where participants went. Journeys generalises them: authors build a graph of steps and choices on a visual canvas with auto-layout and undo, publish immutable versions, theme the experience, and share a link that participants walk anonymously. Analytics are drawn on the graph itself, and a step can pose a question that an AI reads to decide the next step. It was built in one week with Claude Code and the Atlas plugin: specs grilled into tickets, each delivered as a reviewed pull request with end-to-end evidence. Play the original cases at https://journeys.paul-macfarlane.com

Look at this first (if the form has a notes field):

> - Play a case anonymously from the home page, then open the same Journey's analytics as an Author to see the paths drawn on the graph.
> - Open a Draft on the canvas: drag a choice onto empty space to create a step, switch the layout direction, undo it.
> - Add a Prompt to a step and let the AI decide the Choice from a free-text response.

**Domain change (Paul, Vercel dashboard, before the seed):** add `journeys.paul-macfarlane.com` (Production, `main`) and `journeys-staging.paul-macfarlane.com` (`staging`) under Project → Settings → Domains; Vercel manages the `paul-macfarlane.com` zone, so the records are created for you. Set `BETTER_AUTH_URL` per environment to the new origin. Add `<origin>/api/auth/callback/google` and `/api/auth/callback/discord` to the Google and Discord OAuth clients. Redeploy both branches. Mark the new production domain primary so the old `journeys-ten-virid.vercel.app` redirects. Sign in once on each domain.

**Production and staging seed (Paul's terminal; the URL is a secret, never in chat or in `.env.local`):**

```
DATABASE_URL='<neon url>' pnpm seed:journey-stories pauljosephmacfarlane@gmail.com
```

Then sign in, open the Journey Stories Project, publish Case 1, 2, and 3 from each Journey's Versions tab, and open `/p/00000000-5eed-4000-8000-000000000001` in a private window to confirm anonymous play. Repeat for staging so 56 can exercise the Play link.

**Tonight's runbook:**

| Order | Who | What |
|---|---|---|
| 0 | Paul | Domain change, then the seed and publish on production and staging |
| 1 | thread | `/implement .scratch/journeys-platform/issues/38-landing-demo-recording.md` (reads its 2026-09-24 addendum for the stills) |
| 2 | thread | `/implement .scratch/journeys-platform/issues/54-about-page-and-submission.md` after 38 merges |
| 3 | thread | `/implement .scratch/journeys-platform/issues/55-user-guide.md` in a worktree, parallel to 54; first to cut |
| 4 | thread | `/implement .scratch/journeys-platform/issues/56-staging-regression-pass.md` after 54 and 55 merge; Paul signs in inside the browser pane himself |
| 5 | Paul | Promote `staging` → `main`, smoke production (sign in, create, publish, anonymous play, AI Choice), submit the form with the long paragraph and the root URL |
| 6 | Paul | Narrated 2–3 minute walkthrough, only if time remains |
