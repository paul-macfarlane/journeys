# 26: Journey page layout

Status: ready-for-agent
Blocked by: 25
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → **26** → 27 → 10 → 28 → 29 → 30 → 31 → 23; 17 is post-hackathon.
Route: polish

**Why:** On staging the Publish button sits below the header in "a weird location", the title and description need a separate Edit dialog for two fields, there is no way to copy the link a Participant needs, and a Validate button duplicates what the map and the Publish dialog already show. Items 5, 6, 9, and 23 of Paul's 2026-09-21 notes. Ticket 28 gives the Project page tabs; this ticket gives the Journey page the same shape so the two read as one app.

**Decisions (Paul, 2026-09-21):** Publish belongs in the header with Preview and Delete. Title and description are plain fields at the top, no Edit dialog. A copy-to-clipboard share link is wanted now. The standalone Validate button goes: live validation on the map plus the problems list on Publish are enough.

**What to build:**

- **Inline title and description.** The header's `<h1>` becomes a borderless text input holding the title and the description becomes a borderless textarea beneath it (placeholder "Add a description"), both styled to read as headings until focused. Each saves on blur and on Enter (title only) through the existing update action `edit-journey-dialog.tsx` calls; a save that fails shows the error inline and keeps the text. `EditJourneyDialog` and its "Edit" button are removed. A one-line hint under the description: "Participants see the title and description from the last published version."
- **Header actions.** Right side of the header, in this order: Preview, Publish, Delete. Publish is the same button and dialog `publish-controls.tsx` renders today (problems list, confirmation), moved into the header. The status badge stays under the title; the "unpublished changes" notice and Unpublish move beside it as a compact line. `PublishControls` no longer renders a block between the header and the editor.
- **Share link.** When a Published Version is live, a "Copy link" button (link icon, `aria-label="Copy participant link"`) sits beside the status badge. It writes `${window.location.origin}/j/${journeyId}` to the clipboard and reads "Copied" for two seconds; the URL is also shown as plain text in a `title` so it can be selected by hand. Nothing is shown while no version is live.
- **No Validate button.** Remove the button, `validateError`, and the server round-trip in `draft-editor.tsx`. The header problem count ("Live problems") and the Publish dialog remain the two ways to read problems; the count keeps opening the "All problems" list.
- **Tabs.** Below the header: shadcn `Tabs` with "Editor" (the `DraftEditor`) and "Versions" (the `VersionList`), selected tab in the URL as `?tab=versions` so a reload or a shared link keeps it; default "Editor". Same component and placement ticket 28 uses on the Project page.
- **Specs.** `journey-edit-and-delete` becomes inline edits (type in the title field, blur, reload, read it back); `publish-*` specs find Publish in the header; `step-editing-*` and `canvas-*` specs that clicked Validate use the header count instead; a new `journey-share-link` spec publishes, copies (grant `clipboard-read`/`clipboard-write` in the Playwright context), and reads the clipboard back.

Acceptance criteria:

- [ ] Editing the title inline and blurring saves it; a reload shows the new title; the Project page's Journey list shows it too. Same for the description.
- [ ] Preview, Publish, and Delete are the only buttons in the header, in that order; publishing from the header succeeds and refuses with the problems list exactly as before.
- [ ] After a publish, "Copy link" is present, copies `/j/<journeyId>` on the current origin, and reads "Copied"; before any publish it is absent.
- [ ] No Validate button exists; the header problem count still opens the list of problems.
- [ ] The Versions tab lists versions and restore works from it; `?tab=versions` survives a reload.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 5, 6, 9, 10, 23.

## Comments
