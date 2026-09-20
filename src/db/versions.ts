// Database access only — `server-only` so a client import fails the build.
// Pure logic (the document contract, publish validation, the publish-state
// rule) lives under src/lib and stays importable from both sides.
import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { draft, journey, publishedVersion, user } from "@/db/schema";
import { graphDocumentSchema } from "@/lib/graph/document";
import { validateForPublish, type PublishProblem } from "@/lib/graph/validate";

/**
 * Data access for Published Versions, mirroring `@/db/drafts`.
 *
 * A Published Version belongs to a Journey, which belongs to a Project, so
 * its authorization rides on the same Project membership: every read and
 * write here re-checks it against the signed-in Author, and an Author who is
 * not a Member cannot tell an existing Journey from one that never existed.
 *
 * Nothing in here ever updates a `published_version` row. Publishing writes
 * one, restoring reads one, unpublishing moves the Journey's pointer, and
 * only deleting the Journey (or its Project) takes any of them away.
 */

export type VersionSummary = {
  id: string;
  versionNumber: number;
  publishedAt: Date;
  /** Null once the account that published it is gone. */
  publishedByName: string | null;
  isLive: boolean;
};

/**
 * Every Published Version of a Journey, newest first. Null for a non-Member,
 * an unknown Project, and an unknown Journey alike — an empty list is a
 * Journey that has never been published, which is a different answer.
 */
export async function listVersionsForMember(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<VersionSummary[] | null> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const rows = await db
    .select({
      id: publishedVersion.id,
      versionNumber: publishedVersion.versionNumber,
      publishedAt: publishedVersion.publishedAt,
      publishedByName: user.name,
      liveVersionId: journey.liveVersionId,
    })
    .from(publishedVersion)
    .innerJoin(journey, eq(journey.id, publishedVersion.journeyId))
    // Left: the version outlives the Member who published it.
    .leftJoin(user, eq(user.id, publishedVersion.publishedBy))
    .where(eq(publishedVersion.journeyId, existing.id))
    .orderBy(desc(publishedVersion.versionNumber));

  return rows.map(({ liveVersionId, ...version }) => ({
    ...version,
    isLive: liveVersionId === version.id,
  }));
}

export type PublishDraftResult =
  | { ok: true; versionNumber: number }
  | { ok: false; problems: PublishProblem[] }
  | { ok: false; conflict: true }
  | null;

/**
 * Postgres `unique_violation`, whether the driver's error arrives bare or
 * wrapped by Drizzle with the original as its `cause`.
 */
function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown })?.cause];
  return candidates.some(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { code?: unknown }).code === "23505",
  );
}

/**
 * Publishes a Journey's Draft as the next Published Version and points the
 * Journey at it.
 *
 * Validation first: a Draft with publish-time problems is refused with all of
 * them and nothing is written, because a participant must never meet a
 * journey with a dangling choice or an ending that means nothing. A valid
 * Draft's document is snapshotted exactly as stored — publish never rewrites
 * it and never touches the Draft row.
 *
 * The insert and the pointer move are one transaction: a version nothing
 * points at would read as "unpublished" with no way back, and a pointer at a
 * version that isn't there is worse. The version number is the Journey's
 * highest plus one, and `(journey_id, version_number)` is unique, so two
 * Authors publishing at the same moment produce two versions or one error,
 * never two rows calling themselves version 2.
 *
 * Null when the Author is not a Member, or there is no such Journey under
 * that Project — the same answer the page's 404 gives.
 */
export async function publishDraft(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<PublishDraftResult> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const document = await getDraftForMember(projectId, journeyId, userId);
  if (!document) return null;

  const problems = validateForPublish(document);
  if (problems.length > 0) return { ok: false, problems };

  try {
    return await db.transaction(async (tx) => {
      const [highest] = await tx
        .select({ versionNumber: publishedVersion.versionNumber })
        .from(publishedVersion)
        .where(eq(publishedVersion.journeyId, existing.id))
        .orderBy(desc(publishedVersion.versionNumber))
        .limit(1);

      const versionNumber = (highest?.versionNumber ?? 0) + 1;

      const [created] = await tx
        .insert(publishedVersion)
        .values({
          journeyId: existing.id,
          versionNumber,
          document,
          publishedBy: userId,
        })
        .returning({ id: publishedVersion.id });

      await tx
        .update(journey)
        .set({ liveVersionId: created.id, updatedAt: new Date() })
        .where(eq(journey.id, existing.id));

      return { ok: true, versionNumber };
    });
  } catch (error) {
    // The race the unique constraint exists for: another Member published
    // between our read of the highest number and our insert. Their version
    // is live and complete, and this Author can look at it and try again.
    if (isUniqueViolation(error)) return { ok: false, conflict: true };
    throw error;
  }
}

/**
 * Takes a Journey away from participants by clearing its live pointer. Every
 * Published Version stays, so publishing again continues the numbering and
 * restoring an older version still works. False when the Author is not a
 * Member, which callers answer with the same 404 as an unknown id.
 */
export async function unpublishJourney(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<boolean> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return false;

  await db
    .update(journey)
    .set({ liveVersionId: null, updatedAt: new Date() })
    .where(eq(journey.id, existing.id));

  return true;
}

export type RestoreVersionResult = { versionNumber: number } | null;

/**
 * Copies a Published Version's document into the Draft, replacing what the
 * Draft held. The version itself is untouched: restoring is an edit to the
 * Draft, not a move of the live pointer, so what participants are walking
 * does not change until the Author publishes again.
 *
 * The stored document is parsed, not re-sanitized: it went through
 * `prepareDocumentForWrite` on its way into the Draft it was snapshotted
 * from, so it is already in stored shape, and a row that no longer satisfies
 * the contract is a bug worth failing loudly on.
 *
 * Null for a non-Member, an unknown Journey, and a version belonging to some
 * other Journey alike.
 */
export async function restoreVersion(
  projectId: string,
  journeyId: string,
  versionId: string,
  userId: string,
): Promise<RestoreVersionResult> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const [row] = await db
    .select({
      versionNumber: publishedVersion.versionNumber,
      document: publishedVersion.document,
    })
    .from(publishedVersion)
    .where(
      and(
        eq(publishedVersion.id, versionId),
        eq(publishedVersion.journeyId, existing.id),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Upsert for the same reason `saveDraft` is one: a Journey whose Draft row
  // is somehow missing must get one rather than silently update nothing.
  const restored = {
    document: graphDocumentSchema.parse(row.document),
    updatedAt: new Date(),
  };
  await db
    .insert(draft)
    .values({ journeyId: existing.id, ...restored })
    .onConflictDoUpdate({ target: draft.journeyId, set: restored });

  return { versionNumber: row.versionNumber };
}
