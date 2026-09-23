# Journeys platform — MVP spec

Status: ready-for-agent
Source: `decisions.md` (2026-09-18 grill, confirmed by Paul). Vocabulary: `/CONTEXT.md`.
Timebox: hackathon, 2026-09-18 → 2026-09-25. Scope is prioritized, not capped (see Further Notes).

## Problem Statement

The current Journey site is three hand-built branching stories compiled from Twine into a static Astro site. Anyone who wants to add, edit, or reorder a step has to edit exported JSON and redeploy. There is no way to see the shape of a journey — 36 to 64 steps with 6 to 9 endings — except by clicking through it. Nothing records how participants move through a journey or which endings they reach, so the people who wrote the stories cannot tell whether they work. Only one person can practically author, and the product is welded to one subject (migrant healthcare) even though the same mechanic — read a step, make a choice, live with the consequence — is useful far beyond it.

## Solution

A platform where signed-in Authors build Journeys as a visible graph of Steps and Choices, publish immutable versions to a stable public URL, and watch anonymous Participants' Runs accumulate into analytics drawn directly on that graph. Journeys live in Projects that Members share; each Project has a public page listing its published Journeys, and that page or a Journey's own URL is how participants arrive — discovery is link-only. Real content from the legacy site is seeded in so the platform is demonstrated on a journey people already know, not a toy.

## User Stories

### Authentication and projects

1. As an Author, I want to sign in with Google or Discord, so that I do not have to manage another password.
2. As an Author, I want to create a Project with a name, so that I have a place to group related Journeys.
3. As an Author, I want to see a list of the Projects I am a Member of, so that I can find my work.
4. As an Author, I want to rename a Project, so that its name can evolve with its content.
5. As a Member, I want to delete a Project I belong to, so that abandoned work does not clutter the list.
6. As a Participant, I want to open a published Journey without creating an account, so that nothing stands between me and the story.
6a. As a visitor, I want the site root to explain what Journeys is and offer sign-in for Authors, so that a trimmed URL never looks broken.
6b. As an Author, I want to give a Project a URL slug and a rich-text description (e.g. context, learning objectives, references), so that it can be presented to participants as a set.
6c. As a Participant, I want to open a Project's public page and see its published Journeys listed, so that I can find "all three cases" from one link.
6d. As a Participant, I want unpublished or never-published Journeys to be absent from the Project page, so that I only see what is ready.

### Journeys and drafts

7. As an Author, I want to create a Journey inside a Project with a title and URL slug, so that it has an identity before it has content.
8. As an Author, I want to see all Journeys in a Project with their publish state (never published / published / unpublished), so that I know what participants can currently reach.
9. As an Author, I want a new Journey to come with a single Start step already in place, so that I am never staring at an empty graph.
10. As an Author, I want every edit to go to the Draft and never to the live Published Version, so that I can work in progress without breaking what participants see.
11. As an Author, I want my Draft saved as I work, so that I never lose edits.
12. As an Author, I want to rename a Journey or change its slug before first publish, so that I can fix early mistakes.
12a. As an Author, I want to give a Journey a short description (e.g. "Goal: Cross the border."), so that the Project page and the runner's start screen can say what it is about.
12b. As a Member, I want to delete a Journey after a confirmation, so that abandoned or duplicate journeys go away; its Runs and Responses go with it.

### Steps and content

13. As an Author, I want to add a Step, so that the journey grows.
14. As an Author, I want to give a Step a title and rich-text content with headings, bold, italic, lists, and links, so that the writing reads like a story, not a form.
15. As an Author, I want to add an image to a Step by pasting a URL, so that a step can carry a photo without an upload pipeline.
16. As an Author, I want every image to require a credit line, so that Creative Commons attribution is never forgotten.
17. As an Author, I want to delete a Step, and see which Choices pointed at it become broken, so that deletion is safe and visible.
18. As an Author, I want to edit content with a WYSIWYG editor and never see Markdown or HTML, so that non-technical authors can use it.

### Choices and graph structure

19. As an Author, I want to add a Choice to a Step with label text and a target Step, so that participants have somewhere to go.
20. As an Author, I want to create the target Step in the same action as the Choice, so that building a branch is one motion.
21. As an Author, I want to reorder Choices on a Step, so that the most natural option reads first.
22. As an Author, I want to change which Step a Choice points to, so that I can restructure without deleting.
23. As an Author, I want a Step with zero Choices to be treated as an Ending, so that endings are structural, not a separate thing I configure.
24. As an Author, I want to designate which Step is the Start, so that the journey has one unambiguous beginning.

### Outcomes

