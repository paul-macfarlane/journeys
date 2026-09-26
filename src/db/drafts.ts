// Database access only — `server-only` so a client import fails the build.
// Pure logic (the document contract, sanitizing, publish validation) lives
// under src/lib/graph and stays importable from both sides.
import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  guardedWrite,
  type GuardedWriteResult,
  type StaleWrite,
} from "@/db/guarded-write";
import { getJourneyForMember } from "@/db/journeys";
import { draft, journey, member, project } from "@/db/schema";
import {
  graphDocumentSchema,
  prepareDocumentForWrite,
  type GraphDocument,
} from "@/lib/graph/document";

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
 * A Draft as stored: its document, the version counter every write is
 * guarded by (ticket 73), and when an Author last saved it.
 */
export type StoredDraft = {
  kind: "ok";
  document: GraphDocument;
  /** What the next save or restore must send back to be stored. */
  version: number;
  /** The last save (or restore) — what the Versions tab shows beside it. */
  updatedAt: Date;
};

/**
 * A Draft row whose document fails the contract: nothing can render or
 * publish it, and the Journey page offers a Restore instead (ticket 73,
 * design point 5). Its version is what that Restore is guarded by.
 */
export type UnreadableDraft = {
  kind: "unreadable";
  version: number;
  updatedAt: Date;
};

/** A `draft` row read through the document contract, never trusted. */
export function toStoredDraft(row: {
  document: unknown;
  version: number;
  updatedAt: Date;
}): StoredDraft | UnreadableDraft {
  const parsed = graphDocumentSchema.safeParse(row.document);
  return parsed.success
    ? {
        kind: "ok",
        document: parsed.data,
        version: row.version,
        updatedAt: row.updatedAt,
      }
    : { kind: "unreadable", version: row.version, updatedAt: row.updatedAt };
}

/**
 * The Draft behind a Project id and Journey id pair, but only for one of the
 * Project's Members. Returns null for a non-Member, an unknown Project, and
 * an unknown Journey alike, so callers can answer all three with the same
 * 404.
 *
 * Parsed rather than trusted: a row that doesn't satisfy the contract is a
 * bug somewhere upstream. It comes back as `unreadable` rather than thrown,
 * so the page can say so and offer a Restore instead of failing with a 500.
 */
export async function getDraftForMember(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<StoredDraft | UnreadableDraft | null> {
  const [row] = await db
    .select({
      document: draft.document,
      version: draft.version,
      updatedAt: draft.updatedAt,
    })
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

  return row ? toStoredDraft(row) : null;
}

/**
 * Writes a document into a Journey's Draft, guarded by the version the
 * Member read (ticket 73): an upsert whose conflict branch updates only
 * while `draft.version` is still `expectedVersion`, incrementing it. A
 * missing Draft row is still created, as the upserts it replaces intended.
 * Shared by `saveDraft` and `restoreVersion` in `@/db/versions`.
 */
export function writeDraftGuarded(
  journeyId: string,
  document: GraphDocument,
  expectedVersion: number,
): Promise<GuardedWriteResult<{ version: number }>> {
  const updatedAt = new Date();
  return guardedWrite(
    () =>
      db
        .insert(draft)
        .values({ journeyId, document, updatedAt, version: 1 })
        .onConflictDoUpdate({
          target: draft.journeyId,
          set: { document, updatedAt, version: sql`${draft.version} + 1` },
          setWhere: eq(draft.version, expectedVersion),
        })
        .returning({ version: draft.version }),
    async () => {
      const [row] = await db
        .select({ journeyId: draft.journeyId })
        .from(draft)
        .where(eq(draft.journeyId, journeyId))
        .limit(1);
      return row !== undefined;
    },
  );
}

export type SaveDraftResult =
  | { ok: true; document: GraphDocument; version: number }
  | { ok: false; error: string; stepId?: string }
  | StaleWrite
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
 * Guarded by `expectedVersion`, the version the Member's editor last read or
 * stored: another Member's save in between is answered `stale` and nothing
 * is written (ticket 73). Written as an upsert: a Journey created in the
 * moment between the Vercel build going live and migration 0002 running has
 * no Draft row yet, and its first save must create one rather than update
 * nothing and report success.
 *
 * Null when the Author is not a Member of the Journey's Project, or there is
 * no such Journey under it — the same answer, so neither leaks the other.
 * `{ ok: false, error }` is a document the contract refused, which is an
 * Author's problem to fix rather than a missing Journey.
 */
export async function saveDraft(
  projectId: string,
  journeyId: string,
  input: unknown,
  expectedVersion: number,
  userId: string,
): Promise<SaveDraftResult> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const prepared = prepareDocumentForWrite(input);
  if (!prepared.ok) return prepared;

  const written = await writeDraftGuarded(
    existing.id,
    prepared.document,
    expectedVersion,
  );
  if (!written.ok) return written.reason === "stale" ? written : null;

  return {
    ok: true,
    document: prepared.document,
    version: written.row.version,
  };
}
