# 55: The user guide

Status: ready-for-agent
Blocked by: 38
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: hackathon presentation (Paul, 2026-09-24, grilled the same evening): runs in a worktree parallel to 54 after 38 merges; the first ticket to cut if the night runs late. In-app help is ticket 57, post-hackathon.
Route: polish

**Why:** Paul, 2026-09-24, at 54's grilling: "a user guide could be nice not just for the judges, but also for normal users and authors. That way judges can use it if they really want." Judges cannot author without a Google or Discord sign-in, and the guide is the help they get instead of a demo account or a tour.

**What is true today:** there is no help of any kind: no guide, no tooltips beyond control labels, no empty-state copy that teaches. The vocabulary is in `CONTEXT.md`. Ticket 54 adds the footer's Guide link and the splash's link to `/guide`, so this ticket does not touch `SiteFooter` or `src/app/page.tsx`. Ticket 38 writes the stills under `public/demo/`.

**Decisions (Paul, 2026-09-24):** one static page at `/guide`, public, product voice, prose with the 38 stills where they fit. No in-app tour.

**What to build:**

- `src/app/guide/page.tsx` with `metadata` (title "Guide", a description) and an in-page table of contents. Sections, using `CONTEXT.md` terms:
  - **For Authors:** sign in; create a Project; create a Journey; the canvas (Steps, Choices, dragging a Choice onto bare map, direction, fit, undo); the Step panel and rich text with images and credits; Prompts and the AI-decided Choice; Themes; publish a Version, restore, Preview; share the link; read analytics on the graph; Members and Author pages.
  - **For Participants:** what a Run is, anonymity (no account, nothing identifying stored), going back when the Journey allows it, Endings.
  - **Good to know:** discovery is link-only; a Published Version never changes under a Participant; where Responses are visible (Members only).
- A "Guide" link in the Projects page header next to the existing controls, so signed-in Authors find it.
- Spec `guide`: heading, the table of contents links resolve to sections, one still renders, both themes, 375 px.

Acceptance criteria:

- [ ] `/guide` renders for an anonymous visitor in both themes and at phone width with the Author, Participant, and Good-to-know sections and uses only `CONTEXT.md` vocabulary.
- [ ] It is reachable from the Projects page header (the footer and splash links come from 54).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and one full `pnpm test:e2e` pass at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): `dod-1-commands.txt` plus the `guide` screenshot directory (`E2E_EVIDENCE=guide`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, at 54's grilling.

## Comments
