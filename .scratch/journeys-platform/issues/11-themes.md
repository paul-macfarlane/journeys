# 11: Themes

Status: done
Blocked by: 06, 07
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Route: contract

**What to build:** An Author picks one of ~6 curated preset Themes for a Project and optionally an accent color; a Journey can override its Project's Theme. The runner and the public Project page render in the Theme; the authoring UI does not. A nullable custom-tokens column is reserved and unused.

- [x] Preset picker and accent color on Project settings; override toggle + picker on Journey settings.
- [x] Runner and Project page reflect the effective Theme (Journey override wins); editor is unchanged.
- [x] Every preset passes WCAG AA contrast (axe `color-contrast` rule via `@axe-core/playwright`) on the runner start screen, a Step, and the Project page, in light and dark — screenshot evidence per preset under `test-results/`.
- [x] Seam B: set a preset → open the runner → assert the theme attribute/class.

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

### [AI CODE REVIEW] 2026-09-22 — two-axis review of `2f61ab0..e2ccf70`, fixes in `97e204a` and `b6c7390`

Two fresh readers (opus, `/code-review`: standards and spec) read the whole diff against the ticket, its execution plan, `CLAUDE.md`, `CONTEXT.md`, `docs/agents/testing.md`, `docs/branding.md`, spec stories 71–75, the Data model, the public Project page paragraph, and the Non-goals, plus the neighbouring settings, data-access, runner, and e2e code the change mirrors. **No blocking finding on either axis; no correctness bug found.**

**Standards** (2 documented, 6 smells): a second copy of the spruce hex in the picker where `docs/branding.md` makes `src/lib/brand.ts` the home of hex anchors — **resolved (`97e204a`)**, `BRAND_COLORS.spruce`; the accent's JSDoc and `docs/branding.md` said two tokens while the code set three — **resolved (`97e204a`)**, the mechanism changed (below) and both texts describe it; the "null preset is no override" shape written twice (`src/db/journeys.ts`, `src/db/runs.ts`) — **resolved**, one `readThemeOverride` in `src/lib/theme.ts` with tests; four theme columns flattened and re-destructured in `getRunForJourney` — **resolved**, the select is nested (`run`, `version`, `theme`); `toSummary` computing a publish state the writes then overwrote — **resolved**, it takes the state; `cn()` around one literal — **resolved**; `--primary-foreground` set with nothing in the frame reading it — kept on purpose, it is what keeps any future primary fill readable, and the spec finding below made it part of the dark-scheme rule; the `E2E_PORT`/`E2E_DATABASE_NAME` overrides as a change unrelated to Themes — kept, recorded as a deviation below.

**Spec** (0 missing, 2 not-asked-for, 3 looks-wrong): nothing in the four criteria missing or partial, and the reserved `theme_custom_tokens` column confirmed present and unread. Not asked for and kept: the e2e overrides (deviation below); the stripe along the top of the frame and the Choice hover border in the Theme's primary — kept, as the accent's surface (the ticket asks for an accent and gives it nowhere to show; both are recorded as decisions in the execution plan and `docs/branding.md`); Preview themed — the reader agreed story 38 asks for it. Looks wrong: the new code selects the new columns unconditionally, so a Vercel build landing before the Migrate action would 500 the runner for that window — the same exposure every add-a-column ticket here has carried, named in the PR rather than coded around; **an Author's dark accent vanished on dark paper** because the hex replaced `--primary` in both schemes — **resolved (`97e204a`)**, the accent now rides as `data-accent` plus `--theme-accent`, and a `.dark [data-theme][data-accent]` rule lifts its oklch lightness to 0.75 before use, proved by painted luminance by day and by night in `themes-settings` (`b6c7390` corrected the assertion's threshold); the picker's swatches carry `data-theme` inside the authoring UI, so the attribute alone no longer names the frame — **resolved (`97e204a`)**, the frame carries `data-slot="runner-frame"` and the spec locates it by that while still asserting no `data-theme` anywhere on the editor tab.

### [CLOSEOUT] 2026-09-22 — /implement (Claude Fable 5.1)

