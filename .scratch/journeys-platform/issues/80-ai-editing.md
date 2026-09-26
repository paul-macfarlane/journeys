# 80: AI editing: proofread and tighten a Step's content

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → **80**; parked 44, 39, 45. A reach goal: "a small quality of life improvement for editors … a low priority one."
Route: contract (a new AI call and an editor surface)

**Why:** Paul, 2026-09-26: AI authoring is cut ("I don't want to encourage AI writing for the stories"; ticket 14 is `wontfix`). AI *editing* stays as a small aid for Authors.

**Decisions (Paul, 2026-09-26, Q2 and Q13):**

- **What it may do:** proofread (spelling, grammar, punctuation) and tighten (a shorter or clearer version of the Author's own sentence). It never adds content: no new sentences of story, Steps, Choices, or Outcomes.
- **Where:** the Step's rich-text content only. Titles, Choice labels, Prompts, and descriptions are out.
- **Scope of a request:** the selection, or the whole Step content when nothing is selected.
- **Review before apply:** each change is shown inline, like tracked changes (the original struck through, the suggestion beside it). The Author accepts or rejects each change individually, or all at once. Nothing touches the Draft until accepted, and accepting is an ordinary edit that autosaves and can be undone.

**What to build:**

- A server action that sends the plain text of the selected blocks, with their marks, through the Vercel AI Gateway (`AI_GATEWAY_API_KEY`, a small, fast model chosen from the gateway's list at implementation time). It returns a list of replacements, each an exact span and its suggestion, validated with zod. It never returns a rewritten document. Spans that no longer match the current text are dropped.
- A Tiptap decoration layer that renders the suggestions with accept and reject controls, reachable by keyboard and named for screen readers.
- No key, no control, as with deciding Prompts.
- **Reference, not a base:** branch `feat/14-ai-authoring`, commit `04d1b5a` ("Rewrite with AI for one Step"), holds a Rewrite action and the re-feed fix `2b44c83`. Reuse what fits. That branch replaced the whole content; this ticket must not.
- Rate-limited per Author, like the Judge (`src/lib/ai/rate-limit.ts`).

Acceptance criteria:

- [ ] With the model stubbed, a request on a selection shows each suggested change inline. Accepting one applies only that span, rejecting one leaves the text as it was, and the Draft saves only after an accept (e2e, `ai-editing`).
- [ ] A suggestion that would add a sentence not derived from the original is refused by the result schema's span rule (unit test).
- [ ] With no gateway key, no AI control renders.
- [ ] A spec `[SCOPE CHANGE]` records AI editing and its limits.

Verification follows `docs/agents/testing.md` (`contract`). Use `CONTEXT.md` vocabulary. Origin: Paul's post-hackathon grilling, 2026-09-26.

## Comments
