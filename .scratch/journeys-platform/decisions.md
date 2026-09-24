# Journeys platform — decisions from the 2026-09-18 grill

Status: settled (shared understanding confirmed by Paul, 2026-09-18)
Source: `/grill-with-docs` session. This file is the durable record of what was
decided; `spec.md` (next step, via `/to-spec`) turns it into a work contract.
Vocabulary is defined in `/CONTEXT.md` — use those terms.

## Product

- A general platform for authoring and running branching, text-based journeys.
  The three migrant-healthcare empathy cases on the legacy site
  (journey-stories.netlify.app) are one example use, not the domain.
- Legacy repo `paul-macfarlane/journey` (private, Astro static, Twine-derived)
  stays live and untouched as a reference. Agents cannot read it (404).
- Legacy facts (crawled from the live site): journeys are 36–64 steps with
  6–9 endings each; mostly linear "Next" steps plus 2–3-way choices; **no**
  participant input anywhere; step bodies contain headings, lists, italics,
  and ~20 images with Creative Commons credit lines.

## Timebox and approach

- Hackathon: 2026-09-18 → Fri 2026-09-25, a few hours/day, solo.
- Scope is not capped to fit the time. Work is strictly prioritized so the
  high-priority items land (see Priority order).

## Repository and stack

- Build in `paul-macfarlane/journeys` (this repo). Remote: GitHub, `main`
  protected, PRs via `gh pr create`, human merges.
- Next.js 16 App Router, React 19, TypeScript, pnpm.
- Drizzle ORM + Neon Postgres (`@neondatabase/serverless` in prod; `pg` +
  docker-compose Postgres locally).
- better-auth with Google + Discord (always both), copied from `paulitakes`.
- Tailwind v4, shadcn (`base-nova`, neutral, lucide), zod 4, react-hook-form,
  TanStack Query, next-themes.
- Vercel AI SDK (`ai` v6) for AI features.
- Vitest (unit; mandatory on graph validation and publish) + Playwright
  (bounded to the demo path: author publishes → participant completes →
  analytics shows it).
- Vercel: preview deploys + `main`. No staging environment for now.
- Mirror `paul-macfarlane/paulitakes` for ESLint/Prettier/husky/lint-staged
  and project layout. `picksleagues` (TanStack Router + Hono) is NOT the
  template — not needed for this UI.
- React Flow (`@xyflow/react`, MIT — not paywalled) + `@dagrejs/dagre` auto-layout for
  the canvas. Tiptap (MIT) for rich text.

## Domain / graph contract

- Pure directed graph. **No participant state/variables** (choices that set
  values read later). Reserve nullable `choice.condition` / `choice.effect`
  columns; build nothing for them.
- One Start per journey. Steps have rich-text content and 0+ Choices.
- Ending = step with no choices; every ending has exactly one Outcome.
  **Amended 2026-09-22 (Paul):** an ending may carry an outcome or not; an
  outcome is a grouping for analytics, never a requirement. Ticket 24.
- Outcome: journey-scoped, author-defined, stable id + free text label
  (renameable without breaking analytics).
- Validation at publish: exactly one start; every choice resolves to an
  existing step; every step reachable from start; every ending has an outcome.
  **Amended 2026-09-22 (Paul):** the last rule is withdrawn; an ending tagged
  with an outcome the document no longer defines is still refused. Ticket 24.
- Step content: Tiptap JSON, rendered server-side to sanitized HTML with
  Tiptap's renderer (do not round-trip through a Markdown pipeline).
  Allowed marks: headings, bold/italic, lists, links, image-by-URL as a Tiptap
  node with a required `credit` attribute. No uploads (post-hackathon).
- Prompt: optional free-text question on a step, with an optional/required
  flag. `prompt.type` discriminator exists but only `free_text` is accepted.
  Responses are stored per Run, readable by authors in a per-step list,
  never shown to participants. Authors see a one-line notice that responses
  are anonymous and should not request identifying information.

## Publishing and versions

