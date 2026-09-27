# 95: Video in Steps

Status: needs-info
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`. Parked.
Route: contract

**Why:** Paul, 2026-09-27, reading the home page's "each step is one screen of text": "we could in theory add support for videos too." He parked it; ticket 93 fixes the copy to say text and images.

**What to settle before it can move:**

- Whether video is in scope at all, given the post-hackathon direction (polish and stability, no feature bloat).
- Where video comes from. Images today are external `http(s)` URLs with no upload storage. An embed from YouTube or Vimeo loads a third party into an anonymous Participant's walk, which cuts against `/privacy` ("nothing that identifies you"). A hosted file needs storage the app doesn't have.
- The rich-text contract: a new node in `src/lib/rich-text`, carried through the Draft, Published Versions, and the runner. Old Versions must still read.
- Accessibility: captions or a transcript, no autoplay, and the reduced-motion preference respected.
