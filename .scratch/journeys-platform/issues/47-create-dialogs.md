# 47: Create dialogs take a title and land on the new thing

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (/implement, worktree feat/47-create-dialogs)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon 46 → **47** → 48 → 49 → 38 → 50 → 51; 52 is grilled in its own thread and may squeeze in; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call.
Route: polish

**Why:** Paul, 2026-09-23, items 5 and 6: "When I create a new journey, I should be navigated to it. Same thing with projects." and "We have some ui inconsistency between projects and journeys. Are journey descriptions outward facing. If so, should we also make them rich text?"

**What is true today:** `createProjectAction` and `createJourneyAction` both return the new id and both dialogs ignore it, closing and refreshing the list instead (`new-project-dialog.tsx`, `new-journey-dialog.tsx`). New Project asks for a title only; New Journey asks for a title and a plain `Textarea` description. The Journey description is a plain string capped at 500 characters (`journeyDescriptionSchema`) rendered in four places that cannot take rich text: the public Project page card subtitle, the runner header, the link-preview description, and the OG image. The Project description is a page body on the public Project page, which is why ticket 07 made it rich text.

**Decisions (Paul, 2026-09-23, accepted the agent's recommendation):**

- The Journey description stays plain text. A Project has a page, a Journey has a blurb; the four surfaces above are the reason, recorded in `decisions.md`.
- Both dialogs ask for a title only. The description is edited on the Journey page it already lives on, and the Author lands there straight after creating.
- After a successful create the dialog navigates: `/projects/<id>` for a Project, `/projects/<projectId>/journeys/<id>` for a Journey. The list refresh goes; the landing page is fresh by construction.

**What to build:**

- `new-journey-dialog.tsx` drops the description field; `createJourneySchema` makes `description` optional with an empty default so the action's contract is unchanged for any caller. `new-project-dialog.tsx` and `new-journey-dialog.tsx` call `router.push` with the returned id on `ok`.
- **Specs.** `project-create` and `journey-create` (`e2e/projects-and-journeys.spec.ts`) assert the URL after the create and the new title in the page header; `author-flow` and any spec that typed a description into the New Journey dialog set it on the Journey page instead. Check `e2e/` helpers that create Journeys through the dialog.

Acceptance criteria:

- [x] Creating a Project lands on its page; creating a Journey lands on its page; both dialogs ask for a title only.
- [x] A Journey's description is still editable on its page and still reaches the public Project page card, the runner header, and the link preview.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, items 5 and 6.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/57 (base `staging`, branched from `origin/staging` at `f93bdf2`, worktree `.claude/worktrees/47-create-dialogs/journeys`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** e0a86db (both dialogs take a title only and `router.push` to the thing they made, held open with the button disabled through `useTransition` until the new page commits; `createJourneySchema` defaults `description` to `""` and `CreateJourneyInput` becomes the schema's input type, with four unit tests in `journey.test.ts`; the e2e helpers read the id from the landing address and set a Journey's description on its page; the seven specs that relied on staying on a list go back to it), 5fc6184 (review follow-ups: the description schema's comment no longer denies the default, both dialogs refuse to close while navigating, two redundant list reloads dropped), 71f2b9f (evidence).

**Verified run command (code at 5fc6184):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=project-create,journey-create,author-flow E2E_PORT=3147 E2E_DATABASE_NAME=journeys_e2e_47 pnpm test:e2e` — `test-results/dod-1-commands.txt`. Lint, format:check, typecheck exit 0; unit 508/508; e2e **100 passed in 2.0 min, 0 flaky, retries 0** (`test-results/dod-1-e2e.txt`). No build step of its own (`pnpm test:e2e` builds); no migration. The run used dummy env exported in a scratch script (the worktree has no `.env.local` by design) and its own port and database so it could run beside another session.

| Criterion | Verdict | Evidence |
|---|---|---|
| Creating a Project lands on its page; creating a Journey lands on its page; both dialogs ask for a title only | PASS | `project-create` asserts the URL `/projects/<id>`, the title heading, and "No journeys yet" on landing, then the list link; `journey-create` asserts the URL `/projects/<projectId>/journeys/<id>` and the title in the header; the `createJourney` helper fills only "Title" (the dialog has no other field). `test-results/project-create/project-create.png`, `test-results/journey-create/journey-create.png` (both viewed) |
| A Journey's description is still editable on its page and still reaches the public Project page card, the runner header, and the link preview | PASS | `journey-create` sets the description on the Journey page and reads it back on the Project page card; `public-project-page`, `runner-*`, and `project-link-preview` set descriptions through the same helper and passed in the full run (`dod-1-e2e.txt`) |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt`, `dod-1-e2e.txt` |

**AI code review** (one reviewer, whole diff `origin/staging...e0a86db`, standards and spec in one pass). Must fix: the `journeyDescriptionSchema` comment still said no schema-level default was needed (fixed); evidence was uncommitted (now 71f2b9f). Nits: the dialogs could be closed and reopened while the navigation was in flight, letting a second submit create a second record (fixed: `onOpenChange` ignores a close while busy); two redundant `page.goto`s in the navbar and reorder loops (fixed). Checked and fine: `useTransition` + `router.push` hands `isSubmitting` off to `isNavigating` with no gap and a failed navigation cannot strand the dialog; `z.input` for `CreateJourneyInput` leaves the action passing a `string` description to `createJourney`; `editJourneyField` after the client-side landing; no "Title" label collision on either page; no weakened assertion in the amended specs; vocabulary correct.

**Deviations.** None. `author-flow` needed no change: it never typed a description into the dialog.
