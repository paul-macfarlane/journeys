// Database access only — `server-only` so a client import fails the build.
// Pure logic (the document contract, publish validation, the publish-state
// rule) lives under src/lib and stays importable from both sides.
import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import type { MemberJourney } from "@/db/access";
import { writeDraftGuarded } from "@/db/drafts";
import { isUniqueViolation } from "@/db/errors";
import { guardedWrite, rowExists } from "@/db/guarded-write";
import { draft, journey, publishedVersion, user } from "@/db/schema";
import { logUnreadable } from "@/db/unreadable";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";
import { validateForPublish } from "@/lib/graph/validate";
import {
  conflict,
  invalid,
  notFound,
  type WriteFailure,
} from "@/lib/write-result";

/**
 * Data access for Published Versions, mirroring `@/db/drafts`.
 *
 * A Published Version belongs to a Journey, which belongs to a Project, so
 * its authorization rides on the same Project membership, resolved once in
 * `@/db/access` (ticket 82): every read and write here takes the
 * `MemberJourney` that check hands back and never checks again.
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
 * Every Published Version of a Journey, newest first; an empty list is a
 * Journey that has never been published.
 */
export async function listVersions(
  existing: MemberJourney,
): Promise<VersionSummary[]> {
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

/** What participants see of a version: its title, description, and graph. */
export type LiveVersion =
  | { kind: "ok"; title: string; description: string; document: GraphDocument }
  /**
   * A live Published Version whose row fails the document contract (ticket
   * 83): the runner treats it as no live version at all, and the Journey
   * page's Versions and Analytics tabs name it in a banner instead of
   * rendering it.
   */
  | { kind: "unreadable"; versionId: string; versionNumber: number };

/** A `published_version` row read through the document contract, never trusted. */
export function toLiveVersion(row: {
  journeyId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  description: string;
  document: unknown;
}): LiveVersion {
  const parsed = graphDocumentSchema.safeParse(row.document);
  if (parsed.success) {
    return {
      kind: "ok",
      title: row.title,
      description: row.description,
      document: parsed.data,
    };
  }
  logUnreadable("published version", {
    journeyId: row.journeyId,
    versionId: row.versionId,
  });
  return {
    kind: "unreadable",
    versionId: row.versionId,
    versionNumber: row.versionNumber,
  };
}

/**
 * The version participants are walking right now, or null when the Journey
 * has no live version.
 */
export async function getLiveVersion(
  existing: MemberJourney,
): Promise<LiveVersion | null> {
  const [row] = await db
    .select({
      versionId: publishedVersion.id,
      versionNumber: publishedVersion.versionNumber,
      title: publishedVersion.title,
      description: publishedVersion.description,
      document: publishedVersion.document,
    })
    .from(journey)
    .innerJoin(publishedVersion, eq(publishedVersion.id, journey.liveVersionId))
    .where(eq(journey.id, existing.id))
    .limit(1);

  return row ? toLiveVersion({ journeyId: existing.id, ...row }) : null;
}

export type PublishDraftResult =
  { ok: true; versionNumber: number } | WriteFailure;

/**
 * Publishes a Journey's Draft as the next Published Version and points the
 * Journey at it.
 *
 * The Draft is read inside the transaction, locked `FOR SHARE` so no save
 * lands between the read and the snapshot, and only at `expectedVersion` —
 * the version the Member holds (ticket 73). Another Member's save since is
 * answered `stale`, and a row that fails the contract `invalid` with the
 * sentence that says so: neither publishes anything.
 *
 * Validation next: a Draft with publish-time problems is refused `invalid`
 * with all of them and nothing is written, because a participant must never
 * meet a journey with a dangling choice or an ending that means nothing. A
 * valid Draft's document is snapshotted exactly as stored — publish never
 * rewrites it and never touches the Draft row.
 *
 * The insert and the pointer move are one transaction: a version nothing
 * points at would read as "unpublished" with no way back, and a pointer at a
 * version that isn't there is worse. The version number is the Journey's
 * highest plus one, and `(journey_id, version_number)` is unique, so two
 * Authors publishing at the same moment produce two versions or one error,
 * never two rows calling themselves version 2; the loser is answered
 * `conflict`.
 *
 * `not-found` when the Journey (or its Draft) went away since its
 * membership was resolved. The version is published by the Member the
 * Journey was resolved for.
 */
export async function publishDraft(
  existing: MemberJourney,
  expectedVersion: number,
): Promise<PublishDraftResult> {
  try {
    return await db.transaction(async (tx): Promise<PublishDraftResult> => {
      const locked = await guardedWrite(
        () =>
          tx
            .select({ document: draft.document })
            .from(draft)
            .where(
              and(
                eq(draft.journeyId, existing.id),
                eq(draft.version, expectedVersion),
              ),
            )
            .for("share"),
        () => rowExists(draft, draft.journeyId, existing.id, tx),
      );
      if (!locked.ok) return locked;

      const parsed = graphDocumentSchema.safeParse(locked.row.document);
      if (!parsed.success) {
        return invalid(
          "This journey's draft can't be read. Restore it from a published version before publishing.",
        );
      }
      const document = parsed.data;

      const problems = validateForPublish(document);
      if (problems.length > 0) {
        return invalid("This journey can't be published yet", { problems });
      }

      // The title and description as they read now, inside the
      // transaction, rather than as the membership check read them.
      const [current] = await tx
        .select({ title: journey.title, description: journey.description })
        .from(journey)
        .where(eq(journey.id, existing.id))
        .limit(1);
      if (!current) return notFound();

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
          // The title and description as they read at this moment, so a
          // later rename is the next version's, not this one's.
          title: current.title,
          description: current.description,
          document,
          publishedBy: existing.memberUserId,
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
    if (isUniqueViolation(error)) return conflict();
    throw error;
  }
}

/**
 * Takes a Journey away from participants by clearing its live pointer. Every
 * Published Version stays, so publishing again continues the numbering and
 * restoring an older version still works.
 */
export async function unpublishJourney(
  existing: MemberJourney,
): Promise<{ ok: true }> {
  await db
    .update(journey)
    .set({ liveVersionId: null, updatedAt: new Date() })
    .where(eq(journey.id, existing.id));

  return { ok: true };
}

export type RestoreVersionResult =
  { ok: true; versionNumber: number } | WriteFailure;

/**
 * A stored Published Version document, parsed rather than trusted (ticket
 * 83): null for a row that fails the document contract, so `restoreVersion`
 * can refuse it by name instead of throwing.
 */
export function parseVersionDocument(document: unknown): GraphDocument | null {
  const parsed = graphDocumentSchema.safeParse(document);
  return parsed.success ? parsed.data : null;
}

/**
 * Copies a Published Version's document into the Draft, replacing what the
 * Draft held. The version itself is untouched: restoring is an edit to the
 * Draft, not a move of the live pointer, so what participants are walking
 * does not change until the Author publishes again.
 *
 * The stored document is parsed, not re-sanitized: it went through
 * `prepareDocumentForWrite` on its way into the Draft it was snapshotted
 * from, so it is already in stored shape. A row that no longer satisfies
 * the contract is refused `invalid`, naming its version number, and logged,
 * never thrown (ticket 83).
 *
 * Guarded like a save (ticket 73): `expectedVersion` is the Draft version
 * the Member's page last read, and a Draft another Member has written since
 * is answered `stale` and left alone. It is also how a Draft whose row
 * cannot be read is recovered: the restore replaces the row whole.
 *
 * `not-found` for an unknown version and one belonging to some other
 * Journey alike, and for a Journey that went away since its membership was
 * resolved.
 */
export async function restoreVersion(
  existing: MemberJourney,
  versionId: string,
  expectedVersion: number,
): Promise<RestoreVersionResult> {
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

  if (!row) return notFound();

  const document = parseVersionDocument(row.document);
  if (document === null) {
    logUnreadable("published version", { versionId, journeyId: existing.id });
    return invalid(
      `Version ${row.versionNumber} can't be read, so it can't be restored.`,
    );
  }

  // Upsert for the same reason `saveDraft` is one: a Journey whose Draft row
  // is somehow missing must get one rather than silently update nothing.
  const written = await writeDraftGuarded(
    existing.id,
    document,
    expectedVersion,
  );
  if (!written.ok) return written;

  return { ok: true, versionNumber: row.versionNumber };
}
