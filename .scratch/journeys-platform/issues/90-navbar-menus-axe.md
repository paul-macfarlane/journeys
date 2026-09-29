# 90: Navbar menus under axe

Status: done
Blocked by: None
Owner: Claude, chunk 9 orchestrator (2026-09-28)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). With the Account menu open, axe reports `aria-required-children` (critical): ticket 51's Theme `SegmentedControl` (a `radiogroup`) sits directly inside `role=menu`. Wrapping it in a menu group did not help. Every open menu's portaled popup (Projects, the Project switcher, Account) is also outside any landmark (`region`, moderate).

**What "fixed" means:**

- The Theme row uses menu roles (`menuitemradio` in a group) while keeping ticket 51's segmented look; `navbar.spec`'s expectations are updated with it.
- axe finds no violations with each of the three menus open, in both schemes.

Acceptance: extend `e2e/accessibility.spec.ts` with each menu open under axe.

## Comments

### 2026-09-28 — Claude, chunk 9 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/115 (chunk 9, route `contract` from ticket 89; the chunk plan, the AI review and the command chain are on ticket 89).

- **Worker:** D5 (Opus, 38496f8 on the chunk branch), plus review fixes S4 and S5 and the stale `canvas-dark-controls` locator (E1) in 566edd1. The review record is on ticket 89.
- **Changes:**
  - The Theme row is a `DropdownMenuRadioGroup` labelled "Theme", holding three `menuitemradio` items drawn with the segmented control's shared classes. Choosing one leaves the menu open.
  - `NavbarHeader` passes the header to both navbar menus, which portal their popups into it.
  - `navbar.spec` is updated for the new roles.
- **Verdict PASS:** `a11y-navbar-menus` passes in the final run. Axe finds nothing with each open menu, in light and dark: the Projects switcher, the Project switcher and Account. Screenshot: `test-results/a11y-navbar-menus/`.
- **Approved deviation:** Left and Right do not move between the Theme items; Up and Down do (review C9).
- **Open question for Paul, in the PR:** rename the row to "Appearance".
- **DoD:** the chunk chain passed on 566edd1, e2e 150 passed, 0 failed, 0 flaky (`test-results/chunk-9-commands.txt`).
