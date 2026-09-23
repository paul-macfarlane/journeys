"use server";

import { redirect } from "next/navigation";

import { getDraftForMember } from "@/db/drafts";
import { decideChoice, gatewayJudge, type Decision } from "@/lib/ai/decide";
import { decisionAllowed } from "@/lib/ai/rate-limit";
import { env } from "@/lib/env";
import { hasStep, type Step } from "@/lib/graph/document";
import { readResponse, refusalNotice } from "@/lib/graph/prompt";
import { requireSession } from "@/lib/session";

/** One decision per Author per second, as the runner allows one per Run. */
const DECISION_WINDOW_MS = 1000;
const lastDecisionAt = new Map<string, number>();

/** The runner's judge path: no key or inside the rate limit is no answer. */
async function judge(
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

/**
 * Preview's one server action: where a Step with a Prompt posts its form.
 * Preview walks the Draft through the participant runner's own components,
 * so a prompted Step offers the same textbox and the same submit buttons a
 * Participant would see — and they have to post somewhere. This is that
 * somewhere, and it records nothing: it reads the answer with the runner's
 * own rule, so a required Prompt left blank is refused here exactly as it
 * would be live, and then it goes where the Choice leads. Member-only like
 * every Preview page; a non-Member is sent to the Journey page, which 404s.
 *
 * A deciding Prompt (ticket 43) asks the judge exactly as the runner does,
 * but Preview never advances on the answer: it always comes back to the
 * Step with the pick, its probability, and the Response in the address, so
 * an Author sees what a live Run would have done and can tune the labels.
 */
export async function previewChooseAction(
  projectId: string,
  journeyId: string,
  stepId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  const stored = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!stored) redirect(journeyHref);
  const draft = stored.document;

  const base = `${journeyHref}/preview`;
  // A Step the Draft no longer has (deleted in another tab): back to the
  // start of Preview, which is where a stale link would land too.
  if (!hasStep(draft, stepId)) redirect(base);

  const here = `${base}/${stepId}`;
  const reading = readResponse(draft.steps[stepId], formData.get("response"));
  const refused = refusalNotice(reading);
  if (refused) redirect(`${here}?notice=${refused}`);

  const step = draft.steps[stepId];
  if (
    step.prompt?.decides === true &&
    step.choices.length > 0 &&
    formData.get("to") === null &&
    reading.kind === "answered"
  ) {
    const decision = await judge(step, reading.text, session.user.id);
    const judged =
      decision.kind === "none"
        ? "decide=none"
        : `decide=${encodeURIComponent(decision.choiceId)}&confidence=${Math.round(decision.probability * 100)}`;
    redirect(`${here}?${judged}&response=${encodeURIComponent(reading.text)}`);
  }

  const to = formData.get("to");
  if (typeof to === "string" && hasStep(draft, to)) redirect(`${base}/${to}`);

  // An Ending's "Save response", or a stale Choice: the Author stays where
  // they are, told that nothing was recorded rather than left wondering.
  redirect(
    reading.kind === "answered" ? `${here}?notice=response-preview` : here,
  );
}
