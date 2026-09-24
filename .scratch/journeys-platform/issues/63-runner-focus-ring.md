# 63: Keyboard focus on a Choice is nearly invisible

Status: done
Blocked by: 56
Owner: Claude (Fable 5.1), 2026-09-24, PR #76
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (56's regression pass, 2026-09-24): a keyboard user walking a Journey cannot see which Choice, Next, or Start over is focused, especially in dark mode.
Route: polish

**Why:** the runner's Choices, Next, Continue, and Start over use `choiceLinkClassName` (`src/components/runner/step-view.tsx`), the shadcn `outline` button. Its focus style is `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`: a 50 % ring over a pale border on a pale card. Tabbing to Next on Case 1's Preface shows only a faint green halo in light mode (`test-results/56-regression-pass/prod-1280-light-keyboard-focus-choice.png`) and no perceptible change in dark mode (`test-results/56-regression-pass/prod-375-dark-keyboard-focus-choice.png`). The splash's primary button, by contrast, shows a clear ring (`focus-visible` on a filled button).

**What is true today:** the ring token is shared by every button; the runner is themed by the Theme's palette (ticket 11), so the ring colour comes from the theme's `--ring`. Analytics and the editor use the same buttons but with a stronger contrast context.

**What to do:**

1. Give the runner's Choice-like controls a visible `focus-visible` treatment: a 2 px solid outline in the Theme's accent (or `--ring` at full opacity) with a 2 px offset, in both colour schemes and every preset.
2. Do not change hover or the chosen-edge accent (ticket 11's "edge of a choice as it is chosen").
3. Check the six presets in dark and light; the contrast of the outline against the card must be at least 3:1 (WCAG 2.4.11 focus appearance).

Acceptance criteria:

- [x] The `runner` spec tabs to the first Choice and asserts the computed `outline-style` is `solid` with a non-zero width, and captures `runner-focus-{light,dark}.png`.
- [x] Manual check across presets recorded in the closeout.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding E.

## Comments

### 2026-09-24 — [CLOSEOUT] Claude (Fable 5.1), `/implement` from a worktree

- **PR:** https://github.com/paul-macfarlane/journeys/pull/76 (`feat/63-runner-focus-ring` → `staging`, base `7a42d6d`). Worktree `.claude/worktrees/63-runner-focus-ring/journeys`, `E2E_PORT=3163`, `E2E_DATABASE_NAME=journeys_e2e_63`, CI's dummy env exported from a scratch script (no `.env.local`).
- **Delivered:** `choiceLinkClassName` (`src/components/runner/step-view.tsx`) adds `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid`: a solid 2 px outline in the Theme's `--ring` at full opacity, offset 2 px, on every control built on the class — Choices, Next, Continue, Save response, "Continue where you left off", and "Start over" — in the live runner, Preview, and the Choice-styled links on the public Project and Author pages. `outline-solid` is explicit because the shared button's `outline-none` sets Tailwind's outline-style variable to `none`, which a bare `outline-2` inherits (the first attempt without it computed `outline-style: none`). Hover (`hover:border-primary`) and the suggested Choice's `ring-primary ring-2` are untouched; the button's own half-opacity focus ring stays beneath the outline. The `runner` spec gains `runner-focus`: it tabs to the first Choice by keyboard (a `.focus()` call never triggers `:focus-visible`) in a light and a dark context, polls `toHaveCSS` for `outline-style: solid`, `outline-width: 2px`, `outline-offset: 2px` (polled, because the button carries `transition-all` and a one-shot read caught the offset at 0 on the first frame), and captures both screenshots.
- **Manual check across presets** (step 3; `--ring` against `--background`, where the offset outline sits, and against `--card`, computed from the oklch tokens in `globals.css` with the same maths as `scripts/contrast.mjs`; threshold 3:1):

  | preset | light ring:bg | light ring:card | dark ring:bg | dark ring:card |
  |---|---|---|---|---|
  | trail | 4.47 | 4.59 | 6.99 | 6.34 |
  | parchment | 3.75 | 3.97 | 6.30 | 5.66 |
  | tide | 4.35 | 4.53 | 7.01 | 6.37 |
  | dusk | 4.17 | 4.42 | 6.89 | 6.23 |
  | ember | 3.82 | 4.05 | 6.52 | 5.93 |
  | slate | 4.06 | 4.24 | 6.64 | 6.00 |

  Worst 3.75 (parchment, light, against the background): PASS on all twelve. An Author's accent replaces `--ring`; by night `globals.css` lifts its lightness to at least 0.7, by day it is the colour as picked, so a pale accent on light paper can fall under 3:1 — the same latitude the hover border has had since ticket 11, outside this ticket's "six presets" and recorded here rather than changed.
- **Commands** (`test-results/63-commands.txt`, on `1828b27 (the working tree of the evidence commit, source unchanged since)`): `pnpm lint`, `pnpm typecheck`, `pnpm test` (544), `E2E_EVIDENCE=runner-focus pnpm test:e2e` — 110 passed in 1.8 min, started at load 4.8, all PASS.
- **Two earlier full runs were FAIL**, both 109 passed and `metadata-autosave` failed on the known Settings-tab race (`setup/authoring.ts:143`, the same line as ticket 60's two failures): `test-results/63-e2e-run-1-failed.txt` on `2145718` with the machine at load average 46, and `test-results/63-e2e-run-2-failed.txt` on `1828b27` started at load 8.6 (the suite's own workers push it past 20). This ticket touches neither the Settings tab nor autosave, and `metadata-autosave` run alone on the same build passed in 4.3 s. The run cited above started once the one-minute load fell under 6, as ticket 60's passing run did. The race already has a task chip from ticket 60.
- **Evidence:** `test-results/runner-focus/runner-focus-light.png` and `runner-focus-dark.png` (the first Choice "Wait your turn" focused by keyboard on the `runnerDocument()` fixture, trail preset), from the evidence run above.
- **Acceptance criteria:** AC 1 (spec tabs, asserts `solid` with a non-zero width, captures both files) — PASS, `runner-focus` passed on every run including the three consecutive local runs used to settle the transition race. AC 2 (manual preset check) — PASS, table above. AC 3 (command chain) — PASS, capture above.
- **AI Code Review** (one reviewer, Standards + Spec axes, on `2145718`):
  - Spec: nothing missing; the test meets the criterion exactly; the outline never interacts with hover or the suggested-Choice ring; the six presets clear 3:1 (two pairs re-derived independently). One wording fault: the class comment said an accent's ring is "lifted by night the same way", implying light-scheme accents are covered — fixed in `1828b27`, and recorded above. Noted, not a fault: the shared class also restyles the Choice-styled links on the public Project and Author pages.
  - Standards: no hard violations; Tailwind v4 classes correct and `outline-solid` necessary; tailwind-merge keeps all four classes; no flake risk (polled assertions, bounded `tabTo`, focus needs no hydration, no `autoFocus` on the fixture); evidence paths per policy. Judgement calls, both taken in `1828b27`: cite the WCAG criteria that actually carry 3:1 (1.4.11 and 2.4.13, not 2.4.11), and move `tabTo` beside the other helpers with its press cap as a named constant. Declined: extracting the light/dark `newContext` loop shared with `themes.spec` and `landing.spec` (pre-existing, beyond a polish ticket).
- **Deviations:** none from the ticket's steps.
