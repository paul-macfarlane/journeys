// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { draft, journey, member, project } from "@/db/schema";
import { createDraftDocument } from "@/lib/graph/document";

/**
 * Data access for Journeys, mirroring `@/db/projects`.
 *
 * A Journey belongs to a Project, so its authorization rides on the same
 * Project membership: every read and write here re-checks it against the
 * signed-in Author, and an Author who is not a Member of the Journey's
 * Project cannot tell an existing Journey from one that never existed.
 *
 * There is no publish state column: every Journey reads as "Never
 * published" until ticket 05 adds the live-version pointer that changes it.
 */

export type JourneySummary = {
  id: string;
  title: string;
  description: string;
};

const journeyColumns = {
  id: journey.id,
  title: journey.title,
  description: journey.description,
};

/** Every Journey in the Project, newest first. */
export async function listJourneysForProject(
  projectId: string,
): Promise<JourneySummary[]> {
  return db
    .select(journeyColumns)
    .from(journey)
    .where(eq(journey.projectId, projectId))
    .orderBy(desc(journey.createdAt));
}

/**
 * Creates a Journey inside a Project, with the Draft every Journey has: one
 * Start Step and nothing else. Both rows in one transaction, because a
 * Journey without a Draft is a Journey an Author could never author.
 *
 * The caller is responsible for having already confirmed the Author is a
 * Member of `projectId` — every action that calls this resolves the Project
 * through `getProjectForMember` first, which is where that check lives.
 */
export async function createJourney(
  projectId: string,
  input: { title: string; description: string },
): Promise<JourneySummary> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(journey)
      .values({
        projectId,
        title: input.title,
        description: input.description,
      })
      .returning(journeyColumns);

    await tx
      .insert(draft)
      .values({ journeyId: created.id, document: createDraftDocument() });

    return created;
  });
}

/**
 * The Journey behind a Project id and Journey id pair, but only for one of
 * the Project's Members. Returns null for a non-Member, an unknown Project,
 * and an unknown Journey alike, so callers can answer all three with the
 * same 404 — including a real Journey asked for under the wrong Project.
 */
export async function getJourneyForMember(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<JourneySummary | null> {
  const [row] = await db
    .select(journeyColumns)
    .from(journey)
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

  return row ?? null;
}

/**
 * Edits a Journey's title and description. Its id — and so its URL — is
 * untouched. Returns null when the Author is not a Member of the Journey's
 * Project, or the Journey doesn't exist under that Project.
 */
export async function updateJourney(
  projectId: string,
  journeyId: string,
  input: { title: string; description: string },
  userId: string,
): Promise<JourneySummary | null> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(journey)
    .set({
      title: input.title,
      description: input.description,
      updatedAt: new Date(),
    })
    .where(eq(journey.id, existing.id))
    .returning(journeyColumns);

  return updated ?? null;
}

/**
 * Hard-deletes a Journey. Returns false when the Author is not a Member of
 * its Project, which callers answer with the same 404 as an unknown id.
 */
export async function deleteJourney(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<boolean> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return false;

  await db.delete(journey).where(eq(journey.id, existing.id));
  return true;
}
