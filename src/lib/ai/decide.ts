import { experimental_evaluate as evaluate } from "ai";

import { DECISION_THRESHOLD } from "@/lib/ai/threshold";
import { contentPreview } from "@/lib/graph/content";
import type { Step } from "@/lib/graph/document";

/**
 * A deciding Prompt's judgment (ticket 43): the Response a Participant typed
 * is read by an AI judge against the Step's Choices, and a confident answer
 * advances the Run along it instead of showing Choice buttons. Pure and
 * database-free like the rest of `src/lib` — no `server-only`, no db import —
 * so the action that calls `decideChoice` is the only thing that has to worry
 * about the network, and a test exercises the whole decision with a stub
 * `Judge` and no gateway call.
 */

/**
 * Re-exported from `@/lib/ai/threshold` (ticket 43 F5): the number lives
 * outside this network module so a UI file that only needs it, like
 * `step-view.tsx`, does not pull the AI SDK in with it. `decideChoice` below
 * still reads it from here.
 */
export { DECISION_THRESHOLD };

/**
 * Exactly what the judge is shown: the Step's title, its content as plain
 * text, the Prompt's label, and each Choice's id and label — the same things
 * a Participant sees on the page, and nothing else. Never an Ending, an
 * Outcome, a target step id, or any other Step.
 */
export type DecisionInput = {
  state: {
    stepTitle: string;
    stepContent: string;
    promptLabel: string;
    choices: Array<{ id: string; label: string }>;
    response: string;
  };
  question: {
    type: "choice";
    instructions: string;
    /** Choice id -> Choice label, so the judge answers with an id. */
    criteria: Record<string, string>;
  };
};

/**
 * Builds the judge's whole view of a Step and a Response: nothing the judge
 * is shown reaches past this Step's own title, content, Prompt label, and
 * Choices. `contentPreview` is asked for its full length (`Number.MAX_SAFE_INTEGER`)
 * because a judge cutting off mid-sentence would judge a Response against
 * half the Step.
 */
export function buildDecision(step: Step, response: string): DecisionInput {
  const choices = step.choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
  }));

  const criteria = Object.fromEntries(
    choices.map((choice) => [choice.id, choice.label]),
  );

  return {
    state: {
      stepTitle: step.title,
      stepContent: contentPreview(step.content, Number.MAX_SAFE_INTEGER),
      promptLabel: step.prompt?.label ?? "",
      choices,
      response,
    },
    question: {
      type: "choice",
      instructions:
        "A participant read the step and answered its prompt with the " +
        "given response. Pick the choice, by id, that the response selects " +
        "— referring to the choices table by its label column to judge fit.",
      criteria,
    },
  };
}

/** A judge's answer: the Choice id it picked and its probability, or null when it could not judge. */
export type Judge = (
  input: DecisionInput,
) => Promise<{ choiceId: string; probability: number } | null>;

export type Decision =
  | { kind: "confident"; choiceId: string; probability: number }
  | { kind: "weak"; choiceId: string; probability: number }
  | { kind: "none" };

/**
 * Judges a Response against a Step's Choices. Never throws: a judge that
 * returns null, throws, or names a Choice the Step does not have all read as
 * `{ kind: "none" }`, so a Run is never stuck on a judge's failure. At or
 * above `DECISION_THRESHOLD`, the answer is `"confident"`; otherwise it is
 * `"weak"` — both name the judge's pick, so the caller can preselect it.
 */
export async function decideChoice(
  step: Step,
  response: string,
  judge: Judge,
): Promise<Decision> {
  const input = buildDecision(step, response);

  let answer: { choiceId: string; probability: number } | null;
  try {
    answer = await judge(input);
  } catch {
    return { kind: "none" };
  }

  if (answer === null) {
    return { kind: "none" };
  }

  const isKnownChoice = step.choices.some(
    (choice) => choice.id === answer.choiceId,
  );
  if (!isKnownChoice) {
    return { kind: "none" };
  }

  return answer.probability >= DECISION_THRESHOLD
    ? {
        kind: "confident",
        choiceId: answer.choiceId,
        probability: answer.probability,
      }
    : {
        kind: "weak",
        choiceId: answer.choiceId,
        probability: answer.probability,
      };
}

/**
 * A Participant is waiting on this call, so it does not get the AI SDK's
 * default retries and never runs longer than this: a slow gateway falls back
 * to the Choices, the same as any other judge failure, rather than holding a
 * Run's redirect open until an error page. Twenty seconds (ticket 49): jev's
 * latency is bimodal, most calls about half a second and a slow third of
 * them twelve to fourteen, and at the earlier five the slow third fell back
 * as if the judge had failed. `DecideSubmit` shows "Deciding…" for the wait.
 */
export const DECISION_TIMEOUT_MS = 20_000;

/**
 * The real `Judge`: a thin caller around `experimental_evaluate` with jev on
 * the Vercel AI Gateway, tagged `feature:decide` for usage reporting. Returns
 * null on anything unusable — no `choice` answer, an empty `choiceId`, or a
 * probability the provider did not supply — so `decideChoice` treats it the
 * same as any other judge failure. Does not check for a gateway key: the
 * action that calls this decides what "no key" means, and a call made
 * without one simply fails the way any other gateway call without
 * credentials does.
 */
export const gatewayJudge: Judge = async (input) => {
  const result = await evaluate({
    model: "typesafe-ai/jev",
    state: input.state,
    questions: { decision: input.question },
    providerOptions: { gateway: { tags: ["feature:decide"] } },
    // No retry and a hard timeout (ticket 43 blocking fix): a Participant
    // waits on this call, and a gateway that is merely slow must fall back
    // to the Choices exactly as fast as one that is down.
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(DECISION_TIMEOUT_MS),
  });

  const answer = result.answers.decision;
  if (answer.type !== "choice") {
    return null;
  }

  const probability = answer.probabilities?.[answer.choice];
  if (answer.choice.length === 0 || probability === undefined) {
    return null;
  }

  return { choiceId: answer.choice, probability };
};
