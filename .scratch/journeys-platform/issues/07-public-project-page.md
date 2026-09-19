# 07: Public Project page

Status: ready-for-agent
Blocked by: 05, 08
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A Participant opens `/p/{project-slug}` and sees the Project's title, its rich-text description, and its currently published Journeys (title, description, link); unpublished and never-published Journeys are absent. Authors edit the Project description with the same Tiptap editor component and allowed node set that ticket 08 builds for Steps (ticket 08 owns the editor; this ticket reuses it). Discovery is link-only: no index, search, or cross-project browsing anywhere.

- [ ] Project page renders description and only published Journeys; unpublishing one removes it without a deploy.
- [ ] Author edits the Project description in a rich-text editor; content is sanitized with the shared allowed set.
- [ ] Unknown project slug 404s; the site root still lists nothing.
- [ ] Seam B: publish a Journey → it appears on the Project page → Unpublish → gone.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
