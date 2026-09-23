// Database access only — `server-only` so a client import fails the build.
// Pure logic (the arithmetic itself) lives in `src/lib/analytics.ts` and
// stays importable from both sides.
import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { getJourneyForMember } from "@/db/journeys";
import { publishedVersion, run } from "@/db/schema";
import type { RunPath } from "@/lib/analytics";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

/**
 * The Members' read of a Published Version's Runs, for the Analytics tab.
 *
 * Not in `@/db/runs`, whose contract is the anonymous runner's — nothing
 * there checks membership, because a Participant has none to check. This
 * read rides on Project membership like every other read under `src/db`:
 * the Journey is resolved through `getJourneyForMember` first, and the
 * version is selected under that Journey's id, so a version id lifted from
 * another Journey answers null exactly as an unknown one does. Runs come
 * back as paths and nothing more — no participant id, no timestamps — which
 * is all analytics reads (spec: "every metric is computed from paths").
 */

export type AnalyticsSource = {
  version: {
    id: string;
    versionNumber: number;
    document: GraphDocument;
  };
  runs: RunPath[];
};

/**
 * One Published Version of a Journey and every Run pinned to it, for one of
 * the Journey's Project's Members. Null for a non-Member, an unknown Project,
 * an unknown Journey, and a version that is not this Journey's alike — the
 * same 404 as every other Journey page.
 */
export async function getAnalyticsForMember(
  projectId: string,
  journeyId: string,
  versionId: string,
  userId: string,
): Promise<AnalyticsSource | null> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

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
    .select({ versionId: run.versionId, path: run.path })
    .from(run)
    .where(eq(run.versionId, version.id));

  return {
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      document: graphDocumentSchema.parse(version.document),
    },
    runs,
  };
}
