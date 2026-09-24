"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { deleteResponse, saveResponse } from "@/db/responses";
import {
  createRun,
  getPublicJourney,
  getRunForJourney,
  saveRunState,
} from "@/db/runs";
import type { Decision } from "@/lib/ai/decide";
import { asksJudge, judgeResponse } from "@/lib/ai/judge";
import { beginRun } from "@/lib/graph/begin";
import { hasStep, type Step } from "@/lib/graph/document";
import { readResponse, refusalNotice } from "@/lib/graph/prompt";
import { currentStepId, navigateTo } from "@/lib/graph/run";
import {
  PARTICIPANT_COOKIE,
  participantCookieOptions,
  runCookieName,
  runCookieOptions,
  runCookiePath,
} from "@/lib/run-cookies";

/**
 * The participant runner's server actions, and the only place in the app
 * that writes a cookie: a page render may read one, never set one.
 *
 * A Run is created when a Participant takes their first Choice (ticket 27),
 * not when they open the Journey — a Run created on page load would count
 * every prefetch and crawler as a start. So `/j/{journey-id}` shows the
 * Start Step, and its Choices post here.
 *
 * A Step with a Prompt (ticket 12) posts here too, from any Step: the answer
 * travels in the form's `response` field beside the chosen Step's `to`, and
 * is read by `readResponse` — the one rule about when an answer is required
 * — before anything is written. A refused answer sends the Participant back
 * to the Step with a `?notice=` naming why, and moves nothing.
 */

/**
 * A deciding Prompt (ticket 43): a form posted from a Step whose Prompt
 * decides, carrying no `to`, asks the judge which Choice the Response takes.
 * A confident answer is taken exactly as if its button had been pressed;
 * anything else comes back to the Step with `?decide=<choice-id|none>`, and
 * the page offers the Choices — the pick marked — under "Choose for
 * yourself". The judge is never an error: no key, a call inside the rate
 * limit, a failed call, or an answer naming no Choice of the Step all read
 * as "none", so a Run is never stuck.
 */

/** The Step a confident answer leads to; null for any other decision. */
function judgedTarget(step: Step, decision: Decision): string | null {
  if (decision.kind !== "confident") return null;
  return (
    step.choices.find((choice) => choice.id === decision.choiceId)
      ?.targetStepId ?? null
  );
}

/** `?decide=` for an answer the Participant is asked to confirm. */
function decideParam(decision: Decision): string {
  return `decide=${encodeURIComponent(decision.kind === "none" ? "none" : decision.choiceId)}`;
}

/**
 * The first Choice of a walk: creates the Run, already holding the Start and
 * the chosen Step, sets the cookies, and lands on that Step in one round
 * trip. The chosen Step travels as the form's `to` field. A Run already in
 * progress for this Journey is left exactly as it was — a Run is a record of
 * one walk, and rewriting it would lose what happened — and the new Run's id
 * simply replaces it in the cookie.
 */
export async function chooseFromStartAction(
  journeyId: string,
  formData: FormData,
): Promise<void> {
  const journey = await getPublicJourney(journeyId);
  // Unknown or not live: back to the Start, which 404s or says why. Checked
  // here as well as on the page because an action is a public endpoint of
  // its own, not something only that page can reach.
  if (!journey || journey.kind !== "live") redirect(`/j/${journeyId}`);

  const startStep = journey.document.steps[journey.document.startStepId];
  const cookieStore = await cookies();

  // Pseudonymous and shared across the Journeys this browser walks, so the
  // analytics in ticket 10 can tell one Participant's walks apart without
  // ever knowing who they are. Minted on the first Run, kept afterwards —
  // and minted here, before any judging, rather than only right before
  // `createRun` below: the judge's rate limit is keyed on this id, and two
  // different first-time visitors judged in the same second must not share
  // a key, which they would if the key fell back to the Journey id instead
  // (ticket 43 S8/F2). Cached in `participantId` so a deciding Start still
  // mints exactly once, whether or not it ends up judging.
  let participantId: string | undefined;
  function ensureParticipantId(): string {
    if (participantId !== undefined) return participantId;
    participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value;
    if (participantId === undefined) {
      participantId = crypto.randomUUID();
      cookieStore.set(
        PARTICIPANT_COOKIE,
        participantId,
        participantCookieOptions(),
      );
    }
    return participantId;
  }

  let to = formData.get("to");
  if (asksJudge(startStep, formData)) {
    // A deciding Prompt on the Start: the Response is read (and refused)
    // before the judge sees it, and a Response that is not taken forward
    // travels back in the address, since no Run exists yet to hold it.
    const reading = readResponse(startStep, formData.get("response"));
    const refused = refusalNotice(reading);
    if (refused) redirect(`/j/${journeyId}?notice=${refused}`);
    const text = reading.kind === "answered" ? reading.text : "";

    const decision = await judgeResponse(
      startStep,
      text,
      ensureParticipantId(),
    );
    to = judgedTarget(startStep, decision);
    if (to === null) {
      redirect(
        `/j/${journeyId}?${decideParam(decision)}&response=${encodeURIComponent(text)}`,
      );
    }
  }

  const begun =
    typeof to === "string"
      ? beginRun(journey.document, to, new Date())
      : ({ kind: "refused" } as const);
  // Not a Choice the Start Step offers (a typed request, a stale form from a
  // version since replaced), or a Choice back onto the Start, which is a
  // stay: nothing is recorded, and the Start is shown again.
  if (begun.kind === "refused") redirect(`/j/${journeyId}`);

  // The Start Step's Prompt, answered with this first Choice. Native
  // constraint validation is off across the app, so the server is the only
  // check a required Prompt left blank ever meets.
  const reading = readResponse(startStep, formData.get("response"));
  const refused = refusalNotice(reading);
  if (refused) redirect(`/j/${journeyId}?notice=${refused}`);

  const created = await createRun({
    versionId: journey.versionId,
    participantId: ensureParticipantId(),
    state: begun.state,
    response:
      reading.kind === "answered"
        ? { stepId: startStep.id, text: reading.text }
        : undefined,
  });

  // The new Run's id replaces whatever this Journey's cookie held.
  cookieStore.set(
    runCookieName(journeyId),
    created.id,
    runCookieOptions(journeyId),
  );

  redirect(`/j/${journeyId}/${currentStepId(begun.state)}`);
}

