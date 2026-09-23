# 35: Analytics map direction and the dark-mode canvas controls

Status: ready-for-agent
Blocked by: None
Owner:
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

- [ ] The Analytics tab offers top-to-bottom and left-to-right, the map relays out and refits, and the choice survives a reload in the same browser without touching the version document.
- [ ] In the dark theme the canvas controls take the theme's card and foreground colours on a full load and after client-side navigation, on both OS colour schemes; the closeout names the confirmed cause.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, items 15 and 19.

## Comments
