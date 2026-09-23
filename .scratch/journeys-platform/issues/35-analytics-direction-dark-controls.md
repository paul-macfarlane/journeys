# 35: Analytics map direction and the dark-mode canvas controls

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (/implement, worktree, 2026-09-23)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → **35** → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: polish

**Why:** The Analytics tab draws the Published Version in the direction stored on its document and offers no way to turn it (item 15: "The analytics canvas should also have the option to switch between top to bottom and left to right"). In the dark theme the zoom in, zoom out, and fit-view controls sometimes render white (item 19: "this doesn't happen all the time, only some of the time").

**Decisions (Paul, 2026-09-22, grilled):**

- The analytics direction is a way of reading, not content: a Published Version is immutable, so the toggle is a per-browser preference like the hidden panel (ticket 21), stored in `localStorage` beside `PANEL_STORAGE_KEY`, defaulting to the version document's own `layoutDirection`. Nothing is written to the Draft or the version.
- The controls bug is fixed at its cause, not by a `!important`.

**What to build:**

- **Direction.** `AnalyticsCanvas` (`src/components/journeys/analytics-canvas.tsx`) takes a `direction` and lays the version out with it (`layoutGraph` already accepts one for the editor); `AnalyticsTab` renders the same direction toggle the editor uses, beside the version select, and remembers the choice per browser. Switching refits the view.
- **Controls.** Reproduce first: dark theme, land on a Journey page by full load and again by client-side navigation from the Projects list, in both OS colour schemes. The likely cause is a stylesheet-order contest: `globals.css` sets React Flow's `--xy-*-default` variables on `.react-flow` and `.react-flow.dark` (lines ~405–445), the same selectors and specificity React Flow's own stylesheet uses, so whichever chunk Next.js emits last wins, and chunk order differs between a full load and a client navigation. The fix is to set the non-default names React Flow reads first (`--xy-controls-button-background-color`, `--xy-controls-button-color`, `--xy-controls-button-border-color`, `--xy-controls-button-background-color-hover`, and the same for the minimap, edges, and nodes) on the canvas wrapper, which no React Flow rule ever sets, so order no longer matters. A second suspect is `useCanvasColorMode` (`src/components/journeys/canvas-shared.ts`) answering `"system"` before hydration while the app is dark on a light OS; confirm whether `.react-flow.light` is ever stamped and, if so, cover it. Record the confirmed cause in the closeout.
- **Specs.** `analytics` gains `analytics-direction-toggle`: switch to left-to-right, read the arrows' handle sides (`data-direction` or the handle positions the editor spec already reads), reload, and find it remembered. `canvas` gains `canvas-dark-controls`: in the dark theme, by full load and by client navigation, assert the computed background colour of `.react-flow__controls-button` equals the card token's computed colour (read `--card` off `<html>` and compare through a canvas probe as ticket 31 did).

Acceptance criteria:

- [x] The Analytics tab offers top-to-bottom and left-to-right, the map relays out and refits, and the choice survives a reload in the same browser without touching the version document.
- [x] In the dark theme the canvas controls take the theme's card and foreground colours on a full load and after client-side navigation, on both OS colour schemes; the closeout names the confirmed cause.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, items 15 and 19.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/47 (base `staging`, comparison SHA `cf3d781`). Status set to `done` in this commit; merging the PR is Paul's acceptance. Delivered from the worktree `.claude/worktrees/35-analytics-direction-dark-controls/journeys` on port 3135 / `journeys_e2e_t35`, with a dummy env exported from the scratchpad (no `.env.local`), so Paul's checkout stayed free.

**Commits.** 6048ea6 — the direction toggle on the Analytics tab (`DirectionControl` extracted from the editor's Canvas into `direction-control.tsx`; `AnalyticsTab` a client component holding the preference; `AnalyticsCanvas` takes `direction` and refits on a change), the browser-preference module (`src/lib/browser-preferences.ts`: `PANEL_STORAGE_KEY`, `ANALYTICS_DIRECTION_STORAGE_KEY`, guarded `readPreference`/`writePreference`, `usePreference` over `useSyncExternalStore`; the editor's panel preference routed through it), both controls fixes, and the two specs. f530d23 — review fixes. aa0ab75 — evidence.

**The confirmed causes (both reproduced on the untouched build by `canvas-dark-controls` before the fix).**