25. As an Author, I want to define Outcomes for a Journey as short free-text labels (e.g. "Reached care", "Death", "Deported"), so that endings can be grouped by meaning.
26. ~~As an Author, I want every Ending to require exactly one Outcome, so that analytics can always say what happened.~~ _Withdrawn by ticket 24 (2026-09-22); see the `[SCOPE CHANGE]` below._
27. As an Author, I want to rename an Outcome without losing its history, so that wording can improve after runs exist.
28. As an Author, I want to see how many Endings map to each Outcome, so that I notice an Outcome nothing reaches.

### Visual editor (canvas)

29. As an Author, I want to see the whole Journey as a graph of Steps connected by Choices, so that I can understand its shape at a glance.
30. As an Author, I want the graph laid out automatically, so that I never arrange boxes by hand.
31. As an Author, I want to click a Step on the canvas and edit it in a side panel, so that navigating and editing are the same gesture.
32. As an Author, I want the Start visually distinct and Endings visually distinct, colored by Outcome, so that structure is readable without reading text.
33. As an Author, I want validation problems highlighted on the canvas (unreachable Steps, broken Choices, Choices with no label), so that I fix problems where they are.
34. As an Author, I want to pan and zoom a 60-step graph and still find things, so that real-sized journeys stay usable.
35. As an Author, I want to add a Step from the canvas, so that I do not have to leave the map to grow it.

### Validation, preview, and publishing

36. As an Author, I want to run validation on demand and see a list of problems, so that I know what blocks publishing.
37. As an Author, I want validation to check: exactly one Start; every Choice targets an existing Step; every Choice has a label (amended 2026-09-22 by ticket 20; see the `[SCOPE CHANGE]` below); every Step is reachable from Start; so that a published journey can never dead-end unexpectedly.
38. As an Author, I want to Preview the Draft exactly as a Participant would see it, so that I can test before publishing.
39. As an Author, I want Preview to record no Run, so that my testing does not pollute analytics.
40. As an Author, I want to Publish, and have publishing refuse if validation fails, so that the live journey is always coherent.
41. As an Author, I want Publish to create an immutable Published Version and make it the one live version, so that participants see a consistent whole.
42. As an Author, I want continued Draft edits after publishing to leave the live version untouched, so that I can iterate safely.
43. As an Author, I want to Unpublish a Journey so that its public URL shows an "unavailable" page, so that I can take content down.
44. As an Author, I want a list of Published Versions with publish time and version number, so that I can see the history.
45. As an Author, I want to restore an older Published Version as a new Draft, so that I can undo a bad direction.

### Participant runner

46. As a Participant, I want to open a Journey at a stable short URL, so that it can be shared or put on a QR code.
46a. As a Participant, I want a start screen showing the Journey's title and description before the first Step, so that I know what I am about to do.
47. As a Participant, I want to read a Step and see its Choices as clear buttons, so that the experience is simple.
48. As a Participant, I want the runner to be readable on a phone, so that it works in a classroom or waiting room.
49. As a Participant, I want to reach an Ending and clearly see that the journey is over, so that the consequence lands.
50. As a Participant, I want a way to start over from an Ending, so that I can explore a different path.
50a. As a Participant, I want to go back to the previous Step and choose differently, so that I am not locked into a mis-tap.
50b. As a Participant, I want the browser back button and an in-app Back control to behave the same, so that navigation feels native.
50c. As a Participant, I want a refresh to return me to my current Step, so that I do not lose my place.
51. As a Participant, I want my Run to stay on the version I started, even if the Author publishes mid-run, so that the story does not change under me.
52. As a Participant, I want a Journey that has been unpublished to tell me plainly that it is unavailable, so that I am not confused by an error.
53. As a Participant, I want to be anonymous, so that I can engage honestly with difficult content.

### Prompts and responses

54. As an Author, I want to attach an optional free-text Prompt to a Step, so that I can ask participants to reflect at a moment that matters.
55. As an Author, I want to mark a Prompt required or optional, so that I can decide whether reflection gates progress.
56. As a Participant, I want to answer a Prompt in a text box before choosing, so that I can record my reaction.
57. As a Participant, I want to skip an optional Prompt, so that I am not forced to write.
58. As an Author, I want to read all Responses to a Prompt in a plain list, so that I learn what participants felt at that step.
59. As an Author, I want a notice reminding me that Responses are anonymous and should not ask for identifying information, so that I do not collect what I should not.
60. As a Participant, I want my Responses never shown to other participants, so that I can be candid.

### Analytics

