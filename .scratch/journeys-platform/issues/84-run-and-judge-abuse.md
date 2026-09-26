# 84: Abuse limits on Runs and the Judge, and no Response in the address

Status: needs-triage
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`. Paul settles the two decisions below before work starts.
Route: contract (a runner route contract changes; Paul-owned cloud settings)

**Why:** ticket 72, finding Q-abuse (its three parts are A1–A3 below); ticket 15 ("rate limiting and abuse protection", moved to 72).

- **A1: a Response in the address.** When the Judge is undecided on a deciding Prompt at the Start, the Participant's Response (up to 2000 characters) travels back as `?response=` in the redirect (`src/app/j/[journeyId]/actions.ts:131`), because no Run exists yet to hold it. Addresses end up in browser history, Vercel request logs, and anything the Participant shares. A Response is the most sensitive thing the app stores (`CLAUDE.md` bars it from proof artifacts).
- **A2: the Judge has no durable limit.**
  - The only limit is one decision per key per second in module memory (`src/lib/ai/judge.ts:19-20`, `src/lib/ai/rate-limit.ts`). That memory is per server instance.
  - The keys are free to mint: a participant cookie at the Start, a Run id after it (`actions.ts:123-127, 242`).
  - There is no per-Run cap and no budget. A script that clears cookies calls the model without limit, at Paul's cost.
  - The Step content, Choice labels, and Prompt label go to the model uncapped (`src/lib/ai/decide.ts:67`, `contentPreview(..., Number.MAX_SAFE_INTEGER)`).
- **A3: Run creation is unlimited.** Every Start submission creates a Run (`chooseFromStartAction`), and nothing limits it (`src/proxy.ts` only routes sign-in). The cost is database growth and polluted Analytics, not money.

**Decisions for Paul (agent recommendation first):**

1. **Where the undecided Start Response lives.**
   - *Recommended:* a short-lived `httpOnly` cookie scoped to the Journey's `/j/<id>` path (the pattern `src/lib/run-cookies.ts` already uses), read once by the page and cleared.
   - *Alternative:* create the Run before judging. That changes what a Start means for Analytics (ADR-0002), so it is not recommended.
2. **The durable limit.**
   - *Recommended:* two Paul-owned Vercel settings, with no new service and no new dependency:
     - a **Vercel Firewall rate-limit rule** on `POST /j/*` (for example 30 requests per minute per IP);
     - an **AI Gateway spend limit** on the key the Judge uses.
   - In code: a per-Run cap on Judge calls (for example 20, then the Participant chooses, the same fallback as a timeout) and a cap on the text sent to the model (for example 4000 characters of content).
   - *Alternative:* a shared store (Upstash via the Marketplace) for a cross-instance limiter. That adds a service, so it is not recommended for this product's size.

**What to build (after the decisions):**

- Decision 1 as chosen. The page stops trusting `?response=` entirely.
- The per-Run Judge cap, counted on the Run. Use an additive column with a default, compatible with the deployed code. The Start's Judge call counts toward the Run it begins.
- The model-input cap in `decide.ts`, with a unit test.
- `human-prerequisites.md` gains the Firewall rule and the Gateway spend limit as Paul's steps. Agents do not change cloud configuration.

Acceptance criteria (completed after the decisions):

- [ ] An undecided Start leaves no Response in the address (e2e reads `page.url()` with the Judge stubbed at the existing decide seam).
- [ ] The (N+1)th Judge call on one Run returns the no-decision fallback (unit).
- [ ] The model receives at most the capped length (unit).
- [ ] The two Paul-owned settings are listed in `human-prerequisites.md`.

Verification follows `docs/agents/testing.md` (`contract`), including migration compatibility. Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 72; ticket 15.

## Comments
