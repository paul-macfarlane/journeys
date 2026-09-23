# 51: Theme as one row of the user menu

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon 46 → 47 → 48 → 49 → 38 → 50 → **51**; 52 is grilled in its own thread and may squeeze in; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call. If Friday arrives first, this slides to post-hackathon.
Route: polish

**Why:** Paul, 2026-09-23, item 3: "for the dark/light mode toggle, I wonder if that should be a single button with different options like a radio button or something like that instead of taking up 3 slots in the pop down."

**What is true today:** `user-menu.tsx` renders a "Theme" label and a `DropdownMenuRadioGroup` of three radio rows, Light, Dark, System. That was Paul's own ruling on 2026-09-21 (ticket 29) when the fly-out submenu was dropped for phones; the vendored `dropdown-menu.tsx` still exports the submenu parts, unused. Submenus are awkward on touch, and a row that cycles hides two of the three states.

**Decisions (Paul, 2026-09-23, accepted the agent's recommendation):** one menu row, "Theme" on the left and a segmented control of three icon buttons on the right (sun, moon, monitor from lucide), the group `role="radiogroup"` with `aria-label="Theme"`, each button `role="radio"`, `aria-checked`, and an accessible name (Light, Dark, System). The checked segment is styled from `aria-checked` in both schemes, the same rule ticket 48 gives the direction toggle; consider one shared segmented-control component for both. Choosing a theme does not close the menu (the user sees the change), unlike the old rows. Phone tap targets stay at the menu's larger size.

**What to build:**

- `user-menu.tsx`: the row; a `SegmentedControl` in `src/components/ui/` if shared with ticket 48's `DirectionControl`. No submenu.
- **Specs.** `navbar-switch-project-and-theme` and `navbar-sticky-and-phone-menu` choose themes through the segments and assert `html.dark`, the `aria-checked` state, and, at 375 × 667, that all three segments and Sign out sit inside the viewport.

Acceptance criteria:

- [ ] The user menu shows Theme on one row with three labelled segments; each sets the theme, persists across a reload, and is reachable by keyboard.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 3.

## Comments
