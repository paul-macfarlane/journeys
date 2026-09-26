// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import {
  changedFields,
  guardedWrite,
  rowExists,
  stillHolds,
  stillHoldsOrRetired,
  type StaleWrite,
} from "@/db/guarded-write";
import { member, project } from "@/db/schema";
import { logUnreadable } from "@/db/unreadable";
import { contentSchema, emptyContent, type Content } from "@/lib/graph/content";
import { themePresetSchema, toThemePreset, type Theme } from "@/lib/theme";

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
 * The description is read with `contentSchema.safeParse`, falling back to
 * empty rich text on a row that fails it (ticket 83) rather than throwing:
 * a Project's title and Theme must keep working beside a description no
 * Author can read. The Theme's preset is read more gently still
 * (`toThemePreset`): a retired preset id would mean the app's palette,
 * never a 404 on a public page.
 */
export function toProjectSummary(row: {
  id: string;
  title: string;
  descriptionContent: unknown;
  themePreset: string;
  themeAccent: string | null;
}): ProjectSummary {
  const parsed = contentSchema.safeParse(row.descriptionContent);
  if (!parsed.success)
    logUnreadable("project description", { projectId: row.id });

  return {
    id: row.id,
    title: row.title,
    description: parsed.success ? parsed.data : emptyContent,
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

  return rows.map(toProjectSummary);
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

  return rows.map(toProjectSummary);
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

    return toProjectSummary(created);
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

    return row ? toProjectSummary(row) : null;
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

    return row ? toProjectSummary(row) : null;
  },
);

/** The Project fields the Settings tab writes, by their column. */
type ProjectFields = {
  title: string;
  descriptionContent: Content;
  themePreset: string;
  themeAccent: string | null;
};

const projectFieldColumns = {
  title: project.title,
  descriptionContent: project.descriptionContent,
  themePreset: project.themePreset,
  themeAccent: project.themeAccent,
} as const;

/** Whether a description is the empty rich text an unreadable one reads as. */
function isEmptyContent(value: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(emptyContent);
}

/**
 * Whether a description write is guarded by its baseline (ticket 73 with
 * ticket 83). A stored description that fails `contentSchema` reads back as
 * empty rich text, so that is the baseline the Member edits from — and the
 * row never holds it, so a guard would refuse every description save as
 * stale. Such a write, from empty rich text over a stored description that
 * cannot be read, is unguarded; every other one is guarded.
 */
export function guardsDescription(baseline: unknown, stored: unknown): boolean {
  if (!isEmptyContent(baseline)) return true;
  return contentSchema.safeParse(stored).success;
}

/** The description as the row holds it, unparsed: what `guardsDescription` reads. */
async function storedDescription(projectId: string): Promise<unknown> {
  const [row] = await db
    .select({ descriptionContent: project.descriptionContent })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return row?.descriptionContent;
}

/** The guard on one changed field: the preset also passes a retired id. */
function fieldGuard(field: keyof ProjectFields, previous: unknown) {
  return field === "themePreset"
    ? stillHoldsOrRetired(
        projectFieldColumns.themePreset,
        previous,
        themePresetSchema.options,
      )
    : stillHolds(projectFieldColumns[field], previous);
}

/**
 * The one write shape every Settings-tab edit has: the Member check, then
 * the guarded update (ticket 73). Only the fields whose value differs from
 * `baseline` — what the Member edited against — are written, and each is
 * written only while the row still holds its baseline value, so another
 * Member's change to the same field since is answered `stale` and
 * nothing is overwritten. The title, description, and Theme loops each
 * guard only their own fields and never make each other stale. The update is
 * stamped with `updatedAt` (which is what moves the Project up the navbar's
 * switcher), and the row read back. Null when the Author is not a Member of
 * `projectId`, or the Project went away. A description edited from the
 * empty rich text an unreadable description reads as is written unguarded
 * (`guardsDescription`), and logged.
 */
async function updateProjectForMember(
  projectId: string,
  userId: string,
  next: Partial<ProjectFields>,
  baseline: Partial<ProjectFields>,
): Promise<ProjectSummary | StaleWrite | null> {
  const existing = await getProjectForMember(projectId, userId);
  if (!existing) return null;

  const fields = changedFields(next, baseline);
  if (fields.length === 0) return existing;

  let guarded = fields;
  if (
    fields.includes("descriptionContent") &&
    isEmptyContent(baseline.descriptionContent) &&
    !guardsDescription(
      baseline.descriptionContent,
      await storedDescription(existing.id),
    )
  ) {
    logUnreadable("project description", { projectId: existing.id });
    guarded = fields.filter((field) => field !== "descriptionContent");
  }

  const written = await guardedWrite(
    () =>
      db
        .update(project)
        .set({
          ...Object.fromEntries(fields.map((field) => [field, next[field]])),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(project.id, existing.id),
            ...guarded.map((field) => fieldGuard(field, baseline[field])),
          ),
        )
        .returning(projectColumns),
    () => rowExists(project, project.id, existing.id),
  );
  if (!written.ok) return written.reason === "stale" ? written : null;
  return toProjectSummary(written.row);
}

/**
 * Renames a Project. Its id — and so its URL — is untouched. `baseline` is
 * the title the Member edited from.
 */
export function renameProject(
  projectId: string,
  input: { title: string },
  baseline: { title: string },
  userId: string,
): Promise<ProjectSummary | StaleWrite | null> {
  return updateProjectForMember(
    projectId,
    userId,
    { title: input.title },
    { title: baseline.title },
  );
}

/**
 * Replaces a Project's rich-text description. The caller has already put
 * `description` and `baseline` through `sanitizeContent`; this stores what
 * it was given, while the row still holds `baseline`.
 */
export function editProjectDescription(
  projectId: string,
  description: Content,
  baseline: Content,
  userId: string,
): Promise<ProjectSummary | StaleWrite | null> {
  return updateProjectForMember(
    projectId,
    userId,
    { descriptionContent: description },
    { descriptionContent: baseline },
  );
}

/**
 * Sets a Project's Theme: the preset every Journey in it is painted in
 * unless the Journey overrides it, and the optional accent. The caller has
 * already parsed both, and the baseline, through the Theme schemas; this
 * stores what it was given. The runner and the public page read the row on
 * every request, so the change shows the moment it is stored.
 */
export function setProjectTheme(
  projectId: string,
  theme: Theme,
  baseline: Theme,
  userId: string,
): Promise<ProjectSummary | StaleWrite | null> {
  return updateProjectForMember(
    projectId,
    userId,
    { themePreset: theme.preset, themeAccent: theme.accent },
    { themePreset: baseline.preset, themeAccent: baseline.accent },
  );
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
