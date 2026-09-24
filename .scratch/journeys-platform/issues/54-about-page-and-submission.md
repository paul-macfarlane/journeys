# 54: The About page and the hackathon submission paragraph

Status: needs-info
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: hackathon presentation (Paul, 2026-09-24): to be grilled on 2026-09-25, the day of the hackathon share, alongside any last round of feedback. The About page is not hackathon-specific and stays useful afterwards. The submission paragraph is only for the hackathon. Ticket 38 (the landing recording) was held until 2026-09-25 so it can land after this is grilled. The two tickets overlap: see "Relation to 38" below.
Route: polish (proposed; the grilling confirms it)

**Why:** Paul, 2026-09-24: "I'd like to put some other hackathon specific tasks in the backlog, namely around presentation and sharing with judges. I want to make a splashy impression … there will be a google form to submit to judges and I believe we describe the app in a paragraph, so an airtight paragraph + a link to the site that goes more into detail about the app would be good. In general, hackathon agnostic, a more splashy page or a separate page about the history of the site and why it exists and what problems it solves and what features it offers would be great."

**What is true today (read on `staging` at `2ff8633`):**

- `src/app/page.tsx` is the landing page. It has the mark, the "Journeys" heading, a one-line tagline, two paragraphs explaining Projects, Journeys, Steps, Choices, and immutable publishing, and one call to action (Sign in, or "Go to your projects" when signed in). It shows no screenshots, no example Journey, and no feature list. Its comment says it lists no Projects or Journeys because discovery is link-only.
- There is no About, story, or features page. The only public content routes are `/`, `/sign-in`, `/privacy`, `/terms`, `/p/<projectId>`, `/j/...`, and `/authors/<userId>` (ticket 52). `SiteFooter` holds the wordmark, the repository link, and `LegalLinks`.
- The history is written down in the spec's Problem Statement. The legacy site is three hand-built branching stories about migrant healthcare, compiled from Twine to a static Astro site and still live, untouched, at journey-stories.netlify.app. Editing it meant editing exported JSON and redeploying. A journey's shape (36 to 64 Steps, 6 to 9 Endings) could only be seen by clicking through it. Nothing recorded where participants went. Only one person could practically author, and the site was tied to one subject. The platform generalises it, and the three cases are seeded into it (`pnpm seed:journey-stories`).
- What the site can show off, with the ticket that built each: the canvas with auto-layout and direction (09, 16, 21, 22, 25, 48); undo and redo (23); immutable Published Versions, Preview, and restore (05, 36); anonymous Runs with no account (06, 27); analytics drawn on the graph (10, 35); Prompts and Responses (12); a Choice decided by AI from a Response through the Vercel AI Gateway (43, 49); Themes (11, 51); rich text with images and credits (30, 40); Members (13); Author pages (52); link previews (37). AI authoring (14) is being tried as a spike in a separate thread and may or may not ship.
- The OG image (`src/app/opengraph-image.tsx`, ticket 37) is what the judges' form or chat app shows when the link is pasted.

**Deliverables (the grilling settles the shape of each):**

1. **The submission paragraph.** One paragraph, written for a judge reading a Google Form: the problem, what Journeys does about it, the one or two things that set it apart, and the link. It goes in this ticket's `## Comments` as the approved text for Paul to paste. It is not published anywhere. Paul submits the form himself.
2. **The About page.** A public page, linked from the landing page and the footer. It tells the history (the legacy site, what went wrong, why a platform), the problems it solves and for whom, and the features, with visuals of the real product. It is the link in the paragraph.
3. **Supporting changes it may need.** The landing page's link to it, the footer link, its OG image and metadata, and a demo Journey a judge can play in one click.

**Open questions for the grilling (Paul, 2026-09-25):**

- **Where the detail lives.** A separate `/about` page, a longer landing page, or both (a splashier landing page that links to `/about` for the story)? Which URL goes in the form?
- **Audience and tone.** Hackathon judges first, or future Authors (educators, trainers, writers)? How much of the migrant-healthcare origin is told, and in whose voice (first person from Paul, or product voice)? Does it name the people who wrote the original cases?
- **The story.** Which beats, in what order: the legacy site, the pain, the rewrite in a week, what it is now? Does it say it was built with AI agents (Claude Code and Atlas), and if so how prominently?
- **Features.** Which five or six to show, and in what form: screenshots, short clips reused from 38's script, or live embeds? Screenshots made by a committed script like 38's, so they can be redone after UI changes?
- **A playable example.** Should the page link a public Project or Journey (a seeded Journey Story on production) so a judge can play one without signing in? Which one, and is it already published on production? Judges cannot author without a Google or Discord sign-in. Is that acceptable, or do they need a demo account or a guided tour?
- **Splash.** How far past the current quiet Trail brand does it go (motion, a hero, large type)? The authoring UI stays un-themed (round-4 ruling).
- **Relation to 38.** Does the recording go on the landing page as 38 says, on the About page, or both? Should 38's script also produce the About page's clips and stills?
- **Production.** The judges will open production (`main`), so the work needs a `staging` → `main` promotion before the form is submitted. What time is the deadline on 2026-09-25?
- **The paragraph's limits.** Is there a word or character limit, and is it one field or several (name, tagline, description, link)?

**Acceptance criteria:** completed after the grilling. Expected shape: the page renders for an anonymous visitor in both themes and at phone width, it is linked from the landing page and the footer, a `landing`/`about` spec asserts it with screenshot evidence, and Paul approves the paragraph in this ticket.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification"). Never include participant Responses or real run data in screenshots or clips; use seeded content only. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md` (the grilling decides whether user story 6a needs an amendment). Origin: Paul, 2026-09-24.

## Comments
