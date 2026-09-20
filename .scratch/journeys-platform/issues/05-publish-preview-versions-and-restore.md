# 05: Publish, Preview, Unpublish, versions, and restore

Status: ready-for-agent
Blocked by: 03
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** From a Journey's page an Author can Preview the Draft, Publish it, see the version list, Unpublish, and restore an older version as the new Draft. Publish validates and refuses with the problem list, otherwise snapshots the Draft into an immutable Published Version (next version number, timestamp, publishing Member) and points the Journey's live pointer at it. Later Draft edits never change a Published Version. Unpublish clears the live pointer; the version row stays. Restore copies a chosen version's document into the Draft after confirmation. Preview is Member-only; it renders the Draft through the runner components (built minimally here, completed in ticket 06) and never records a Run. Journey slug becomes frozen after first publish.

- [ ] Publishing a Draft that fails validation shows the problems and creates nothing.
- [ ] Publishing a valid Draft creates version 1; publishing again after an edit creates version 2 and leaves version 1's stored document unchanged — proven in Seam B by restoring version 1 and seeing the pre-edit content (not a Seam A test: immutability of an in-memory value proves nothing about the row).
- [ ] Journey list shows state published / unpublished / never published; Unpublish flips it and the live pointer is cleared.
- [ ] Version list shows number, publish time, and who published; restore replaces the Draft with the chosen version's document after confirmation.
- [ ] Preview walks the Draft from Start to an Ending; no Run row is created; a non-Member (or signed-out user) cannot open Preview.
- [ ] Slug editing is disabled once a version exists.
- [ ] Seam B: publish → edit → publish v2 → restore v1 flow.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [SCOPE CHANGE] 2026-09-19 — slugs dropped (see ticket 02)

Paul decided during PR #10 review that Projects and Journeys have no slug: every path parameter is the id. Read every "slug" in this ticket as the id (`/j/{journey-id}`, `/p/{project-id}`), and drop any "slug frozen at first publish" behavior. Recorded in ticket 02's [SCOPE CHANGE] and the spec's Comments.
