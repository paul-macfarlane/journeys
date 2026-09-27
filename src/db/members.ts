// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import type { MemberProject } from "@/db/access";
import { isUniqueViolation } from "@/db/errors";
import { lockProject } from "@/db/projects";
import { member, user } from "@/db/schema";
import { notFound, type WriteFailure } from "@/lib/write-result";

/**
 * Data access for a Project's Members, mirroring `@/db/projects`: every
 * function here takes the `MemberProject` `@/db/access` resolved for the
 * signed-in Author, so none can be called without that check and none
 * repeats it.
 *
 * All Members are equal — `member.role` is written on insert (defaulting to
 * "member") and never read here. A Project can never lose its last Member:
 * `removeMember` refuses that itself, serializing removals of one Project
 * behind a row lock so two of them cannot both count two Members and both
 * commit, and migration 0001's `project_keeps_last_member` trigger is the
 * backstop for any delete that does not come through here.
 */

export type MemberSummary = {
  userId: string;
  name: string;
  email: string;
};

/** Every Member of the Project, the first one added first. */
export async function listMembers(
  project: MemberProject,
): Promise<MemberSummary[]> {
  return db
    .select({ userId: member.userId, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.projectId, project.id))
    .orderBy(asc(member.createdAt));
}

export type AddMemberResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unknown-email" | "already-member" };

/**
 * Adds an existing account as a Member by email, matched case-insensitively
 * so a differently cased email still finds the account. The actor is the
 * Member `project` was resolved for.
 */
export async function addMemberByEmail(
  project: MemberProject,
  email: string,
): Promise<AddMemberResult> {
  const projectId = project.id;

  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = lower(${email})`)
    .limit(1);
  if (!account) return { ok: false, reason: "unknown-email" };

  const [existing] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.projectId, projectId), eq(member.userId, account.id)))
    .limit(1);
  if (existing) return { ok: false, reason: "already-member" };

  try {
    await db.insert(member).values({ projectId, userId: account.id });
  } catch (error) {
    // Two Members adding the same account at once: the second insert hits
    // the (project_id, user_id) primary key, which is the same answer the
    // check above would have given a moment later.
    if (isUniqueViolation(error))
      return { ok: false, reason: "already-member" };
    throw error;
  }
  return { ok: true, userId: account.id };
}

export type RemoveMemberResult =
  | { ok: true }
  | Extract<WriteFailure, { reason: "not-found" }>
  | { ok: false; reason: "not-a-member" | "last-member" };

/**
 * Removes a Member. One transaction: the Project row is locked first
 * (`lockProject`), so removals of one Project run one at a time (a Project
 * deleted since its membership was resolved is `not-found`, and so is an
 * actor who has since stopped being one of its Members, re-checked under
 * the lock); then the Project's member count is read before any delete is attempted (`<= 1`
 * refuses with `last-member`), and only then is the row deleted (zero rows
 * deleted means `not-a-member`). The actor is the Member `project` was
 * resolved for.
 *
 * The lock is what makes the count trustworthy: without it two removals of
 * different Members could each count two, delete different rows, and both
 * commit — the trigger would not notice either, because each one's count
 * runs against a snapshot where the other's delete is still uncommitted.
 * The trigger stays as the backstop for any delete that bypasses this
 * function; if it ever raises here, that error — its own message or its
 * `cause`'s containing "must keep at least one member" — is returned as
 * `last-member` rather than rethrown.
 */
export async function removeMember(
  project: MemberProject,
  userId: string,
): Promise<RemoveMemberResult> {
  const projectId = project.id;
  try {
    return await db.transaction(async (tx): Promise<RemoveMemberResult> => {
      if (!(await lockProject(tx, projectId))) return notFound();

      // The actor must still be a Member now the Project is locked: one
      // removed since `project` was resolved answers as the Project gone.
      const [actor] = await tx
        .select({ userId: member.userId })
        .from(member)
        .where(
          and(
            eq(member.projectId, projectId),
            eq(member.userId, project.memberUserId),
          ),
        )
        .limit(1);
      if (!actor) return notFound();

      const [{ value: memberCount }] = await tx
        .select({ value: count() })
        .from(member)
        .where(eq(member.projectId, projectId));
      if (memberCount <= 1)
        return { ok: false, reason: "last-member" as const };

      const deleted = await tx
        .delete(member)
        .where(and(eq(member.projectId, projectId), eq(member.userId, userId)))
        .returning({ userId: member.userId });
      if (deleted.length === 0) {
        return { ok: false, reason: "not-a-member" as const };
      }

      return { ok: true as const };
    });
  } catch (error) {
    if (isLastMemberTriggerError(error)) {
      return { ok: false, reason: "last-member" };
    }
    throw error;
  }
}

function isLastMemberTriggerError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const causeMessage =
    error.cause instanceof Error
      ? error.cause.message
      : String(error.cause ?? "");
  return (
    error.message.includes("must keep at least one member") ||
    causeMessage.includes("must keep at least one member")
  );
}
