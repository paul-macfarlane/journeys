import "server-only";

import { decideChoice, gatewayJudge, type Decision } from "@/lib/ai/decide";
import { decisionAllowed } from "@/lib/ai/rate-limit";
import { env } from "@/lib/env";
import { isDeciding } from "@/lib/graph/prompt";
import type { Step } from "@/lib/graph/document";

/**
 * The one home for a deciding Prompt's judge path (ticket 43 S2): both the
 * runner's actions and Preview's action ask a Step's judge through this
 * file, so the rate limit and the rule for when a form even asks the judge
 * can never quietly diverge between the two surfaces. `server-only` because
 * this is where the gateway call and the rate-limit map live — neither
 * belongs in a bundle a browser could load.
 */

/** One decision per key (a Run, a Participant, or an Author) per second. */
export const DECISION_WINDOW_MS = 1000;
const lastDecisionAt = new Map<string, number>();

/**
 * True when this form asks the judge rather than naming a Choice: the Step's
 * Prompt is genuinely deciding (`isDeciding`, ticket 43 F3 — two or more
 * Choices) and the form carries no `to`.
 */
export function asksJudge(step: Step, formData: FormData): boolean {
  return isDeciding(step) && formData.get("to") === null;
}

/**
 * Judges a Response against a Step's Choices, rate-limited by `rateKey`. No
 * gateway key, or a call inside the rate limit, both read as `{ kind: "none" }`
 * — never an error — so a Run or a Preview click is never stuck on the judge.
 */
export async function judgeResponse(
  step: Step,
  response: string,
  rateKey: string,
): Promise<Decision> {
  if (env.AI_GATEWAY_API_KEY === undefined) return { kind: "none" };
  if (
    !decisionAllowed(lastDecisionAt, rateKey, Date.now(), DECISION_WINDOW_MS)
  ) {
    return { kind: "none" };
  }
  return decideChoice(step, response, gatewayJudge);
}
