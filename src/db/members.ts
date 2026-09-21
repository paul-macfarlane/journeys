// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { getProjectForMember } from "@/db/projects";
import { member, user } from "@/db/schema";

/**
 * Data access for a Project's Members, mirroring `@/db/projects`.
 *
 * All Members are equal — `member.role` is written on insert (defaulting to
 * "member") and never read here. A Project can never lose its last Member:
 * `removeMember` refuses that itself, and migration 0001's
 * `project_keeps_last_member` trigger is the backstop for a race between two
 * concurrent removals.
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

  await db.insert(member).values({ projectId, userId: account.id });
  return { ok: true, userId: account.id };
}

export type RemoveMemberResult =
  | { ok: true }
  | { ok: false; reason: "no-project" | "not-a-member" | "last-member" };

/**
 * Removes a Member. One transaction: the actor's own membership is checked
 * first (else `no-project`), then the Project's member count is checked
 * before any delete is attempted (`<= 1` refuses with `last-member`), and
 * only then is the row deleted (zero rows deleted means `not-a-member`).
 *
 * The trigger backstop: if two removals race past the count check, the
 * database's own `project_keeps_last_member` trigger raises on the losing
 * delete. That error — its own message or its `cause`'s containing "must
 * keep at least one member" — is caught here and returned as `last-member`
 * rather than rethrown.
 */
export async function removeMember(
  projectId: string,
  userId: string,
  actorUserId: string,
): Promise<RemoveMemberResult> {
  try {
    return await db.transaction(async (tx) => {
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
