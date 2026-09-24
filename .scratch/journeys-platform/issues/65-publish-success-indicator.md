# 65: A clear acknowledgement when a Journey is published

Status: ready-for-agent
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (Paul, 2026-09-24, after 56's pass): "I'd like a more clear indicator of publish success when publishing a journey. Right now it's not clear."
Route: polish

**Why:** publishing is the moment an Author hands a Journey to Participants, and the page barely reacts. Paul, 2026-09-24: "Right now its not clear."

**What is true today:** `PublishButton` (`src/components/journeys/publish-controls.tsx`) publishes on one click, no confirm. On success the only changes are indirect: the button disables (`!hasUnpublishedChanges`), the status badge flips from "Never published" or "Unpublished changes" to "Published", and "Copy link" and "Unpublish" appear in the header. The one `role="status"` line the button owns shows only the ticket-43 warning (a deciding Prompt with no gateway key). Nothing says "you just published", nothing names the new Version, and nothing offers the link at the moment the Author wants it. The Versions tab does mark the new row "Live". 56 saw exactly this: after Publish the pane showed "Published · Copy link · Unpublish" and a greyed button, and the walk had to read the Versions tab to be sure.

**What to do:**

1. On a successful publish, render one visible acknowledgement beside the header controls, in the same `role="status"` line the warning uses: "Published Version N — participants see it now." with the Copy link control inline (reuse the existing copy button). `N` is the `versionNumber` that `publishJourneyAction` already returns on success (`src/app/projects/[projectId]/journeys/actions.ts`); the button currently discards it. When the ticket-43 warning also applies, show both sentences in that line.
2. The line stays until the Draft changes again (when the badge turns to "Unpublished changes") or the page is left; it is not a toast and needs no library.
3. Give the "Published" badge a short entrance (the `animate-in fade-in` already used on the splash, `motion-reduce:animate-none`) so the change registers; nothing that moves the layout.
4. Same treatment for the `sm` button on the Versions tab's Draft row.
5. Copy in `CONTEXT.md` vocabulary: Published Version, Participants.

Acceptance criteria:

- [ ] The `publish` spec asserts the status line "Published Version 1 — participants see it now." after the first publish and "Published Version 2 …" after the second, that the copy control inside it copies the participant link, and that the line disappears after a Draft edit; screenshots `publish-acknowledged-{light,dark}.png`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e`.

Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, on ticket 56's PR; recorded in 56's `[FINDINGS]`.
