# 11: Themes

Status: in-progress
Blocked by: 06, 07
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Route: contract

**What to build:** An Author picks one of ~6 curated preset Themes for a Project and optionally an accent color; a Journey can override its Project's Theme. The runner and the public Project page render in the Theme; the authoring UI does not. A nullable custom-tokens column is reserved and unused.

- [ ] Preset picker and accent color on Project settings; override toggle + picker on Journey settings.
- [ ] Runner and Project page reflect the effective Theme (Journey override wins); editor is unchanged.
- [ ] Every preset passes WCAG AA contrast (axe `color-contrast` rule via `@axe-core/playwright`) on the runner start screen, a Step, and the Project page, in light and dark — screenshot evidence per preset under `test-results/`.
- [ ] Seam B: set a preset → open the runner → assert the theme attribute/class.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [EXECUTION PLAN] 2026-09-22 — /implement (Claude Fable 5.1)

**Contract:** this ticket as written; no scope change. The ticket carried no `Route:` line; it changes the schema and what two public routes render, so it is `contract`. Criteria in checklist order: AC-1 preset picker and accent color on Project settings, override toggle and picker on Journey settings; AC-2 runner and Project page reflect the effective Theme (Journey override wins), editor unchanged; AC-3 every preset passes axe `color-contrast` on the runner start screen, a Step, and the Project page in light and dark, screenshots per preset; AC-4 Seam B: set a preset → open the runner → assert the theme attribute. Derived DoD: DoD-1 the `contract` chain green (`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate`, then one `E2E_EVIDENCE=<the themes spec's tests> pnpm test:e2e`); DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only. **Dependency change:** `@axe-core/playwright` (dev), as the ticket names; the lockfile commit is Paul's, from his terminal (`CLAUDE.md`).

**Availability:** `Blocked by` 06 and 07 are both `done` on `staging`; no other claim. Branch `feat/11-themes` from `staging` at `2f61ab0`, in the worktree `.claude/worktrees/11-themes/journeys` so ticket 10 can proceed in another session.

**Decisions resolved from the spec and `CONTEXT.md`** (the ticket leaves them open):

- A Theme is a preset id plus an optional accent color (spec, Data model). Six presets, each with a light and a dark token set, defined in `globals.css` under `[data-theme="<id>"]` and `.dark [data-theme="<id>"]`: `trail` (the app's own palette, the default for every existing Project), `parchment`, `tide`, `dusk`, `ember`, `slate`. The ids and labels live in `src/lib/theme.ts`, the one place the picker, the schema, and the runner read them from.
- Columns: `project.theme_preset text NOT NULL DEFAULT 'trail'`, `project.theme_accent text NULL`, `project.theme_custom_tokens jsonb NULL` (the reserved, unused column the spec documents), `journey.theme_preset text NULL`, `journey.theme_accent text NULL`. A Journey overrides its Project exactly when its `theme_preset` is set; the effective Theme is the Journey's preset and accent when set, else the Project's. Every column defaults or is nullable, so the code deployed before migration 0009 keeps inserting and the Migrate action and the Vercel build may land in either order.
- The Theme is presentation, read from the Project and Journey rows at request time, not snapshotted into a Published Version: setting a preset shows in the runner at once with no publish, which is what Seam B asks for and how the public Project page already reads its description.
- The accent is a `#rrggbb` color. It replaces `--primary` and `--ring` inside the themed frame and is used only as a fill and a border (the stripe across the top of the frame, a Choice's hover and focus border, focus rings), never as text; its own foreground is chosen by luminance on the server, so an arbitrary accent can never fail WCAG AA on text. The presets alone carry the contrast guarantee the ticket names.
- The runner frame (`RunnerFrame`) is the one surface that carries `data-theme`: the runner's start screen and Steps, the public Project page, and Preview (a Participant-facing surface, so an Author sees what Participants will), all paint the effective Theme; every Author page keeps the app tokens.
- Journey settings: the Journey page gains a "Settings" tab (there was none) holding the override toggle and, when on, the same picker the Project's Settings tab uses. Both save on change, blur-saved like the other Settings fields (`useBlurSavedForm`).
- Contrast is proved by axe's `color-contrast` rule (`@axe-core/playwright`), one run per preset per surface per scheme, with a screenshot each; the token pairs are also computed by `scripts/contrast.mjs` and recorded in `docs/branding.md`.

**Structure:** one session, seams in order. (1) Pure seam by TDD: `src/lib/theme.ts` (presets, schemas, effective Theme, accent foreground, inline style). (2) Schema and migration 0009. (3) Data access on Projects, Journeys, and the runner reads. (4) Actions with doubles tests. (5) Frame and the six presets in CSS, checked with `scripts/contrast.mjs`. (6) Pickers on both Settings tabs. (7) Seam B and the contrast sweep: `e2e/themes.spec.ts`.

**Review:** `/code-review` (two fresh readers, standards and spec), as `contract` requires. **Red team:** not run — this implements the spec's own Theme model (Data model, story 71–75) on the existing settings and runner seams; it changes no part of the graph model, publishing, Run semantics, auth, or the deploy path.
