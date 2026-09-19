# 04: Seed case-3 from the legacy site

Status: ready-for-agent
Blocked by: 03
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A development script that reads the live legacy site's prerendered step pages for case-3 (36 steps, entry step 7), converts them into a valid graph document — titles, rich content including images with their credit lines, choices, endings — assigns Outcomes from a hand-written mapping, validates, and inserts the Journey as a Draft in a seed Project whose Member is the existing account for `pauljosephmacfarlane@gmail.com`. The script never creates user rows: if no user has that email it exits with a clear message and writes nothing (Paul signs in once first, `human-prerequisites.md` §10). Idempotent: rerunning updates in place rather than duplicating. Images hotlink the legacy site; note this fragility in the script. Legacy step hrefs omit the trailing slash and the host 301s to `/N/`; the scraper must follow redirects (a bare `curl -s` returns an empty body).

- [ ] Running the seed against a database where the Author account exists produces a seed Project and a case-3 Journey whose Draft passes publish-time validation; against a database with no such user it exits non-zero with a message naming the email and creates nothing.
- [ ] Every legacy ending maps to an Outcome. Human-gated: prerequisite — the mapping file lists all 6 endings with proposed labels; action — Paul reviews and edits the labels in the mapping file; expected result — each label is a short phrase a Participant would recognize as the consequence they reached; post-check — the seed is rerun and the Journey's Outcomes match the mapping.
- [ ] Step count and choice counts match the legacy site (36 steps; 6 endings); a Seam A test asserts the seeded document validates (the real document becomes the second success-case fixture for ticket 03's validation suite).
- [ ] After seeding, signing in as that email (`human-prerequisites.md` §10) shows the seed Project in the projects list and opens the case-3 Journey.
- [ ] Rerunning the seed leaves exactly one seed Project and one case-3 Journey.
- [ ] The script is documented in the README under development commands.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
