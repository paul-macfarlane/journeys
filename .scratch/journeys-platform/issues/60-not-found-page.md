# 60: A Journeys not-found page

Status: done
Blocked by: 56
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: fix-tonight (56's regression pass, 2026-09-24): a judge who follows a stale or mistyped link, or opens a Journey that was unpublished, sees Next's bare 404.
Route: polish

**Why:** every missing route renders Next's default not-found page: a black or white screen with "404 | This page could not be found.", no app shell, no link home, and no `<main>` landmark (axe `landmark-one-main` and `region` on every 404 in 56's tour). The title is also inconsistent: `/nope` keeps the app title "Journeys" while `/p/<missing>` shows "404: This page could not be found.". Screens: `test-results/56-regression-pass/1280-light-nope.png`, `test-results/56-regression-pass/375-dark-nope.png`, `test-results/56-regression-pass/1280-dark-allotment-project.png`.

**What is true today:** `src/app/` has no `not-found.tsx`; `notFound()` is called from `src/app/p/[projectId]/page.tsx`, `src/app/j/[journeyId]/page.tsx`, and `src/app/authors/[userId]/page.tsx`, and unknown routes fall through to the framework default. The legal pages render through `ProsePage` (`src/components/prose-page.tsx`), which already gives a page the header, the prose column, and the footer.

**What to do:**

1. Add `src/app/not-found.tsx` rendering through `ProsePage`: title "Page not found", one sentence ("There is nothing at this address. A Journey or a Project is found only by the link its Authors hand out."), a link to `/`, and the Play link from `src/lib/demo.ts`. `metadata.title` "Page not found" (the layout template appends the app name).
2. Keep the participant-facing wording in `CONTEXT.md` vocabulary; no mention of ids or routes.
3. Both themes and 375 px, no horizontal overflow.

Acceptance criteria:

- [x] `/nope`, `/p/<unknown>`, `/j/<unknown>`, and `/authors/<unknown>` all render the new page with status 404, the app header, the footer, and a `<main>` landmark; the `branding` or a new `not-found` spec asserts the title, the heading, the home link, and status 404, with screenshots in light, dark, and at 375 px.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, then one full `pnpm test:e2e` pass; evidence per `docs/agents/testing.md` ("Proportional verification", `polish`).

Spec: `.scratch/journeys-platform/spec.md`. Origin: ticket 56's `[FINDINGS]`, finding B.

## Comments

### 2026-09-24 — Claude (Fable 5.1), `[CLOSEOUT]`

**PR:** https://github.com/paul-macfarlane/journeys/pull/71 (base `staging`, head `feat/60-not-found-page`, merged by Paul as `549ea20` while the local full run was still waiting on machine load). Route: polish; `/implement` from the worktree `.claude/worktrees/60/journeys` on `E2E_PORT=3160` and `E2E_DATABASE_NAME=journeys_e2e_60`, dummy env from a scratch script. The evidence and this record follow in a second PR because #71 merged first.

**Delivered:** `src/app/not-found.tsx` (through `ProsePage`: the title, the one sentence, a link to the front page, the Play link; `metadata.title` "Page not found"); `generateMetadata` in `src/app/p/[projectId]/page.tsx`, `src/app/j/[journeyId]/page.tsx`, and `src/app/authors/[userId]/page.tsx` now calls `notFound()` for a missing row, because a page's metadata streams in after its body and the generic "Journeys" title replaced the not-found title after hydration, which is the title inconsistency the ticket's **Why** names; the header of `src/lib/link-preview.ts` says so. `e2e/not-found.spec.ts` (`not-found`): the four routes answer 404 with the title, heading, home link, Play link, banner, `main`, and footer; light, dark, and 375 px with no horizontal overflow.

**Commands** (`test-results/dod-1-commands.txt`, at `3cc8bd3`): `pnpm lint`, `pnpm typecheck`, `pnpm test` (544), `E2E_EVIDENCE=not-found pnpm test:e2e` — 108 passed, all PASS. Two earlier full runs were FAIL on the unrelated `metadata-autosave` spec (the Project page's Settings tab click after a refresh never selected the tab) while another session's Playwright runs held the machine at load average 28 and then 65; kept as `test-results/60-e2e-run-1-failed.txt` and `60-e2e-run-2-failed.txt`. CI on #71 was green on the same code. The race is flagged for its own thread.

**Evidence:** `test-results/not-found/not-found-light.png`, `not-found-dark.png`, `not-found-375.png`.

**Acceptance criteria:** the four routes with 404, header, footer, `main`, title, heading, home link, screenshots — PASS (`not-found`). Command chain — PASS (third run; the two failed runs recorded above).

**AI Code Review** (`/code-review` against `staging`, one pass, two axes, on `66255d5`). Standards: no documented-standard breaches; judgement calls — the three `generateMetadata` hunks share a shape (kept, three lines each; a wrapper would be speculative), the link-preview docstrings described a path no page takes (fixed in `810456b`), a shared unknown-id constant across specs (not taken), doc-block placement (cosmetic). Spec: nothing missing; the `generateMetadata` edits judged justified scope with the "unavailable" Journey branch untouched; a link to a missing row now previews as the not-found page with no Open Graph card, accepted.

**Found on the way, not in scope:** a malformed id (not a UUID) on `/p/`, `/j/`, or `/authors/` still reaches Postgres and errors instead of 404ing; the spec uses well-formed unknown ids. The runner's Step page redirects to the Journey for a missing Run, so it never 404s itself.

**For Paul:** merge the evidence PR; the worktree branch and `.claude/worktrees/60/` can go once it is in. Screenshot feedback noted: one screenshot per spec from now on unless the ticket names more.