61. As an Author, I want to see, on the canvas, the percentage of participants who took each Choice, so that I know which decisions people make.
62. As an Author, I want to see, on each Ending, how many Runs reached it, so that I see where journeys actually end.
63. As an Author, I want to see which Steps participants abandon on, so that I can find where the story loses them.
64. As an Author, I want a chart of Runs by Outcome, so that I can say "40% of participants died" instead of "ending #25 was reached 40 times".
65. As an Author, I want analytics scoped to one Published Version at a time, so that edits do not muddy historical numbers.
66. As an Author, I want counts of Runs started and completed, so that I have the basic denominator.
66a. As a Member, I want analytics and Responses visible only to the Project's Members, so that participant data is not public.

### Members

67. As a Member, I want to add another Author to my Project by their account email, so that we can collaborate.
68. As a Member, I want to see who else is a Member of a Project, so that I know who can edit.
69. As a Member, I want to remove a Member, so that access can be revoked.
70. As a Member, I want all Members to have equal ability, so that collaboration has no permission friction.
70a. As a Member, I want the system to refuse removing the last Member, so that a Project can never be orphaned.

### Themes

71. As an Author, I want to pick a Theme for a Project from a small set of curated presets, so that the runner looks intentional without design work.
72. As an Author, I want to set an optional accent color on top of the preset, so that a project can carry a signature color.
73. As an Author, I want a Journey to override its Project's Theme, so that one journey in a set can feel different.
74. As a Participant, I want the Theme applied to the runner, so that the story has a mood.
75. As an Author, I want the authoring UI unaffected by Themes, so that the editor stays consistent.

### AI authoring

76. As an Author, I want to describe a Journey in a paragraph and receive a generated Draft of Steps, Choices, and Outcomes, so that I start from something instead of nothing.
77. As an Author, I want the generated Draft to appear on the canvas for review before anything is published, so that AI proposes and I decide.
78. As an Author, I want generation to respect the graph contract (one Start, endings with Outcomes, resolvable Choices), so that generated drafts are publishable with edits.
79. As an Author, I want to ask AI to rewrite one Step's text with an instruction (e.g. "more urgent"), so that I can polish without retyping.
80. As an Author, I want AI never to touch a Published Version, so that participants are never exposed to unreviewed content.
80a. As an Author, I want AI features simply hidden when the platform has no AI key configured, so that a missing key is never an error I see.

### Seeded content

81. As an Author, I want the platform pre-loaded with at least one real legacy journey (case-3, 36 steps), so that the demo is credible.
82. As an Author, I want seeded content to carry its images and credit lines, so that it is not visibly poorer than the legacy site.

## Implementation Decisions

### Stack (confirmed team policy)

Next.js 16 App Router, React 19, TypeScript, pnpm. Drizzle ORM on Neon Postgres in deployed environments and on a docker-compose Postgres locally. better-auth with Google and Discord, both always enabled. Tailwind v4 with shadcn, zod 4, react-hook-form, TanStack Query, next-themes. Vercel AI SDK for AI features. Vitest and Playwright. Deployed on Vercel: Production from `main`, a long-lived `staging` branch with a stable domain, and ephemeral preview deployments for every other branch. The Vercel Preview environment carries a full set of env values (`human-prerequisites.md` §9) so every preview build passes env validation; the Preview environment's OAuth callbacks and `BETTER_AUTH_URL` point at the staging domain, so sign-in is expected to work on staging and production but not on ephemeral PR previews. Project layout, lint, format, and hook conventions mirror `paul-macfarlane/paulitakes`. The canvas uses React Flow (`@xyflow/react`, MIT) with `@dagrejs/dagre` auto-layout (the maintained fork, not the unmaintained `dagre` package). Rich text uses Tiptap.

### Domain model

