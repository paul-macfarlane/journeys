# 14: AI authoring

Status: ready-for-agent
Blocked by: 08
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** From an empty (or, after confirmation, non-empty) Draft, an Author describes a Journey in a paragraph and receives a generated Draft — Steps, Choices, Outcomes, Endings — that lands in the editor for review; nothing is published. Uses Anthropic `claude-opus-5` through the Vercel AI SDK's Anthropic provider with adaptive thinking and structured output. Anthropic structured outputs reject dictionary-shaped and recursive schemas, so the AI-facing schema is an array-shaped projection of the graph document (Steps and Outcomes as arrays with explicit ids, content as a restricted block list) derived in code beside the canonical zod schema; the output is mapped into a graph document and validated with the canonical schema before it replaces the Draft. AI entry points are hidden when `ANTHROPIC_API_KEY` is absent. Stretch: rewrite one Step's content from an instruction.

Human prerequisite: `ANTHROPIC_API_KEY` set in `.env.local` and Vercel (`human-prerequisites.md` §6).

- [ ] With no key, no AI controls render and nothing else changes.
- [ ] Generation from a prompt yields a Draft that passes publish-time validation (retry once on failure, then show the problems).
- [ ] Generated Draft appears in the editor unpublished; a non-empty Draft asks for confirmation before replacement.
- [ ] Seam A: the AI-facing projection is derived from the canonical graph schema (not hand-copied); a graph document round-trips through the projection and back, and mapped model output validates against the canonical schema.
- [ ] Stretch: step rewrite replaces only that Step's content and keeps its Choices.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
