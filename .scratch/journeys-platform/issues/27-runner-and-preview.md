# 27: Runner and preview — start on the first Step

Status: in-progress
Blocked by: None
Owner: Claude Fable 5.1 (`/implement`), session of Paul Macfarlane, claimed 2026-09-22
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

### [EXECUTION PLAN] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

Route: contract. Repository delivery: `journeys` on `feat/27-runner-start-on-first-step`, comparison SHA `d3a3494` (staging). Direct checkout, one implementer (this session), no worktrees: every deliverable touches the runner routes, so parallel work would only conflict.

**Seams and order.** (1) Seam A, test first: a pure `beginRun(document, targetStepId, now)` in `src/lib/graph/begin.ts` (start + first Choice in one reducer step; refuses a target the Start Step does not offer); `run.ts` and `run.test.ts` untouched. (2) Server actions in `src/app/j/[journeyId]/actions.ts`: `chooseFromStartAction` (creates the Run on the first Choice, mints the participant cookie, sets the Run cookie exactly as `beginRunAction` did, redirects to the target Step) and `startOverAction` (drops the Run cookie, leaves the old Run as it is, redirects to `/j/{id}`); unit tests with mocked `@/db/runs`, `next/headers`, `next/navigation` for the in-progress-Run and unknown-Choice cases. (3) `RunnerFrame` gains `title`, `description` (Start Step only), and `preview` (banner + link back to the editor); `PreviewFrame` deleted; `StepView` renders Choices as a form of submit buttons when given an action, plain links otherwise. (4) `/j/{id}` renders the Start Step with the resume banner when a Run is in progress; `/j/{id}/{stepId}` and both preview pages use the shared frame. (5) e2e: every spec that clicked "Begin" chooses from the Start Step; `runner-run-cookie-and-refresh` asserts no Run row before the first Choice, one after, and the start-over path; `publish-untagged-ending` asserts no Run for an Ending-as-Start Journey. (6) Docs: `CONTEXT.md` Run entry, README runner paragraph, spec `[SCOPE CHANGE]`, ticket 10 note.

**Verification map (contract route, `docs/agents/testing.md`):**

| Criterion | Command | Evidence |
|---|---|---|
| AC-1 title in header, Start Step first, Run on first Choice with path `[start, target]` | `E2E_EVIDENCE=… pnpm test:e2e` → `runner-run-cookie-and-refresh`, `runner-case-3-on-a-phone`, `author-flow` | `test-results/runner-run-cookie-and-refresh/`, `test-results/runner-case-3-on-a-phone/`, `test-results/ac-1-run-on-first-choice.txt` |
| AC-2 resume banner; Start over abandons, next Choice is a new Run | same → `runner-run-cookie-and-refresh` | `test-results/ac-2-start-over-new-run.txt` |
| AC-3 preview mirrors it, no Run | same → `preview` | `test-results/preview/` |
| AC-4 Ending as Start: "The end", no Run; ticket 10 note | same → `publish-untagged-ending`; `grep` on `10-analytics.md` | `test-results/publish-untagged-ending/`, `test-results/ac-4-ending-as-start-no-run.txt` |
| AC-5 Seam A | `pnpm test`; `git diff staging -- src/lib/graph/run.test.ts` empty | `test-results/ac-5-begin-and-choose-unit.txt` |
| AC-6 full e2e once at the end | `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm test:e2e` | `test-results/dod-1-commands.txt` |

No schema change, so `pnpm db:migrate` is not in play; `pnpm test:e2e` builds. Review: two readers (correctness, contract) via the two-axis code review.

### [AI CODE REVIEW] 2026-09-22 — Claude Fable 5.1; two fresh Opus readers (standards, spec) read the diff `d3a3494..a7637f5`, this session adjudicated

**Standards axis.** No breach of a documented standard: plain `<a>` everywhere in the runner (both preview pages dropped `next/link` with `PreviewFrame`); only `actions.ts` writes or deletes a cookie; role locators, no skip/fixme, retries untouched, `evidencePath` throughout; tracker state matched a mid-flight contract ticket. Findings and what was done: (1) "start screen" survived in a test name and two comments after the scope change retired it — renamed in `actions.test.ts`, `runner.spec.ts`, `projects-and-journeys.spec.ts`, `db/runs.ts`; (2) bare indexing of the Start in `begin.ts` — kept, it mirrors `startRun` and a Published Version's Start is validated; noted in the module comment; (3) "Recorded in ticket 27" in the spec pointed at a record not yet written — this record and the closeout are it. Smells (judgement calls): one-member `reason` union nobody read — removed; the Start-Step-only description ternary repeated in the two step pages — kept, two one-line call sites; `to` carrying a Step id while the refusal said "choice" — moot with the reason gone; `choices.kind` branched twice in `ChoiceList` — kept. In passing: self-loop first Choice wrote a one-entry Run — fixed (see spec axis); no warning that choosing beneath the resume panel abandons the Run — the panel now says so; a URL assertion after "Start over" passed trivially — reordered behind the wait on the offer disappearing; header guarded on `!== undefined`, description on truthiness — both truthiness now.

**Spec axis.** Every named deliverable present (`CONTEXT.md`, README, spec `[SCOPE CHANGE]`, ticket 10 note, `run.test.ts` untouched, no "Begin" left, cookie names/paths, all redirect targets, unavailable screen unchanged, `PreviewFrame` gone). Findings: (1) evidence and closeout absent — the planned last step, below; (2) a Choice taken beneath the resume banner abandons the in-progress Run without "Start over" — deliberate and now warned about in the panel, but a product call the ticket does not state; queued for Paul, non-blocking; (3) the stranger in `runner-run-cookie-and-refresh` now walks to an Ending — harmless; (4) a first Choice back onto the Start recorded a Run with path `[start]`, against AC-1's `[start, target]` — fixed: `beginRun` treats it as the stay it is everywhere else and begins nothing, so every Run ever created holds two entries; unit case added on both seams.

Fixes landed as f7ee3ed. Remaining risk: none blocking; the deployed surface is checked after Paul merges.