- **Project** has a title, a globally unique slug (auto-generated from the title, editable), a rich-text description (Tiptap JSON, same allowed node set as Steps), and many **Members** (user references). Membership is flat; every Member can do everything. A `role` column exists, defaults to `member`, and is never read in MVP.
- **Journey** belongs to one Project; has title, a short plain-text description, slug (globally unique, auto-generated from the title, editable until first publish and frozen afterward), a Draft, an optional pointer to the live Published Version, and a publish state derivable from that pointer.
- **Draft** and **Published Version** each store the graph as **one validated JSON document** (see Graph document). The Draft is mutable; Published Versions are immutable rows with a version number, publish timestamp, and the publishing Member (`publishedBy`). A Journey has at most one live version at a time; earlier versions are retained, never publicly reachable, and used for Run pinning and restore.
- **Outcome** is journey-scoped, with a stable id and a free-text label. Outcomes live in the graph document so a Published Version carries the outcome labels as they were at publish time; analytics group by outcome id.
- **Run** is pinned to one Published Version and stores an ordered array of step ids (the path — the participant's current route from Start, one entry per visit, see Back navigation), a count of backtracks, started-at, optional ended-at, and optional outcome id. There is **no event table**; every metric is computed from paths. A pseudonymous participant id from a cookie is stored so repeat starts can be distinguished from distinct participants, but it is never linked to any account.
- **Response** is stored in its own table keyed by Run and step id, holding the free-text answer.
- **Theme** is a preset id plus an optional accent color, stored on Project with an optional override on Journey. A nullable custom-tokens JSON column is reserved and unused.

### Graph document

The graph document is the contract everything else depends on (priority 2). It contains: a schema version; the Start step id; a map of Steps by stable id, each with title, Tiptap-JSON content, ordered Choices, and an optional Prompt; a map of Outcomes by stable id; and for Endings (steps with no Choices) an outcome id. Each Choice has a stable id, label, and target step id, plus reserved nullable `condition` and `effect` fields that nothing reads. Each Prompt has a `type` discriminator that accepts only `free_text` in MVP, a label, and a required flag. Step positions on the canvas are not stored; nullable position fields are reserved for a future manual-layout mode.

The document is validated with a zod schema at every write and again at publish. Publish-time validation additionally enforces: exactly one Start; every Choice target exists; every Choice has a label (amended 2026-09-22 by ticket 20; see the `[SCOPE CHANGE]` below); every Step is reachable from Start; an Ending that carries an Outcome names one the document defines (amended 2026-09-22 by ticket 24; see the `[SCOPE CHANGE]` below). Cycles are allowed (amended 2026-09-21; see the `[SCOPE CHANGE]` below and ADR-0002). Validation returns a structured list of problems with step or choice ids so the canvas can highlight them.

Content is stored as Tiptap JSON and rendered to sanitized HTML on the server with Tiptap's renderer. The allowed node and mark set is fixed: paragraph, headings, bold, italic, bullet and ordered lists, links, and an image node whose attributes are a URL and a required `credit` (amended 2026-09-22 by ticket 30: `caption` and `alt`; amended 2026-09-23 by ticket 40: underline, strike, blockquote, and `hardBreak`; see the `[SCOPE CHANGE]` below). Link `href` and image `src` values must be absolute `http:` or `https:` URLs; anything else (including `javascript:` and `data:`) is stripped, and rendered links carry `rel="noopener noreferrer"`. Sanitization runs on the server at every write, not only in the editor, so a document submitted straight to the API is held to the same rules. Nothing is round-tripped through Markdown.

### Deletion

Deleting a Journey or a Project is a hard delete after an explicit confirmation; it cascades to Drafts, Published Versions, Runs, and Responses. There is no soft delete, archive, or undo in MVP. A Project cannot lose its last Member.

### Publishing

Publish = validate the Draft → refuse with problems, or copy the document into a new Published Version row with the next version number → point the Journey's live pointer at it. Unpublish clears the live pointer; the version row remains. Restore copies a chosen Published Version's document into the Draft, replacing it. Preview is Member-only; it renders the Draft through the same runner components but never creates a Run or stores a Response.

### Public pages and discovery

The site root is a static landing page describing the product with an Author sign-in; it lists nothing. Each Project has a public page at `/p/{project-slug}` rendering its description and its currently published Journeys (live pointer set), in the Project's Theme. There is no search, index, or cross-project browsing: discovery is link-only, via a Project URL, a Journey URL, or a QR code the Author generates from either. Publishing a Journey is what makes it public and listed; there is no separate visibility flag.

### Public URL and runner

Participants use `/j/{journey-slug}`. The runner resolves the slug to the live Published Version at Run start and pins the Run to that version id; all subsequent steps read from the pinned version, not the live pointer. An unpublished slug renders an "unavailable" page. The runner opens on the Start Step itself — the Journey's title in a header on every screen, the description beneath it on the Start Step only — and the Run is created when the Participant takes their first Choice, never on page load (amended 2026-09-22 by ticket 27; see the `[SCOPE CHANGE]` below). Each step has its own URL, `/j/{slug}/{step-id}`, so the browser back button works; an in-app Back control does the same thing. The Run id is an unguessable random id — it is the only credential that can write to a Run — and lives in a cookie scoped to the journey slug, so refresh resumes at the current step and two journeys open in one browser do not clobber each other. A step URL opened without a Run cookie for that journey redirects to `/j/{slug}` (the start screen).

**Back navigation.** Participants may go back and choose differently. The Run's path keeps every visit, repeats included; "current" is the Run's last entry. A navigation to a Step is resolved in order: first as a Choice of the current Step (forward: append the target, even when it closes a loop); then as a backtrack to that Step's latest occurrence on the path (truncate to it and count a backtrack); then as ticket 06's rule for a Choice offered by an earlier Step on the path; otherwise it is refused. Browser Back on a loop-closing Step — where the target is both the previous entry and a Choice of the current Step — is told apart from taking the Choice by a path index the runner stores in the page's history state and sends back with the navigation (amended 2026-09-21; see the `[SCOPE CHANGE]` below and ADR-0002). The path is capped at 500 entries; a forward move past the cap is refused with a short notice. Reaching an Ending sets ended-at and outcome id; going back from an Ending clears them. Analytics therefore describe where participants ended up, not every detour; the backtrack count is stored for future use but not surfaced in MVP. A per-journey `allow_back` setting is reserved in the graph document (default true, not exposed in the UI); when it is later exposed and set to false, the runner hides Back and refuses truncation, so authors can lock participants into consequences.

A Run whose last step is not an Ending and has no ended-at is an abandonment for analytics purposes.

### Analytics

All analytics are computed per Published Version from Run paths: choice take-rate (runs whose path contains step A followed by step B, over runs that visited A), ending counts, outcome distribution, abandonment per step (runs whose path ends at that step without ended-at), starts, and completions. The canvas overlay reuses the same graph rendering as the editor with numbers on edges and nodes. Responses are listed per step with no participant identifiers.

_Amended by ticket 10 (2026-09-22), following ticket 18's cycles: a path may visit a Step more than once, so a Choice's take-rate is its traversals (each consecutive pair of path entries that is that Choice) over every visit to its Step, not over Runs — a Step's Choices and the Runs that stop on it then account for its visits exactly once. Completion and abandonment are read off the path alone (a Run is completed when its last entry is an Ending of the version's document), which is equivalent to `ended_at` under ADR-0002 and keeps the map and the totals from ever disagreeing. Two Choices of one Step to the same Step cannot be told apart in a path and share the pair's number._