- One mutable Draft per journey. Publish = validate + snapshot into an
  immutable Published Version stored as **one JSON document**.
- Exactly one Published Version is live at a time. Earlier versions are kept
  (runs point at them; restore reads them) but never publicly reachable.
- Unpublish → public URL shows "this journey is unavailable"; in-flight runs
  are abandoned.
- Version list is in scope; "restore as new draft" is in scope but last in
  priority.
- Public URL: `/j/{journey-slug}`. No project slug in participant URLs.
- Preview: authors walk the Draft in the participant runner; no Run recorded.

## Discovery and public pages (added 2026-09-18, Q23–Q26)

- Site root: landing page + Author sign-in. Lists nothing.
- Project has a slug and rich-text description and a public page at
  `/p/{project-slug}` listing its published journeys (the legacy `/journeys`
  page, generalized).
- Published = public and listed. No unlisted/private journeys, no visibility
  flag.
- Discovery is link-only: Project URL, Journey URL, or a QR code. No search,
  index, or marketplace.

## Gap round (added 2026-09-19, Q27–Q33)

- Delete Journey: supported, hard delete with confirm, cascades runs/responses.
  No soft delete.
- Back navigation: allowed. URL per step; path = current linear route (back
  truncates, backtrack counter stored); reserved `allow_back` flag for later
  (amended 2026-09-21 — see the Back-navigation bullet below).
- Journey gets a short description; runner has a start screen.
- Playwright auth: mint a real better-auth session via the internal adapter
  and a hand-signed `better-auth.session_token` cookie (picksleagues pattern),
  dedicated e2e database in global setup. No OAuth, no test-only provider.
- AI: Anthropic `claude-opus-5` via Vercel AI SDK Anthropic provider; key is
  an env var populated out of band; features hidden when absent.
- Seeded case-3 owned by Paul (pauljosephmacfarlane@gmail.com); script is
  idempotent and takes the email as an argument.
- Human prerequisites tracked in `human-prerequisites.md`.

## People and permissions

- Authors sign in (better-auth). Participants are anonymous with a
  pseudonymous run id in a cookie; no participant accounts.
- Projects have flat Members: every member can do everything, including add
  members by email of an existing account and delete the project. The
  creator is just the first member. `member.role` column exists, defaults to
  `member`, is never read. No invite emails, no per-journey permissions,
  last-write-wins on the draft.

## Runs and analytics

- Run = `{ versionId, path: stepId[], startedAt, endedAt?, outcomeId? }` plus a
  separate response table. **No event table.**
- Analytics, in scope: numbers overlaid on the canvas (choice %, outcome
  counts, abandonment per step) + outcome distribution chart + per-step
  Response list. Nothing else.

## Themes

- Curated presets (~6) + optional accent color; project default with
  per-journey override; applies to the participant runner only. Reserve a
  nullable custom-tokens JSON column for future custom themes.

## Canvas / editor

- Always auto-layout (dagre). Click a step → side panel edits it; adding a
  choice in the panel creates the edge. No drag-to-connect, no persisted
  x/y positions in MVP. Reserve nullable position columns for later.

## AI

- MVP: AI *authoring* only — generate a new draft journey (steps, choices,
  outcomes) from a prompt via structured output into the Draft for review.
- Step-level rewrite ("make this step more X") only if time allows.
- Full AI graph editing is out. AI never touches Published Versions.

## Seeding real content

- No Twine importer. Write a throwaway scraper against the live Netlify site
  to seed case-3 (36 steps) into the new schema. Hackathon demo uses real
  content.

## Priority order (vertical, demo-able slices)

1. Foundation — deployed Next.js app, Neon + Drizzle, better-auth, project +
   journey CRUD, docker-compose, lint/test/build commands, README, rerun
   `/atlas:setup-atlas` to record commands.
2. Graph contract + validation.
3. Seed scraper (case-3).
4. Participant runner + runs on a published version.
5. Publish / version (draft → validate → snapshot → stable URL; unpublish).
6. Visual editor (canvas + side-panel editing + Tiptap).
7. Analytics (canvas overlay + outcome chart + responses list).
8. Themes.
9. Prompts / Responses.
10. Members.
11. AI authoring (step rewrite if time).
12. Version restore.

