# 03: Graph contract, validation, and Draft

Status: ready-for-agent
Blocked by: 02
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** Every Journey has a Draft holding one validated graph document, created with a single Start step when the Journey is created. The graph document is the contract every later ticket depends on; this ticket makes it real and proves it with Seam A tests on a real-sized fixture. Also write ADR-0001 (graph as one JSON document per Draft/Published Version) in `docs/adr/`.

The document contains: schema version; Start step id; Steps by stable id (title, Tiptap-JSON content, ordered Choices, optional Prompt); Outcomes by stable id (label); Endings (steps with no Choices) carry an outcome id; reserved `allow_back` (default true). Each Choice: stable id, label, target step id, reserved nullable `condition`/`effect`. Each Prompt: `type` accepting only `free_text`, label, required flag. Nullable step position fields reserved. Write-time validation is structural (zod). Publish-time validation additionally enforces: exactly one Start; every Choice target exists; every Step reachable from Start; every Ending has an existing Outcome; no cycles (no Choice targets a Step that can reach it); returns structured problems with step/choice ids. Content sanitization runs server-side at every write and allows only paragraph, headings, bold, italic, bullet/ordered lists, links, and an image node with URL + required credit; link `href` and image `src` must be absolute http(s) URLs (anything else, including `javascript:`/`data:`, is stripped) and rendered links carry `rel="noopener noreferrer"`.

- [ ] Creating a Journey creates a Draft with one Start step; the Draft round-trips through save/load unchanged.
- [ ] Seam A: each publish-time rule (including cycle) has a failing test case and the success case passes on a hand-authored 40+ step fixture committed with the tests (ticket 04 adds the real case-3 document as a second success case); sanitization strips disallowed nodes/marks, rejects images without credit, and strips `javascript:` and non-http(s) link/image URLs.
- [ ] Publish-time validation is exposed as a callable operation (no UI required yet) returning the structured problem list.
- [ ] ADR-0001 exists in `docs/adr/` with context, decision, alternatives (relational steps/edges; event-sourced graph), and consequences.
- [ ] `CONTEXT.md` terms are used in type and function names (Step, Choice, Ending, Outcome, Draft) — no `node`/`edge` outside canvas code.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
