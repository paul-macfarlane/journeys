# 91: Preview page title

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). The Preview pages' `<title>` is "Journeys" alone, while the Journey page now reads "<Journey title> · Journeys" (ticket 78).

**What "fixed" means:** "Preview: <Journey title> · Journeys" on the Preview start and Step pages, through `generateMetadata` reading `loadPreview`'s cached membership read, with `notFound()` there too (ticket 60's streamed-metadata trap).

Acceptance: `preview.spec` asserts the title.
