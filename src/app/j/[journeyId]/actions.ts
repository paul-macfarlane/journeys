"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createRun, getPublicJourney } from "@/db/runs";
import { startRun } from "@/lib/graph/run";
import {
  PARTICIPANT_COOKIE,
  participantCookieOptions,
  runCookieName,
  runCookieOptions,
} from "@/lib/run-cookies";

/**
 * The one server action the participant runner has, and the only place in the
 * app that writes a cookie: a page render may read one, never set one.
 *
 * "Begin" and "Start over" are the same move. Starting over does not reset a
 * Run — it creates a new one, pinned to whatever version is live now, and
 * leaves the old Run exactly as the Participant left it, because a Run is a
 * record of one walk and rewriting it would lose what happened.
 */
export async function beginRunAction(journeyId: string): Promise<void> {
  const journey = await getPublicJourney(journeyId);
  // Unknown or not live: back to the start screen, which 404s or says why.
  // Checked here as well as on the page because an action is a public
  // endpoint of its own, not something only that page can reach.
  if (!journey || journey.kind !== "live") redirect(`/j/${journeyId}`);

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

  const state = startRun(journey.document, new Date());
  const created = await createRun({
    versionId: journey.versionId,
    participantId,
    state,
  });

  // The new Run's id replaces whatever this Journey's cookie held.
  cookieStore.set(
    runCookieName(journeyId),
    created.id,
    runCookieOptions(journeyId),
  );

  redirect(`/j/${journeyId}/${journey.document.startStepId}`);
}
