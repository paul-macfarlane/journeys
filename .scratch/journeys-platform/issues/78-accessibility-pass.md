# 78: Accessibility pass

Status: done
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

`[AI CODE REVIEW]` The chunk's two reviewers; the full list is in 42's record. For this ticket:
- F3 was fixed in c8554e3. D2 had capped the editor's headings at levels 1–3, which broke `####` and pasted `h4`–`h6`, and would have drawn a stored H4–H6 as `h1`. That contradicted "the editor is unchanged". Tiptap's Heading already allows 1–6, so every `levels` override is gone and the runner's shift clamps at 6.
- F10 was fixed: axe now also runs over the Versions, Responses, Analytics, and Settings tabs, in light, with zero violations.
- The fixed sleep in `a11y-reduced-motion` was replaced by awaiting the sampler (CS-5, CS-6, F12).
- Comment fixes: CS-1, CS-9, CS-10, CS-12.

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/111 (chunk 5, with ticket 42).
- **Workers:**
  - D2: items 1–4, one worker (Sonnet, worktree `journeys-d2`, commit b2f88bd, run in parallel with 42). Orchestrator fix: a JSDoc it had moved off `hardenBlock` was put back.
  - D3: the walk, one worker (Opus, worktree `journeys-d3`, 159cf7e).
  - Review fixes by a Sonnet worker (c8554e3).
- **Verified** at 745a9c6 on local `next start` over docker Postgres 18.
- **Verdicts:**
  - AC-1 PASS: `test-results/a11y-project-page/` and `test-results/a11y-journey-page/`. The full default axe rule set ran, signed in, in light and dark, with no rule disabled.
  - AC-2 PASS: `test-results/runner-single-h1/`, plus `rich-text.test.tsx` (H1 → `h2`, H3 → `h4`, H5 and H6 → `h6`).
  - AC-3 PASS: the two titles are asserted in the two `a11y-*` tests.
  - AC-4 PASS: the list below.
  - AC-5 PASS: ticket 15's bullet ticked in this commit.
  - The full run is in `test-results/chunk-5-commands.txt`: 133 passed, 0 flaky.
- **Fixes beyond items 1–4, found by axe on the two pages (D2):**
  - unselected tab text went from `foreground/60` (4.24:1) to `/70`;
  - the light scheme's destructive button text (3.83:1) is mixed toward black;
  - the Analytics tab's and Responses tab's top headings moved to `h2`, and "Choices" and "Problems" to `h3`.
- **The walk (D3).** Automated, not VoiceOver (plan decision 6). It ran against a production build, recording axe in both schemes, Tab order, names and roles, every dialog and menu, and computed motion under `reduce`. It covered:
  - sign-in and the landing page;
  - the Projects list and the Project tabs;
  - the five Journey tabs, the canvas, and the Step panel with its editor;
  - Preview;
  - the runner's start, a Step with a Prompt, and an Ending;
  - the public Project page, the Author page, and both 404s;
  - account Settings, including the delete dialog.

  Fixed, each with an assertion in `e2e/accessibility.spec.ts`:
  - The rich-text editors had no role, so their name was prohibited (axe `aria-prohibited-attr` on Project Settings) and they had no focus ring. They are now a multi-line `textbox` with a focus ring (`a11y-project-settings`, `a11y-names`).
  - Tab panels are tab stops, and they now show a focus ring (`a11y-names`).
  - Preview had two banners, and its "nothing is recorded" bar sat outside any landmark. The bar is now a region named "Preview", and the frame's header is a region named "Journey" on Preview (`a11y-preview`, `preview.spec`).
  - Copy-link buttons now start their name with the visible "Copy link" (WCAG 2.5.3). The account Settings one is named for the Author page (`a11y-names`, `publish.spec`).
  - The sign-in buttons read "Google Sign in with Google". The logos are now decorative (`a11y-names`, `sign-in.spec`), which reverses the earlier spec's image assertion on purpose.
  - Dialogs, menus, and transitions now finish at once under `prefers-reduced-motion: reduce`, and so do the map's own pan and zoom moves (`mapMoveDuration`) (`a11y-reduced-motion`).

  Checked and already right:
  - every dialog focuses sensibly, traps Tab, closes on Escape, and returns focus;
  - menus open onto their first item and return focus;
  - `Mod-K` reaches Find step;
  - the landing hero already honoured reduced motion.

  Too big for this ticket, filed under "Awaiting a place in the order":
  - 88: canvas arrows' focus and order;
  - 89: the Choice target combobox retargets on Enter, a keyboard-only Draft change;
  - 90: navbar menus under axe;
  - 91: the Preview title;
  - 92: heading order after the shift.

  Not covered:
  - VoiceOver announcements (live regions such as "Copied" and the autosave status), rotor, and touch screen readers;
  - drag-to-connect by keyboard;
  - the image bubble menu;
  - tooltip timing;
  - Members with a second Member;
  - Analytics over several Versions.

  Paul is asked whether he wants a VoiceOver pass of his own.