**Delivery:** repository `journeys`, branch `feat/11-themes` from `staging` at `2f61ab0`, in the worktree `.claude/worktrees/11-themes/journeys`; implemented by the orchestrator (Claude Fable 5.1) with no delegated workers; reviewed by two opus readers. Commits: `e2ccf70` (feature), `97e204a` (review fixes), `b6c7390` (assertion fix), `9411e34` (evidence), then this closeout. PR: https://github.com/paul-macfarlane/journeys/pull/42 (to `staging`; CI red until Paul commits the lockfile).

**Verified run command** (`test-results/dod-1-commands.txt`, at `b6c7390`, from the worktree with `E2E_PORT=3111 E2E_DATABASE_NAME=journeys_e2e_t11`):

```
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm db:migrate && E2E_EVIDENCE=themes-settings,themes-contrast pnpm test:e2e
```

Exit status 0; Vitest 367 passed in 24 files; migration 0009 applied; Playwright 86 passed (production build, `retries` 0, nothing flaky). Dependency change: `@axe-core/playwright` (dev) — `package.json` is committed, the lockfile is left for Paul to commit from his terminal, so CI is red on this PR until that commit lands. No deployed-target check (Paul's 2026-09-20 decision).

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 Preset picker and accent on Project settings; override toggle and picker on Journey settings | PASS | `test-results/themes-settings/project-settings.png` (six presets with swatches, accent on, `#c2410c`), `…/journey-settings.png` (override on, Dusk, accent off); every save polled on the row in `e2e/themes.spec.ts`; `src/app/projects/actions.test.ts` and `…/journeys/actions.test.ts` for the two actions |
| AC-2 Runner and Project page reflect the effective Theme, Journey override wins, editor unchanged | PASS | `…/project-page-tide.png`, `…/runner-step-tide.png` (Project's Tide with the accent), `…/runner-start-dusk.png` (the Journey's Dusk winning while `/p/<id>` stays Tide), `…/runner-start-tide-dark.png` (the accent lifted by night); the editor tab asserted free of `data-theme`; `src/lib/theme.test.ts` for `effectiveTheme` |
| AC-3 Every preset passes axe `color-contrast` on the start screen, a Step, and the Project page, light and dark | PASS | `test-results/themes-contrast/<preset>-<scheme>-<start|step|project>.png`, 36 screens, 0 violations and 7–9 elements checked on each (the `contrast …` lines in `dod-1-commands.txt`); token ratios in `docs/branding.md` "Themes" |
| AC-4 Seam B: set a preset → open the runner → assert the theme attribute | PASS | `themes-settings` in `e2e/themes.spec.ts`: Tide chosen on the Settings tab, `/j/<id>` and a Step carry `data-theme="tide"` and `data-accent="#c2410c"` |
| DoD-1 command chain green | PASS | `test-results/dod-1-commands.txt` |
| DoD-2 PASS artifacts committed, fixture journeys only | PASS | `9411e34`; every screen is the spec's own `runnerDocument()` |

**Deviations:** (1) `e2e/setup/e2e-env.ts` reads `E2E_PORT` and `E2E_DATABASE_NAME` from the environment, defaults unchanged, so this worktree's suite could run beside the ticket 10 session's on the shared machine; CI and a single checkout are unaffected, and `CLAUDE.md`'s "port 3100 / `journeys_e2e`" line stays true by default (Paul may want a note there). (2) The ticket had no `Route:` line; `contract` was added (schema and public routes). **Red team:** not run, as the execution plan records. **Deploy window:** every new column defaults or is nullable, so the code deployed before 0009 keeps working; the new code selects the columns unconditionally, so if the Vercel build lands before the Migrate action the runner and `/p/<id>` fail for that window, as with every add-a-column ticket here. **Follow-ups:** the `theme_custom_tokens` column is reserved and unread; the Journey page's new Settings tab holds only the Theme today and is the place for any future per-Journey setting; ticket 10's analytics tab will land beside it in `JOURNEY_TABS`.
