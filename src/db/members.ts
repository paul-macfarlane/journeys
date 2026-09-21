// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { getProjectForMember } from "@/db/projects";
import { member, project, user } from "@/db/schema";

/**
 * Data access for a Project's Members, mirroring `@/db/projects`.
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
export async function listMembers(projectId: string): Promise<MemberSummary[]> {
  return db
    .select({ userId: member.userId, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.projectId, projectId))
    .orderBy(asc(member.createdAt));
}

export type AddMemberResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "no-project" | "unknown-email" | "already-member" };

/**
 * Adds an existing account as a Member by email, matched case-insensitively
 * so a differently cased email still finds the account. The actor must
 * already be a Member of the Project — the same check every Project action
 * makes — so an Author who is not a Member gets `no-project`, indistinguishable
 * from a Project that never existed.
 */
export async function addMemberByEmail(
  projectId: string,
  email: string,
  actorUserId: string,
): Promise<AddMemberResult> {
  const project = await getProjectForMember(projectId, actorUserId);
  if (!project) return { ok: false, reason: "no-project" };

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
  | { ok: false; reason: "no-project" | "not-a-member" | "last-member" };

/**
 * Removes a Member. One transaction: the Project row is locked first, so
 * removals of one Project run one at a time (else `no-project`); then the
 * actor's own membership is checked (else `no-project`), then the Project's
 * member count before any delete is attempted (`<= 1` refuses with
 * `last-member`), and only then is the row deleted (zero rows deleted means
 * `not-a-member`).
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
  projectId: string,
  userId: string,
  actorUserId: string,
): Promise<RemoveMemberResult> {
  try {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, projectId))
        .for("update");
      if (!locked) return { ok: false, reason: "no-project" as const };

      const [actorMembership] = await tx
        .select({ userId: member.userId })
        .from(member)
        .where(
          and(eq(member.projectId, projectId), eq(member.userId, actorUserId)),
        )
        .limit(1);
      if (!actorMembership) return { ok: false, reason: "no-project" as const };

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

/**
 * The SQLSTATE of a failed statement. drizzle-orm wraps the driver's error
 * as a `DrizzleQueryError` whose `cause` is the `pg` `DatabaseError`, so the
 * code lives on the cause; the error itself is checked too in case a caller
 * ever sees the driver error unwrapped.
 */
function pgErrorCode(error: unknown): string | undefined {
  const candidates = [error instanceof Error ? error.cause : undefined, error];
  for (const candidate of candidates) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof candidate.code === "string"
    ) {
      return candidate.code;
    }
  }
  return undefined;
}

/** 23505: unique_violation. */
function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23505";
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
