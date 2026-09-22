# 29: App shell navbar

Status: ready-for-agent
Blocked by: None
Owner:
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
