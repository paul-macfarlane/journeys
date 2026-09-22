# 27: Runner and preview — start on the first Step

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → 26 → **27** → 10 → 28 → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: contract

**Why:** "It feels a bit weird to have the first part of a journey be the title and description instead of just step 1." The runner and the preview also never show the Journey's name once a Participant is inside it, and Paul asked how in lock step the two are. Items 19, 20, and 21 of his 2026-09-21 notes.

**How in lock step they are today (answer to item 21):** the Step body and its Choices render through one component, `src/components/runner/step-view.tsx`, for both, so content is identical. What differs is the frame (`preview-frame.tsx` vs `runner-frame.tsx`), the start page (each has its own), and run state: the preview has no Run, so no history cookie and no "continue" behaviour. This ticket removes the first two differences; the third is the definition of a preview.

**Decisions (Paul, 2026-09-21):** the runner opens on the Start Step, not a title page. The Journey title is shown on every screen in both the runner and the preview. The Run is created on the Participant's first Choice, not on page load — a Run created on load would count prefetches and bots as starts. A Journey whose Start is an Ending therefore records no Run; ticket 10 notes it.

**What to build:**

- **The frame carries the title.** `RunnerFrame` takes `title` and renders it as the frame header on every Step, above the content; the description appears beneath the header on the Start Step only. `PreviewFrame` is replaced by `RunnerFrame` with a `preview` prop that adds a banner ("Preview — nothing is recorded", with a link back to the editor) and nothing else, so the two frames cannot drift.
- **`/j/{journeyId}` renders the Start Step.** The page reads the live Published Version and renders the Start Step through `StepView`. Its Choices are a form whose action creates the Run, applies the chosen Choice, sets the run cookies exactly as `beginRunAction` does today, and redirects to the target Step — one round trip. If a Run for this Journey is already in progress (cookie), a banner above the content offers "Continue where you left off" and "Start over" (which abandons the old Run as unpublish does and shows the Start Step fresh). The unavailable screen stays as it is. `/j/{journeyId}/{stepId}` with no Run still lands on `/j/{journeyId}`.
- **Preview mirrors it.** `/preview` renders the Draft's Start Step the same way, with plain links for Choices (`/preview/{stepId}`) and no Run; `/preview/{stepId}` is unchanged apart from the frame. A Draft with no Start Step keeps its "no start step" message inside the frame.
- **Ending as Start.** A one-Step Journey shows "The end" on `/j/{journeyId}` and records nothing; add the note to `10-analytics.md` beside ticket 24's untagged-Ending note.
- **Docs and specs.** `CONTEXT.md` (Run: "created when a Participant takes their first Choice"), README's runner paragraph, spec "Public URL and runner" via a `[SCOPE CHANGE]` (the title page is withdrawn). `runner-*`, `preview*`, `author-flow`, `publish-*`, and `canvas-build-*-and-walk` specs that clicked "Begin" now choose from the Start Step directly; `runner-run-cookie-and-refresh` asserts no Run row exists before the first Choice and one exists after; `runner-case-3-on-a-phone` shows the title in the header.

Acceptance criteria:

- [ ] Opening `/j/<id>` of a live Journey shows the Journey title in the header, the Start Step's content, and its Choices; no `run` row exists yet. Taking a Choice creates exactly one Run whose path is `[start, target]` and lands on the target Step with the title still in the header.
- [ ] Reopening `/j/<id>` mid-Run shows "Continue where you left off" above the Start Step's content; "Start over" leaves the old Run abandoned and a fresh Choice creates a new Run.
- [ ] `/preview` shows the same header, banner, Start Step, and Choices for the Draft, and walking it creates no Run.
- [ ] A one-Step live Journey shows "The end" on `/j/<id>` with no Run recorded; `10-analytics.md` carries the note.
- [ ] Seam A: the Run reducer tests are unchanged and pass; the new "begin and choose" action has a unit test for the in-progress-Run and unknown-Choice cases.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-<n>-<slug>.txt` for the Run-row assertions; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 19, 20, 21.

## Comments
