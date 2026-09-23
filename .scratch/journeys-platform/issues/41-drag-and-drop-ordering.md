# 41: Drag-and-drop Journey ordering

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) **41** → 42 → 44 → 45. 14 stays available; 17 is post-hackathon. Not before 2026-09-25. Also listed on ticket 15.
Route: polish

**Why:** Ticket 28 orders Journeys with Move up / Move down, which Paul chose as "enough for the hackathon". Item 4 of his 2026-09-22 notes: "Low priority, but for re-ordering stories for a project, it would be nice to be able to reorder by dragging and dropping."

**Decisions (Paul, 2026-09-22, grilled):** dragging is an addition, not a replacement: the Move buttons stay as the keyboard and screen-reader path. `@dnd-kit/core` and `@dnd-kit/sortable` are the dependency (pointer and keyboard sensors; the lockfile commit is Paul's, per `CLAUDE.md`). One drop is one action.

**What to build:**

- **Action.** `reorderJourneyAction(projectId, journeyId, toIndex)` beside `moveJourneyAction` in `src/app/projects/[projectId]/journeys/actions.ts`: Member-only, renumbers `journey.position` for the Project inside one transaction, locking the Project row as ticket 28 does. `src/lib/journey-order.ts` gains the pure reorder and its unit tests.
- **List.** `src/components/projects/journey-list.tsx` becomes sortable: a drag handle per row with an accessible name, optimistic order while the action runs (`useOptimistic`), the server's order after it settles, a refusal restores the previous order.
- **Specs.** `journeys-reorder` gains a drag: drag the third Journey to the top with `dragTo`, reload, read the order.

Acceptance criteria:

- [ ] Dragging a Journey row to a new place persists the order across a reload; Move up / Move down still work and stay reachable by keyboard.
- [ ] A drop that the server refuses restores the previous order with a message.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 4.

## Comments
