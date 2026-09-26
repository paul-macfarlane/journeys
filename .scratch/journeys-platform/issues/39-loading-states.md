# 39: Loading states

Status: needs-info
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: parked (Paul, 2026-09-26): still blocked on vercel/next.js#86055; resume per the comment above when it closes. Product order: 71 → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
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

### [BLOCKED] 2026-09-23 — parked by Paul, blocked on Next.js

**Reason.** Any `loading.tsx` over an Author page breaks that page's in-place updates on Next 16.2.10 (and on 16.2.12, the latest 16.2 patch, tried locally and reverted): after a server action the page intermittently never re-renders, or re-renders and then reverts to the old render half a second later, and a `useTransition` pending state can stay set so the next click times out. Upstream: [vercel/next.js#86055](https://github.com/vercel/next.js/issues/86055) ("`useTransition` stuck … `router.refresh()` after calling a server action"; removing `loading.tsx` is the only reliable workaround there) and the React race in [discussion #88767](https://github.com/vercel/next.js/discussions/88767).

**Evidence.** The first full `pnpm test:e2e` (worktree, port 3139) failed 29 of 95; under heavy load (average 198) some were contention, but `journeys-reorder` and `journey-edit-and-delete` fail on a quiet machine, every time, and pass at once with the Project skeleton removed. Tried and ruled out: dropping the `router.refresh()` after revalidating actions (the ticket-29 race), dropping `revalidatePath` from the move action, Next 16.2.12. The server sends the right tree every time; the client drops it.

**Also found (fixed on the branch).** A `loading.tsx` streams the page, so a `notFound()` in it answers 200: `project-non-member`, `project-delete`, and `preview-non-member` expect 404. Fixed by running the member checks in the `[projectId]` and `[journeyId]` layouts (outside the boundary) and by putting each page and its skeleton in a route group, `(overview)` and `(editor)`, so a skeleton covers its own page only (a Preview otherwise loaded under the editor's skeleton, and an unknown Preview Step answered 200). `revalidatePath` then names the group (`/projects/[projectId]/(overview)`).

**Preserved.** Branch `feat/39-loading-states` (worktree `.claude/worktrees/39-loading-states/journeys`, not merged, no PR): `52e9c3f` adds the three skeletons, `page-skeleton.tsx`, the shadcn `Skeleton` (stray `cn` dependency removed, lockfile untouched) and the render test; `1f668bf` adds the scoping and 404 fix. Lint, typecheck, and the 413 unit tests pass on it; the skeletons were checked in the built app in both themes under the navbar.

**Resume.** When a Next release closes #86055: rebase the branch on `staging`, bump `next`, run `journeys-reorder` and `journey-edit-and-delete` with `--repeat-each 4`, then the full polish chain. Next in Paul's order: 40.
