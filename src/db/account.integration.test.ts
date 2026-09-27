import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { deleteAccount } from "@/db/account";
import * as schema from "@/db/schema";
import type { GraphDocument } from "@/lib/graph/document";

/**
 * Integration coverage for `deleteAccount` (ticket 77): the cascade, the
 * last-Member trigger backstop, and the races with a `member` insert and a
 * `member` delete. Skipped unless `DB_INTEGRATION_URL` is set, since it
 * writes real rows against a real Postgres rather than mocking the database.
 * CI sets it to the same service database `pnpm db:migrate` migrates before
 * `pnpm test` runs.
 *
 * The races are made deterministic by a second connection holding its
 * transaction open, and by polling `pg_stat_activity` until `deleteAccount`
 * is seen waiting on a lock that connection holds — never by sleeping.
 */

const url = process.env.DB_INTEGRATION_URL;

describe.skipIf(!url)("deleteAccount (integration)", () => {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const projectIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    if (projectIds.length > 0) {
      await db
        .delete(schema.project)
        .where(inArray(schema.project.id, projectIds));
    }
    if (userIds.length > 0) {
      await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    }
    await pool.end();
  });

  function email(label: string): string {
    return `${label}-${randomUUID()}@example.com`;
  }

  async function insertUser(label: string): Promise<string> {
    const id = randomUUID();
    userIds.push(id);
    await db
      .insert(schema.user)
      .values({ id, name: label, email: email(label) });
    return id;
  }

  async function insertProject(title: string): Promise<string> {
    const id = randomUUID();
    projectIds.push(id);
    await db.insert(schema.project).values({ id, title });
    return id;
  }

  async function addMember(projectId: string, userId: string): Promise<void> {
    await db.insert(schema.member).values({ projectId, userId });
  }

  async function membersOf(projectId: string): Promise<string[]> {
    const rows = await db
      .select({ userId: schema.member.userId })
      .from(schema.member)
      .where(inArray(schema.member.projectId, [projectId]));
    return rows.map((row) => row.userId);
  }

  async function projectExists(projectId: string): Promise<boolean> {
    const rows = await db
      .select({ id: schema.project.id })
      .from(schema.project)
      .where(inArray(schema.project.id, [projectId]));
    return rows.length > 0;
  }

  async function userExists(userId: string): Promise<boolean> {
    const rows = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(inArray(schema.user.id, [userId]));
    return rows.length > 0;
  }

  /** A second connection, whose open transaction the races are made of. */
  async function connectRaceClient(): Promise<{
    client: pg.Client;
    pid: number;
  }> {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const {
      rows: [{ pid }],
    } = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    return { client, pid };
  }

  /**
   * Resolves once some backend is waiting on a lock `blockerPid` holds —
   * `deleteAccount`, the only other statement in flight — polling
   * `pg_stat_activity` rather than sleeping a guessed interval.
   */
  async function waitUntilBlockedBy(blockerPid: number): Promise<void> {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const { rows } = await pool.query<{ waiting: number }>(
        `SELECT count(*)::int AS waiting FROM pg_stat_activity
         WHERE wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))`,
        [blockerPid],
      );
      if (rows[0].waiting > 0) return;
      if (Date.now() > deadline) {
        throw new Error(`nothing blocked on backend ${blockerPid} within 10s`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * `deleteAccount`, started now, settled as a value: a rejection is
   * captured rather than left unhandled while the test is still polling.
   */
  function startDeletion(
    userId: string,
  ): Promise<
    { result: Awaited<ReturnType<typeof deleteAccount>> } | { error: unknown }
  > {
    return deleteAccount(db, userId).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );
  }

  /** A Journey with a Draft, a Published Version, a Run, and a Response. */
  async function insertJourneyWithRunHistory(
    projectId: string,
    publishedBy: string,
  ): Promise<{ journeyId: string; versionId: string; runId: string }> {
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

    await db
      .insert(schema.journey)
      .values({ id: journeyId, projectId, title: "J" });
    await db.insert(schema.draft).values({ journeyId, document });
    await db.insert(schema.publishedVersion).values({
      id: versionId,
      journeyId,
      versionNumber: 1,
      document,
      publishedBy,
    });
    await db.insert(schema.run).values({
      id: runId,
      versionId,
      participantId: randomUUID(),
      path: ["start"],
    });
    await db
      .insert(schema.response)
      .values({ runId, stepId: "start", text: "hi" });

    return { journeyId, versionId, runId };
  }

  it("deletes the sole Project and everything in it, keeps the shared Project, nulls its published_by, and deletes the account", async () => {
    const author = await insertUser("author");
    const otherMember = await insertUser("other-member");

    const soleProject = await insertProject("Sole project");
    await addMember(soleProject, author);
    const { journeyId, versionId, runId } = await insertJourneyWithRunHistory(
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
    await db.insert(schema.session).values({
      id: sessionId,
      token: randomUUID(),
      userId: author,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const accountId = randomUUID();
    await db.insert(schema.account).values({
      id: accountId,
      accountId: randomUUID(),
      providerId: "google",
      userId: author,
    });

    const responsesOfRun = () =>
      db
        .select()
        .from(schema.response)
        .where(inArray(schema.response.runId, [runId]));

    // The Run's Response is there to be cascaded away.
    expect(await responsesOfRun()).toHaveLength(1);

    const result = await deleteAccount(db, author);
    expect(result).toEqual({ ok: true, deletedProjectIds: [soleProject] });

    // The sole Project and everything under it: gone.
    expect(await projectExists(soleProject)).toBe(false);
    expect(
      await db
        .select()
        .from(schema.journey)
        .where(inArray(schema.journey.id, [journeyId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.publishedVersion)
        .where(inArray(schema.publishedVersion.id, [versionId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.run)
        .where(inArray(schema.run.id, [runId])),
    ).toHaveLength(0);
    expect(await responsesOfRun()).toHaveLength(0);

    // The shared Project: intact, one Member left, its version's
    // `published_by` nulled with the Author's account.
    expect(await membersOf(sharedProject)).toEqual([otherMember]);

    const [sharedVersion] = await db
      .select({ publishedBy: schema.publishedVersion.publishedBy })
      .from(schema.publishedVersion)
      .where(inArray(schema.publishedVersion.id, [sharedVersionId]));
    expect(sharedVersion.publishedBy).toBeNull();

    // The Author's own rows: gone.
    expect(await userExists(author)).toBe(false);
    expect(
      await db
        .select()
        .from(schema.session)
        .where(inArray(schema.session.id, [sessionId])),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.account)
        .where(inArray(schema.account.id, [accountId])),
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
        .delete(schema.member)
        .where(inArray(schema.member.projectId, [soleProject]))
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

  it("waits out a member insert into a shared Project, then keeps that Project for its other Member", async () => {
    const author = await insertUser("racing-author");
    const otherMember = await insertUser("project-b-member");
    const projectB = await insertProject("Project B");
    await addMember(projectB, otherMember);

    const race = await connectRaceClient();
    try {
      await race.client.query("BEGIN");
      await race.client.query(
        'INSERT INTO "member" (project_id, user_id) VALUES ($1, $2)',
        [projectB, author],
      );

      // The insert holds KEY SHARE on the Author's user row, which the
      // deletion's first statement (`FOR UPDATE` on that row) waits for.
      const deletion = startDeletion(author);
      await waitUntilBlockedBy(race.pid);

      await race.client.query("COMMIT");

      expect(await deletion).toEqual({
        result: { ok: true, deletedProjectIds: [] },
      });
      expect(await userExists(author)).toBe(false);
      expect(await membersOf(projectB)).toEqual([otherMember]);
    } finally {
      await race.client.end();
    }
  });

  it("sees a removal of the Author that commits while it waits on the Project lock, and keeps the Project (F1)", async () => {
    const author = await insertUser("removed-author");
    const otherMember = await insertUser("project-s-member");
    const projectS = await insertProject("Project S");
    await addMember(projectS, author);
    await addMember(projectS, otherMember);

    const race = await connectRaceClient();
    try {
      // What `removeMember` does, stopped before its commit: the Project
      // locked, then the Author's membership deleted.
      await race.client.query("BEGIN");
      await race.client.query(
        'SELECT id FROM "project" WHERE id = $1 FOR UPDATE',
        [projectS],
      );
      await race.client.query(
        'DELETE FROM "member" WHERE project_id = $1 AND user_id = $2',
        [projectS, author],
      );

      // The deletion still reads the Author as S's Member (the removal is
      // uncommitted), and then waits on S's row lock.
      const deletion = startDeletion(author);
      await waitUntilBlockedBy(race.pid);

      await race.client.query("COMMIT");

      // After the lock, the re-read finds the Author no longer in S, whose
      // one Member left is someone else's: S stays.
      expect(await deletion).toEqual({
        result: { ok: true, deletedProjectIds: [] },
      });
      expect(await projectExists(projectS)).toBe(true);
      expect(await membersOf(projectS)).toEqual([otherMember]);
      expect(await userExists(author)).toBe(false);
    } finally {
      await race.client.end();
    }
  });

  it("waits out a Project created with the Author as its first Member, then deletes it as a sole Project (F2)", async () => {
    const author = await insertUser("creating-author");
    const projectP2 = randomUUID();
    projectIds.push(projectP2);

    const race = await connectRaceClient();
    try {
      // What `createProject` does, stopped before its commit.
      await race.client.query("BEGIN");
      await race.client.query(
        'INSERT INTO "project" (id, title) VALUES ($1, $2)',
        [projectP2, "Project P2"],
      );
      await race.client.query(
        'INSERT INTO "member" (project_id, user_id) VALUES ($1, $2)',
        [projectP2, author],
      );

      // The member insert holds KEY SHARE on the Author's user row, so the
      // deletion's `FOR UPDATE` on it waits for the commit, and every read
      // after it sees P2.
      const deletion = startDeletion(author);
      await waitUntilBlockedBy(race.pid);

      await race.client.query("COMMIT");

      // Neither a trigger error nor a memberless Project: P2, whose only
      // Member was the Author, goes with the account.
      expect(await deletion).toEqual({
        result: { ok: true, deletedProjectIds: [projectP2] },
      });
      expect(await projectExists(projectP2)).toBe(false);
      expect(await userExists(author)).toBe(false);
    } finally {
      await race.client.end();
    }
  });
});
