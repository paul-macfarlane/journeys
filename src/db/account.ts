// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { asc, count, eq, inArray, sql } from "drizzle-orm";

import { db, type Db } from "@/db";
import { member, project, user } from "@/db/schema";

/**
 * Data access for deleting an Author's account (ticket 77).
 *
 * A Project where the Author is the only Member is deleted whole, with
 * every Journey, Draft, Published Version, Run, and Response in it (the
 * schema's own cascades); a Project shared with other Members keeps
 * everything and only loses the Author as a Member. The user row itself,
 * its sessions, and its linked OAuth `account` rows go with it too.
 *
 * Both functions take the Author's own id and act only on the Author's own
 * memberships — they are not the membership seam `@/db/access` holds, which
 * resolves one Project or Journey for a Member.
 *
 * better-auth ships its own `/delete-user` endpoint, but it is off by
 * default (`user.deleteUser.enabled` is never set here) and, even enabled,
 * would run its own deletion outside this transaction — the sole-Project
 * cascade above has to happen atomically with the user row going, or a
 * crash between the two could leave a Project with no Members at all, which
 * the last-Member trigger exists to prevent. `deleteAccount` below is the
 * one path; nothing calls better-auth's endpoint.
 */

export type AccountDeletionPreview = {
  /** Projects deleted whole: the Author is their only Member. */
  deleted: { id: string; title: string }[];
  /** Projects that stay, with their other Members, minus the Author. */
  shared: { id: string; title: string }[];
};

/**
 * Every Project the Author belongs to, split by whether deleting the
 * account deletes it too — for the confirmation dialog. By title, so the
 * two lists read the same as the Projects list does.
 */
export async function previewAccountDeletion(
  userId: string,
): Promise<AccountDeletionPreview> {
  const projectsForUser = await db
    .select({ id: project.id, title: project.title })
    .from(project)
    .innerJoin(member, eq(member.projectId, project.id))
    .where(eq(member.userId, userId));

  if (projectsForUser.length === 0) return { deleted: [], shared: [] };

  const counts = await db
    .select({ projectId: member.projectId, value: count() })
    .from(member)
    .where(
      inArray(
        member.projectId,
        projectsForUser.map((row) => row.id),
      ),
    )
    .groupBy(member.projectId);
  const countByProject = new Map(
    counts.map((row) => [row.projectId, row.value]),
  );

  const deleted: { id: string; title: string }[] = [];
  const shared: { id: string; title: string }[] = [];
  for (const row of projectsForUser) {
    const memberCount = countByProject.get(row.id) ?? 0;
    (memberCount <= 1 ? deleted : shared).push(row);
  }

  const byTitle = (a: { title: string }, b: { title: string }) =>
    a.title.localeCompare(b.title);
  deleted.sort(byTitle);
  shared.sort(byTitle);

  return { deleted, shared };
}

export type DeleteAccountResult =
  | { ok: true; deletedProjectIds: string[] }
  | { ok: false; reason: "not-found" };

/**
 * Deletes an Author's account: the Projects where they are the only Member,
 * then the user row itself. One transaction, so a crash midway can never
 * leave a Project without a Member.
 *
 * The locks, in order, and what each racing write lands as:
 *
 * 1. The user row, `FOR UPDATE` (none: `not-found`). Every `member` insert
 *    naming this Author — `addMemberByEmail`, `createProject`'s first
 *    Member — takes `FOR KEY SHARE` on it. An insert that committed first is
 *    seen by the membership read below. One still open when this lock is
 *    asked for makes it wait for that commit, and is then seen too. One that
 *    starts after this lock waits for this transaction, then fails its
 *    foreign key: the account is gone, so `createProject` is never left with
 *    a Project whose only Member was cascaded away.
 * 2. The Author's memberships, read.
 * 3. Those Projects, `FOR UPDATE` in id order — the lock `removeMember` in
 *    `@/db/members` takes on the one Project it touches. A removal that holds
 *    it runs to its commit first.
 * 4. After the lock, for each locked Project, the Member count and whether
 *    the Author is still a Member, re-read in one query. A removal of the
 *    Author that committed while this transaction waited in step 3 is seen
 *    here, and that Project is left alone. Only a Project the Author is
 *    still the one Member of is deleted; any other Member's removal waits
 *    on the lock, so the count cannot fall after it is read.
 * 5. The user row, deleted.
 *
 * `client` is typed structurally so the integration test can pass its own
 * pooled connection rather than the app's shared `db`.
 */
export async function deleteAccount(
  client: Pick<Db, "transaction">,
  userId: string,
): Promise<DeleteAccountResult> {
  return client.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!existing) return { ok: false as const, reason: "not-found" as const };

    const memberships = await tx
      .select({ projectId: member.projectId })
      .from(member)
      .where(eq(member.userId, userId));
    const projectIds = memberships.map((row) => row.projectId);

    let deletedProjectIds: string[] = [];
    if (projectIds.length > 0) {
      const locked = await tx
        .select({ id: project.id })
        .from(project)
        .where(inArray(project.id, projectIds))
        .orderBy(asc(project.id))
        .for("update");

      if (locked.length > 0) {
        const membership = await tx
          .select({
            projectId: member.projectId,
            memberCount: count(),
            authorIsMember: sql<boolean>`bool_or(${member.userId} = ${userId})`,
          })
          .from(member)
          .where(
            inArray(
              member.projectId,
              locked.map((row) => row.id),
            ),
          )
          .groupBy(member.projectId)
          .orderBy(asc(member.projectId));

        deletedProjectIds = membership
          .filter((row) => row.authorIsMember && row.memberCount === 1)
          .map((row) => row.projectId);
      }

      if (deletedProjectIds.length > 0) {
        await tx.delete(project).where(inArray(project.id, deletedProjectIds));
      }
    }

    // Cascades the remaining memberships (every surviving Project the
    // Author is still in keeps at least one other Member, so the
    // last-Member trigger has nothing to refuse), sessions, and OAuth
    // `account` rows, and nulls `published_version.published_by` on any
    // shared Project's versions.
    await tx.delete(user).where(eq(user.id, userId));

    return { ok: true as const, deletedProjectIds };
  });
}
