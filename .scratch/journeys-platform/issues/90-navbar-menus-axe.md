# 90: Navbar menus under axe

Status: needs-triage
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). With the Account menu open, axe reports `aria-required-children` (critical): ticket 51's Theme `SegmentedControl` (a `radiogroup`) sits directly inside `role=menu`. Wrapping it in a menu group did not help. Every open menu's portaled popup (Projects, the Project switcher, Account) is also outside any landmark (`region`, moderate).

**What "fixed" means:**

- The Theme row uses menu roles (`menuitemradio` in a group) while keeping ticket 51's segmented look; `navbar.spec`'s expectations are updated with it.
- axe finds no violations with each of the three menus open, in both schemes.

Acceptance: extend `e2e/accessibility.spec.ts` with each menu open under axe.
