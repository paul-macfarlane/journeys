# 78: Accessibility pass

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 15 ("Accessibility pass": nobody has done the full screen-reader and keyboard walk), plus the specific findings from the regression passes.

**What to build:**

1. **Page titles** (64 finding 1). The Project page and the Journey page take "<Project title> · Journeys" and "<Journey title> · Journeys".
2. **Editor headings** (64 finding 2). The Journey page gets an `sr-only` `h1` with the Journey's title, since the visible title is an input, and fixes the jump to `h4` (axe `page-has-heading-one`, `heading-order`).
3. **Map attribution contrast** (64 finding 2). The React Flow attribution link fails contrast (4.24:1, `#999999` on `#2f3835` at 10 px). Restyle it to pass in both schemes.
4. **Runner content headings** (68 finding 4). A Step whose content starts with an H1 renders two `<h1>`s. The runner renders content headings one level down (H1 → h2, H2 → h3, H3 → h4). The editor is unchanged.
5. **The walk.** Every surface with VoiceOver and keyboard only: sign-in, Projects, Project tabs, Journey page, canvas, Step panel, rich-text editor, runner, Preview, account Settings. Fix names, roles, focus order, and reduced motion. Each fix goes in the closeout; anything too big becomes a new ticket.

Acceptance criteria:

- [ ] Zero axe violations on the Journey page and the Project page, signed in, in both schemes (extend the existing axe spec).
- [ ] The runner renders a single `h1` on a Step whose content opens with an H1 (e2e).
- [ ] The Project and Journey pages carry the titles above (e2e).
- [ ] The walk's findings and fixes are listed in the closeout.
- [ ] Ticket 15's "Accessibility pass" bullet is closed.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 15; ticket 64 findings 1–2; ticket 68 finding 4.

## Comments
