// Database access only — `server-only` so a client import fails the build.
// Pure logic (the document contract, the path reducer) lives under src/lib
// and stays importable from both sides.
import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { journey, publishedVersion, run } from "@/db/schema";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";
import type { RunState } from "@/lib/graph/run";

/**
 * Data access for the participant runner. Unlike every other module under
 * `src/db`, nothing here checks Project membership — a Participant walking a
 * Journey is anonymous by design, and a Run's id (an unguessable
 * `crypto.randomUUID()`, see `src/lib/run-cookies.ts`) is its only write
 * credential. `getRunForJourney` still refuses a Run whose Published Version
 * belongs to a different Journey, so a Run cookie can never be used to read
 * or write another Journey's Run.
 *
 * Documents are parsed with `graphDocumentSchema` on the way out, as
 * `@/db/versions` does — a stored Published Version is always well-formed
 * (see `docs/adr/0001-graph-as-one-json-document.md`), and failing loudly on
 * a row that isn't is better than rendering garbage to a Participant.
 */

export type PublicJourney =
  | {
      kind: "live";
      versionId: string;
      title: string;
      description: string;
      document: GraphDocument;
    }
  | { kind: "unavailable" };

/**
 * What an anonymous Participant may see of a Journey by id: its live
 * Published Version, or why there isn't one. Null for an unknown Journey id
 * (the runner 404s); `unavailable` when the Journey exists but has no
 * live pointer, whether it was never published or was later unpublished —
 * the two read the same to a Participant. Title and description come from
 * the Published Version, never the Journey row, so a rename after publish
 * never changes what a live or in-progress Run shows.
 */
export async function getPublicJourney(
  journeyId: string,
): Promise<PublicJourney | null> {
  const [row] = await db
    .select({
      versionId: publishedVersion.id,
      title: publishedVersion.title,
      description: publishedVersion.description,
      document: publishedVersion.document,
    })
    .from(journey)
    // Left, not inner: a Journey with no live version must still produce a
    // row, so it can be told apart from a Journey that does not exist.
    .leftJoin(publishedVersion, eq(publishedVersion.id, journey.liveVersionId))
    .where(eq(journey.id, journeyId))
    .limit(1);

  if (!row) return null;

  // The left join fills every `published_version` column from one row or
  // none, so the four are null together; narrowing on all of them keeps the
  // types honest without asserting.
  const { versionId, title, description, document } = row;
  if (
    versionId === null ||
    title === null ||
    description === null ||
    document === null
  ) {
    return { kind: "unavailable" };
  }

  return {
    kind: "live",
    versionId,
    title,
    description,
    document: graphDocumentSchema.parse(document),
  };
}

/**
 * Starts a Run: one row pinned to the Published Version the Participant is
 * about to walk, recording the reducer's own starting state.
 */
export async function createRun({
  versionId,
  participantId,
  state,
}: {
  versionId: string;
  participantId: string;
  state: RunState;
}): Promise<{ id: string }> {
  const [created] = await db
    .insert(run)
    .values({
      versionId,
      participantId,
      path: state.path,
      backtrackCount: state.backtrackCount,
      endedAt: state.endedAt,
      outcomeId: state.outcomeId,
    })
    .returning({ id: run.id });

  return created;
}

export type RunForJourney = {
  run: {
    id: string;
    versionId: string;
    participantId: string;
    path: string[];
    backtrackCount: number;
    startedAt: Date;
    endedAt: Date | null;
    outcomeId: string | null;
  };
  version: { title: string; description: string; document: GraphDocument };
};

/**
 * The Run named by a Run cookie, together with the Published Version it is
 * pinned to — joined through `published_version` and refused (null) when
 * that version does not belong to `journeyId`, so a Run cookie minted on one
 * Journey can never open a step page on another. Also null for an unknown
 * Run id, which a step page answers the same way: back to the Start Step.
 */
export async function getRunForJourney(
  runId: string,
  journeyId: string,
): Promise<RunForJourney | null> {
  const [row] = await db
    .select({
      id: run.id,
      versionId: run.versionId,
      participantId: run.participantId,
      path: run.path,
      backtrackCount: run.backtrackCount,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      outcomeId: run.outcomeId,
      title: publishedVersion.title,
      description: publishedVersion.description,
      document: publishedVersion.document,
    })
    .from(run)
    .innerJoin(publishedVersion, eq(publishedVersion.id, run.versionId))
    .where(and(eq(run.id, runId), eq(publishedVersion.journeyId, journeyId)))
    .limit(1);

  if (!row) return null;

  const { title, description, document, ...runRow } = row;
  return {
    run: runRow,
    version: {
      title,
      description,
      document: graphDocumentSchema.parse(document),
    },
  };
}

/**
 * Persists the reducer's next state after a move — `path`, `backtrackCount`,
 * `endedAt`, and `outcomeId` are the whole of what the reducer changes, so
 * they are the whole of what is written back.
 */
export async function saveRunState(
  runId: string,
  state: RunState,
): Promise<void> {
  await db
    .update(run)
    .set({
      path: state.path,
      backtrackCount: state.backtrackCount,
      endedAt: state.endedAt,
      outcomeId: state.outcomeId,
    })
    .where(eq(run.id, runId));
}
