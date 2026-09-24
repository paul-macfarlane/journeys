# 52: Author pages and the display name

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (`/atlas-implement`, 2026-09-23, worktree `52-author-pages` on `feat/52-author-pages`)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day, grilled in its own thread the same day): in the hackathon, and one of the higher priorities. It is independent of 46 → 47 → 48 → 49 → 38 → 50 → 51 at this point, so it runs in parallel with that order in its own worktree rather than queueing behind it (Paul, Q8 and Q10). Post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call.
Route: contract

**Why:** Paul, 2026-09-23, item 4: "it would be cool if Authors themselves could have public pages about themselves and what they use the platform for. They also could edit their display name. This is a new feature."

**What is true today (read on `staging` at `c876d4e`):** the better-auth `user` table has `id`, `name`, `email`, `emailVerified`, `image`, and timestamps; no bio, links, or public flag, and no `additionalFields` or `updateUser` anywhere. There is no Settings, account, or `/authors` route; the user menu (`src/components/navbar/user-menu.tsx`) holds the name and email block, the Theme radios, and Sign out. The name shows in the navbar, the Projects list ("Signed in as …", `src/app/projects/(list)/page.tsx`), and the Members tab (`src/components/projects/member-list.tsx`). The public Project page (`src/app/p/[projectId]/page.tsx`) renders any known id inside `RunnerFrame` in the Project's Theme, lists live Journeys through `listPublicJourneysForProject`, says "No journeys are available right now." when there are none, and shows no Author. The privacy page (`src/app/privacy/page.tsx`) says the name is used "to let the other members of a project recognise you". The app's own Theme is the `trail` preset (`src/lib/theme.ts`), which RunnerFrame already paints. better-auth overwrites a user's name on a later OAuth sign-in only when `overrideUserInfoOnSignIn` is set, and it is not, so an edited name persists. lucide ships no brand icons. The navbar comes from the two sibling layouts under `/projects` (`(list)` and `[projectId]`); the `(list)` layout's comment says new routes belong inside it.

**Scope change:** the spec's "discovery is link-only, no cross-project browsing" rule gains one exception, recorded as `[SCOPE CHANGE] 2026-09-23 — Author pages and the display name` on the spec (with pointers in "Public pages and discovery" and "Members and auth") and as "Amendment for ticket 52" in `decisions.md`. Both are in this ticket's PR.

**Decisions (Paul, 2026-09-23, grilled; two rounds, every recommendation accepted):**

