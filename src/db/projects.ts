// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { member, project } from "@/db/schema";
import { contentSchema, type Content } from "@/lib/graph/content";
import { toThemePreset, type Theme } from "@/lib/theme";

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
  /** Rich text, the same closed shape a Step's content has (ticket 07). */
  description: Content;
  /** The Theme the runner and the public page paint (ticket 11). */
  theme: Theme;
};

const projectColumns = {
  id: project.id,
  title: project.title,
  descriptionContent: project.descriptionContent,
  themePreset: project.themePreset,
  themeAccent: project.themeAccent,
};

/**
 * The description is parsed with `contentSchema` on the way out, as
 * `@/db/versions` parses a document: what reached storage went through
 * `sanitizeContent` (or migration 0007's backfill), so a row that does not
 * parse is a bug worth failing loudly on rather than rendering. The Theme's
 * preset is read more gently (`toThemePreset`): a retired preset id would
 * mean the app's palette, never a 404 on a public page.
 */
function toSummary(row: {
  id: string;
  title: string;
  descriptionContent: unknown;
  themePreset: string;
  themeAccent: string | null;
}): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    description: contentSchema.parse(row.descriptionContent),
    theme: { preset: toThemePreset(row.themePreset), accent: row.themeAccent },
  };
}

/** Every Project the Author is a Member of, newest first. */
export async function listProjectsForAuthor(
  userId: string,
): Promise<ProjectSummary[]> {
  const rows = await db
    .select(projectColumns)
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(eq(member.userId, userId))
    .orderBy(desc(project.createdAt));

  return rows.map(toSummary);
}

/**
 * The Projects the Author is a Member of that changed most recently, at most
 * `limit` of them — the navbar's switcher (ticket 29). "Changed" is the
 * Project row itself: a title or description edit, or its creation; work
 * inside its Journeys does not move it up. Ties fall back to newest first,
 * then id, so the list is stable between renders.
 */
export async function listRecentProjectsForAuthor(
  userId: string,
  limit: number,
): Promise<ProjectSummary[]> {
  const rows = await db
    .select(projectColumns)
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(eq(member.userId, userId))
    .orderBy(desc(project.updatedAt), desc(project.createdAt), desc(project.id))
    .limit(limit);

  return rows.map(toSummary);
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

    return toSummary(created);
  });
}

/**
 * The Project behind an id, but only for one of its Members. Returns null
 * for a non-Member and for an unknown id alike, so callers can answer both
 * with the same 404.
 *
 * Request-scoped `cache()`, like `getSession`: the layout under
 * `[projectId]` asks for the Project to label the navbar and the page asks
 * again for the same render, and the two render in parallel, so this is
 * what makes that one query rather than two.
 */
export const getProjectForMember = cache(
  async (projectId: string, userId: string): Promise<ProjectSummary | null> => {
    const [row] = await db
      .select(projectColumns)
      .from(project)
      .innerJoin(member, eq(member.projectId, project.id))
      .where(and(eq(project.id, projectId), eq(member.userId, userId)))
      .limit(1);

    return row ? toSummary(row) : null;
  },
);

/**
 * What an anonymous Participant may see of a Project by id: its title and
 * its description, for the public Project page at `/p/<id>` (ticket 07).
 * The one read here that checks no membership — every Project has a public
 * page, and a Participant only ever needs the link. Null for an unknown id,
 * which the page answers with a 404. Its Journeys are
 * `listPublicJourneysForProject` in `@/db/journeys`.
 *
 * Request-scoped `cache()` because the page and its `generateMetadata` ask
 * for the same Project in the same render.
 */
export const getPublicProject = cache(
  async (projectId: string): Promise<ProjectSummary | null> => {
    const [row] = await db
      .select(projectColumns)
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    return row ? toSummary(row) : null;
  },
);

/**
 * The one write shape every Settings-tab edit has: the Member check, the
 * update stamped with `updatedAt` (which is what moves the Project up the
 * navbar's switcher), and the row read back. Null when the Author is not a
 * Member of `projectId`.
 */
async function updateProjectForMember(
  projectId: string,
  userId: string,
  changes: Partial<{
    title: string;
    descriptionContent: Content;
    themePreset: string;
    themeAccent: string | null;
  }>,
): Promise<ProjectSummary | null> {
  const existing = await getProjectForMember(projectId, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(project)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(project.id, existing.id))
    .returning(projectColumns);

  return updated ? toSummary(updated) : null;
}

/** Renames a Project. Its id — and so its URL — is untouched. */
export function renameProject(
  projectId: string,
  input: { title: string },
  userId: string,
): Promise<ProjectSummary | null> {
  return updateProjectForMember(projectId, userId, { title: input.title });
}

/**
 * Replaces a Project's rich-text description. The caller has already put
 * `description` through `sanitizeContent`; this stores what it was given.
 */
export function editProjectDescription(
  projectId: string,
  description: Content,
  userId: string,
): Promise<ProjectSummary | null> {
  return updateProjectForMember(projectId, userId, {
    descriptionContent: description,
  });
}

/**
 * Sets a Project's Theme: the preset every Journey in it is painted in
 * unless the Journey overrides it, and the optional accent. The caller has
 * already parsed both through the Theme schemas; this stores what it was
 * given. The runner and the public page read the row on every request, so
 * the change shows the moment it is stored.
 */
export function setProjectTheme(
  projectId: string,
  theme: Theme,
  userId: string,
): Promise<ProjectSummary | null> {
  return updateProjectForMember(projectId, userId, {
    themePreset: theme.preset,
    themeAccent: theme.accent,
  });
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
