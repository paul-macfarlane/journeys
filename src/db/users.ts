// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { journey, member, project, user } from "@/db/schema";
import { readAuthorLinks, type AuthorLink } from "@/lib/author";
import { contentSchema, type Content } from "@/lib/graph/content";

/**
 * Data access for an Author's account fields (ticket 52): the display name,
 * bio, links, and public opt-in the Settings page edits, and what an
 * anonymous Participant may see of an Author at `/authors/<userId>` and on a
 * Project page. Mirrors `@/db/projects`: an Author page is addressed by the
 * Author's own id, and turning the public switch off makes an existing
 * Author indistinguishable from an unknown id.
 */

export type AuthorSettings = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string;
  links: AuthorLink[];
  public: boolean;
};

const authorSettingsColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  bio: user.bio,
  links: user.links,
  public: user.public,
};

function toAuthorSettings(row: {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  links: unknown;
  public: boolean;
}): AuthorSettings {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    bio: row.bio ?? "",
    links: readAuthorLinks(row.links),
    public: row.public,
  };
}

/** The signed-in Author's own settings, for the Settings page. */
export async function getAuthorSettings(
  userId: string,
): Promise<AuthorSettings | null> {
  const [row] = await db
    .select(authorSettingsColumns)
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row ? toAuthorSettings(row) : null;
}

/**
 * Applies one Settings-page edit. The caller has already parsed the patch
 * through `src/lib/author.ts`'s schemas; this stores what it is given. A
 * bio of `""` is stored as `null` and read back as `""` again, matching
 * `AuthorSettings.bio`'s never-null shape. Returns null when `userId` names
 * no account.
 */
export async function updateAuthorSettings(
  userId: string,
  patch: Partial<{
    name: string;
    bio: string;
    links: AuthorLink[];
    public: boolean;
  }>,
): Promise<AuthorSettings | null> {
  const changes: Partial<{
    name: string;
    bio: string | null;
    links: AuthorLink[];
    public: boolean;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.bio !== undefined) {
    changes.bio = patch.bio === "" ? null : patch.bio;
  }
  if (patch.links !== undefined) changes.links = patch.links;
  if (patch.public !== undefined) changes.public = patch.public;

  const [updated] = await db
    .update(user)
    .set(changes)
    .where(eq(user.id, userId))
    .returning(authorSettingsColumns);

  return updated ? toAuthorSettings(updated) : null;
}

export type PublicAuthor = {
  id: string;
  name: string;
  image: string | null;
  bio: string;
  links: AuthorLink[];
};

/**
 * What an anonymous Participant may see of an Author by id: null for an
 * unknown id and for an Author who has not turned their page on alike, so
 * the public page and its `generateMetadata` answer both with the same
 * 404. Never returns the email.
 *
 * Request-scoped `cache()`, like `getPublicProject`: the page and its
 * `generateMetadata` ask for the same Author in the same render.
 */
export const getPublicAuthor = cache(
  async (userId: string): Promise<PublicAuthor | null> => {
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        bio: user.bio,
        links: user.links,
      })
      .from(user)
      .where(and(eq(user.id, userId), eq(user.public, true)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      image: row.image,
      bio: row.bio ?? "",
      links: readAuthorLinks(row.links),
    };
  },
);

export type PublicAuthorProject = {
  id: string;
  title: string;
  description: Content;
};

/**
 * The Projects an Author's public page lists: every Project they are a
 * Member of that has at least one Journey with a live Published Version, in
 * the same order `listRecentProjectsForAuthor` in `@/db/projects` uses
 * (updated, then created, then id, all descending).
 */
export async function listPublicProjectsForAuthor(
  userId: string,
): Promise<PublicAuthorProject[]> {
  const projectIdsWithLiveJourneys = db
    .select({ id: journey.projectId })
    .from(journey)
    .where(isNotNull(journey.liveVersionId));

  const rows = await db
    .select({
      id: project.id,
      title: project.title,
      descriptionContent: project.descriptionContent,
    })
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(
      and(
        eq(member.userId, userId),
        inArray(project.id, projectIdsWithLiveJourneys),
      ),
    )
    .orderBy(
      desc(project.updatedAt),
      desc(project.createdAt),
      desc(project.id),
    );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: contentSchema.parse(row.descriptionContent),
  }));
}

export type PublicAuthorSummary = {
  id: string;
  name: string;
};

/**
 * The Members of a Project whose Author page is on, in the same order the
 * Members tab lists them (`member.createdAt` ascending) — the "By …" line
 * on the public Project page.
 */
export async function listPublicAuthorsForProject(
  projectId: string,
): Promise<PublicAuthorSummary[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.projectId, projectId), eq(user.public, true)))
    .orderBy(asc(member.createdAt));
}
