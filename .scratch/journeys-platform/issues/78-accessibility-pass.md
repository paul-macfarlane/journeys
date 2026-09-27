# 78: Accessibility pass

Status: in-progress
Blocked by: None
Owner: Claude (Fable 5.1), chunk 5
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

### 2026-09-27 — Claude (Fable 5.1), chunk 5

`[EXECUTION PLAN]` Chunk 5 with 42; the chunk plan is in 42's record. This ticket is two deliverables: **D2** (items 1–4 and ACs 1–3, one worker in worktree `journeys-d2`, in parallel with 42) and **D3** (item 5, the walk, on the integrated chunk branch after D1 and D2 land). Resolved decisions:

1. **Titles:** `generateMetadata` on the Author Project page and Journey page returns the row's title (the root template appends "· Journeys"), calling `notFound()` when the membership read is null, as the public pages do since ticket 60. `projectForMember`, `journeyForMember`, and `getSession` are `cache()`d, so the page pays no second query.
2. **Headings:** a visually hidden `h1` with the Journey's title, above the tab row; every heading below it descends one level at a time (the Step panel's "Problems" `h4` moves up, and whatever else axe's `heading-order` names on the Editor, Versions, Responses, Analytics, and Settings tabs).
3. **Attribution:** `.react-flow__attribution` is restyled in `globals.css` so its link reads at 4.5:1 or better on the map in both schemes; it stays visible (React Flow's licence asks for it).
4. **Content headings:** `RichText` renders headings one level down (H1 → `h2`, H2 → `h3`, H3 → `h4`) wherever it renders stored rich text — the runner's Step content, Preview, and the public Project page's description, each already under a page `h1`. The renderer's extension set allows level 4 (Tiptap's Heading falls back to its first allowed level for one it does not know, so the render set and the editor set diverge here and nowhere else). The editor is unchanged. Unit test in `rich-text.test.tsx`; the `h4` gets a text style.
5. **Axe:** a new `e2e/accessibility.spec.ts` with `a11y-project-page` and `a11y-journey-page`, signed in, the full default rule set, in light and dark, with the Journey page on its Editor tab with a Step selected; each also asserts the page title. The `runner-single-h1` test publishes a Step whose content opens with an H1 and counts one `h1`.
6. **The walk (D3):** automated in place of VoiceOver — the accessibility tree, tab order, names and roles, axe, and `prefers-reduced-motion` over every listed surface, driven with Playwright against a production build. Fixes land in the chunk; anything larger is proposed as a ticket. Paul is asked whether he wants a VoiceOver pass of his own on top.

Verification map (route `polish`): AC-1 → `a11y-project-page` and `a11y-journey-page` screenshots; AC-2 → `runner-single-h1`; AC-3 → asserted inside the two `a11y-*` tests; AC-4 → the `[CLOSEOUT]` list; AC-5 → ticket 15's bullet ticked in the closeout commit; the chunk's full run in `test-results/chunk-5-commands.txt`.