1. *Stylesheet order*, as the ticket suspected. `globals.css` set React Flow's `--xy-*-default` names on `.react-flow` and `.react-flow.dark`, the selectors React Flow's own sheet uses; React Flow's sheet came last on every arrival tested (full load and client navigation, both OS schemes), so in the dark theme the controls painted React Flow's own dark greys (`43,43,43` on `248,248,248`) instead of the card and foreground. Fixed by setting the un-suffixed `--xy-*` names React Flow reads first (`var(--xy-X, var(--xy-X-default))`), which no React Flow rule sets, on `.react-flow` (one rule for both maps rather than each wrapper; every name checked against `@xyflow/react` 12.11.6's `style.css`, including `--xy-background-pattern-color` for the dots). Order no longer matters, and the tokens follow `html.dark` regardless of React Flow's class.
2. *Hydration*, the ticket's second suspect, confirmed: `.react-flow.light` was stamped and stayed stamped on a full load with the OS dark (`254,254,254`, React Flow's light `#fefefe`). `useCanvasColorMode` answered `"system"` until hydrated; React Flow's `useColorModeClass` resolves `"system"` through `matchMedia` on the spot, so the server render (`light`) and the hydrating render (`dark`) disagreed about the class, React keeps the server's attribute on a hydration mismatch, and every later render computed the same class as the hydrating one, so the DOM was never updated. The hook now answers a definite `"light"` until hydrated, then the resolved theme: the two renders agree and the change afterwards is an ordinary update. Not reachable by client navigation (no hydration) or with the OS light (the two renders agree), which is why it was "only some of the time".

**Verified run command (final tree, head f530d23):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=canvas-dark-controls,analytics-direction-toggle pnpm test:e2e` — every block `exit=0`; unit 396/396; e2e 92 passed in 3.3m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3135, Chromium. `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| The Analytics tab offers top-to-bottom and left-to-right, the map relays out and refits, and the choice survives a reload in the same browser without touching the version document | PASS | `analytics-direction-toggle`: source anchors move from bottom to right and targets from top to left, the queue Step stands past the Start's right edge, every box inside the map frame after the refit, a reload finds "Left to right" checked, `published_version.document.layoutDirection` still `TB`, a second browser of the same Member (cookie carried, storage not) opens it top to bottom, and it turns back; `test-results/analytics-direction-toggle/analytics-direction-toggle.png` (viewed: toggle beside the version select, map left to right) |
| In the dark theme the canvas controls take the card and foreground on a full load and after client-side navigation, on both OS colour schemes; the closeout names the confirmed cause | PASS | `canvas-dark-controls`: dark chosen from the user menu, four arrivals (OS light/dark × full load/client navigation from the Projects list), the map carries React Flow's `dark` class and the buttons' painted background and glyph colours equal `--card` and `--foreground` read off `<html>` through a one-pixel canvas; `test-results/canvas-dark-controls/canvas-dark-controls.png` (viewed: dark controls on the dark map); causes above |
| `pnpm test:e2e` once in full at the end | PASS locally (92/92); PR CI is the durable proof | `test-results/dod-1-e2e.txt`; PR checks |

**AI review (one Opus reader, both axes, diff `cf3d781..6048ea6`).** 1 blocking: `readPreference`/`writePreference` resolved `window.localStorage` in a default argument, outside the `try`, so a browser with site data blocked (Chrome throws from the accessor itself) would have crashed the Analytics tab and the panel click — fixed by reaching storage through a function inside the guard, with a unit test for that refusal. Non-blocking, fixed: a refused write left the toggle doing nothing (a refused value is now held for the life of the page, tested); the class and colour reads in the dark-controls spec were one-shot (now `toHaveClass` and `expect.poll`); `ARROW_KEYS` repeated the editor's `ARROW_DIRECTIONS` (shared from `canvas-shared.ts`); a dead `useCallback`; "Author" where the Analytics reader is a Member; the two cause comments now name each other's symptom. Non-blocking, accepted: a React hook in `src/lib/` (precedent: `session.ts`); the preference is one key per browser, so once chosen it applies to every version of every Journey read there (follows the "like the hidden panel" decision; queued for Paul below). Spec axis: `{ ...document, layoutDirection }` accepted as the reading of "`layoutGraph` already accepts one" (it does not; the copy is never stored); the variables on `.react-flow` accepted as meeting "so order no longer matters".

**Deviations.** (1) The un-suffixed variables sit on `.react-flow` in `globals.css` rather than on each canvas wrapper: same effect, one rule, both maps. (2) `layoutGraph` is unchanged; the analytics map hands it a copy of the version document with the chosen direction. (3) The dark-controls spec also checks the glyph colour and React Flow's class, beyond the background the ticket named. (4) `pnpm build` was not run on its own: `pnpm test:e2e` builds the app.

**One unrelated flake, not this ticket's.** In the first full run `prompts-participant-answers-and-author-reads` failed once (the queue answer refilled after "← Back" was submitted as the old one) and passed on three isolated reruns and the second full run. Cause: React's textarea hydration (`initTextarea` sets `element.value = element.textContent`) resets a value Playwright typed before hydration finished; under a loaded machine the spec's `fill` lands first. The runner is right for a real Participant; the spec should wait for hydration before filling. Flagged as a separate task for Paul; nothing in this diff touches the runner.

**Queued for Paul (non-blocking, also in the PR).** The single per-browser direction key with no "follow the version again" state; the prompts spec's hydration race.

**Next in Paul's order:** 36 → 37 (sweep 1), then 38 → 39 → 40 → 43.