### Members and auth

Authors authenticate via better-auth. Any signed-in user can create a Project and becomes its first Member. A Member adds another by the email of an existing account; there are no invitation emails or pending states. Draft edits are last-write-wins with no locking.

### Canvas

Auto-layout only via dagre; the canvas is a navigable map, not a drawing surface. Selecting a node opens a side panel that edits title, content, Prompt, Outcome (for Endings), and Choices; adding a Choice in the panel creates the edge. Adding a target Step from a Choice creates the node. Validation problems and analytics numbers are both rendered as decorations on the same graph.

### AI

Provider: Anthropic Claude via the Vercel AI SDK's Anthropic provider, model `claude-opus-5` with adaptive thinking, using structured output. Anthropic structured outputs do not accept dictionary-shaped (`additionalProperties`) or recursive schemas, so the AI-facing schema is an array-shaped projection of the graph document (Steps and Outcomes as arrays with explicit ids, content as a restricted block list) derived in code next to the canonical zod schema so the two cannot drift; the model's output is mapped into a graph document and validated with the canonical schema before it touches the Draft. The API key is an environment variable populated out of band; agents never read live secret files. When the key is absent the AI entry points are hidden and every other feature works unchanged.

Authoring generates a full graph document from a prompt through that projection, writes it into the Draft (replacing an empty Draft or, if non-empty, after confirmation), and returns the author to the canvas. Step rewrite generates replacement Tiptap-JSON content for one step from an instruction and the current content. Neither operation can read or write a Published Version.

### Seeding

A throwaway scraper reads the live legacy site's prerendered step pages for case-3, converts them into a graph document (step titles, content with images and credits, choices, endings), assigns Outcomes by hand-written mapping, validates, and inserts the Journey as a Draft in a seed Project. The script takes an Author email argument (Paul's account for now) and requires that account to already exist: Paul signs in once with Google or Discord before seeding (`human-prerequisites.md` §10), so better-auth owns the user row and OAuth account linking is never at risk. If no user has that email the script exits with a clear message and writes nothing. It is idempotent so it can be rerun. Legacy step links omit the trailing slash and the host redirects to `/N/`, so the scraper must follow redirects. Seeded images hotlink the legacy site's URLs; acceptable because that site stays live, but fragile and noted as such. It is a development script, not a product feature.

### Reserved-for-future columns and fields

Documented so nobody removes them: `member.role`; `choice.condition` and `choice.effect`; `prompt.type` accepting only `free_text`; nullable step position fields; nullable custom theme tokens.

## Testing Decisions

A good test exercises behavior a user or author would observe and never asserts on internal structure, storage layout, or component internals. Two seams, agreed with the owner:

**Seam A — the graph domain module (Vitest, pure).** Everything that can silently corrupt content is a pure function over the graph document and Run paths, and is tested without a database:

