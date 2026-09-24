# 38: A recording of the canvas on the landing page

Status: done
Blocked by: None
Owner: Claude (Fable 5.1), /implement, 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) **38** → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon. Must land before the hackathon share on 2026-09-25 if it lands at all.
Route: polish

**Why:** Paul, 2026-09-22, item 1: "What would be really cool is if the splash page had a recording of usage of the graph. We can save this until before we have to share this with the hackathon judges though."

**Decisions (Paul, 2026-09-22, grilled):** the recording is produced by a committed script, not by hand, so it can be re-made after any canvas change. It is silent, loops, plays inline, and shows the poster still under `prefers-reduced-motion`. Under 3 MB committed; no third-party video host.

**What to build:**

- **Script.** `scripts/record-landing-demo.ts` (run with `tsx`, like the seed): starts from the e2e helpers' session minting and the seeded Journey Stories Project (or a fixture Journey it creates and deletes), records a 1280 × 720 Chromium video of about twenty seconds in each theme: open the Journey, click through two Steps in the panel, drag a Choice onto bare map to make a Step, switch the direction, fit the view. Playwright writes WebM; the script also writes the first frame as `public/demo/canvas.png` (the poster). Document the command in `docs/agents/testing.md`'s command table as `inferred` or in `README.md`.
- **Landing page.** `src/app/page.tsx` gains a framed `<video autoPlay muted loop playsInline poster>` between the tagline and the explanation, with a one-line caption; hidden video and visible poster under `prefers-reduced-motion`. Two recordings, one per theme, switched with the page theme (`<source>` per scheme through a small client-free trick: two `<video>` elements, one hidden by the `dark` class), both under the size cap together (Paul, Q23).
- **Specs.** `landing` asserts the video element, its poster, and that the WebM answers 200 with `video/webm`.

Acceptance criteria:

- [x] The landing page shows a looping, muted recording of the canvas being used, with a poster image and a reduced-motion fallback.
- [x] Both recordings are reproducible from the committed script and together stay under 3 MB.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data (the recording uses seeded content only). Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 1.

## Comments

### 2026-09-24 — Claude Opus 5.5, held by Paul

Held until 2026-09-25 (Paul: "I will hold off on the recording until tomorrow in case I have other feedback I want to squeeze in"). Ticket 54's grilling may move the recording to the About page, add stills or clips there made by this script, or both. Read 54's decisions before starting.

### 2026-09-24 — Claude (Fable 5.1), addendum from ticket 54's grilling

Ticket 54 keeps the recording on the landing page (which becomes the splash) and takes its six feature stills from this script, so this ticket runs **first tonight** and gains one deliverable: after the recording, `scripts/record-landing-demo.ts` also writes six 1280 × 720 PNG stills per theme to `public/demo/<slug>-{light,dark}.png`, using the seed Project only:

| slug | What is on screen |
|---|---|
| `versions` | A Journey's Versions tab with two Published Versions and the Restore control |
| `run` | A Participant's Step on the runner, mid-Journey, with its Choices |
| `analytics` | The canvas with analytics drawn on the graph (seeded Runs the script creates, never real data) |
| `prompt` | A Step's Prompt in the panel with an AI-decided Choice configured |
| `themes` | The Theme row on a Journey, one non-default Theme selected |
| `rich-text` | A Step's rich text with an image and its credit caption |

The stills use the same page size and theme switch as the recording, so a rerun after any UI change refreshes all twelve files plus the video. Document the command once (README or `docs/agents/testing.md`, as the ticket already says) and mention that it writes the stills. Keep the whole `public/demo/` directory under 4 MB (the 3 MB video cap plus the stills). The landing-page `<video>` block still lands here; 54 rebuilds the page around it. Blocked by: none; 54 is blocked by this ticket.

### 2026-09-24 — Claude (Fable 5.1), `[CLOSEOUT]`

**PR:** https://github.com/paul-macfarlane/journeys/pull/64 (base `staging`, head `feat/38-landing-demo-recording`, feature commit `d3dbe9b`). Route: polish; delivered directly in the main checkout with `/implement`, no worker delegation.

**Delivered**

