// Database access only — `server-only` so a client import fails the build.
// Pure logic (the document contract, sanitizing, publish validation) lives
// under src/lib/graph and stays importable from both sides.
import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { getJourneyForMember } from "@/db/journeys";
import { draft, journey, member, project } from "@/db/schema";
import {
  graphDocumentSchema,
  prepareDocumentForWrite,
  type GraphDocument,
} from "@/lib/graph/document";
import { validateForPublish, type PublishProblem } from "@/lib/graph/validate";

/**
 * Data access for Drafts, mirroring `@/db/journeys`.
 *
 * A Draft belongs to a Journey, which belongs to a Project, so its
 * authorization rides on the same Project membership: every read and write
 * here re-checks it against the signed-in Author, and an Author who is not a
 * Member cannot tell an existing Draft from one that never existed.
 *
 * Postgres stores the document as jsonb and knows nothing about its shape —
 * the contract is `@/lib/graph/document`'s, so a document is validated on the
 * way out as well as on the way in.
 */

/**
 * The Draft behind a Project id and Journey id pair, but only for one of the
 * Project's Members. Returns null for a non-Member, an unknown Project, and
 * an unknown Journey alike, so callers can answer all three with the same
 * 404.
 *
 * Parsed rather than trusted: a row that doesn't satisfy the contract is a
 * bug somewhere upstream, and failing loudly here beats rendering garbage.
 */
export async function getDraftForMember(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<GraphDocument | null> {
  const [row] = await db
    .select({ document: draft.document })
    .from(draft)
    .innerJoin(journey, eq(journey.id, draft.journeyId))
    .innerJoin(project, eq(project.id, journey.projectId))
    .innerJoin(member, eq(member.projectId, project.id))
    .where(
      and(
        eq(project.id, projectId),
        eq(journey.id, journeyId),
        eq(member.userId, userId),
      ),
    )
    .limit(1);

  return row ? graphDocumentSchema.parse(row.document) : null;
}

export type SaveDraftResult =
  | { ok: true; document: GraphDocument }
  | { ok: false; error: string; stepId?: string }
  | null;

/**
 * Stores a Draft's document. The only path that accepts a document from
 * outside: `createJourney` and migration 0002's backfill write the shape
 * `createDraftDocument()` builds, `restoreVersion` in `@/db/versions` copies
 * back a document that already went through this path once, and everything
 * else comes through here, so every stored document has been through
 * `prepareDocumentForWrite` (loose parse, sanitize, strict parse) and nothing
 * reaches the column that the contract would refuse to read back.
 *
 * Written as an upsert: a Journey created in the moment between the Vercel
 * build going live and migration 0002 running has no Draft row yet, and its
 * first save must create one rather than update nothing and report success.
 *
 * Null when the Author is not a Member of the Journey's Project, or there is
 * no such Journey under it — the same answer, so neither leaks the other.
 * `{ ok: false }` is a document the contract refused, which is an Author's
 * problem to fix rather than a missing Journey.
 */
export async function saveDraft(
  projectId: string,
  journeyId: string,
  input: unknown,
  userId: string,
): Promise<SaveDraftResult> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const prepared = prepareDocumentForWrite(input);
  if (!prepared.ok) return prepared;

  const saved = { document: prepared.document, updatedAt: new Date() };
  await db
    .insert(draft)
    .values({ journeyId: existing.id, ...saved })
    .onConflictDoUpdate({ target: draft.journeyId, set: saved });

  return { ok: true, document: prepared.document };
}

/**
 * The publish-time problems with a Journey's Draft as it stands, or null when
 * the Author is not a Member. An empty list means the Draft could be
 * published; `publishDraft` in `@/db/versions` is what refuses on them.
 */
export async function validateDraft(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<PublishProblem[] | null> {
  const document = await getDraftForMember(projectId, journeyId, userId);
  if (!document) return null;

  return validateForPublish(document);
}