- Validation: each rule independently (multiple Starts, missing Start, dangling Choice target, empty or whitespace-only Choice label, unreachable Step, Ending without Outcome accepted, Outcome id not defined) and a document with a loop is accepted, and the success case on a hand-authored 40+ step fixture; once the seeded case-3 document exists it is added as a second success case.
- Runner transition: given a version document, a current step, and a Choice id, the next step is the Choice's target; an invalid Choice id is rejected; reaching an Ending yields its Outcome.
- Analytics aggregation: given a set of Run paths, choice take-rates, ending counts, outcome distribution, abandonment per step, starts, and completions match hand-computed expectations, including edge cases (zero runs, all abandoned, runs pinned to a different version excluded).
- Content sanitization: disallowed nodes and marks are stripped; image nodes without a credit are rejected; `javascript:` and other non-http(s) link and image URLs are stripped.
- AI schema projection: a graph document round-trips through the AI-facing projection and back, and the mapped result validates against the canonical schema.

**Seam B — the demo path (Playwright, browser).** Authentication in e2e never drives OAuth. Following the pattern already used in `picksleagues` (and, in a simpler form, `paulitakes`): a helper mints a real better-auth session through better-auth's own internal adapter (create user, create session), signs the session token the way better-auth does (standard-alphabet base64 HMAC-SHA256 of the token with `BETTER_AUTH_SECRET`, percent-encoded, cookie name `better-auth.session_token`), and adds that cookie to the Playwright browser context. Tests run against a dedicated e2e database created and migrated in Playwright's global setup. Playwright starts its own server on a dedicated port with `reuseExistingServer` off (never against a running `pnpm dev`), and `webServer.env` overrides `DATABASE_URL` to the e2e database and `BETTER_AUTH_URL` to the e2e server so better-auth's origin check passes; global setup asserts and logs the database name in use, so a run against the dev database cannot be mistaken for a pass. No test-only auth provider, no mock identity provider, no `storageState` files; each browser context signs in as a freshly minted Author so tests are independent. Real Google/Discord client values must still exist in the environment because env validation requires them, but they are never exercised. better-auth ships cookie helpers in `better-auth/test-utils` (`createCookieHeaders`, `signCookieValue`); prefer them over a hand-rolled HMAC when the pinned version exports them.

One end-to-end flow against the running app with a minted Author session and the e2e database: sign in → create Project and Journey → add Steps and Choices in the side panel → define an Outcome and assign it to an Ending → Preview → Publish → open `/j/{slug}` as an anonymous Participant in a fresh context → complete a Run → return as Author and see the Run in analytics → edit the Draft and publish version 2 → confirm the earlier Run still reports against version 1, the public URL now serves version 2, and restoring version 1 into the Draft yields the pre-edit content (row immutability is only provable here, against the database, not in Seam A). A second, shorter flow covers Unpublish → "unavailable" page.

Not tested separately: server actions and route handlers in isolation. They are thin glue between A and B and are covered by B.

Prior art: `paulitakes` colocates Vitest unit tests next to modules and keeps Playwright specs in an `e2e/` directory; follow that layout. The session-minting helper is modeled on `picksleagues`' e2e setup (`mintSession`/`signInAs` over better-auth's internal adapter, dedicated e2e database in global setup). Evidence policy per `docs/agents/testing.md`: Playwright screenshots under `test-results/<test-name>/`, cleared per work package; fixture journeys only, never real Responses.

## Out of Scope

Participant state or variables (Choices that set values later Steps read); conditional or scripted logic; a Twine importer or general Twine compatibility; image upload or hosting; real-time collaborative editing; roles or per-journey permissions; invitation emails; select or multi-select Prompts or any form builder; full AI graph editing or AI diffs of an existing graph; per-version public URLs; custom theme editors; manual canvas layout; participant accounts; soft delete, archive, or undo; rate limiting or abuse protection on Runs; a mobile-optimized editor (the editor is desktop-only; the runner and Project page are mobile-first); surfacing backtrack counts or per-journey lock-in in the UI; public discovery, search, a directory, or a marketplace (discovery is link-only); unlisted or private journeys or any per-journey visibility control beyond published/unpublished; migrating the legacy deployment. The legacy site stays live and untouched.

## Further Notes

**Priority order.** Work is delivered as vertical, demo-able slices in this order; if time runs out, whatever is below the line is simply not built: 1 Foundation (deployed app, database, auth, Project and Journey CRUD, docker-compose, lint/test/build commands, README, rerun Atlas setup to record commands) → 2 Graph contract and validation → 3 Seed scraper → 4 Publish, versions, unpublish → 5 Participant runner, Runs, landing page, and public Project page → 6 Visual editor → 7 Analytics → 8 Themes → 9 Prompts and Responses → 10 Members → 11 AI authoring (step rewrite if time) → 12 Version restore.