/**
 * Starting over drops the Run cookie and shows the Start Step fresh; the
 * next Choice creates a new Run. The old Run is neither ended nor deleted —
 * it is abandoned where the Participant left it, which is what an Author's
 * analytics should see. Deleted by name *and* path: a cookie is one of
 * (name, domain, path), and a deletion on any other path would leave it.
 */
export async function startOverAction(journeyId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: runCookieName(journeyId),
    path: runCookiePath(journeyId),
  });

  redirect(`/j/${journeyId}`);
}

/**
 * A Choice taken from a Step with a Prompt, or a Response saved on an Ending
 * with one: the form on `/j/{journey-id}/{step-id}` posts here with the
 * answer in `response` and, on a Step with Choices, the chosen Step in `to`.
 * Without a Run cookie, or with one naming another Journey's Run, there is
 * nothing to answer for and the Participant goes to the Start.
 *
 * The answer is read first and refused first: a required Prompt left blank
 * moves nothing, and neither does an answer over the cap. An answer is saved
 * against `stepId` — the Step the form was on — before the move, so a move
 * the reducer refuses still keeps what was written; an optional Prompt left
 * blank on a Step already answered takes that answer back, since the box
 * showed it and the Participant emptied it. The move itself is the same
 * `navigateTo` the step page applies to a link, without the path index a
 * Back carries: a form is a Choice, never a Back, and the page it was on has
 * already been read as current by the time it renders. Landing is a redirect
 * to the chosen Step's own URL, which the step page reads as a stay: nothing
 * is recorded twice.
 */
export async function respondAndChooseAction(
  journeyId: string,
  stepId: string,
  formData: FormData,
): Promise<void> {
  const cookieStore = await cookies();
  const runId = cookieStore.get(runCookieName(journeyId))?.value;
  if (!runId) redirect(`/j/${journeyId}`);

  const found = await getRunForJourney(runId, journeyId);
  if (!found) redirect(`/j/${journeyId}`);

  const { run, version } = found;
  // A Step this version does not have: a stale form. Back to where the Run
  // stands, which is where the step page would send a link to it too.
  if (!hasStep(version.document, stepId)) {
    redirect(`/j/${journeyId}/${currentStepId(run)}`);
  }

  const here = `/j/${journeyId}/${stepId}`;
  const step = version.document.steps[stepId];
  const reading = readResponse(step, formData.get("response"));
  const refused = refusalNotice(reading);
  if (refused) redirect(`${here}?notice=${refused}`);
  if (reading.kind === "answered") {
    await saveResponse(run.id, stepId, reading.text);
  } else if (step.prompt !== null) {
    await deleteResponse(run.id, stepId);
  }

  let to = formData.get("to");
  if (asksJudge(step, formData) && reading.kind === "answered") {
    // The Response is already saved; a confident answer is taken as the
    // Choice it names, and anything else asks the Participant.
    const decision = await judgeResponse(step, reading.text, run.id);
    to = judgedTarget(step, decision);
    if (to === null) redirect(`${here}?${decideParam(decision)}`);
  }

  if (typeof to !== "string") {
    // An Ending's "Save response": there is nothing to move to, and the
    // Participant is told what happened where they stand.
    redirect(
      `${here}?notice=${reading.kind === "answered" ? "response-saved" : "response-cleared"}`,
    );
  }

  const moved = navigateTo(version.document, run, to, new Date());
  if (moved.kind === "refused") {
    const where = `/j/${journeyId}/${moved.currentStepId}`;
    redirect(
      moved.reason === "path-full" ? `${where}?notice=path-full` : where,
    );
  }
  if (moved.kind === "moved") {
    await saveRunState(run.id, moved.state);
  }

  redirect(`/j/${journeyId}/${to}`);
}
