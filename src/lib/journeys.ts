import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { journey, member, project } from "@/db/schema";
import { isUniqueViolation, SlugTakenError } from "@/lib/db-errors";
import { slugify, uniqueSlug } from "@/lib/slug";

/**
 * Data access for Journeys, mirroring `@/lib/projects`.
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
  slug: string;
  description: string;
};

const journeyColumns = {
  id: journey.id,
  title: journey.title,
  slug: journey.slug,
  description: journey.description,
};

async function isSlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: journey.id })
    .from(journey)
    .where(eq(journey.slug, slug))
    .limit(1);

  return row !== undefined;
}

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
 * Creates a Journey inside a Project. The caller is responsible for having
 * already confirmed the Author is a Member of `projectId` — every action
 * that calls this resolves the Project through `getProjectForMember` first,
 * which is where that check lives.
 */
export async function createJourney(
  projectId: string,
  input: { title: string; description: string },
): Promise<JourneySummary> {
  const slug = await uniqueSlug(slugify(input.title), isSlugTaken);

  try {
    const [created] = await db
      .insert(journey)
      .values({
        projectId,
        title: input.title,
        description: input.description,
        slug,
      })
      .returning(journeyColumns);

    return created;
  } catch (error) {
    // Another Author took the slug between the check above and this insert.
    if (isUniqueViolation(error)) throw new SlugTakenError();
    throw error;
  }
}

/**
 * The Journey behind a Project slug and Journey slug pair, but only for one
 * of the Project's Members. Returns null for a non-Member, an unknown
 * Project, and an unknown Journey alike, so callers can answer all three
 * with the same 404.
 */
export async function getJourneyForMember(
  projectSlug: string,
  journeySlug: string,
  userId: string,
): Promise<JourneySummary | null> {
  const [row] = await db
    .select(journeyColumns)
    .from(journey)
    .innerJoin(project, eq(project.id, journey.projectId))
    .innerJoin(member, eq(member.projectId, project.id))
    .where(
      and(
        eq(project.slug, projectSlug),
        eq(journey.slug, journeySlug),
        eq(member.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Renames a Journey, and moves its slug when the Author changed it. Returns
 * null when the Author is not a Member of the Journey's Project, or the
 * Journey doesn't exist under that Project slug.
 */
export async function updateJourney(
  projectSlug: string,
  currentJourneySlug: string,
  input: { title: string; slug: string; description: string },
  userId: string,
): Promise<JourneySummary | null> {
  const existing = await getJourneyForMember(
    projectSlug,
    currentJourneySlug,
    userId,
  );
  if (!existing) return null;

  try {
    const [updated] = await db
      .update(journey)
      .set({
        title: input.title,
        slug: input.slug,
        description: input.description,
        updatedAt: new Date(),
      })
      .where(eq(journey.id, existing.id))
      .returning(journeyColumns);

    return updated ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError();
    throw error;
  }
}

/**
 * Hard-deletes a Journey. Returns false when the Author is not a Member of
 * its Project, which callers answer with the same 404 as an unknown slug.
 */
export async function deleteJourney(
  projectSlug: string,
  journeySlug: string,
  userId: string,
): Promise<boolean> {
  const existing = await getJourneyForMember(projectSlug, journeySlug, userId);
  if (!existing) return false;

  await db.delete(journey).where(eq(journey.id, existing.id));
  return true;
}
