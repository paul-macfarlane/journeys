# 11: Themes

Status: ready-for-agent
Blocked by: 06, 07
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** An Author picks one of ~6 curated preset Themes for a Project and optionally an accent color; a Journey can override its Project's Theme. The runner and the public Project page render in the Theme; the authoring UI does not. A nullable custom-tokens column is reserved and unused.

- [ ] Preset picker and accent color on Project settings; override toggle + picker on Journey settings.
- [ ] Runner and Project page reflect the effective Theme (Journey override wins); editor is unchanged.
- [ ] Every preset passes WCAG AA contrast (axe `color-contrast` rule via `@axe-core/playwright`) on the runner start screen, a Step, and the Project page, in light and dark — screenshot evidence per preset under `test-results/`.
- [ ] Seam B: set a preset → open the runner → assert the theme attribute/class.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
