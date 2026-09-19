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
- Outcome: journey-scoped, author-defined, stable id + free text label
  (renameable without breaking analytics).
- Validation at publish: exactly one start; every choice resolves to an
  existing step; every step reachable from start; every ending has an outcome.
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
  truncates, backtrack counter stored); reserved `allow_back` flag for later.
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
- Sanitization constrains link/image URLs to http(s); Preview is Member-only;
  Published Versions record `publishedBy`; Run cookies are per-journey.
- Publish-immutability is proven in Seam B (database), not Seam A.
- AI structured output uses an array-shaped projection of the graph schema.
- Priority order: publish (4) before runner (5), matching ticket dependencies.
