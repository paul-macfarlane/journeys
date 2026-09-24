# 52: Author pages and the display name

Status: needs-info
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 4 (Paul, 2026-09-23, triaged the same day): pre-hackathon 46 → 47 → 48 → 49 → 38 → 50 → 51; **52 is grilled in its own thread** and may squeeze in before Friday if the grilling finds it as light as Paul expects; post-hackathon 53 joins sweep 3 (41 → 42 → 44 → 45). 14 stays available and is Paul's call.
Route: contract

**Why:** Paul, 2026-09-23, item 4: "it would be cool if Authors themselves could have public pages about themselves and what they use the platform for. They also could edit their display name. This is a new feature." Triaged post-hackathon as a large feature; Paul asked to squeeze it in as lightweight and to grill it in a separate thread first.

**What is true today (read on `staging` at `78a4e32`):** the better-auth `user` table has `id`, `name`, `email`, `emailVerified`, `image`, and timestamps; no handle, bio, or slug. There is no settings, account, or profile page, and the name is whatever Google or Discord supplied. The name shows in the navbar, the Projects list ("Signed in as …"), and the Members tab. The public routes are `/p/<projectId>`, `/j/<journeyId>`, `/j/<journeyId>/<stepId>`, `/privacy`, `/terms`, and `/`; all public ids are primary keys, so a rename never moves a URL. The public Project page shows no author. The privacy page describes the name as something only Members see.

**Needs from Paul before this is ready (the grilling):**

- **The page.** What is on it: display name, avatar, a bio (plain text, or rich text through the existing editor), and which Projects? All Projects the Author is a Member of, only the ones they own, or only the ones they opt in? A Project with no live Journey shows nothing today; does it show on an Author page?
- **The address.** `/authors/<userId>` follows the id-is-the-address rule with no new column; a handle (`/authors/paul`) needs a unique column, a validation rule, a claim flow, and a rename policy. Which?
- **Opt-in.** An Author page makes a name public that was private. Is the page off until the Author turns it on (a `public` flag), and does the public Project page link to its Authors only when their page is on? The privacy page changes either way.
- **The display name.** Edited where: a Settings page under `/projects`, or a row in the user menu? better-auth's `updateUser` covers the name; the avatar stays the provider's unless Paul wants a URL field (images are by URL only, spec).
- **Lightweight cut.** The smallest version is: editable name in the user menu, `/authors/<userId>` off by default, a plain-text bio, and the Author's Projects with at least one live Journey. Schema: `user.bio text NULL`, `user.public boolean NOT NULL DEFAULT false`, one additive migration. Is that the hackathon cut, or does it wait?

**What to build (after the grilling):** the migration, `src/db/users.ts` (`server-only`), the settings surface, `src/app/authors/[userId]/page.tsx` inside `RunnerFrame` with the app's own Theme, the link from the public Project page, `generateMetadata` and an OG image following ticket 37, the privacy sentence, and specs `author-page` and `author-settings`.

Acceptance criteria: written after the grilling.

Verification and evidence follow `docs/agents/testing.md` (`contract`): the full command chain including `pnpm db:migrate`, one full `pnpm test:e2e` at the end; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary (Author, never profile or user, in copy). Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-23, item 4.

## Comments
