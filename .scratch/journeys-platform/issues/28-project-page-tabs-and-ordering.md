# 28: Project page tabs, Journey ordering, and Project settings

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → 26 → 27 → 10 → **28** → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: contract

**Why:** The Project page stacks Journeys, Members, and the title controls in one column; Paul wants tabs — Journeys, then Members, then Settings holding the title, a description, and delete — with the Journey page laid out the same way (ticket 26). Journeys should be orderable, and the members copy "they need to sign in once first" is clunky. Items 7, 10, and 24 of his 2026-09-21 notes.

**Decisions (Paul, 2026-09-21):** tabs in the order Journeys, Members, Settings. A Project gains a description. Journeys are ordered by the Author; up/down controls rather than drag, which is enough for the hackathon. The members refusal reads "No account has that email — they need to sign up first".

**What to build:**

- **Schema.** `project.description` text, not null, default `''`; `journey.position` integer, not null, default 0. One migration (`pnpm db:generate`) that adds both columns and backfills `position` per Project in `created_at` order (a `WITH ... ROW_NUMBER()` update in the SQL). Both additive with defaults, so the previously deployed code keeps working during the deploy window.
- **Ordering.** `createJourney` appends at `max(position) + 1` within the Project; `listJourneysForProject` orders by `position`, then `created_at`. New actions `moveJourney(projectId, journeyId, "up" | "down")` swap positions with the neighbour inside one transaction and are Member-only like every other write. Each Journey row in the list gets "Move up" / "Move down" icon buttons (disabled at the ends).
- **Tabs.** The Project page becomes a header (inline title as in ticket 26, status of nothing, the "New journey" button on the Journeys tab) plus shadcn `Tabs`: **Journeys** (the list with ordering), **Members** (`MemberList` and add-member form), **Settings** (inline title input and description textarea saving on blur through the update action, then a "Danger zone" holding `DeleteProjectDialog`). Selected tab in the URL as `?tab=members` / `?tab=settings`, default Journeys. `EditProjectDialog` is removed; its update action gains `description`.
- **Copy.** `src/app/projects/actions.ts`: "No account has that email — they need to sign up first".
- **Public Project page note.** Ticket 07 renders `project.description` and lists Journeys in `position` order; add one line to `07-public-project-page.md`.
- **Specs.** `project-rename` becomes an inline edit on the Settings tab; `members-*` specs open the Members tab first and read the new copy; `project-delete*` use the Settings tab; a new `journeys-reorder` spec creates three Journeys, moves the third up twice, reloads, and reads the order.

Acceptance criteria:

- [ ] The migration applies to a database holding existing Projects and Journeys; every existing Journey gets a `position` matching its `created_at` order within its Project, and `pnpm db:migrate` in CI passes.
- [ ] The Project page shows three tabs in the order Journeys, Members, Settings; `?tab=settings` survives a reload.
- [ ] Editing the title and description on the Settings tab and blurring saves them; the Projects list and the page header show the new title.
- [ ] Move up / Move down reorder Journeys, the order survives a reload, and a new Journey appears last.
- [ ] Adding a Member with an unknown email reads "No account has that email — they need to sign up first".
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-1-migration.txt`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 7, 10, 24.

## Comments
