# 92: Heading order in rendered rich text

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). Ticket 78 renders stored rich text one heading level down (H1 → `h2`, H2 → `h3`, H3 → `h4`) so a Step's content never repeats the page's `h1`. Content that opens with an H2 therefore renders `h1` → `h3` on the public Project page and in the runner, which axe flags as `heading-order` (moderate, best practice).

**What "fixed" means:** the renderer normalises heading levels relative to the first heading in the document, or clamps each heading to one level below the previous one, so rendered content never skips a level under the page's `h1`. The editor is unchanged.

Acceptance: a `rich-text.test.tsx` case for content opening with H2 and H3; axe clean on the public Project page with such a description.
