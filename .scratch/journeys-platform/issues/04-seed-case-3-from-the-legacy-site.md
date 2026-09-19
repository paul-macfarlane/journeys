# 04: Seed case-3 from the legacy site

Status: ready-for-agent
Blocked by: 03
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A development script that reads the live legacy site's prerendered step pages for case-3 (36 steps, entry step 7), converts them into a valid graph document — titles, rich content including images with their credit lines, choices, endings — assigns Outcomes from a hand-written mapping, validates, and inserts the Journey as a Draft in a seed Project whose Member is the account for `pauljosephmacfarlane@gmail.com` (creating that user record if absent). Idempotent: rerunning updates in place rather than duplicating. Images hotlink the legacy site; note this fragility in the script.

- [ ] Running the seed against an empty local database produces a seed Project and a case-3 Journey whose Draft passes publish-time validation.
- [ ] Every legacy ending maps to an Outcome; the Outcome labels are reviewed by a human and recorded in the mapping.
- [ ] Step count and choice counts match the legacy site (36 steps; 6 endings); a Seam A test asserts the seeded document validates.
- [ ] Rerunning the seed leaves exactly one seed Project and one case-3 Journey.
- [ ] The script is documented in the README under development commands.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