**Human prerequisites.** Foundation cannot be completed by an agent alone: Neon database, Vercel project, Google and Discord OAuth apps, the `staging` branch with Preview-environment values, a one-time sign-in before seeding, and an Anthropic API key are provisioned by Paul. The checklist is `human-prerequisites.md` beside this spec; ticket 1 lists them as human-gated criteria.

**Pending ADR.** ADR-0001, "graph stored as one validated JSON document per Draft and Published Version rather than relational step and choice rows," was approved in principle during the grill and should be written in `docs/adr/` as part of ticket 2. Consequence recorded there: analytics derive from Run paths and the version document; if relational querying is ever needed, the version boundary is where it is introduced.

**Legacy facts that shaped this spec.** The live site's journeys have 36–64 steps and 6–9 endings; most steps are linear with a single "Next"; a minority branch two or three ways; there is no participant input anywhere; step bodies contain headings, lists, italics, and about twenty Creative Commons images with credit lines. The legacy repository is private and unreadable by agents; the live site is the only content source.

**Demo.** Author creates a small journey on the canvas, publishes v1, a participant on a phone completes it via QR code, the author shows the run on the canvas overlay, edits and publishes v2, and shows the run still pinned to v1 — then opens the seeded case-3 journey to show the platform holding real-sized content.

### [SCOPE CHANGE] 2026-09-19 — slugs dropped (approved by Paul during PR #10 review)

Amends "Domain model", "Public URL and runner", and "Public pages and discovery": Project and Journey have **no slug**. Every route uses the id: Author routes `/projects/{project-id}` and `/projects/{project-id}/journeys/{journey-id}`; public `/j/{journey-id}` and `/p/{project-id}`. "Slug editable until first publish and frozen afterward" no longer applies. Reason: Authors should only think about the title, and an id path parameter needs no syncing with it; readable links are traded away (QR codes are unaffected). Recorded in ticket 02's [SCOPE CHANGE]; tickets 05, 06, 07 carry a pointer.

### Note 2026-09-21 — Back navigation, as built (ticket 06)

Refines "Back navigation": a navigation to a Step not yet on the path is refused **unless some Step already on the path offers it as a Choice**. The runner then takes the Choice from the latest such Step — appending when that is the current Step, and truncating to it first (counting a backtrack) when it is earlier. Browsers serve back navigations from cache without asking the server, so a Participant can choose from a page the server never saw as current; because published graphs have no cycles, the resolution is never ambiguous. The reducer is `src/lib/graph/run.ts`; ticket 10's analytics read the paths it writes. Recorded in ticket 06's [EXECUTION PLAN] and [AI CODE REVIEW].

_Amended by ticket 18 (2026-09-21): published graphs may now hold cycles, so the "never ambiguous" premise above no longer holds; see the [SCOPE CHANGE] below and ADR-0002._

### [SCOPE CHANGE] 2026-09-21 — graph tidy-up series takes priority

