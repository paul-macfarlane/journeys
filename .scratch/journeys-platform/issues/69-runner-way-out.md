# 69: A Participant can reach the Project and start over from any Step

Status: done
Blocked by:
Owner: Claude (Fable 5.1), 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: pre-hackathon (Paul, 2026-09-24, on ticket 68's PR #81: "there is no clear way to go back to the start or the project" in the runner; the form goes in at 10:00 ET 2026-09-25).
Route: polish

**Why:** the runner's header (`src/components/runner/runner-frame.tsx`) is the Journey's title as a plain paragraph, and nothing in it links anywhere; the only header link is the Preview banner's "Back to editor", which a Participant never sees. "Start over" renders only on an Ending (`isEnding(step)` in `src/components/runner/step-view.tsx`) and beside the path-full notice. Mid-walk a Participant has the one-Step "← Back" and nothing else, and no Step names or links the Project — so a judge who landed on Case 1 from the Play link cannot reach Case 2 without browser history, and cannot restart a Journey they are partway through. The public Project page is `/p/<projectId>`.

**What to do:** the smallest change that fits the existing frame.

1. `RunnerFrame` gains a way out in its one `<header>`: the Project's title as a small link above the Journey title (which stays as it is), and a "Start over" control at the header's right on every Step that does not already offer one. Live, the control is the existing `startOverAction` form (`src/app/j/[journeyId]/actions.ts`), so it drops the Run cookie and leaves the Run abandoned exactly as ticket 10's analytics expect; on Preview it is a link to the Preview's own first screen, as the Ending's Start over is there, and the Project link points at the Author's Project page — Preview's own routes. `getPublicJourney` already returns `projectTitle`; it and `getRunForJourney` gain the Project id and title from the `project` row every runner read already joins, so no page adds a query. The live pages (`src/app/j/[journeyId]/page.tsx`, `src/app/j/[journeyId]/[stepId]/page.tsx`) and the two Preview pages pass the Project and the control.
2. Exactly one "Start over" per screen. The first screen (the Start Step with no Run yet) has nothing to start over from and its resume box already offers Start over when a Run is in progress, so the header shows none there; an Ending keeps its existing Start over below the Outcome and the path-full notice keeps its own, so the header's control renders only on a Step that offers none of those. Nothing about the Ending, the notice, or the action changes.
3. Landmarks stay as they are: one `<header>` (banner) in the runner, `<main>`, and the footer's `nav[Legal]`; no new `<nav>`, so ticket 62's branding spec reads the same landmarks by name.
4. Theme: the link and the control take the frame's own tokens (`text-muted-foreground`, `hover:text-foreground`, so they read in every preset and both schemes) and a `focus-visible` outline in the ring colour with the same `outline-solid` ticket 63 gave the Choices.

Acceptance criteria:

- [x] On a mid-walk Step of a live Journey the header shows the Project title linking to `/p/<projectId>` and a "Start over" button; pressing it returns to the first screen with the Run cookie dropped, the Run left where it stood with no end, and the next Choice creates a new Run; the first screen itself shows no header Start over; the Project link lands on the public Project page (`e2e/runner.spec.ts`, `runner-way-out`, one screenshot).
- [x] On Preview the same header links the Author's Project page, a mid-walk Step's Start over links the Preview's first screen, an Ending keeps its single Start over, and nothing is recorded (`e2e/preview.spec.ts`, `preview`, the existing screenshot).
- [x] The Ending's existing Start over, the path-full notice's, and the first screen's resume box still work, and `analytics.spec.ts`, `branding.spec.ts`, and `footer.spec.ts` pass unchanged.

Verification follows `docs/agents/testing.md`, polish route: `pnpm lint`, `pnpm typecheck`, `pnpm test`, one full `pnpm test:e2e` at the end with `E2E_EVIDENCE=runner-way-out,preview`; evidence is `test-results/dod-1-commands.txt`, `test-results/runner-way-out/`, and `test-results/preview/`. One AI reviewer. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul on ticket 68's PR #81, 2026-09-24.

## Comments

### 2026-09-24 — Claude (Fable 5.1), `[CLOSEOUT]`

**PR:** https://github.com/paul-macfarlane/journeys/pull/83 (base `staging`, head `fix/69-runner-way-out`, commits `da4ef4e` code, `ff2edd1` spec scoping, `62f4403` evidence, plus this closeout). Route: polish; delivered from a worktree on port 3169 with dummy env, no worker delegation.

**Delivered:** `RunnerFrame` gains `project` (the title, linked) and `startOver` (a form action live, a link on Preview) in its one `<header>`; `getPublicJourney` and `getRunForJourney` return the Project id and title from the row they already join; the two live runner pages and the two Preview pages pass them, with the header's Start over omitted wherever the screen already offers one (an Ending, the path-full notice, the first screen's resume box), so exactly one renders per screen. Landmarks, the Ending's Start over, the seed, and the footer are untouched. `e2e/runner.spec.ts` gains `runner-way-out`; `e2e/preview.spec.ts` proves the header on the first screen, an Ending, and a mid-walk Step.

**Deviation:** four existing assertions read the whole banner's text (`toHaveText(journeyTitle)` in `runner-case-3-on-a-phone`, `runner-pinned-version`, `author-flow`) or the page's only form (`locator("form")` in `runner-required-prompt-refusal`) and failed once the header held the Project link and a form; they now read the title paragraph by exact text and the main column's form. `analytics`, `branding`, and `footer` pass unchanged.

**Verification** (`test-results/dod-1-commands.txt`): `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` 544 passed. `E2E_EVIDENCE=runner-way-out,preview pnpm test:e2e`: run 1 (before `ff2edd1`) 107 passed, 5 failed (the four assertions above plus `metadata-autosave`); run 2 (after) 111 passed, 1 failed — `metadata-autosave` only, the load-sensitive Author-page spec tickets 60, 62, and 63 record, on a machine at load 10–20 all evening; run 3, gated on load, was stopped at Paul's request ("Ship it") with `preview` and `runner-way-out` already green and `metadata-autosave` failed a third time. Recorded as FAIL locally; the CI run on the PR is the full-suite proof. Evidence: `test-results/runner-way-out/runner-way-out.png`, `test-results/preview/preview.png`.

**AI review** (one reviewer, whole diff, medium): five findings. Fixed: "Preface" is not a `CONTEXT.md` term (and is a seeded Step's title), reworded to "the first screen"; the preview spec's header check weakened to a substring, now an exact title match; a long unbroken title could overflow the header column, `break-words` added. Skipped as out of scope: the "← Back" link duplicates the way-out styling without the focus outline; the one-per-screen rule lives in the page rather than `StepView`.

**For Paul:** merge #83 to `staging`, promote to `main` for the form. Ticket 68's PR #81 was already merged, so its finding carries no disposition line.