## Explicitly out (hackathon)

State/variables, Twine importer, image uploads, real-time co-editing, roles,
select-type prompts, full AI graph editing, staging environment, per-version
public URLs, custom theme editor, manual canvas layout.

## Pending

- ADR-0001: graph stored as one validated JSON document per draft/version
  (vs relational steps/choices). Approved in principle; not yet written.

## Amendments after red-team (2026-09-19, confirmed by Paul)

- Staging: a long-lived `staging` branch with a stable Vercel domain now exists
  alongside `main` and PR previews; the Preview environment carries full env
  values so preview builds pass validation. Supersedes "no staging" above.
- Seeding requires Paul's account to exist (he signs in once first); the seed
  never creates user rows.
- Back navigation stays; publish-time validation rejects cycles so "go back"
  and "take a Choice" are never ambiguous. `allow_back` stays reserved.
  **Amended 2026-09-21 (Paul):** cycles are allowed; the path keeps repeats
  and a history-state index disambiguates Back. Ticket 18; ADR-0002.
- Sanitization constrains link/image URLs to http(s); Preview is Member-only;
  Published Versions record `publishedBy`; Run cookies are per-journey.
- Publish-immutability is proven in Seam B (database), not Seam A.
- AI structured output uses an array-shaped projection of the graph schema.
- Priority order: publish (4) before runner (5), matching ticket dependencies.

## Amendment after PR #10 review (2026-09-19, decided by Paul)

- Slugs dropped. Projects and Journeys are addressed by id everywhere:
  `/projects/{project-id}`, `/projects/{project-id}/journeys/{journey-id}`,
  public `/j/{journey-id}` and `/p/{project-id}`. Authors edit a title (and
  a Journey description), never an address. Supersedes every "slug" line
  above and the "slug frozen at first publish" rule.

## Amendment after PR #13 review (2026-09-20, decided by Paul)

- Seeding: no scraper. The local clone of the legacy repo (`~/Code/journey`,
  `src/data/cases/case-{1,2,3}.json`) is converted once into three graph
  documents committed as static JSON; a small idempotent seed command inserts
  all three cases into one `Journey Stories` Project. No e2e coverage for the
  seed; one pure validation test over the committed documents. Supersedes
  "Seeding real content" above and the "Seed scraper" wording in the priority
  order.

## Amendment for ticket 30 (2026-09-22, decided by Paul on 2026-09-21)

- Image contract: `credit` is renamed `caption` (the visible, optional line
  under the picture; a credit is written into it) and `alt` becomes a
  required-by-the-dialog string for assistive technology, `""` until written.
  Stored documents are read with `credit` as `caption`; Published Versions
  are never rewritten. The sanitizer no longer refuses an image for anything.
  Supersedes "image node with a required `credit` attribute" above.

## Amendment for ticket 40 (2026-09-23, decided by Paul on 2026-09-22)

- Rich-text contract: `underline` and `strike` marks, a top-level
  `blockquote` of paragraphs, and the `hardBreak` inline node (Shift+Enter)
  join the allowed set. Inline code, horizontal rules, alignment, and
  highlight stay out. A quote where the contract does not allow one is
  dropped with its contents, never refused. Additive: stored Drafts and
  Published Versions still parse unchanged. Supersedes the node and mark
  list under "Rich text" and the ticket 15 `hardBreak` gap.

## Amendment for ticket 43 (2026-09-23, decided by Paul on 2026-09-22)

- Graph contract: a Prompt gains `decides` (zod default `false`); a deciding
  Prompt is required. Additive: stored Drafts and Published Versions still
  parse unchanged, and Published Versions are never rewritten.
- The judge is jev (`typesafe-ai/jev`) on the Vercel AI Gateway with the
  static `AI_GATEWAY_API_KEY`, called through the AI SDK's
  `experimental_evaluate` as a `choice` question over the Step's Choices,
  tagged `feature:decide`. The judge sees the Step only: its title and plain
  text, the Prompt label, each Choice's id and label, and the Response —
  never Endings, Outcomes, other Steps, or other Participants' Responses.
