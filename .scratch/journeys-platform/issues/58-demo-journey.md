# 58: A small demo Journey for the recording and the stills

Status: done
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

- [x] Paul has approved the scenario (or his edits) in Comments.
- [x] `pnpm seed:journey-stories <email>` writes both Projects; the demo document publishes.
- [x] `pnpm demo:record` records the demo Journey by default and `--source journey-stories` regenerates the cases' set into the same file names.
- [x] The committed `public/demo/` set is the demo Journey's, and the landing page and 54's stills need no code change to show it.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and one full `pnpm test:e2e` pass at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): one `dod-1-commands.txt` plus the `landing` and `landing-canvas-demo` screenshot directories, run with `E2E_EVIDENCE=landing,landing-canvas-demo`. Seeded content only. Use `CONTEXT.md` vocabulary (the image line is a caption, not a credit). Origin: Paul, 2026-09-24.

## Comments

### 2026-09-24 — Paul, scenario approved

Paul: "scenario approved, go ahead." The draft table above is the content; decisions 1–5 stand as proposed. Implemented on `feat/58-demo-journey` (based on the ticket branch with `feat/38-landing-demo-recording` merged in, since #64 is still open); the PR targets `staging` and shrinks to this ticket's diff once #64 merges.

### 2026-09-24 — Claude (Fable 5.1), `[CLOSEOUT]`

**PR:** https://github.com/paul-macfarlane/journeys/pull/66 (base `staging`, head `feat/58-demo-journey`, feature commit `a54e311`; the branch carries #64's commits until #64 merges). Route: polish; delivered in the 38 thread, no worker delegation.

**Delivered**

- `scripts/seed/allotment/a-key-on-the-doormat.json`: the approved scenario in stored shape — ten Steps, fifteen Choices, three Endings, two Outcomes (Kept the plot, Handed on), loops 3 → 2 and 5 → 4, a required deciding Prompt on "Blisters", the image with a written `alt` and a caption on "Waist-high grass". `scripts/seed/journey-stories-seed.ts` gains `DEMO_PROJECT_ID` (`…0002`), `DEMO_JOURNEY_ID` (`…0021`), and `SEED_PROJECTS`; `pnpm seed:journey-stories <email>` writes both Projects and prints both. Four unit tests in `src/lib/graph/validate.test.ts` pin the document.
- `scripts/record-landing-demo.ts`: a per-source table (`demo`, the default; `journey-stories`) and `--source`; walks and the `run` still answer a deciding Prompt (`answerDecidingPrompt`) and match Choices as link or button; the seed image is served from disk for its GitHub address while recording. `public/demo/` regenerated from the demo (recordings 1104 KB of 3072, directory 2368 KB of 4096); the cases' set is one flag away and stays in git history (#64).
- `scripts/seed/allotment/illustration.svg` → `public/seed/allotment.jpg` (45 KB) with `public/seed/README.md`; README and CLAUDE.md updated.

**Verification**

| Check | Result | Evidence |
|---|---|---|
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck` | PASS | `test-results/dod-1-commands.txt` |
| `pnpm test` | PASS, 544 | `test-results/dod-1-commands.txt` |
| `pnpm demo:record:prebuilt` (default source) | PASS, 16 files, under both caps | `test-results/dod-1-commands.txt`, `public/demo/` |
| `E2E_EVIDENCE=landing,landing-canvas-demo pnpm test:e2e`, run 1 | FAIL: `author-settings` (unrelated; the GitHub field's typed value was gone at the assertion; passed on every other run today) | `test-results/dod-1-e2e-run-1-failed.txt` |
| the same, run 2 (the cited pass) | PASS, 104 | `test-results/dod-1-e2e.txt`, `test-results/landing/`, `test-results/landing-canvas-demo/` |

A task chip was raised to fix `author-settings` at its cause (likely the settings form's refresh after a save wiping a value typed meanwhile); it is not this ticket's.

**AI code review** (one reviewer, both axes, applied before the commit): the image `src` was a root-relative path, which the runner's `harden` strips and the next autosave would delete — now the committed file's raw GitHub address on `staging`, served from disk while recording; `answerDecidingPrompt` waits for the Step's form or Choices before probing; the dead `versionsExpected` removed; `chooseSource` returns the typed name; stale comments fixed; the 5 → 4 loop asserted. Not taken: renaming `seedJourneyStories`/`parseSeedJourneys` (the command keeps its name); collapsing the six per-still `journeyId` fields.

**Deviations from the ticket as written:** decision 4 delivers a drawn illustration rather than a downloaded photograph (nothing to license, no fetch; swap the file for a photo any time); the `run` still is on "Ada's advice", not "Blisters", because a deciding Step shows a textbox and Continue rather than its Choices; the image is linked at its GitHub address rather than served from the app's own origin, for the stored-content rule above.

**For Paul:** merge #64 then #66; rerun the seed on staging and production (it now writes `The Allotment` too) and publish *A key on the doormat* from its Versions tab if 54's Play link should reach it. The image at its GitHub address resolves once this PR is on `staging`.

### 2026-09-24 — Claude (Fable 5.1), `[SCOPE CHANGE]` after Paul merged #64 and #65

Paul: "lets fix the CI and merge conflicts in #66". `origin/staging` merged cleanly (the conflict GitHub reported was the branch carrying #64's commits). CI failed on `author-settings`, the same failure as this ticket's first local run, so it is fixed here at its cause rather than left to the task chip:

- **Cause.** `useAutosavedForm`'s `write` ran validation through `form.handleSubmit(onValid, onInvalid)`. react-hook-form's `handleSubmit` returns without calling either callback when a `reset()` happens while it is validating (`_resetCallId`), and the refresh the previous save asks for resets this form (`form.reset(values)` in the values effect). A field left in that window was a write that never settled: "Saving…" for good, no refusal alert, which is exactly the snapshot both failures captured (the GitHub field holding the typed value, the status "Saving…").
- **Fix.** `src/components/autosaved-form.ts` validates `value` with the schema directly (`schema.safeParse`), sets one error per refused field itself, and only then calls the action; `handleSubmit` is no longer used. Behaviour is otherwise the same: the same messages under the same fields, the stored record as the baseline after a save. Eight repeats of the spec against the old build did not reproduce the race (its window is a few milliseconds), so the proof is the mechanism in the library's source plus the full suite on the fix.
