# 29: App shell navbar

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → 26 → 27 → 10 → 28 → **29** → 30 → 31 → 23; 17 is post-hackathon. After 28 so the switcher reads the ordered Project list.
Route: polish

**Why:** "There really should be a top navbar for signed in users for their profile, theme preferences, and signing out. Ideally they can also toggle between existing projects." Item 8 of Paul's 2026-09-21 notes. Today sign-out is a lone button on `/projects` and theme is system-only.

**Decisions (Paul, 2026-09-21):** the switcher shows a handful of Projects (five) and links to the full list. Signed-in Author pages get the navbar; the runner and the sign-in page do not.

**What to build:**

- **Layout.** A `src/app/projects/layout.tsx` that renders the navbar above every Author page (`/projects`, a Project, a Journey, the preview). The runner (`/j/*`) and `/sign-in` keep their frames. The navbar is a server component reading the session; its menus are small client components.
- **Left:** the app name as a link to `/projects`, then the Project switcher: a dropdown (shadcn `DropdownMenu`) labelled with the current Project's title on Project and Journey pages, or "Projects" elsewhere, listing the five most recently updated Projects the user is a Member of (current one marked), then a separator and "All projects" → `/projects`. Selecting one navigates to that Project page.
- **Right:** the user menu: avatar or initials from the better-auth session, the user's name and email in the menu header, a Theme submenu (Light / Dark / System through `next-themes`, the existing `ThemeProvider`), and "Sign out" (the existing `SignOutButton` logic). Remove the standalone sign-out button from `/projects`.
- **Navigation.** Each page keeps its "← Back" link; the navbar adds no breadcrumb.
- **Responsive.** At phone width the switcher collapses to the Project title only and the user menu to the avatar; nothing wraps to a second row.
- **Specs.** A new `navbar-switch-project-and-theme` spec: from a Journey page, open the switcher, pick another Project, land on it; open the user menu, choose Dark, read the `dark` class on `<html>`; `sign-out` finds Sign out in the user menu. `projects-*` specs that relied on the old sign-out button follow.

Acceptance criteria:

- [ ] Every page under `/projects` shows the navbar; `/j/<id>` and `/sign-in` do not.
- [ ] The switcher lists at most five Projects the user is a Member of, marks the current one, and "All projects" opens the list; choosing another Project navigates to it.
- [ ] The user menu shows name and email, switches theme (Light / Dark / System, persisted across a reload), and signs out to `/sign-in`.
- [ ] At 375 px width the navbar stays on one row with no horizontal scroll.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, item 8.

## Comments

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/34 (base `staging`, comparison SHA `cc7d500`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Deliverables (this session, direct checkout on `feat/29-app-shell-navbar`).** 91fe8cd — `src/lib/navbar.ts` (`initials`, `switcherProjects`, unit-tested first), `listRecentProjectsForAuthor` in `src/db/projects.ts`, the `AppNavbar` server component with the `ProjectSwitcher` and `UserMenu` client menus, the two sibling layouts `src/app/projects/(list)/layout.tsx` and `src/app/projects/[projectId]/layout.tsx`, `/projects` moved into the `(list)` group with its sign-out button removed and `SignOutButton` deleted, shadcn `dropdown-menu` and `avatar` (CLI's stray `cn` package removed, lockfile untouched), the `navbar-switch-project-and-theme` spec, and the `sign-out` test reaching Sign out through the user menu. 13d3b1b — review fixes: `getProjectForMember` request-cached, one `current` prop on the switcher, theme radio items with proper labels that close the menu, the spec grown to six Projects (cap, current-first, most-recently-updated after a rename) and all three themes, `preview.spec.ts` scoping its banner to the runner frame, `sign-out.png` capturing the sign-in page. 7cbf6f4 — evidence.

**Verified run command (final tree, head 13d3b1b):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; E2E_EVIDENCE=navbar-switch-project-and-theme,sign-out pnpm test:e2e` — every block `exit=0`; unit 287/287; e2e 72 passed in 1.3m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium.

| Criterion | Verdict | Evidence |
|---|---|---|
| Every page under `/projects` shows the navbar; `/j/<id>` and `/sign-in` do not | PASS | `navbar-switch-project-and-theme` asserts the list, a Project, a Journey, the Preview (present) and `/sign-in`, `/j/<id>` (absent); `test-results/navbar-switch-project-and-theme/switcher-open.png` (viewed: bar over the Journey page) |
| At most five Projects, current marked, "All projects" opens the list, choosing navigates | PASS | same spec with six Projects: `[p1 (current), p6, p5, p4, p3]` from the oldest, `[p6…p2]` from the newest, renamed p3 first afterwards; `aria-current="page"` on the current; "All projects" lands on `/projects`; `switcher-open.png` (viewed: five entries, check on the first) |
| Name and email; Light / Dark / System persisted across a reload; sign out to `/sign-in` | PASS | menu header assertions; Dark survives a reload and reads back checked; Light; System follows an emulated OS scheme; `navbar-switch-project-and-theme.png` (viewed: dark Project page after the reload); `test-results/sign-out/sign-out.png` (viewed: sign-in page) |
| 375 px: one row, no horizontal scroll | PASS | `phone.png` (viewed: truncated title, avatar only) plus the banner bounding-box ≤ 60 px and `scrollWidth` ≤ 375 assertions |
| `pnpm test:e2e` once in full at the end | PASS locally (72/72, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR #34 checks |

**AI review (one Opus reader, both axes, diff `cc7d500..91fe8cd`).** No documented-standard violation, nothing blocking. Standards: duplicated `getProjectForMember` query per request (fixed with `cache()`), `currentId` + `label` data clump (fixed), the doubled five-cap in SQL and `switcherProjects` (kept: the pure function's own contract), unused vendored shadcn parts (convention), `body > header` locator (now `getByRole("banner")`). Spec: `listRecentProjectsForAuthor` ordering and cap untested e2e (fixed: six Projects and a rename), only Dark exercised (fixed: all three), the current-first rule not in the ticket (kept, flagged to Paul), sign-out to `/sign-in` while the proxy and `requireSession` send signed-out visitors to `/` (kept per the AC, flagged), two layouts endorsed with a note about routes placed straight under `projects/` (added to the layout comment).

**Deviations.** (1) Two sibling layouts instead of the ticket's single `src/app/projects/layout.tsx`: a layout only sees its own segment's params, and the switcher's label needs the Project. No URL changed. (2) Sign out lands on `/sign-in` (the acceptance criterion) rather than `/` (the old button). (3) A current Project outside the five most recent is listed first in place of the fifth, so it can be marked; the ticket says "the five most recently updated". (4) The first full run failed `preview` on two banner landmarks (navbar plus runner-frame header); the spec now filters out the App nav. (5) `pnpm build` was not run on its own: `pnpm test:e2e` builds the app.

**Queued for Paul (non-blocking, also in the PR).** (1) Two signed-out exits now exist (`/sign-in` after Sign out, `/` from the proxy and `requireSession`). (2) "Most recently updated" means the Project row: work inside a Journey does not move its Project up the switcher. (3) The `Signed in as …` line on `/projects` still stands beside the user menu's name; remove it if it reads as doubled.

**Next in Paul's order:** 30 → 31 → 23; 17 post-hackathon.
