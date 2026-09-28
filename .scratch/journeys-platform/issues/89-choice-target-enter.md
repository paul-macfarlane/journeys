# 89: Choice target combobox: Enter retargets on open

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). The Choice target field in the Step panel opens its list on focus with the first option active, not the current target. Tabbing in and pressing Enter silently retargets the Choice to the first Step. The walk did exactly that to "Wait your turn" (→ "Border post"). It is keyboard-only data loss in the Draft, so the route is `contract` (it changes the graph document an Author did not mean to change).

**What "fixed" means:**

- On open, the active option is the current target, or the list does not open on focus.
- Enter without navigating keeps the target unchanged.
- Step titles can repeat, so the match is on Step id, never on the title.

Acceptance: an e2e test focuses a Choice's target field with the keyboard, presses Enter, and reads the Draft row: the target is unchanged.
