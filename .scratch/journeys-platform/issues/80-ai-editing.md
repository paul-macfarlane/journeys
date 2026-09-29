# 80: AI editing: proofread and tighten a Step's content

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`. A reach goal: "a small quality of life improvement for editors … a low priority one."
Route: contract (a new AI call, a new dependency and env var, and an editor surface)

**Why:** Paul, 2026-09-26: AI authoring is cut ("I don't want to encourage AI writing for the stories"; ticket 14 is `wontfix`). AI *editing* stays as a small aid for Authors.

**Decisions (Paul, 2026-09-26, Q2 and Q13):**

- **What it may do:** proofread (spelling, grammar, punctuation) and tighten (a shorter or clearer version of the Author's own sentence). It never adds content: no new sentences of story, Steps, Choices, or Outcomes.
- **Where:** the Step's rich-text content only. Titles, Choice labels, Prompts, and descriptions are out.
- **Scope of a request:** the selection, or the whole Step content when nothing is selected.
- **Review before apply:** each change is shown inline, like tracked changes (the original struck through, the suggestion beside it). The Author accepts or rejects each change individually, or all at once. Nothing touches the Draft until accepted, and accepting is an ordinary edit that autosaves and can be undone.

## Starting point after the Judge cut

This ticket was written while the Judge still existed. Ticket 87 (PR #106, 2026-09-26) removed every AI piece, and its decision 2 says this ticket adds back what it needs. As of `staging` at `eaf01b3`:

- There is no `ai` package, no `src/lib/ai/`, and no `AI_GATEWAY_API_KEY` in `src/lib/env.ts`, `.env.example`, or `playwright.config.ts`. This ticket adds all three back. Adding the dependency changes `pnpm-lock.yaml`, and that commit is Paul's (see `CLAUDE.md`).
- There is no in-app rate limiter. The Judge's limiter can be read at `git show 8da2dd0^:src/lib/ai/rate-limit.ts` and `…:src/lib/ai/judge.ts`. It was one call per key per second, held in module memory, so it was per server instance. Ticket 84 (A2) judged that too weak for anonymous callers. Here the callers are signed-in Members, which changes the risk (see the decision below).
- `human-prerequisites.md` §6 (the gateway key) is retired. This ticket adds a new section for Paul: set `AI_GATEWAY_API_KEY` on Vercel (Production and Preview) and put a spend limit on the gateway.
- **Reference, not a base:** commits `04d1b5a` ("Rewrite with AI for one Step", `src/lib/ai/authoring.ts`, `rewrite-step-dialog.tsx`, the `aiAuthoring` prop threaded through `DraftEditor`) and `2b44c83` (re-feeding the rich-text surface after a rewrite). No branch or remote ref holds them. They survive only as objects in Paul's main checkout, so check with `git cat-file -t 04d1b5a` before relying on them. Reuse what fits. That work replaced the whole content; this ticket must not. Since then, ticket 86 (PR #113) split the canvas, the Draft editor, and the layout module, so the prop threading will land in different files.
- Ticket 43's lessons still apply to any gateway call: set `maxRetries: 0` and an explicit timeout, and treat a timeout or failure as "no suggestions" with a message. A failed call never blocks editing.

## How AI editing is limited (Paul, 2026-09-28, settled)

Four limits: a Member-only server action, a cap on input length (4000 characters, the cap Paul picked for the Judge in ticket 84), a per-Author in-memory limit (the old `decisionAllowed` shape, one request per Author every few seconds, with the window in a named constant), and a spend limit Paul sets on the gateway. No new table. Why this is enough: a caller must be signed in through Google or Discord and be a Member, so nobody can mint new keys for free the way ticket 84's A2 could, and the gateway spend limit bounds the cost across server instances. A durable per-Author counter in Postgres was the alternative. It was not chosen because it needs a migration and a deploy-window check.

## What to build

- Add back the `ai` dependency and an optional `AI_GATEWAY_API_KEY` in `src/lib/env.ts` and `.env.example`, blanked in `playwright.config.ts` the way it was before ticket 87.
- A server action that sends the plain text of the selected blocks, with their marks, through the Vercel AI Gateway, using a small, fast model chosen from the gateway's list at implementation time, named as a plain `"provider/model"` string. It checks Journey membership, the length cap, and the limit. It returns a list of replacements, each an exact span and its suggestion, validated with zod. It never returns a rewritten document. Spans that no longer match the current text are dropped.
- A Tiptap decoration layer that renders the suggestions with accept and reject controls, reachable by keyboard and named for screen readers.
- With no key, no control renders. The page reads the key on the server and passes a boolean down to the Draft editor.

Acceptance criteria:

- [ ] With the model stubbed, a request on a selection shows each suggested change inline. Accepting one applies only that span, rejecting one leaves the text as it was, and the Draft saves only after an accept (e2e, `ai-editing`).
- [ ] A suggestion that would add a sentence not derived from the original is refused by the result schema's span rule (unit test).
- [ ] The action refuses a non-Member, input over the cap, and a call inside the limit, and none of them reaches the model (unit test).
- [ ] With no gateway key, no AI control renders.
- [ ] `human-prerequisites.md` has a section for the key and the gateway spend limit, and `.env.example` lists the key.
- [ ] A spec `[SCOPE CHANGE]` records AI editing and its limits.

Verification follows `docs/agents/testing.md` (`contract`). Use `CONTEXT.md` vocabulary. Origin: Paul's post-hackathon grilling, 2026-09-26.

## Comments

### 2026-09-28 — Claude (Opus 5.5)

Refreshed at Paul's request ("we can fix 80") when he re-ordered the backlog to 94 → 93 → 80. The product decisions are unchanged. The ticket had pointed at the Judge's `src/lib/ai/rate-limit.ts` and at "as with deciding Prompts", and both went away with ticket 87. It now says what to add back, where the old code can be read, and which limit decision is still open.

### 2026-09-28 — Claude (Opus 5.5)

Paul agreed to the recommended limit ("I agree with your recommendations"): Member-only, a 4000-character cap, a per-Author in-memory limit, and a gateway spend limit. The section above now records it as settled, so chunk 8 has no open decisions left.
