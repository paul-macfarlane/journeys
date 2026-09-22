// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, project } from "@/db/schema";

/**
 * Data access for Projects. Their Members live in `@/db/members`; only the
 * first one, written with the Project, is created here.
 *
 * A Project is addressed by its id, so nothing here resolves a name to a
 * row and renaming one can never move it. Membership is the only
 * authorization rule there is: every read and write re-checks it against the
 * signed-in Author rather than trusting a caller, and an Author who is not a
 * Member cannot tell an existing Project from one that never existed.
 */

export type ProjectSummary = {
  id: string;
  title: string;
  description: string;
};

const projectColumns = {
  id: project.id,
  title: project.title,
  description: project.description,
};

/** Every Project the Author is a Member of, newest first. */
export async function listProjectsForAuthor(
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
 * Creates a Project with the creating Author as its first Member. Both rows in one
 * transaction: a Project with no Members could never be opened again, and
 * the database refuses to let one lose its last Member anyway.
 */
export async function createProject(
  input: { title: string },
  userId: string,
): Promise<ProjectSummary> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(project)
      .values({ title: input.title })
      .returning(projectColumns);

    await tx.insert(member).values({ projectId: created.id, userId });

    return created;
  });
}

/**
 * The Project behind an id, but only for one of its Members. Returns null
 * for a non-Member and for an unknown id alike, so callers can answer both
 * with the same 404.
 */
export async function getProjectForMember(
  projectId: string,
  userId: string,
): Promise<ProjectSummary | null> {
  const [row] = await db
    .select(projectColumns)
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(and(eq(project.id, projectId), eq(member.userId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Edits a Project's title and description. Its id — and so its URL — is
 * untouched. Returns null when the Author is not a Member of `projectId`.
 */
export async function editProject(
  projectId: string,
  input: { title: string; description: string },
  userId: string,
): Promise<ProjectSummary | null> {
  const existing = await getProjectForMember(projectId, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(project)
    .set({
      title: input.title,
      description: input.description,
      updatedAt: new Date(),
    })
    .where(eq(project.id, existing.id))
    .returning(projectColumns);

  return updated ?? null;
}

/**
 * Hard-deletes a Project. Its Members and its Journeys cascade with it.
 * Returns false when the Author is not a Member, which callers answer with
 * the same 404 as an unknown id.
 */
export async function deleteProject(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const existing = await getProjectForMember(projectId, userId);
  if (!existing) return false;

  await db.delete(project).where(eq(project.id, existing.id));
  return true;
}
