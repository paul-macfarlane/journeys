# 36: The Draft on the Versions tab

Status: in-progress
Blocked by: None
Owner: Claude (Fable 5.1), worktree `feat/36-versions-tab-draft-row`, 2026-09-23
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → **36** → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: polish

**Why:** The Versions tab lists Published Versions only. Paul, 2026-09-22, item 13: "it would be helpful to also show the current draft version on there (assuming there are staged but not published changes)".

**Decisions (Paul, 2026-09-22, grilled):** the Draft appears as the first row only while it differs from the live version (the page already derives `hasUnpublishedChanges` from the title, the description, and `documentsEqual`); when the live version matches the Draft exactly, the list is as it is today. A never-published Journey shows the Draft row above "Not published yet."

**What to build:**

- **Data.** `getDraftForMember` (`src/db/drafts.ts`) exposes the Draft's `updatedAt`; the Journey page passes `hasUnpublishedChanges` and that timestamp to `VersionList`.
- **Row.** In `src/components/journeys/version-list.tsx`, a first row "Draft" with a badge "Unpublished changes", "Last edited <time> UTC" in the same fixed format as the versions, and two actions: "Open editor" (switches to the editor tab through `UrlTabs`, so the tabs need a way to change from a sibling; the simplest is a link to `?tab=editor` that the page reads) and the existing Publish button. No restore on the Draft row.
- **Copy.** The empty state reads "Not published yet." beneath the Draft row rather than alone.
- **Specs.** `publish` gains `versions-tab-shows-draft`: publish, edit a Step title, open Versions, find the Draft row with "Unpublished changes" above "Version 1 · Live"; publish again and find no Draft row.

Acceptance criteria:

- [ ] With unpublished changes the Versions tab lists the Draft first with its last-edited time, a way to the editor, and Publish; with none it lists only Published Versions.
- [ ] A never-published Journey shows the Draft row and "Not published yet."
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 13.

## Comments