- `scripts/record-landing-demo.ts`, run with `pnpm demo:record` (builds first) or `pnpm demo:record:prebuilt`: over the production build, on its own `next start` (port 3138, `DEMO_PORT`) against the e2e database it creates and migrates, with a minted Author and the Journey Stories seed written for that Author. Per theme it writes `public/demo/canvas-<scheme>.webm` (18 s: find "HHS" by name, open "911" from its box, drag a Choice onto bare map and name the new Step "Follow-up visit", fit the whole map, turn it left to right, find the new Step again), `canvas-<scheme>.png` (the first frame, the poster), and the six stills `versions|run|analytics|prompt|themes|rich-text-<scheme>.png`, all 1280 × 720. The Runs behind `analytics` are nine walks of Case 3 by the script's own Participants; the deciding Prompt is written onto Case 2's "Sponsor"; Case 1 is published twice and given the Dusk Theme. Everything is deleted afterwards. Playwright's bundled ffmpeg (`DEMO_FFMPEG` to override; none found keeps the raw take) trims the lead-in and re-encodes as VP8; the script fails over 3 MB of recordings or 4 MB of directory. Sizes: recordings 1101 KB, directory 3353 KB.
- `src/components/canvas-demo.tsx` on the landing page: two `<video autoPlay muted loop playsInline poster preload="metadata">` elements, light shown unless `<html>` has next-themes' `dark` class, plus the matching poster `<img>` under `prefers-reduced-motion`, by Tailwind variants only (`dark` is two classes of specificity, so `dark:hidden` and `motion-safe:dark:block` beat the single `motion-*` variants). React 19 renders `muted` as an attribute on the server, which the spec asserts.
- `scripts/seed/journey-stories-seed.ts` (the seed as a function, `SEED_PROJECT_ID`, `SEED_JOURNEYS`) with `journey-stories.ts` as the command around it; ticket 54 moves the id to `src/lib/demo.ts` as planned.
- `e2e/setup/canvas.ts`: `canvas`, `canvasNode`, `canvasNodeBox`, `connectHandle`, `mapInView`, `settledTransform`, `emptySpot` moved out of `canvas.spec.ts` unchanged, shared with the script.
- `landing-canvas-demo` spec; README section and command rows; CLAUDE.md `scripts/` line now names the new files and the `e2e/setup/` imports this ticket asked for.

**Verification**

| Check | Result | Evidence |
|---|---|---|
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck` | PASS | `test-results/dod-1-commands.txt` |
| `pnpm test` | PASS, 540 | `test-results/dod-1-commands.txt` |
| `pnpm demo:record:prebuilt` | PASS, 16 files, under both caps | `test-results/dod-1-commands.txt`, `public/demo/` |
| `E2E_EVIDENCE=landing,landing-canvas-demo pnpm test:e2e` (full, once, at the end) | PASS, 104 | `test-results/dod-1-e2e.txt`, `test-results/landing/`, `test-results/landing-canvas-demo/` |
| Deployed smoke | Not applicable until merge (no PR previews); the landing page on staging is the check | — |

**AI code review** (one pass, two axes, applied before the commit)

- Standards: the script's `e2e/setup` imports breach CLAUDE.md's `scripts/` import list as written, sanctioned by the ticket → the CLAUDE.md line was updated in this PR; "credit" → "caption" per CONTEXT.md; canvas helpers duplicated from the spec → moved to `e2e/setup/canvas.ts`; dead `export`/`require.main` block and an unused `className` removed; `still` counter renamed; `publishFromHeader` now takes the Journey id; one `seedJourney` lookup. Not taken: splitting the script into modules, a `Take` type for the `(browser, cookie, journeys, scheme)` clump, extracting the server env from `playwright.config.ts`.
- Spec: `run` still lacked its Choices and `prompt` still lacked the AI-decides option in frame → both reframed (the run still waits for the image's height first). `public/demo` is committed. Not taken: opening the second Step from the panel's Choice row (far down a long Step; the page would scroll there and back on camera). Deviations kept and noted: fit view before the direction switch, naming the new Step, and a closing find-by-name zoom so the loop starts and ends legibly; the poster is a screenshot at the trim point rather than a frame extracted from the file.

**Deviations from the ticket text:** poster files are `canvas-light.png` and `canvas-dark.png` (one per theme) rather than a single `canvas.png`.

**For Paul:** merge #64; ticket 54 then takes the stills. Rerun `pnpm demo:record` after any canvas or page change and commit the result.
