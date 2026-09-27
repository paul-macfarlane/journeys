// Database access only — `server-only` so a client import fails the build.
// Pure logic (the arithmetic itself) lives in `src/lib/analytics.ts` and
// stays importable from both sides.
import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import type { MemberJourney } from "@/db/access";
import { publishedVersion, run } from "@/db/schema";
import { logUnreadable } from "@/db/unreadable";
import type { RunPath } from "@/lib/analytics";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

/**
 * The Members' read of a Published Version's Runs, for the Analytics tab.
 *
 * Not in `@/db/runs`, whose contract is the anonymous runner's — nothing
 * there checks membership, because a Participant has none to check. This
 * read rides on Project membership like every other read under `src/db`:
 * it takes the `MemberJourney` `@/db/access` resolved, and the version is
 * selected under that Journey's id, so a version id lifted from
 * another Journey answers null exactly as an unknown one does. Runs come
 * back as a path plus the reducer's Completion state (`completedAt`,
 * `endingStepId`, ticket 75) — no participant id, no other timestamp — which
 * is all analytics reads.
 */

export type AnalyticsSource =
  | {
      kind: "ok";
      version: {
        id: string;
        versionNumber: number;
        document: GraphDocument;
      };
      runs: RunPath[];
    }
  /**
   * The selected Published Version's row fails the document contract
   * (ticket 83): the Analytics tab names it in a banner instead of
   * rendering a map for it.
   */
  | { kind: "unreadable"; versionId: string; versionNumber: number };

/** A `published_version` row read through the document contract, never trusted. */
export function toAnalyticsSource(
  version: {
    journeyId: string;
    id: string;
    versionNumber: number;
    document: unknown;
  },
  runs: RunPath[],
): AnalyticsSource {
  const parsed = graphDocumentSchema.safeParse(version.document);
  if (parsed.success) {
    return {
      kind: "ok",
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        document: parsed.data,
      },
      runs,
    };
  }
  logUnreadable("published version", {
    journeyId: version.journeyId,
    versionId: version.id,
  });
  return {
    kind: "unreadable",
    versionId: version.id,
    versionNumber: version.versionNumber,
  };
}

/**
 * One Published Version of a Journey and every Run pinned to it. Null for a
 * version that is not this Journey's, exactly as for an unknown one.
 */
export async function getAnalytics(
  existing: MemberJourney,
  versionId: string,
): Promise<AnalyticsSource | null> {
  const [version] = await db
    .select({
      id: publishedVersion.id,
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

  if (!version) return null;

  // Selected by the index ticket 06 left for exactly this read.
  const runs = await db
    .select({
      versionId: run.versionId,
      path: run.path,
      completedAt: run.completedAt,
      endingStepId: run.endingStepId,
    })
    .from(run)
    .where(eq(run.versionId, version.id));

  return toAnalyticsSource({ journeyId: existing.id, ...version }, runs);
}
