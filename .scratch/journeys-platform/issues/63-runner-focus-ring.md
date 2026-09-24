# 63: Keyboard focus on a Choice is nearly invisible

Status: ready-for-agent
Blocked by: 56
Owner:
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

- [ ] The `runner` spec tabs to the first Choice and asserts the computed `outline-style` is `solid` with a non-zero width, and captures `runner-focus-{light,dark}.png`.
- [ ] Manual check across presets recorded in the closeout.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding E.
