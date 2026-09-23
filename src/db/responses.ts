// Database access only — `server-only` so a client import fails the build.
// Pure logic (what a posted answer means, how Responses are grouped for
// Members) lives under src/lib and stays importable from both sides.
import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { getJourneyForMember } from "@/db/journeys";
import { publishedVersion, response, run } from "@/db/schema";
import type { ResponseRow } from "@/lib/response-list";

/**
 * Data access for Responses, in two halves that share nothing but the table.
 *
 * The runner's half takes a Run id and checks nothing else, like `@/db/runs`:
 * a Participant is anonymous, and the Run cookie — the unguessable id the
 * action has already resolved through `getRunForJourney` — is the only
 * credential there is. The Members' half rides on Project membership like
 * every other read under `src/db`, and hands back the text alone: no Run id,
 * no participant id, nothing a Member could use to tell one Participant's
 * answers from another's.
 */

/**
 * Stores a Participant's answer to a Step's Prompt, replacing the one this
 * Run already gave on this Step if it did: a backtrack that answers again is
 * the same question answered twice, and the later answer is the one meant.
 */
export async function saveResponse(
  runId: string,
  stepId: string,
  text: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(response)
    .values({ runId, stepId, text, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [response.runId, response.stepId],
      set: { text, updatedAt: now },
    });
}

/**
 * Takes back what this Run wrote on this Step, if anything: a Participant
 * who returns to an optional Prompt and leaves it blank has chosen not to
 * record a Response after all. Nothing to do when there was none.
 */
export async function deleteResponse(
  runId: string,
  stepId: string,
): Promise<void> {
  await db
    .delete(response)
    .where(and(eq(response.runId, runId), eq(response.stepId, stepId)));
}

/**
 * What this Run already answered on this Step, or null: shown back in the
 * textbox when a Participant returns to a Step they answered on.
 */
export async function getResponse(
  runId: string,
  stepId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ text: response.text })
    .from(response)
    .where(and(eq(response.runId, runId), eq(response.stepId, stepId)))
    .limit(1);

  return row?.text ?? null;
}

/**
 * Every Response recorded against any Published Version of a Journey,
 * oldest first, for one of its Project's Members. Null for a non-Member, an
 * unknown Project, and an unknown Journey alike — the same 404 as every other
 * Journey page. Steps keep their ids across versions, so a Step's answers
 * from every version it was published in arrive together under its id.
 */
export async function listResponsesForMember(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<ResponseRow[] | null> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  return db
    .select({
      stepId: response.stepId,
      text: response.text,
      createdAt: response.createdAt,
    })
    .from(response)
    .innerJoin(run, eq(run.id, response.runId))
    .innerJoin(publishedVersion, eq(publishedVersion.id, run.versionId))
    .where(eq(publishedVersion.journeyId, existing.id))
    .orderBy(asc(response.createdAt), asc(response.stepId));
}