- Threshold 0.5: at or above it the Run advances along the judged Choice,
  recorded exactly as a pressed Choice plus the Response; below it the
  Choices are shown with the pick marked, under "Choose for yourself".
- Fallback: no key, a failed call, a call inside the rate limit (one
  decision per Run per second), or an answer naming no Choice of the Step
  shows the Choices with nothing marked. A Run is never stuck.
- Preview judges the same way, records nothing, never advances on its own,
  and shows the pick and its probability so an Author can tune labels.
- A deciding Prompt published with no key is a publish-time warning, never
  a refusal.
- Supersedes "Vercel AI SDK (`ai` v6) for AI features." (decisions still use
  `ai`, but the judge is jev on the Gateway, not a model chosen per feature);
  "AI: Anthropic `claude-opus-5` via Vercel AI SDK Anthropic provider; key is
  an env var populated out of band; features hidden when absent" for
  decisions only (AI authoring keeps its own Anthropic line until ticket
  14); and "MVP: AI *authoring* only" (the runner now also uses AI, to judge
  a deciding Prompt's Response).

## Amendment for feedback round 4 (2026-09-23, decided by Paul on 2026-09-23)

- A Journey's description stays plain text (ticket 47): it is a blurb read
  by the public Project page card, the runner header, the link-preview
  description, and the OG image, none of which can take rich text. A
  Project's description is a page body and stays rich text (ticket 07).
  Both create dialogs ask for a title only and land on the new Project or
  Journey.
- The metadata forms (titles, descriptions, Theme) autosave on the Draft
  editor's model: debounce, flush on blur, save on unmount, an unload
  guard, and a status line (ticket 46). Last write wins between Members
  stays until ticket 15.
- The authoring UI stays un-themed and the app keeps one brand (Trail);
  the Theme presets are the Participant's experience and are never a
  preference for the app itself (ticket 15, reaffirms ticket 11's story 75
  and ticket 31).
- The judge's timeout rises from 5 s to 20 s with a pending state on the
  deciding form, the runner's first client island (ticket 49). Threshold
  0.5 stays. A Response to a deciding Prompt is disclosed on the privacy
  page as sent to the AI Gateway.
- Delete or Backspace on a focused Step box opens the same confirmation
  the Step actions menu opens; the Start ignores it (ticket 50, agent's
  ruling under Paul's blanket approval).

## Amendment for ticket 52 (2026-09-23, decided by Paul on 2026-09-23)

- Supersedes "Discovery and public pages": discovery is still link-only and
  the site root still lists nothing, but an Author may turn on a public Author
  page at `/authors/{user-id}` that lists the Projects they belong to which
  have a live Journey. No index of Authors; no handle, the id is the address.
- Off by default (`user.public`, default false); off is a 404, and the OG
  image falls back to the brand card. Turning it on is the Author's consent
  to a public name, avatar, bio, and links.
- The page shows the provider avatar, the display name, a plain-text bio
  (≤ 1,000 characters), links (one each of LinkedIn, GitHub, Instagram,
  Facebook, website; `https:` only; platform kinds pinned to their host,
  stored as one `user.links` jsonb array of `{ kind, url }`), and the
  Projects, newest activity first. Rendered in the app's own Theme (`trail`)
  inside the runner frame; metadata and OG card follow ticket 37.
- The public Project page names, under its title, the Members whose pages
  are on ("By …", each a link, join order) and nothing otherwise. Not the
  runner, not the OG card.
- One Settings page at `/projects/settings` from a "Settings" row in the
  user menu: display name (1–60 characters, trimmed, blank refused), bio,
  links, and the Author page switch. Blur-saved fields, switch on change,
  one server action into `src/db/users.ts` (not better-auth's `updateUser`).
  No avatar field; images stay URL-only.
- The privacy page adds one sentence about what turning the page on makes
  public.
