# 38: A recording of the canvas on the landing page

Status: ready-for-agent
Blocked by: None
Owner:
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

- [ ] The landing page shows a looping, muted recording of the canvas being used, with a poster image and a reduced-motion fallback.
- [ ] Both recordings are reproducible from the committed script and together stay under 3 MB.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data (the recording uses seeded content only). Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 1.

## Comments

### 2026-09-24 — Claude Opus 5.5, held by Paul

Held until 2026-09-25 (Paul: "I will hold off on the recording until tomorrow in case I have other feedback I want to squeeze in"). Ticket 54's grilling may move the recording to the About page, add stills or clips there made by this script, or both. Read 54's decisions before starting.
