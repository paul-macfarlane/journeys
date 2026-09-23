# 07: Public Project page

Status: done
Route: contract
Blocked by: 05, 08
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A Participant opens `/p/{project-slug}` and sees the Project's title, its rich-text description, and its currently published Journeys (title, description, link); unpublished and never-published Journeys are absent. Authors edit the Project description with the same Tiptap editor component and allowed node set that ticket 08 builds for Steps (ticket 08 owns the editor; this ticket reuses it). Discovery is link-only: no index, search, or cross-project browsing anywhere.

- [x] Project page renders description and only published Journeys; unpublishing one removes it without a deploy.
- [x] Author edits the Project description in a rich-text editor; content is sanitized with the shared allowed set.
- [x] Unknown project slug 404s; the site root still lists nothing.
- [x] Seam B: publish a Journey → it appears on the Project page → Unpublish → gone.

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

### [AI CODE REVIEW] 2026-09-22 — two axes over `e712a98...19c0f86` (mattpocock code-review: Standards and Spec sub-agents, run in parallel)

**Standards (0 hard violations, 6 judgement calls).** Documented standards all pass: `server-only` kept on `src/db/*`, `src/lib/graph/content.ts` database-free; migration 0007 additive with a default and the old column left in place; the public page uses plain `<a>`, explicit `role="list"`, no client bundle, mirroring `j/[journeyId]`; every screenshot through `evidencePath`, unique suffixes, no Responses. Baseline smells: (1) Duplicated Code — `renameProject` and `editProjectDescription` shared one shape → applied, `updateProjectForMember`. (2) Mysterious Name — `editable()` and `hasSomething()` → applied, `withTextBlock` / `showsAnything`. (3) Primitive Obsession — `sameContent` via `JSON.stringify` relies on the sanitizer's fixed key order → comment added. (4) Divergent Change — `CopyLinkButton` serves Projects while living under `components/journeys/`; `RunnerFrame` doc listed only Journey screens → doc comment updated, file left where it is (a move is churn for no reader). (5) The visible caption and the editor's `aria-label` repeat the string rather than bind by id → left; the accessible name is present. (6) e2e `newContext` without `baseURL` → applied. Correctness pass: toolbar `preventDefault` keeps blur-save from firing per click; `/projects` never renders the description so the narrower revalidation is right; `getPublicProject` is `cache()`d; the backfill's `btrim` + `<> ''` filter matches `isBlankContent`.

**Spec (0 missing after evidence, 1 note).** All four criteria implemented and proven: live-pointer inner join in the shared `listOrder`, live version's title/description as the runner; `force-dynamic` + `notFound()`; root unchanged; `sanitizeContent` server-side with the same `RichTextEditor` and extension set; Seam B driven through the real Publish/Unpublish buttons; unit test strips `javascript:`/`data:`/`codeBlock`/`underline`. Evidence was absent at the reviewed commit — committed since (ba3084e). Scope beyond the ticket, all judged reasonable and declared in the plan or small: `CopyLinkButton` path prop and the public-page link on the Author's header, the `renameProjectAction` rename, `isBlankContent`, the editor's empty-document shim, `label`/`onBlur` props, `generateMetadata`, README, the rewritten `project-rename` spec. Note: a description edited on the old build between Migrate finishing and the new build going live lands in the plain column only (minutes; recorded on the PR). Flake risk low: both specs poll the row after `blur()` before reloading.

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/37 (base `staging`, comparison SHA e712a98). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Deliverables (one deliverable, orchestrator-implemented on a direct checkout of `feat/07-public-project-page`, no workers).** 4589e4e — `src/app/p/[projectId]/page.tsx` (public page, `force-dynamic`, `generateMetadata`), `getPublicProject` in `src/db/projects.ts` and `listPublicJourneysForProject` in `src/db/journeys.ts`, `project.description_content` + migration `drizzle/0007_daily_lady_mastermind.sql` with the hand-written backfill, `editProjectDescriptionAction` / `renameProjectAction`, `RichTextEditor` `label` + `onBlur` props and the empty-document shim, `isBlankContent`, the Settings tab's description editor, the Author header's preview + public link, `CopyLinkButton` path prop, README, `e2e/public-project.spec.ts`, `project-rename` rewritten, unit tests (`src/app/projects/actions.test.ts`, `src/lib/validation/project.test.ts`, `content.test.ts`). 19c0f86 — review fixes. ba3084e — evidence.

**Verified run command (final tree, head 19c0f86):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm db:migrate; pnpm build; E2E_EVIDENCE=public-project-page,project-rename pnpm test:e2e:prebuilt` (over that build; `pnpm test:e2e` is the same build then the same suite) — every block `exit=0`; unit 306/306; e2e 75 passed in 1.3m, 0 failed, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium. Capture: `test-results/dod-1-commands.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| Project page renders description and only published Journeys; unpublishing one removes it without a deploy | PASS | `test-results/public-project-page/public-project-page.png` (participant, 390px: title, h2/bold/list description, one live Journey with live title + description linking to `/j/<id>`), `after-unpublish.png` ("No journeys are available right now."); Draft-only Journey asserted absent and `live_version_id` null |
| Author edits the Project description in a rich-text editor; content is sanitized with the shared allowed set | PASS | `test-results/public-project-page/settings-description.png`; the row asserted equal to the closed content shape; `src/app/projects/actions.test.ts` (non-document refused, `javascript:` link / `data:` image / `codeBlock` / `underline` stripped, non-Member 404 answer) |
| Unknown project id 404s; the site root still lists nothing | PASS | `e2e/public-project.spec.ts`: `/p/00000000-…` → 404 status; `/` shows no Project title, no Journey title, no `/p/` or `/j/` anchors |
| Seam B: publish → appears → Unpublish → gone | PASS | same spec, through the real Publish and Unpublish buttons, participant reloads between |
| Migration compatible with the previously deployed build | PASS | 0007 additive with default; old column kept; probed locally with a throwaway multi-line row (two trimmed paragraphs, blanks skipped, blank Projects keep the empty document) |
| `pnpm test:e2e` passes once in full at the end | PASS locally (75/75); PR CI is the durable proof | `test-results/dod-1-commands.txt`; PR #37 checks |

**Deviations.** (1) The description is stored in a new `description_content` column beside the plain `description`, which stays unread until a later drop migration (deploy-ordering rule). (2) Two extra seams outside the ticket's text: the editor now opens on one empty paragraph when given a document with no blocks (found by the spec: the first heading toggle was lost otherwise), and `isBlankContent` keeps the public page from rendering an empty block after an Author clears the editor. (3) The Author's Project page gained a "Public page" link and a copy-link button so the link-only discovery has somewhere to get the link from. (4) No red team: nothing here changes the graph model, publishing, runs, auth, or the migration path.

**Next in Paul's order:** 23 undo/redo; 10 analytics; 17 post-hackathon.
