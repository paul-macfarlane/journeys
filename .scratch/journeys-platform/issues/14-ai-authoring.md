# 14: AI authoring

Status: wontfix
Blocked by: 08
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** From an empty (or, after confirmation, non-empty) Draft, an Author describes a Journey in a paragraph and receives a generated Draft — Steps, Choices, Outcomes, Endings — that lands in the editor for review; nothing is published. Uses an Opus-class Claude model through the Vercel AI Gateway — a plain `anthropic/claude-opus-…` model string chosen from `gateway.getAvailableModels()` when this ticket runs, never a hand-copied slug — with the AI SDK's structured output (`ai` package; the lockfile commit is Paul's). No provider package and no Anthropic key. Anthropic structured outputs reject dictionary-shaped and recursive schemas, so the AI-facing schema is an array-shaped projection of the graph document (Steps and Outcomes as arrays with explicit ids, content as a restricted block list) derived in code beside the canonical zod schema; the output is mapped into a graph document and validated with the canonical schema before it replaces the Draft. AI entry points are hidden when `AI_GATEWAY_API_KEY` is absent. Stretch: rewrite one Step's content from an instruction.

Human prerequisite: AI Gateway enabled on the Vercel project and `AI_GATEWAY_API_KEY` set in `.env.local` and Vercel (`human-prerequisites.md` §6).

- [ ] With no key, no AI controls render and nothing else changes.
- [ ] Generation from a prompt yields a Draft that passes publish-time validation (retry once on failure, then show the problems).
- [ ] Generated Draft appears in the editor unpublished; a non-empty Draft asks for confirmation before replacement.
- [ ] Seam A: the AI-facing projection is derived from the canonical graph schema (not hand-copied); a graph document round-trips through the projection and back, and mapped model output validates against the canonical schema.
- [ ] Stretch: step rewrite replaces only that Step's content and keeps its Choices.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### [SCOPE CHANGE] 2026-09-22 — Claude Fable 5.1, decided by Paul in the round-3 grilling

Provider wiring moves from the AI SDK's Anthropic provider to the Vercel AI Gateway (Paul, Q14: "I also think we should use the ai gateway for our other ai features"). Model strings are `provider/model` picked from the gateway's list at implementation time, Opus-class for whole-Draft generation (Q19). Authentication is a static `AI_GATEWAY_API_KEY` (Q18), which replaces `ANTHROPIC_API_KEY` in `src/lib/env.ts`, `.env.example`, `README.md`, and `human-prerequisites.md` §6 in the tickets PR; the "absent means hidden" rule is unchanged. Ticket 43 (jev) shares the key and the `ai` package; whichever ticket lands first adds the package. Tag gateway calls `feature:authoring` for cost attribution. Everything else in the ticket stands.

### 2026-09-24 — Claude Opus 5.5, noted for Paul

Paul will try this as a spike in its own thread and worktree, to see how well whole-Draft generation works before deciding whether it ships. The spike does not block 38 or 54, and they do not wait for it. If the spike lands, ticket 54's feature list names it.

### 2026-09-26 — Claude (Opus 5.5), post-hackathon triage

`[SCOPE CHANGE]` Paul, 2026-09-26: AI authoring is cut ("I don't want to encourage AI writing for the stories"). Whole-Draft generation will not ship. Branch `feat/14-ai-authoring` is kept unmerged as a reference: its per-Step rewrite (`04d1b5a`, `2b44c83`) is the starting point for ticket 80, AI editing (proofread and tighten, each change reviewed before it applies).