After using the ticket-09 canvas (PR #19), Paul decided that all next work tidies the graph editor before anything else in the priority order: ticket 18 (allow cycles), then 16 (canvas authoring), 19 (canvas quality of life), and 17 (manual layout, which amends the "manual canvas layout" exclusion and ADR-0001). Analytics (10) and the rest of the order resume afterwards.

### [SCOPE CHANGE] 2026-09-21 — cycles allowed

Paul decided that Choices may target a Step that can reach them ("as long as we have a fix, we shouldn't limit users"). The publish rule "the graph has no cycles" and the "Back navigation" argument that rests on it are amended by ticket 18: the Run path keeps repeats, the runner resolves a navigation as a Choice first and a backtrack second, and browser Back is disambiguated by a path index in history state. The four legacy Choices dropped in ticket 04 are restored. ADR-0002 records the decision when 18 lands.

### [SCOPE CHANGE] 2026-09-21 — layout direction stored on the Journey (ticket 21)

Amends "Graph document": the document gains a Journey-level `layoutDirection` field, `"TB"` or `"LR"`, defaulting to `"TB"` in the zod schema so every stored document parses. It is a property of the Journey, not of the Author: Members share one view and switch it freely; it lives in the Draft and autosaves like every other edit (last write wins); publishing copies it with the document; nothing reads it at run time. Step positions are still not stored (that is ticket 17). Whether the Step panel is shown is a way of reading, remembered per browser and never stored on the Journey. Decided by Paul, 2026-09-21; recorded in ticket 21's [EXECUTION PLAN].

### [SCOPE CHANGE] 2026-09-21 — staging feedback round 2 takes priority; manual layout deferred

After regression-testing staging (PR #26 merged), Paul filed 26 notes. They became tickets 25–31 and amendments to 15, 17, and 24, and the harness was made proportional (`docs/agents/testing.md` "Proportional verification", `docs/agents/issue-tracker.md` "Proportional records", the `Route: polish` line in `CLAUDE.md`). Order of work from here: 24 (an Ending needs no Outcome) → 25 (canvas polish round 2) → 26 (Journey page layout) → 27 (runner and preview start on the first Step) → 10 (analytics) → 28 (Project tabs, ordering, settings) → 29 (navbar) → 30 (rich text images and tooltips) → 31 (branding, theme, legal pages) → 23 (undo/redo); 20 stays small enough to slot anywhere; 07, 11, 12, 14 resume afterwards. Ticket 17 (manual layout) amends the 2026-09-21 tidy-up scope change: it is deferred past the hackathon and listed on ticket 15. Nothing is cut from the hackathon; the order is the commitment.

### [SCOPE CHANGE] 2026-09-22 — an Ending needs no Outcome (ticket 24)

Story 26 ("every Ending to require exactly one Outcome") is withdrawn; story 33's validation list drops "Endings missing an Outcome" and story 37's validation rule list drops "every Ending has an Outcome"; the "Graph document" publish rule "every Ending has an Outcome that exists" is replaced with "an Ending that carries an Outcome names one the document defines" (`unknown-outcome` is kept as a validation problem for an Outcome id that does not exist). Reason: Paul's feedback on PR #26 (2026-09-21) — an Ending is an outcome in itself, and an Author who does not group their Endings must not be blocked from publishing; an Outcome is a grouping for analytics, never a requirement. Analytics consequence: the Runs-by-Outcome chart groups each untagged Ending by its own Step title, so a result like "40% reached 'Turned back'" still reads (ticket 10). Recorded in ticket 24.

### [SCOPE CHANGE] 2026-09-22 — the runner opens on the Start Step (ticket 27)

Amends "Public URL and runner": the title page ("start screen" with title, description, and "Begin") is withdrawn. `/j/{journey-id}` renders the live Published Version's Start Step directly, with the Journey's title in a header on every screen of the runner and the description beneath the header on the Start Step only. A Run is created when the Participant takes their first Choice — its path already `[start, target]` — never on page load, so prefetches and crawlers never count as starts; reopening the link mid-Run offers "Continue where you left off" and "Start over" (which leaves the old Run abandoned where it stood and shows the Start Step fresh). A Journey whose Start is an Ending shows "The end" and records no Run (noted on ticket 10). Preview renders the Draft's Start Step in the same frame, distinguished only by a banner and a link back to the editor, so the two surfaces cannot drift. Reason: Paul's staging regression notes of 2026-09-21, items 19–21 ("It feels a bit weird to have the first part of a journey be the title and description instead of just step 1"). Recorded in ticket 27.

### [SCOPE CHANGE] 2026-09-22 — an empty Choice label is a publish problem (ticket 20)

Amends "Graph document", stories 33 and 37, and the Seam A "Validation" testing bullet: publish-time validation also enforces "every Choice has a label" — a label that is empty or whitespace-only yields an `empty-choice-label` problem addressed by the Step and the Choice, filed after `dangling-choice-target` and before `unreachable-step`. Reason: since ticket 16 a Choice drawn on the map or made with "Add next step" starts with an empty label; the editor reads it as "Untitled choice" while the Author works, but a Published Version carrying one would give a Participant a link with no text and no accessible name (Paul, 2026-09-21: "Yes, that should be a publish problem"). The runner keeps rendering `choice.label` as is. Recorded in ticket 20.


### [SCOPE CHANGE] 2026-09-23 — underline, strike, quotes, and line breaks in rich text (ticket 40)

Amends "Rich text" and story 14: the allowed set gains two marks (`underline`, `strike`), one block (`blockquote`, holding paragraphs only and allowed only at the top level of a document), and the `hardBreak` inline node (Shift+Enter) inside paragraphs and headings. The sanitizer keeps all four; a quote nested in a list item or another quote, and anything but a paragraph inside a quote, is dropped with what it holds, never refused, and a quote left with no paragraph goes too. A `hardBreak` keeps nothing written on it. The editor binds Mod+U, Mod+Shift+S, and Mod+Shift+B; the runner renders `<u>`, `<s>`, `<br>`, and a `<blockquote>` set off by a rule in the Theme's muted colour and left upright. Inline code, horizontal rules, alignment, and highlight stay out. Additive only: every stored Draft and Published Version still parses, and Published Versions are never rewritten. Reason: Paul's staging regression notes of 2026-09-22, item 12, and his 2026-09-22 answer admitting `hardBreak` (Q12), which closes that item on ticket 15. Recorded in ticket 40.
