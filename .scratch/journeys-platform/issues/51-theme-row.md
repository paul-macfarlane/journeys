# 51: Theme as one row of the user menu

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (delivered 2026-09-23, PR #61)
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

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish, from a worktree)

PR: https://github.com/paul-macfarlane/journeys/pull/61 (base `staging`, branched at `b093869`, PR #58 merged; PR #56 for ticket 52 had merged first as asked). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** 273856b (the shared `SegmentedControl` with its unit test, `DirectionControl` over it, the theme row, the three spec edits), 68480ed (first evidence), 67c2a56 (review tidy-ups: 44px phone segments, `data-open` for "stays open", null guard, one tab stop when nothing is checked, no-submenu assertion), 8366453 (evidence rerun), then this closeout.

**Verified run command (code at 67c2a56):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=navbar-switch-project-and-theme,navbar-sticky-and-phone-menu pnpm test:e2e` — every block `exit 0`; unit 518/518; e2e 100 passed in 2.0m, 0 flaky, retries 0. Worktree `.claude/worktrees/51-theme-row/journeys` on `E2E_PORT=3151`, `journeys_e2e_51`, CI dummy env (no `.env.local`), `AI_GATEWAY_API_KEY` unset. `pnpm build` ran inside `pnpm test:e2e`; no migration. An earlier full run at 273856b was also green (unit 517/517, e2e 100 passed); the cited run is the one after the review fixes.

| Criterion | Verdict | Evidence |
|---|---|---|
| The user menu shows Theme on one row with three labelled segments; each sets the theme, persists across a reload, and is reachable by keyboard | PASS | `navbar-switch-project-and-theme`: `radiogroup` named Theme with three `radio`s named Light, Dark, System, no `menuitemradio`, no `[aria-haspopup]`; Dark chosen → `html.dark`, `aria-checked` true/false, menu still `data-open`; `page.reload()` keeps `html.dark`; Enter on the trigger focuses the checked segment, Left chooses Light (`html.light`), Tab moves to Sign out; System with the OS dark → `html.dark`. `test-results/navbar-switch-project-and-theme/theme-row.png` (viewed), `navbar-switch-project-and-theme.png`, `phone.png`. `navbar-sticky-and-phone-menu`: the three segments and Sign out inside 375 × 667, Dark segment ≥ 44 × 44; `test-results/navbar-sticky-and-phone-menu/phone-menu.png` (viewed). `segmented-control.test.tsx` pins the arrow move and the markup (8/8). |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt` |

**AI review (one reader, both axes, diff `origin/staging...273856b`).** Approve with non-blocking findings. *Spec:* every decision delivered — labels, `aria-label="Theme"`, `aria-checked` both ways, persistence, keyboard reach, phone fit, no submenu. *Correctness:* `CSS.escape` only runs in the keydown handler, never on the server; `isTheme` narrowing is right against next-themes' `string | undefined` with the fallback matching the provider's `defaultTheme="system"`; `max-sm:size-*` survives `cn` and wins the media query; the `DirectionControl` refactor loses nothing (all four arrows, `preventDefault`, focus after a move; `data-direction` had no consumer; the new `stopPropagation` keeps arrows from React Flow's document listeners). *Findings, applied in 67c2a56:* (1) the old phone rows were 44px and the segments 36px — now `max-sm:size-11` and the spec asserts ≥ 44; (2) `toBeVisible` after a click also holds during the popup's 100 ms close animation — now `toHaveAttribute("data-open", "")`; (3) a null `boundingBox` failed opaquely — guarded; (4) the shared control had no tab stop when `value` matched no option — the first segment is now the stop; (5) "no submenu" was unasserted — `[aria-haspopup]` count 0. *Left as decided:* the visible "Theme" span and the group's `aria-label` are not associated (the ticket prescribed `aria-label` verbatim). *Informational:* a `radiogroup` inside `role="menu"` is off the ARIA menu content model (the ticket's accepted decision); against Base UI 1.8, Escape from a segment closes the menu, segment clicks never dismiss, Up/Down/Home/End reach the menu's list navigation, typeahead is harmless; the keyboard-open assertions rely on the focus manager focusing the first tabbable (the checked segment) while list navigation highlights Sign out, so a Base UI upgrade that reorders the two would fail the spec deterministically, not flakily.

**Deviations.** (1) `DirectionControl` (ticket 48) is now visually the shared pill (`bg-secondary` container, `gap-0.5`) rather than two bare secondary buttons; `expectCheckedDirectionMarked` in `canvas.spec.ts` still holds and the canvas evidence was not recaptured (only the two named specs' directories are committed). (2) Up/Down on a theme segment are left to the menu; from the segment they no-op for focus because Base UI highlights Sign out at open, so Tab is the pinned path from the row to the items. (3) Arrow keys on the shared control also `stopPropagation`, new to the direction control on the canvas.

**Queued for Paul.** The worktree at `.claude/worktrees/51-theme-row/journeys` and its `journeys_e2e_51` database are left for removal after the merge. No lockfile change.

**Next in Paul's order:** 38 → 50 (52 grilled, PR #56 merged, implement in its own thread); post-hackathon sweep 3 (41 → 42 → 44 → 45, 53).
