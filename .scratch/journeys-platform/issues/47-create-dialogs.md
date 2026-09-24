# 47: Create dialogs take a title and land on the new thing

Status: ready-for-agent
Blocked by: None
Owner:
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

- [ ] Creating a Project lands on its page; creating a Journey lands on its page; both dialogs ask for a title only.
- [ ] A Journey's description is still editable on its page and still reaches the public Project page card, the runner header, and the link preview.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, items 5 and 6.

## Comments
