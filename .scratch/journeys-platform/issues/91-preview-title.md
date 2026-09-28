# 91: Preview page title

Status: done
Blocked by: None
Owner: Claude, chunk 9 orchestrator (2026-09-28)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). The Preview pages' `<title>` is "Journeys" alone, while the Journey page now reads "<Journey title> · Journeys" (ticket 78).

**What "fixed" means:** "Preview: <Journey title> · Journeys" on the Preview start and Step pages, through `generateMetadata` reading `loadPreview`'s cached membership read, with `notFound()` there too (ticket 60's streamed-metadata trap).

Acceptance: `preview.spec` asserts the title.

## Comments

### 2026-09-28 — Claude, chunk 9 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/115 (chunk 9, route `contract` from ticket 89; the chunk plan, the AI review and the command chain are on ticket 89).

- **Worker:** D3 (Sonnet, 093da6b on the chunk branch), plus review fix C1 in 566edd1.
- **Change:** a request-scoped `cache()`d read in `preview/load.ts` serves both the pages and `previewMetadata`. The metadata calls `notFound()` for a non-Member, an unknown Journey, a missing Draft, or an unknown Step.
- **Verdict PASS:** the `preview` test passes in the final run. It asserts `Preview: <Journey title> · Journeys` on the start and Step screens, and `Page not found · Journeys` for an unknown Step. Screenshot: `test-results/preview/`.
- **DoD:** the chunk chain passed on 566edd1, e2e 150 passed, 0 failed, 0 flaky (`test-results/chunk-9-commands.txt`).
