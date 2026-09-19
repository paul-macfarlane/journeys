# 02: Projects and Journeys

Status: ready-for-agent
Blocked by: 01
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A signed-in Author creates a Project, sees it in their list, renames it, and deletes it; inside a Project they create Journeys with a title, slug, and short description, see their publish state, rename them, and delete them. The creator is the Project's first Member and membership gates every read and write.

Slugs are globally unique and auto-generated from the title; Journey slugs are editable until first publish (no publish exists yet, so editable throughout this ticket). Deleting is a hard delete after confirmation. A Project cannot lose its last Member (enforced here even though removing Members arrives in ticket 13). Member `role` column exists, defaults to `member`, is never read.

- [ ] Author creates a Project; it appears in their projects list; non-Members cannot open it (404 or forbidden, consistently).
- [ ] Author renames a Project and its slug regenerates only if they choose to change it; slug uniqueness is enforced with a clear error.
- [ ] Author deletes a Project after confirmation; it and its Journeys are gone.
- [ ] Author creates a Journey with title, description, auto slug; the Project page lists Journeys with state "never published".
- [ ] Author renames a Journey, edits its description and slug; deletes it after confirmation.
- [ ] Seam B: an e2e spec covers create Project → create Journey → rename → delete.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
