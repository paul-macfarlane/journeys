# 88: Canvas arrows: keyboard focus and order

Status: done
Blocked by: None
Owner: Claude, chunk 9 orchestrator (2026-09-28)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). On the Journey page's canvas, the arrows (`g[role=group]`, named "<Choice>: <Step> → <Step>") are tab stops that come before every Step box, because React Flow renders its edge layer first. A focused arrow shows no outline or ring, and Enter on a focused arrow drops focus to `body`.

**What "fixed" means:**

- Arrows are reached after or with their source Step, or are not tab stops at all (React Flow's `edgesFocusable`), with selection still possible from the Step panel's Choices.
- A focused arrow shows a visible focus indicator in both schemes.
- Enter on a focused arrow keeps focus on it or moves it somewhere meaningful (the Choice in the Step panel).

Acceptance: an e2e test tabs through a two-Step map and asserts the order and a visible focus on an arrow; Enter keeps focus off `body`.

## Comments

### 2026-09-28 — Claude, chunk 9 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/115 (chunk 9, route `contract` from ticket 89; the chunk plan, the AI review and the command chain are on ticket 89).

- **Worker:** D1 (Opus, 4b3691f), plus review fixes C4–C8 and C10 in 566edd1. The review record is on ticket 89.
- **Changes:**
  - Arrows get `tabIndex: -1` through `domAttributes`.
  - A focused arrow draws in the `--ring` colour at 4px. An arrow with a problem keeps its red.
  - Enter or Space is caught in the capture phase on the React Flow wrapper. It opens the Choice in the panel and focuses its label field. The focus request clears once answered.
  - The edge's `aria` description is rewritten to match.
- **Verdict PASS:** `canvas-arrow-focus` passes in the final run. It checks:
  - no tab stop is an arrow, and every Step box is reached;
  - a focused arrow shows the ring, in light and dark;
  - Enter, then Space, land on the Choice's label field, never `body`;
  - the same at phone width, inside the sheet.
  - Screenshot: `test-results/canvas-arrow-focus/`.
- **DoD:** the chunk chain passed on 566edd1, e2e 150 passed, 0 failed, 0 flaky (`test-results/chunk-9-commands.txt`).
