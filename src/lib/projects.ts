import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, project } from "@/db/schema";
import { slugify, uniqueSlug } from "@/lib/slug";

/**
 * Data access for Projects and their Members.
 *
 * Membership is the only authorization rule there is: every read and write
 * here re-checks it against the signed-in Author rather than trusting a
 * caller, and an Author who is not a Member cannot tell an existing Project
 * from one that never existed.
 */

export const SLUG_TAKEN_MESSAGE = "That slug is already taken";

/** Raised when the `project_slug_unique` index refuses a slug. */
export class SlugTakenError extends Error {
  constructor() {
    super(SLUG_TAKEN_MESSAGE);
    this.name = "SlugTakenError";
  }
}

export type ProjectSummary = {
  id: string;
  title: string;
  slug: string;
};

const projectColumns = {
  id: project.id,
  title: project.title,
  slug: project.slug,
};

/**
 * Postgres unique violation. The slug is the only unique constraint a
 * Project write can trip, so 23505 always means the slug.
 *
 * Drizzle wraps the driver's error in a `DrizzleQueryError`, so the SQLSTATE
 * is on the cause rather than the error itself; the chain is walked (to a
 * bounded depth, so a self-referencing cause can't spin) instead of reaching
 * for a wrapper-specific field.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current != null; depth += 1) {
    if (typeof current !== "object") return false;
    if ("code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

async function isSlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.slug, slug))
    .limit(1);

  return row !== undefined;
}

/** Every Project the Author is a Member of, newest first. */
export async function listProjectsForUser(
  userId: string,
): Promise<ProjectSummary[]> {
  return db
    .select(projectColumns)
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(eq(member.userId, userId))
    .orderBy(desc(project.createdAt));
}

/**
 * Creates a Project with its creator as the first Member. Both rows in one
 * transaction: a Project with no Members could never be opened again, and
 * the database refuses to let one lose its last Member anyway.
 */
export async function createProject(
  input: { title: string },
  userId: string,
): Promise<ProjectSummary> {
  const slug = await uniqueSlug(slugify(input.title), isSlugTaken);

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(project)
        .values({ title: input.title, slug })
        .returning(projectColumns);

      await tx.insert(member).values({ projectId: created.id, userId });

      return created;
    });
  } catch (error) {
    // Another Author took the slug between the check above and this insert.
    if (isUniqueViolation(error)) throw new SlugTakenError();
    throw error;
  }
}

/**
 * The Project behind a slug, but only for one of its Members. Returns null
 * for a non-Member and for an unknown slug alike, so callers can answer both
 * with the same 404.
 */
export async function getProjectForMember(
  slug: string,
  userId: string,
): Promise<ProjectSummary | null> {
  const [row] = await db
    .select(projectColumns)
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(and(eq(project.slug, slug), eq(member.userId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Renames a Project, and moves its slug when the Author changed it. Returns
 * null when the Author is not a Member of `currentSlug`.
 */
export async function renameProject(
  currentSlug: string,
  input: { title: string; slug: string },
  userId: string,
): Promise<ProjectSummary | null> {
  const existing = await getProjectForMember(currentSlug, userId);
  if (!existing) return null;

  try {
    const [updated] = await db
      .update(project)
      .set({ title: input.title, slug: input.slug, updatedAt: new Date() })
      .where(eq(project.id, existing.id))
      .returning(projectColumns);

    return updated ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError();
    throw error;
  }
}

/**
 * Hard-deletes a Project. Its Members (and, from ticket 02's second half,
 * its Journeys) cascade with it. Returns false when the Author is not a
 * Member, which callers answer with the same 404 as an unknown slug.
 */
export async function deleteProject(
  slug: string,
  userId: string,
): Promise<boolean> {
  const existing = await getProjectForMember(slug, userId);
  if (!existing) return false;

  await db.delete(project).where(eq(project.id, existing.id));
  return true;
}