- **Address (Q1).** `/authors/<userId>`. The id is the address, as for Projects and Journeys; no handle, no new unique column, no rename policy. A handle can be layered on later as a second address.
- **Opt-in (Q2, re-confirmed in round 2 Q1).** `user.public boolean NOT NULL DEFAULT false`. Off is a 404, exactly like an unknown id, and its OG image falls back to the brand card, so the URL reveals nothing about whether an account exists. Turning it on is the Author's consent to a public name, avatar, bio, and links.
- **Projects listed (Q3).** Every Project the Author is a Member of that has at least one live Journey, automatically, ordered as the Author's own Projects list is (`updatedAt` desc, then `createdAt` desc, then id desc). No per-Project opt-in. A co-Member's Project appears on the page too; it only links to a page that is already public.
- **Bio (Q4).** Plain text, at most 1,000 characters, blank allowed, line breaks preserved on render. Not rich text.
- **Links (round 2 Q2).** One `user.links jsonb NOT NULL DEFAULT '[]'` column holding at most five entries of `{ kind, url }`, `kind` one of `linkedin | github | instagram | facebook | website`, at most one per kind. Every `url` is an absolute `https:` URL; the four platform kinds must sit on that platform's host (`linkedin.com`, `github.com`, `instagram.com`, `facebook.com`, with or without `www.`), so a link labelled "LinkedIn" cannot point elsewhere; `website` accepts any `https:` host. Rendered as a row of text links ("LinkedIn", "GitHub", "Instagram", "Facebook", "Website") with lucide's generic link icon; no brand icons and no new dependency.
- **Avatar (Q4).** The provider's `user.image`, shown on the page and the settings surface; no URL field, no upload (images stay URL-only per spec).
- **Settings surface (Q5, round 2 Q3).** One page at `/projects/settings` inside the `(list)` layout (a static segment beats `[projectId]`, and the layout supplies the navbar), reached from a "Settings" row in the user menu placed between the name block and the Theme group. Page heading "Settings", two sections: "Display name" and "Author page" (the switch, the bio, the links, and, once on, the public URL with an open link).
- **Saving (round 2 Q4).** Name, bio, and links save on blur through the shared blur-saved form (`useBlurSavedForm`) with the same status line as Project settings; the public switch applies on change through the optimistic checkbox pattern in `journey-theme-settings.tsx`. One server action per field group into a new `server-only` `src/db/users.ts`; not better-auth's `updateUser`, so name, bio, links, and public share one validated path.
- **Name rules (round 2 Q5).** Trimmed, 1 to 60 characters; blank refused and the previous value kept; no uniqueness. No minimum bio before the page can go public.
- **Page composition (round 2 Q6, Q7).** Inside `RunnerFrame` with `{ preset: "trail", accent: null }` (the app's own Theme), mobile-first like the Project page: avatar, name, bio, links row, then a "Projects" list where each entry links to `/p/<id>` with the title and a plain-text preview of the description (`contentPreview`); when there are none, "No published journeys yet." No live Journey count. `generateMetadata` and an `opengraph-image.tsx` follow ticket 37 (`LinkPreviewCard`, kicker "Author", title the name, description the bio truncated to `LINK_PREVIEW_DESCRIPTION_LIMIT`, palette from the trail Theme).
- **The Project page line (Q6, round 2 Q8).** Under the title, above the description: "By Paul Macfarlane, Jane Doe", each name a link to its Author page, in Members-tab order (`member.createdAt` asc), and nothing rendered when no Member's page is on. Not on the runner, not on the OG card.
- **Privacy (round 2 Q9).** After the existing Author sentence: "If you turn on your Author page, your name, profile picture, bio, and links are public at that page, together with the projects you belong to that have a published journey, until you turn it off."
- **Delivery (Q10).** This thread's PR carries the spec change and this ticket only; implementation is a separate thread in its own worktree.

**What to build:**

- **Schema.** `user.bio text NULL`, `user.links jsonb NOT NULL DEFAULT '[]'`, `user.public boolean NOT NULL DEFAULT false` in `src/db/schema.ts`; one additive migration from `pnpm db:generate` (next is `0010_*`; renumber on rebase if another ticket lands one first). Adding with defaults keeps the previously deployed code working during the Migrate/Vercel window.
- **Contract.** `src/lib/author.ts` (pure, database-free): zod schemas for the display name, the bio, the links array (kind enum, one per kind, `https:` only, host rule), and the public flag, plus `AUTHOR_LINK_KINDS` with their labels and hosts. Unit tests for the host rule, the one-per-kind rule, the name trim and bounds, and the bio cap.
- **Data access.** `src/db/users.ts` (`server-only`): `getAuthorSettings(userId)`, `updateAuthorSettings(userId, patch)`, `getPublicAuthor(userId)` (null when off or unknown), `listPublicProjectsForAuthor(userId)` (Member of, at least one live Journey, Projects-list order), and `listPublicAuthorsForProject(projectId)` (Members with `public = true`, join order).
- **Settings.** `src/app/projects/settings/page.tsx` (`force-dynamic`, `requireSession`), `src/app/projects/settings/actions.ts` (server actions returning the shared action result), and `src/components/author-settings.tsx` (blur-saved name, bio, and five link inputs; the optimistic switch; the public URL once on). The "Settings" row in `user-menu.tsx`.
- **Public page.** `src/app/authors/[userId]/page.tsx` (`force-dynamic`, `notFound()` when off or unknown) inside `RunnerFrame` with the trail Theme, `generateMetadata` via a new `authorLinkMetadata` in `src/lib/link-preview.ts`, and `src/app/authors/[userId]/opengraph-image.tsx` following the Project card (brand card fallback when off or unknown).
- **Project page.** The "By …" line in `src/app/p/[projectId]/page.tsx` from `listPublicAuthorsForProject`.
- **Privacy.** The sentence above in `src/app/privacy/page.tsx`.
- **Specs.** `e2e/author-settings.spec.ts` (`author-settings`): sign in, open Settings from the user menu, rename (navbar and "Signed in as" follow after reload), write a bio and a LinkedIn link, see a wrong-host link refused, turn the page on and see the URL. `e2e/author-page.spec.ts` (`author-page`): with the page off an anonymous context gets a 404 at `/authors/<id>`; turn it on, publish a Journey in a Project (via `publishDocument`), and the anonymous context at phone size sees avatar, name, bio, the link, the Project entry linking to `/p/<id>`, the meta tags, and the OG PNG; the Project page shows "By <name>" linking back; a second Project with no live Journey is absent. Follow `e2e/public-project.spec.ts` and `e2e/setup/link-preview.ts`.

Acceptance criteria:

- [ ] An Author can change their display name on Settings; the new name shows in the navbar, the Projects list, and the Members tab, survives a later sign-in, and a blank or over-long name is refused with the previous value kept.
- [ ] `/authors/<userId>` is a 404 (brand-card OG image) until the Author turns the page on; once on, an anonymous visitor sees the avatar, name, bio, links, and the Projects with a live Journey, each linking to its public page, or "No published journeys yet."; turning it off makes it a 404 again.
- [ ] A link with the wrong host or a non-`https:` scheme is refused; at most one link per kind is stored.
- [ ] The public Project page names the Members whose pages are on, each linking to their Author page, and renders no such line otherwise.
- [ ] The migration is additive, applied by `pnpm db:migrate` on a fresh database, and existing users get `public = false` and `links = []`.
- [ ] The privacy sentence is present; the spec `[SCOPE CHANGE]` and the `decisions.md` amendment are in `staging`.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): the full command chain including `pnpm build` and `pnpm db:migrate`, one full `pnpm test:e2e` at the end, `ac-<n>-<slug>.txt` captures only where a screenshot cannot prove a criterion (the migration and the refused link); commit only the screenshot directories of `author-settings` and `author-page`, run with `E2E_EVIDENCE=author-settings,author-page`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary (Author, never profile or user, in copy). Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 4, grilled the same day in its own thread.

