# 39: Loading states

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → **39** → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: polish

**Why:** Paul, 2026-09-22, item 9: "Do you feel we need improved loading states? Feels like a nice enhancement, but not something we necessarily need for the hackathon unless there is time." Agent's answer: yes, but only route-level. Every Author page is a server component that reads several tables before it renders, so a navigation from the Projects list to a Journey page shows nothing until the whole page is ready; a `loading.tsx` beside each page turns that into an instant navbar plus a skeleton. Within a page the app already has pending states (blur-saved forms, Publish, moves).

**Decisions (Paul, 2026-09-22, grilled):** `loading.tsx` files only; no client-side spinners, no Suspense boundaries inside pages. Skeletons are the shadcn `Skeleton` primitive laid out like the page they stand in for.

**What to build:**

- `src/app/projects/(list)/loading.tsx` (a heading and three card skeletons), `src/app/projects/[projectId]/loading.tsx` (header, tab row, list rows), `src/app/projects/[projectId]/journeys/[journeyId]/loading.tsx` (header, tab row, a canvas-height block). The navbar comes from the layouts and stays visible throughout.
- Add the `skeleton` component through the shadcn CLI; if the CLI drops a stray dependency again (ticket 26), remove it and leave the lockfile to Paul.
- **Specs.** None new: Playwright cannot reliably catch a skeleton on a fast local server, and the CI run proves the files compile. Screenshot each loading state once by rendering the `loading.tsx` component in a Vitest snapshot-free render test that asserts the landmarks, and commit no evidence beyond `dod-1-commands.txt`.

Acceptance criteria:

- [ ] Navigating between the Projects list, a Project, and a Journey shows the navbar and a skeleton while the page loads, in both themes.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`); never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 9.

## Comments
