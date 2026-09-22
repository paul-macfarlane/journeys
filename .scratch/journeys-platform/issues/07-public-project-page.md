# 07: Public Project page

Status: in-progress
Route: contract
Blocked by: 05, 08
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A Participant opens `/p/{project-slug}` and sees the Project's title, its rich-text description, and its currently published Journeys (title, description, link); unpublished and never-published Journeys are absent. Authors edit the Project description with the same Tiptap editor component and allowed node set that ticket 08 builds for Steps (ticket 08 owns the editor; this ticket reuses it). Discovery is link-only: no index, search, or cross-project browsing anywhere.

- [ ] Project page renders description and only published Journeys; unpublishing one removes it without a deploy.
- [ ] Author edits the Project description in a rich-text editor; content is sanitized with the shared allowed set.
- [ ] Unknown project slug 404s; the site root still lists nothing.
- [ ] Seam B: publish a Journey → it appears on the Project page → Unpublish → gone.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### Note 2026-09-22 — from ticket 28

Ticket 28 added `project.description` (plain text, edited on the Project page's Settings tab) and `journey.position`. The public Project page renders `project.description` and lists its published Journeys in `position` order (`listJourneysForProject` already sorts by it). Whether the description becomes rich text is this ticket's call; the column is plain text today.

### [SCOPE CHANGE] 2026-09-19 — slugs dropped (see ticket 02)

Paul decided during PR #10 review that Projects and Journeys have no slug: every path parameter is the id. Read every "slug" in this ticket as the id (`/j/{journey-id}`, `/p/{project-id}`), and drop any "slug frozen at first publish" behavior. Recorded in ticket 02's [SCOPE CHANGE] and the spec's Comments.

### [EXECUTION PLAN] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

Blockers 05 and 08 are `done` on `staging` (e712a98). Route is `contract`: the ticket adds a public route, a column, and extends the rich-text contract to the Project. No red team: nothing here changes the graph model, publishing, runs, auth, or the migration path; it adds one defaulted column and one anonymous read.

**Decisions.**
1. The Project description becomes rich text, as the ticket's second criterion asks (ticket 28 left the call here). It is stored in a new `project.description_content` jsonb column holding the same `Content` shape a Step holds, sanitized on write by `sanitizeContent` (the shared allowed set). Migration 0007 adds the column with an empty-document default and backfills it from the plain-text column, one paragraph per non-blank line. The plain `description` text column stays, unread and unwritten by the new code, because the Migrate action and the Vercel build have no ordering and the previous build still selects and inserts it; dropping it is a later migration.
2. The Settings tab keeps its blur-saved title field and gains the shared `RichTextEditor` for the description (given a `label` and an `onBlur` prop), saved on blur through a new `editProjectDescriptionAction`. The title action becomes `renameProjectAction` with a title-only schema.
3. `/p/[projectId]` is a Server Component with no session, rendered inside `RunnerFrame` (the participant shell) with `dynamic = "force-dynamic"` so unpublishing shows without a deploy. It reads `getPublicProject` (title + description) and `listPublicJourneysForProject` (Journeys with a live pointer, in the Author's order, titled and described by their live Published Version as the runner is). Unknown id → `notFound()`. Each Journey is a link to `/j/{id}` in the runner's choice style.
4. The Author's Project page header shows a plain-text preview of the description (`contentPreview`) and links to the public page; the seed script is untouched (the seed Project has no description).
5. The site root already lists nothing; the spec asserts it.

**Verification (contract chain).** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm db:migrate` (0007 against the local Postgres), `pnpm build`, and one full `E2E_EVIDENCE=public-project-page,project-rename pnpm test:e2e` at the end. Unit seams: `src/lib/validation/project.test.ts` (title-only rename schema) and `src/app/projects/actions.test.ts` (description action sanitizes: refuses a non-document, strips a `javascript:` link, keeps the allowed set). Evidence: `test-results/public-project-page/`, `test-results/project-rename/`, `test-results/dod-1-commands.txt`. Two AI reviewers (correctness, contract) over the whole diff before the PR.
