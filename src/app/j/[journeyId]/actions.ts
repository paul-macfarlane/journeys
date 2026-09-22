"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createRun, getPublicJourney } from "@/db/runs";
import { beginRun } from "@/lib/graph/begin";
import { currentStepId } from "@/lib/graph/run";
import {
  PARTICIPANT_COOKIE,
  participantCookieOptions,
  runCookieName,
  runCookieOptions,
  runCookiePath,
} from "@/lib/run-cookies";

/**
 * The two server actions the participant runner has, and the only place in
 * the app that writes a cookie: a page render may read one, never set one.
 *
 * A Run is created when a Participant takes their first Choice (ticket 27),
 * not when they open the Journey — a Run created on page load would count
 * every prefetch and crawler as a start. So `/j/{journey-id}` shows the
 * Start Step, and its Choices post here.
 */

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

  const to = formData.get("to");
  const begun =
    typeof to === "string"
      ? beginRun(journey.document, to, new Date())
      : ({ kind: "refused" } as const);
  // Not a Choice the Start Step offers (a typed request, a stale form from a
  // version since replaced), or a Choice back onto the Start, which is a
  // stay: nothing is recorded, and the Start is shown again.
  if (begun.kind === "refused") redirect(`/j/${journeyId}`);

  const cookieStore = await cookies();

  // Pseudonymous and shared across the Journeys this browser walks, so the
  // analytics in ticket 10 can tell one Participant's walks apart without
  // ever knowing who they are. Minted on the first Run, kept afterwards.
  let participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value;
  if (!participantId) {
    participantId = crypto.randomUUID();
    cookieStore.set(
      PARTICIPANT_COOKIE,
      participantId,
      participantCookieOptions(),
    );
  }

  const created = await createRun({
    versionId: journey.versionId,
    participantId,
    state: begun.state,
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
