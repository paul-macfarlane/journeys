# 92: Heading order in rendered rich text

Status: done
Blocked by: None
Owner: Claude, chunk 9 orchestrator (2026-09-28)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). Ticket 78 renders stored rich text one heading level down (H1 → `h2`, H2 → `h3`, H3 → `h4`) so a Step's content never repeats the page's `h1`. Content that opens with an H2 therefore renders `h1` → `h3` on the public Project page and in the runner, which axe flags as `heading-order` (moderate, best practice).

**What "fixed" means:** the renderer normalises heading levels relative to the first heading in the document, or clamps each heading to one level below the previous one, so rendered content never skips a level under the page's `h1`. The editor is unchanged.

Acceptance: a `rich-text.test.tsx` case for content opening with H2 and H3; axe clean on the public Project page with such a description.

## Comments

### 2026-09-28 — Claude, chunk 9 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/115 (chunk 9, route `contract` from ticket 89; the chunk plan, the AI review and the command chain are on ticket 89).

- **Worker:** D4 (Sonnet, b6982e1 on the chunk branch), plus review fixes S9 and E2 in 566edd1.
- **Rule:** the first heading renders as `h2` whatever level it was written at. Each later heading keeps its distance from the first but is never more than one level deeper than the one before, never above `h2`, and capped at `h6`.
- **Two expectations followed the rule:** `public-project-page` now expects level 2, and `step-editing-image-caption-alt-and-preview` now expects level 2.
- **Verdict PASS:**
  - `rich-text.test.tsx` has cases for content opening with H2 then H3, and with H3 only, among others (715 unit tests pass).
  - `a11y-heading-order` finds nothing under axe on a public Project page whose description opens with H2 then H3. Screenshot: `test-results/a11y-heading-order/`.
- **DoD:** the chunk chain passed on 566edd1, e2e 150 passed, 0 failed, 0 flaky (`test-results/chunk-9-commands.txt`).
