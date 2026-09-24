# 58: A small demo Journey for the recording and the stills

Status: in-progress
Blocked by: 38
Owner: Claude (Fable 5.1), the 38 thread, 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: hackathon presentation (Paul, 2026-09-24, after reviewing PR #64): runs in the 38 thread after #64 merges, in parallel with 54; 54 builds on the current stills and swaps the files later, since the file names do not change. Becomes `ready-for-agent` when Paul approves the scenario in Comments.
Route: polish

**Why:** Paul, 2026-09-24, on PR #64: "I wonder if the cases we demo in the video are TOO complicated and may scare people away, those graphs from medha are pretty large lol. I want to keep the content we generated as an option for me to use still, so don't delete it. But I was wondering if you could make a simpler journey/project that demos the functionality but is less overwhelming."

**What is true today (PR #64):** `scripts/record-landing-demo.ts` records Case 3 of the Journey Stories seed (36 Steps) and takes its stills from Cases 1, 2, and 3. The recording zooms in for most of its loop, but the fit view, the direction turn, and the `analytics` still all show the whole 36-Step graph. Every file the script writes goes to `public/demo/` under fixed names that ticket 54's splash reads. The seed Project's ids live in `scripts/seed/journey-stories-seed.ts`; 54 moves the Project id to `src/lib/demo.ts`.

**Decisions (proposed; Paul to confirm at approval):**

1. **A second seed Project, not a fourth case.** `The Allotment` Project (fixed id `00000000-5eed-4000-8000-000000000002`) with one Journey, `A key on the doormat` (fixed id `…0021`), seeded by the same `pnpm seed:journey-stories <email>` command so staging and production get it in the run Paul already does. The three cases stay exactly as they are, in their own Project.
2. **The script records the demo Journey by default.** `pnpm demo:record` (and `:prebuilt`) take `--source demo` (default) or `--source journey-stories`, writing the same file names to `public/demo/` either way, so nothing about 54 changes and Paul can regenerate the cases' set with one flag. The current set stays in git history; the committed set is whichever Paul chooses (the demo Journey, unless he says otherwise).
3. **Original content, neutral subject.** The demo is not a medical case: planning policy says not to bake the migrant-healthcare example into the model, and a warm, everyday scenario is the point of the ticket. Ten Steps, three Endings, two Outcomes, one loop, one image with a caption, one Step with three Choices for the deciding Prompt. Drafted below; Paul edits or approves in Comments.
4. **The image is the repository's own and public domain.** A flat illustration drawn for this repository (`scripts/seed/allotment/illustration.svg`, rendered to `public/seed/allotment.jpg`, outside the 4 MB `public/demo/` cap) rather than a downloaded photograph: nothing to license and no fetch from a third party. Stored rich text keeps only absolute http(s) image URLs (the runner strips anything else and the next autosave would drop it), so the document links the committed file at its raw GitHub address on `staging`; the recording script serves the file for that address itself and needs no network. The `alt` is written (not empty, unlike the legacy cases). Paul may swap in a photograph later by replacing the file.
5. **"Play a Journey" is 54's call.** 54 decides whether the splash's Play link points at the cases, the demo, or both ("Play a short demo", "Play the original cases"). This ticket only makes the demo publishable; Paul publishes it on staging and production with the cases.

**Draft scenario: _A key on the doormat_** (Journey description: "Goal: keep your aunt's allotment plot through the summer.")

| # | Step | Text (one screen each; final copy in the document) | Choices |
|---|---|---|---|
| 1 | **A key on the doormat** (Start) | An envelope with your late aunt's allotment key and a note from the garden committee: the plot is yours until September, if you want it. | "Go and look this evening" → 2; "Ask the garden's group chat what state it's in" → 3 |
| 2 | **Waist-high grass** (image + caption) | The plot is overgrown to the knee. Next door, a neighbour called Ada is watering beans and pretending not to watch you. | "Start clearing tonight" → 4; "Say hello to Ada" → 5 |
| 3 | **Forty replies** | The group chat argues about your aunt's beans, three people offer a hand, and someone mentions the June inspection twice. | "Accept the help" → 5; "Go and see it for yourself" → 2 |
| 4 | **Blisters** (Prompt: "It's getting dark and your hands hurt. What do you do?", required, AI decides) | You clear half the plot alone and find a row of your aunt's rhubarb under the grass. | "Keep going until dark" → 7; "Leave the rest for the weekend" → 6; "Go and find Ada" → 5 |
| 5 | **Ada's advice** | Ada explains the rhubarb, the June inspection, and the rule about untended plots being handed on. | "Ask her to show you the shed" → 6; "Thank her and start on the grass" → 4 |
| 6 | **A plan for the summer** | Beans where they were, potatoes in the cleared half, and the rhubarb stays. | "Plant what your aunt planted" → 8; "Turn half of it over to wildflowers" → 9 |
| 7 | **The inspection letter** | You missed June. The committee gives you two weeks to show the plot is tended. | "Ask the group for a work party" → 8; "Hand the key back" → 10 |
| 8 | **A shared harvest** (Ending, Outcome: Kept the plot) | September: beans for half the garden, and Ada takes a rhubarb crown for her own plot. | — |
| 9 | **Bees on the plot** (Ending, Outcome: Kept the plot) | The wildflower half wins the garden's prize for pollinators. You keep the key. | — |
| 10 | **The key goes back** (Ending, Outcome: Handed on) | You post the key through the committee's door with a note. Someone else will find the rhubarb. | — |

Loops: 3 → 2 and 5 → 4 (allowed since ticket 18). Reachability: every Step is reached from the Start; every Ending carries an Outcome; the document must pass `validateForPublish` like the cases.

**What to build:**

- `scripts/seed/allotment/a-key-on-the-doormat.json` in the stored document shape (`graphDocumentSchema`), plus `public/seed/<image>.jpg` with its licence noted in the caption and in a one-line `public/seed/README.md`.
- `scripts/seed/journey-stories-seed.ts` gains the second Project and Journey (same idempotent upsert; the Author becomes a Member of both). `src/lib/graph/validate.test.ts` checks the new document publishes and holds the counts above, as it does for the cases.
- `scripts/record-landing-demo.ts` gains the `--source` switch and a per-source table of the Steps it opens, drags from, walks to, and photographs (the constants that today name "HHS", "911", "Sponsor", "River", "Preface", and `step-8`). The recording on the demo: find "Waist-high grass" by name, open "Blisters" from its box, drag a Choice onto bare map, name it, fit the view, turn the map, find the new Step again. The stills: `versions` and `themes` on the demo Journey; `prompt` on "Blisters"; `rich-text` on "Waist-high grass"; `analytics` from walks to all three Endings; `run` on "Ada's advice" with its two Choices (a deciding Prompt shows a textbox and Continue in the runner, so "Blisters" would show no Choices).
- README's recording section names the switch and the default; the seed section names the second Project.
- Rerun `pnpm demo:record` and commit the 16 files; both caps still hold.

Acceptance criteria:

- [ ] Paul has approved the scenario (or his edits) in Comments.
- [ ] `pnpm seed:journey-stories <email>` writes both Projects; the demo document publishes.
- [ ] `pnpm demo:record` records the demo Journey by default and `--source journey-stories` regenerates the cases' set into the same file names.
- [ ] The committed `public/demo/` set is the demo Journey's, and the landing page and 54's stills need no code change to show it.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and one full `pnpm test:e2e` pass at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): one `dod-1-commands.txt` plus the `landing` and `landing-canvas-demo` screenshot directories, run with `E2E_EVIDENCE=landing,landing-canvas-demo`. Seeded content only. Use `CONTEXT.md` vocabulary (the image line is a caption, not a credit). Origin: Paul, 2026-09-24.

## Comments

### 2026-09-24 — Paul, scenario approved

Paul: "scenario approved, go ahead." The draft table above is the content; decisions 1–5 stand as proposed. Implemented on `feat/58-demo-journey` (based on the ticket branch with `feat/38-landing-demo-recording` merged in, since #64 is still open); the PR targets `staging` and shrinks to this ticket's diff once #64 merges.
