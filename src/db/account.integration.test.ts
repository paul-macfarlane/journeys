import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { deleteAccount } from "@/db/account";
import {
  account,
  draft,
  journey,
  member,
  project,
  publishedVersion,
  response,
  run,
  session,
  user,
  verification,
} from "@/db/schema";
import type { GraphDocument } from "@/lib/graph/document";

// The same table map `@/db/index.ts` passes as `{ schema }`, spelled out
// from the named imports above rather than a second `* as schema` import
// from the same module (which `import/no-duplicates` refuses) — this is
// what makes `db` below type-compatible with `deleteAccount`'s `Db` param.
const schema = {
  account,
  draft,
  journey,
  member,
  project,
  publishedVersion,
  response,
  run,
  session,
  user,
  verification,
};

/**
 * Integration coverage for `deleteAccount` (ticket 77): the cascade, the
 * last-Member trigger backstop, and the race with a `member` insert. Skipped
 * unless `DB_INTEGRATION_URL` is set, since it writes real rows against a
 * real Postgres rather than mocking the database. CI sets it to the same
 * service database `pnpm db:migrate` migrates before `pnpm test` runs.
 */

const url = process.env.DB_INTEGRATION_URL;

describe.skipIf(!url)("deleteAccount (integration)", () => {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const projectIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    if (projectIds.length > 0) {
      await db.delete(project).where(inArray(project.id, projectIds));
    }
    if (userIds.length > 0) {
      await db.delete(user).where(inArray(user.id, userIds));
    }
    await pool.end();
  });

  function email(label: string): string {
    return `${label}-${randomUUID()}@example.com`;
  }

  async function insertUser(label: string): Promise<string> {
    const id = randomUUID();
    userIds.push(id);
    await db.insert(user).values({ id, name: label, email: email(label) });
    return id;
  }

  async function insertProject(title: string): Promise<string> {
    const id = randomUUID();
    projectIds.push(id);
    await db.insert(project).values({ id, title });
    return id;
  }

  async function addMember(projectId: string, userId: string): Promise<void> {
    await db.insert(member).values({ projectId, userId });
  }

  /** A Journey with a Draft, a Published Version, a Run, and a Response. */
  async function insertJourneyWithRunHistory(
    projectId: string,
    publishedBy: string,
  ): Promise<{ journeyId: string; versionId: string }> {
    const journeyId = randomUUID();
    const versionId = randomUUID();
    const runId = randomUUID();
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: {},
      outcomes: {},
      layoutDirection: "TB",
    };

    await db.insert(journey).values({ id: journeyId, projectId, title: "J" });
    await db.insert(draft).values({ journeyId, document });
    await db.insert(publishedVersion).values({
      id: versionId,
      journeyId,
      versionNumber: 1,
      document,
      publishedBy,
    });
    await db.insert(run).values({
      id: runId,
      versionId,
      participantId: randomUUID(),
      path: ["start"],
    });
    await db.insert(response).values({ runId, stepId: "start", text: "hi" });

    return { journeyId, versionId };
  }

  it("deletes the sole Project and everything in it, keeps the shared Project, nulls its published_by, and deletes the account", async () => {
    const author = await insertUser("author");
    const otherMember = await insertUser("other-member");

    const soleProject = await insertProject("Sole project");
    await addMember(soleProject, author);
    const { journeyId, versionId } = await insertJourneyWithRunHistory(
      soleProject,
      author,
    );

    const sharedProject = await insertProject("Shared project");
    await addMember(sharedProject, author);
    await addMember(sharedProject, otherMember);
    const { versionId: sharedVersionId } = await insertJourneyWithRunHistory(
      sharedProject,
      author,
    );

    const sessionId = randomUUID();
    await db.insert(session).values({
      id: sessionId,
      token: randomUUID(),
      userId: author,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const accountId = randomUUID();
    await db.insert(account).values({
      id: accountId,
      accountId: randomUUID(),
      providerId: "google",
      userId: author,
    });

    const result = await deleteAccount(db, author);
    expect(result).toEqual({ ok: true, deletedProjectIds: [soleProject] });

    // The sole Project and everything under it: gone.
    expect(
      await db
        .select()
        .from(project)
        .where(inArray(project.id, [soleProject])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(journey)
        .where(inArray(journey.id, [journeyId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(publishedVersion)
        .where(inArray(publishedVersion.id, [versionId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(run)
        .where(inArray(run.versionId, [versionId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(response)
        .where(inArray(response.runId, [versionId])),
    ).toHaveLength(0);

    // The shared Project: intact, one Member left, its version's
    // `published_by` nulled with the Author's account.
    const remainingMembers = await db
      .select({ userId: member.userId })
      .from(member)
      .where(inArray(member.projectId, [sharedProject]));
    expect(remainingMembers.map((row) => row.userId)).toEqual([otherMember]);

    const [sharedVersion] = await db
      .select({ publishedBy: publishedVersion.publishedBy })
      .from(publishedVersion)
      .where(inArray(publishedVersion.id, [sharedVersionId]));
    expect(sharedVersion.publishedBy).toBeNull();

    // The Author's own rows: gone.
    expect(
      await db
        .select()
        .from(user)
        .where(inArray(user.id, [author])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(session)
        .where(inArray(session.id, [sessionId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(account)
        .where(inArray(account.id, [accountId])),
    ).toHaveLength(0);
  });

  it("returns not-found for a user row that does not exist", async () => {
    const result = await deleteAccount(db, randomUUID());
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("refuses a raw delete of a Project's last remaining Member", async () => {
    const sole = await insertUser("sole-member");
    const soleProject = await insertProject("Refuses last member");
    await addMember(soleProject, sole);

    // drizzle-orm wraps the driver's error, so the trigger's own message
    // (`removeMember`'s own comment in `@/db/members` explains this) lives
    // on `.cause`, not on the thrown error directly.
    let caught: unknown;
    try {
      await db
        .delete(member)
        .where(inArray(member.projectId, [soleProject]))
        .execute();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const cause = (caught as Error).cause;
    const message =
      cause instanceof Error ? cause.message : String(cause ?? "");
    expect(message).toMatch(/must keep at least one member/);
  });

  it("blocks on a member insert racing the deletion, then finishes correctly once it commits", async () => {
    const author = await insertUser("racing-author");
    const otherOwner = await insertUser("project-b-owner");
    const projectB = await insertProject("Project B");
    await addMember(projectB, otherOwner);

    const raceClient = new pg.Client({ connectionString: url });
    await raceClient.connect();
    try {
      await raceClient.query("BEGIN");
      await raceClient.query(
        'INSERT INTO "member" (project_id, user_id) VALUES ($1, $2)',
        [projectB, author],
      );

      let deleteSettled = false;
      const deletion = deleteAccount(db, author).then((result) => {
        deleteSettled = true;
        return result;
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(deleteSettled, "deleteAccount blocks on the locked user row").toBe(
        false,
      );

      await raceClient.query("COMMIT");

      const result = await deletion;
      expect(result.ok).toBe(true);

      expect(
        await db
          .select()
          .from(user)
          .where(inArray(user.id, [author])),
      ).toHaveLength(0);
      const projectBMembers = await db
        .select({ userId: member.userId })
        .from(member)
        .where(inArray(member.projectId, [projectB]));
      expect(projectBMembers.map((row) => row.userId)).toEqual([otherOwner]);
    } finally {
      await raceClient.end();
    }
  });
});
