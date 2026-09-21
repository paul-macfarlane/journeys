# 19: Canvas quality of life

Status: ready-for-agent
Blocked by: 16
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: third of the graph tidy-up series (18 → 16 → 19 → 17).

**What to build:** the smaller editor conveniences a writer who lives on the canvas will reach for.

- **Find a step.** A "Find step" field above the canvas (also opened with Cmd/Ctrl+K on the Journey page) filters Step titles as you type; choosing one selects it and centers the map on it.
- **Duplicate step.** "Duplicate" in the box toolbar and the panel footer copies a Step's title (suffixed " copy"), content, Prompt, and Outcome, with no Choices, places it beside the original, and opens it.
- **Content peek.** Hovering a box (or focusing it) shows the first ~140 characters of its content as plain text in a tooltip so the map can be skimmed without opening every Step.
- **Selected step stays in view.** The panel column is sticky so the selected Step's fields stay beside the map while the page scrolls.
- **Map keyboard basics.** With a box focused: Enter opens it (already), arrow keys move focus to the nearest box in that direction, Escape returns focus to the canvas.
- **Zoom to selection / fit.** A "Fit" control already exists; add "Zoom to step" in the box toolbar.

Not included, recorded as decisions for Paul: **undo/redo** for structural edits (the spec excludes undo; an in-memory history stack of the Draft document with Cmd/Ctrl+Z is a medium change worth its own ticket if wanted) and **collapsing or removing the step list** beyond ticket 16's disclosure.

- [ ] Typing part of a title in "Find step" and choosing the match selects that Step and brings its box into the viewport (case-3, a Step at the bottom of the map).
- [ ] "Duplicate" creates a Step with the same content and Outcome, no Choices, title suffixed " copy", opened in the panel.
- [ ] Hovering a box shows its content's opening text.
- [ ] Arrow keys move focus between boxes; Enter opens the focused one.
- [ ] Seam B: find, duplicate, and edit through the map; screenshots under `test-results/`.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's usage feedback on PR #19, 2026-09-21.

## Comments