## Comments

**2026-09-23 — grilling (Claude Fable 5.1, `/grilling`, worktree `52-author-pages` on `feat/52-author-pages`).** Two rounds, ten questions each; Paul accepted every recommendation. Round 1 settled the address, opt-in, which Projects, the bio, the settings surface, the Project page link, the spec amendment, and the hackathon cut; round 2 re-confirmed opt-in (Paul's "3" was a typo for (a)), and settled the links shape, the route, saving, name rules, off and empty states, page layout, the Project page line, the privacy sentence, and delivery. Paul: "just put up a PR with the spec change, I'll have implementation be a separate thread." PR: see the `[CLOSEOUT]` on the implementation thread; this PR carries only the spec, decisions, and this ticket.

**2026-09-23 — `[EXECUTION PLAN]` (Claude Fable 5.1, `/atlas-implement`, worktree `52-author-pages`, branch `feat/52-author-pages`, comparison SHA `f93bdf2`, base `staging`).** Route `contract`. One repository delivery (`journeys`), direct checkout in the existing worktree, no worker worktrees: the three deliverables are sequential because D2 and D3 each end in a Playwright run that needs the worktree's own build, port, and database, and two builds plus two suites on one machine is the load that has failed unrelated specs here before. The name, bio, links, and public switch save through `useAutosavedForm` / `useAutosave` (ticket 46 replaced `useBlurSavedForm`; same status line). The Settings route lives at `src/app/projects/(list)/settings/` so the `(list)` layout supplies the navbar (URL `/projects/settings`).

Deliverables and the criteria each proves:

- **D1 — schema, contract, data access** (`src/db/schema.ts`, `drizzle/0010_author_pages.sql`, `src/lib/author.ts` + unit tests, `src/db/users.ts`). AC 3 (unit), AC 5 (migration).
- **D2 — Settings** (`src/app/projects/(list)/settings/{page,actions}.tsx`, `src/components/author-settings.tsx`, the "Settings" row in `user-menu.tsx`, `e2e/author-settings.spec.ts`). AC 1, AC 3 (refusal on screen).
- **D3 — public Author page, Project page line, privacy** (`src/app/authors/[userId]/{page,opengraph-image}.tsx`, `authorLinkMetadata` in `src/lib/link-preview.ts`, the "By …" line in `src/app/p/[projectId]/page.tsx`, `src/app/privacy/page.tsx`, `e2e/author-page.spec.ts`). AC 2, AC 4, AC 6 (privacy).

Verification map (run surface local + deployed; evidence per `docs/agents/testing.md`, `contract`):

| Criterion | Command / action | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|
| AC 1 name | `E2E_EVIDENCE=author-settings,author-page E2E_PORT=3152 E2E_DATABASE_NAME=journeys_e2e_52 pnpm test:e2e` (spec `author-settings`) | `test-results/author-settings/` | after D2 | any change under `src/app/projects/(list)/settings`, `src/components/author-settings.tsx`, `src/components/navbar/user-menu.tsx`, `src/db/users.ts`, `src/lib/author.ts` |
| AC 2 page on/off, OG | same run, spec `author-page` | `test-results/author-page/` | after D3 | any change under `src/app/authors`, `src/lib/link-preview.ts`, `src/lib/og.tsx`, `src/db/users.ts` |
| AC 3 links refused, one per kind | `pnpm test -- src/lib/author.test.ts` + the refusal step of `author-settings` | `test-results/ac-3-refused-link.txt`, `test-results/author-settings/` | after D1 / D2 | `src/lib/author.ts`, the Settings surface |
| AC 4 "By …" line | same run, spec `author-page` | `test-results/author-page/` | after D3 | `src/app/p/[projectId]/page.tsx`, `src/db/users.ts` |
| AC 5 additive migration, defaults | fresh database: migrate the base commit's `drizzle/`, insert a user, `pnpm db:migrate`, read the row back | `test-results/ac-5-migration.txt` | after D1 | `drizzle/`, `src/db/schema.ts` |
| AC 6 privacy sentence; spec + decisions on `staging` | `grep` of `src/app/privacy/page.tsx`; `git log origin/staging` naming PR #56 | `test-results/ac-6-privacy-and-spec.txt` | after D3 | `src/app/privacy/page.tsx` |
| AC 7 full e2e once | the run above, in full | `test-results/dod-1-commands.txt` | after D3 | any change |
| DoD chain | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate` (migrate against the fresh database above) | `test-results/dod-1-commands.txt` | after D3 | any change |
| Deployed | Human gate, after Paul merges: open `/projects/settings`, turn the page on, open `/authors/<id>` on the staging domain; expected: the page renders with the trail Theme and the Project list; post-check: the OG image at `/authors/<id>/opengraph-image` is a 200 PNG | closeout note | after merge | a later deploy |

Human gates: none actionable now. Announced for later: the staging smoke above (after merge) and the Migrate action applying `0010` on push to `staging` (additive with defaults, so the deploy window is safe). No new dependency, so no lockfile commit is needed.

**2026-09-23 — `[AI CODE REVIEW]` (two fresh reviewers over `f93bdf2..33c7554`, adjudicated by the orchestrator; every fix in `33c7554`).**

Axis 1, technical implementation and spec conformity:

- **Blocking, resolved** — `e2e/author-settings.spec.ts`: the first `fill` after `signInAgain` + `goto` and after `page.reload()` could race hydration (React Hook Form writes the stored value back over an early fill; retries are 0; the repo hit this in tickets 35 and 36). Both edits are now made until they take, as the rename and `editJourneyField` are.
- **Non-blocking, resolved** — `src/lib/auth.ts`: better-auth's own `/api/auth/update-user` accepted any name or image from a signed-in Author, bypassing the name rules and putting an arbitrary URL on a public page. `disabledPaths: ["/update-user"]`; the spec asserts a 404 and an untouched row.
- **Non-blocking, resolved** — `src/components/author-settings.tsx`, `src/lib/author.ts`: a link field holding only spaces was refused ("Use an https:// link") instead of clearing the link. The field is trimmed before the choice between "" and a url; `authorLinkUrlSchema` declares its input as `string`.
- **Non-blocking, accepted** — `src/db/users.ts`, `e2e/author-page.spec.ts`: the Projects-list order, the "By …" order, and the co-Member case are read in review but not exercised by a spec (one Project, one public Author). Both queries mirror `listRecentProjectsForAuthor` and `listMembers` exactly.
- **Non-blocking, resolved** — `src/app/projects/(list)/settings/actions.ts`: `revalidatePath("/projects", "layout")` states the intent (navbar layouts and Journey pages included) instead of three page paths.

Axis 2, coding standards:

- **Non-blocking, accepted** — "profile picture" in the Settings copy: the privacy sentence Paul dictated uses the same phrase for the provider's image.
- **Non-blocking, resolved** — a poll in `author-settings.spec.ts` that could never fail, replaced by the single read.
- **Non-blocking, resolved** — `author-page.spec.ts` found the bio by a Tailwind class; now by its text.
- **Non-blocking, resolved** — the form schema was built with `as unknown as`; a typed helper builds it.
- **Non-blocking, accepted** — no `actions.test.ts` for the three Settings actions; the schemas have unit tests and `author-settings` proves refusal and saving end to end.
- **Non-blocking, resolved** — copy nits: "2,048", "account ids".

Both reviewers confirmed: every action re-parses through the shared schemas and writes only `session.user.id`'s row; off and unknown are the same 404, generic metadata, and brand card; `email` reaches no public surface; the migration is additive with defaults; the privacy sentence is verbatim; the five recorded deviations (`useAutosavedForm` for the ticket's `useBlurSavedForm`, the `(list)` route, `shouldFocusError: false`, the row-set spec, the `Avatar` client component) were applied as recorded.

**2026-09-23 — `[CLOSEOUT]` (Claude Fable 5.1, `/atlas-implement`).** PR: https://github.com/paul-macfarlane/journeys/pull/59 (base `staging`). Repository delivery `journeys`, branch `feat/52-author-pages`, comparison SHA `f93bdf2`, `origin/staging` (`b093869`, PRs #57 and #58) merged in as `da12354`; verified code at `d0384cf`.

Deliverables: D1 schema, contract, data access — `atlas-worker` on sonnet, `94cb6d8`. D2 Settings page, user-menu row, `signInAgain`, `author-settings` spec — `atlas-worker` on opus, `04948f8`. D3 public Author page, card, metadata, "By …" line, privacy, `author-page` spec — `atlas-worker` on opus, `2eb0692`. Orchestrator: review fixes `33c7554`, merge `da12354`, `d0384cf` (the merged `createProject` now lands on the new Project, so the author-page spec reopens the list between two creates), evidence `8da42e1`. Two review subagents on opus. Sequential, one worktree, no worker worktrees; the predicted disjoint file sets held.

Verification (`docs/agents/testing.md`, `contract`), all on `d0384cf`:

- AC 1 — PASS — `test-results/author-settings/author-settings.png`; spec `author-settings` (rename; navbar, "Signed in as", Members tab; `signInAgain`; blank and 61-char refused with the row unchanged).
- AC 2 — PASS — `test-results/author-page/author-page.png`, `author-card.png`; spec `author-page` (404 and brand card while off; on: avatar, name, two-line bio, LinkedIn and Website links, "No published journeys yet." then the Project once a Journey is live, B absent; meta tags; 1200×630 PNG with the trail background and stripe; off again: 404 and the same brand bytes).
- AC 3 — PASS — `test-results/ac-3-refused-link.txt` (14 unit tests: host rule, `https:` only, lookalike host, one per kind, at most five) and the on-screen refusals in `author-settings` with the row still holding only the LinkedIn entry; `/api/auth/update-user` is a 404.
- AC 4 — PASS — `test-results/author-page/project-by-line.png`; spec `author-page` (line absent while off, present and linking back while on, present on the Project with no live Journey, absent from the runner).
- AC 5 — PASS — `test-results/ac-5-migration.txt` (fresh `journeys_52_fresh`: base migrations, an Author inserted, `pnpm db:migrate` applies `0010`, the row reads `bio` null, `links` `[]`, `public` false).
- AC 6 — PASS — `test-results/ac-6-privacy-and-spec.txt` (the sentence at `src/app/privacy/page.tsx:39-41`; `[SCOPE CHANGE]` and the amendment on `origin/staging`).
- AC 7 and DoD chain — PASS — `test-results/dod-1-commands.txt`: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate && pnpm test:e2e` with `E2E_EVIDENCE=author-settings,author-page E2E_PORT=3152 E2E_DATABASE_NAME=journeys_e2e_52`; 35 unit files / 528 tests, 102 e2e passed (2.1m), no flake. Earlier full passes on `2eb0692` and `33c7554`; the first run on the merged `da12354` failed on the ticket-47 interaction above and is recorded as FAIL, fixed at its cause in `d0384cf`.
- Deployed — human gate after merge: on the staging domain, `/projects/settings` → "Public Author page" on → `/authors/<id>` renders in the trail Theme with your Projects; post-check `/authors/<id>/opengraph-image` is a 200 PNG. The Migrate action applies `0010` on push to `staging` (additive, defaults).

Deviations: `useAutosavedForm`/`useAutosave` for the ticket's `useBlurSavedForm` (ticket 46 renamed it); the route under `(list)`; `shouldFocusError: false` on the shared hook; the `author-page` spec sets the row directly; the `Avatar` client component on the public page; `disabledPaths` on better-auth (review). No new dependency; no lockfile change. Paul's dev database needs `pnpm db:migrate`. Follow-up candidates: `CopyLinkButton`'s accessible name ("Copy participant link") on Settings; specs for the two ordering rules.

**2026-09-24 — `[SCOPE CHANGE]` (Paul, on PR #59: "we might as well let users edit profile picture … as part of this pr").** The *Avatar (Q4)* decision ("no URL field, no upload") is amended: the Display name section carries a "Profile picture" link field beside the avatar. An absolute `http:` or `https:` URL (the rule a Step's image `src` follows; images stay URL-only per the spec), blank for the initials; saved with the name through one `editAuthorIdentityAction`; `authorImageSchema` in `src/lib/author.ts` with unit tests; the privacy page says the name and the picture link can be changed on Settings; the `author-settings` spec sets, has refused (`javascript:`), and clears it. No upload. Commit `43e0d08`.
