# 06: Participant runner and Runs

Status: ready-for-agent
Blocked by: 04, 05
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** An anonymous Participant opens `/j/{slug}`, sees a start screen with the Journey's title and description, begins, reads Steps with Choices as buttons, can go back, reaches an Ending, and can start over. The Run is recorded and pinned to the live Published Version at start. Mobile-first, themed later (ticket 11).

Each step has its own URL under the journey so the browser back button works; an in-app Back control does the same. Run id is an unguessable random id in a cookie scoped to the journey slug (it is the only write credential for the Run); refresh resumes at the current step; a step URL with no Run cookie for that journey redirects to `/j/{slug}`. Path semantics (unambiguous because published graphs have no cycles): choosing appends; navigating to a step already in the path truncates to it and increments the backtrack counter; navigating to a step not in the path redirects to the current step; reaching an Ending sets ended-at and outcome id; going back from an Ending clears them. Runs store version id, path, backtrack count, started/ended, outcome id, and a pseudonymous participant id never linked to an account. Unpublished slug → "unavailable" page; unknown slug → 404. Start over creates a new Run.

- [ ] Start screen → Steps → Ending renders the seeded case-3 on a phone-sized viewport without horizontal scroll; images and credits display.
- [ ] Browser back and in-app Back both truncate the path and increment backtrack count (Seam A test on the path reducer; Seam B on the UI).
- [ ] Refresh returns to the current step; a new browser context starts a fresh Run; a step URL opened with no Run cookie lands on the start screen; two journeys open in one context keep separate Runs.
- [ ] Publishing v2 mid-run does not change the in-progress Run's content; a new Run uses v2.
- [ ] Unpublished journey shows the unavailable page; unknown slug 404s.
- [ ] Seam B demo path extended: anonymous context completes a Run and the Run row has ended-at and the expected outcome id.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
