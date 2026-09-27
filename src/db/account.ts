// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { asc, count, eq, inArray } from "drizzle-orm";

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
 * The Author's membership Projects are locked in id order — the order
 * `removeMember` in `@/db/members` locks a single Project in — before any
 * count is trusted, exactly as `removeMember` locks the one Project it
 * touches: without the lock, a `member` row inserted into one of these
 * Projects between the count and the delete would go unnoticed and be
 * dropped along with the Project it was just added to. A `member` insert
 * racing this deletion takes `FOR KEY SHARE` on the Project row (blocked by
 * this transaction's `FOR UPDATE`) and, once it reaches the account itself,
 * `FOR KEY SHARE` on the `user` row too (which blocks this transaction's
 * user delete until the racing insert commits) — either way the race lands
 * entirely before this transaction's read or entirely after its commit,
 * never straddling it.
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
      .limit(1);
    if (!existing) return { ok: false as const, reason: "not-found" as const };

    const memberships = await tx
      .select({ projectId: member.projectId })
      .from(member)
      .where(eq(member.userId, userId));
    const projectIds = memberships.map((row) => row.projectId);

    const deletedProjectIds: string[] = [];
    if (projectIds.length > 0) {
      const locked = await tx
        .select({ id: project.id })
        .from(project)
        .where(inArray(project.id, projectIds))
        .orderBy(asc(project.id))
        .for("update");

      for (const row of locked) {
        const [{ value: memberCount }] = await tx
          .select({ value: count() })
          .from(member)
          .where(eq(member.projectId, row.id));
        if (memberCount <= 1) deletedProjectIds.push(row.id);
      }

      if (deletedProjectIds.length > 0) {
        await tx.delete(project).where(inArray(project.id, deletedProjectIds));
      }
    }

    // Cascades the remaining memberships (every surviving Project keeps at
    // least one other Member, so the last-Member trigger has nothing to
    // refuse), sessions, and OAuth `account` rows, and nulls
    // `published_version.published_by` on any shared Project's versions.
    await tx.delete(user).where(eq(user.id, userId));

    return { ok: true as const, deletedProjectIds };
  });
}
