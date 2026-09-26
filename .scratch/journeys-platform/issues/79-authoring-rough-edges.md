# 79: Authoring rough edges

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → **79** → 53 → 57 → 80; parked 44, 39, 45.
Route: polish

**Why:** small authoring bugs and UX gaps from the regression passes (tickets 64, 66, 68), bundled because each is a few lines and they share the Step panel and Project surfaces.

**What to build:**

1. **Untitled step** (68 finding 3). A new Step's title field is empty, with "Untitled step" as its placeholder, and the map box reads "Untitled step" while the title is empty. This replaces pre-filled text that the Author types after.
2. **Adding a Choice to a new Step** (66 finding 7). Adding a Choice whose target is "New step" from the panel keeps the panel on the source Step, so a second "Add choice" lands where the Author expects. The new Step is selected on the map, and a one-line status offers "Edit <new step>".
3. **Image toolbar overlap** (64 finding 4). The "Edit image / Remove" bubble menu no longer covers the paragraph above the image.
4. **Restore acknowledgement** (68 finding 5). Restoring a Version always shows a one-line confirmation like Publish's, including when the content equals the Draft.
5. **Copy link fallback** (68 finding 6). When the clipboard is refused, show the address in a read-only, selected field beside the button.
6. **Local timestamps** (64 finding 6). Versions show the viewer's local time and zone, not UTC.
7. **Accent default** (64 finding 7). Ticking "Accent color" starts from the chosen preset's accent, not Trail's.
8. **Fit view on a small map** (64 finding 3). Cap `fitView` at a max zoom of about 1.25, so a one-Step map is not drawn at 40 px type.
9. **Copy link names** (64 finding 5). The Author page's Copy link is named "Copy author page link", not "Copy participant link".
10. **Members refusal copy** (64 finding 14). "No account has that email — they need to sign in once first."

Acceptance criteria:

- [ ] Each item above has an e2e assertion or a unit test where one is meaningful (1, 2, 4, 5, 7, 9, 10). Items 3, 6, and 8 need one screenshot each in the closeout.
- [ ] The existing Step panel, Versions, and settings specs pass.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 64 findings 3–7 and 14; ticket 66 finding 7; ticket 68 findings 3, 5, 6.

## Comments
