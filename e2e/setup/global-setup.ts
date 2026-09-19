import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { E2E_DATABASE_NAME, loadE2eEnv } from "./e2e-env";

/**
 * Playwright global setup: creates the dedicated `journeys_e2e` database if
 * it doesn't exist yet and applies the committed Drizzle migrations, before
 * any spec runs and before `webServer` starts Next against it. A fresh clone
 * (or a run after `pnpm db:down` / a fresh volume) needs no manual bootstrap
 * step.
 */
export default async function globalSetup(): Promise<void> {
  const { databaseUrl } = loadE2eEnv();
  await ensureDatabase(databaseUrl);
}

async function ensureDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");

  // A run against the dev database must never look like a pass: this suite
  // mints and deletes Authors against whatever database it's pointed at, so a
  // name-derivation bug pointing it at `journeys` would both corrupt real
  // data and let that bug pass silently.
  if (dbName !== E2E_DATABASE_NAME) {
    throw new Error(
      `ensureDatabase: expected database "${E2E_DATABASE_NAME}", got "${dbName}" — refusing to run against it`,
    );
  }

  // The name is derived from whatever DATABASE_URL is in scope, so a shell
  // exporting a Neon/staging URL would otherwise get a `journeys_e2e` created
  // on that server. Only an explicit E2E_DATABASE_URL may point off-box.
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!isLocal && !process.env.E2E_DATABASE_URL) {
    throw new Error(
      `ensureDatabase: refusing to create "${dbName}" on non-local host "${url.hostname}" — set E2E_DATABASE_URL explicitly to run e2e elsewhere`,
    );
  }

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";

  const maintenancePool = new pg.Pool({
    connectionString: maintenanceUrl.toString(),
  });
  try {
    try {
      // CREATE DATABASE can't be parameterized or run in a transaction;
      // dbName comes from our own constant above, never external input.
      await maintenancePool.query(`CREATE DATABASE "${dbName}"`);
    } catch (error) {
      // 42P04 duplicate_database: the database already exists (a prior run,
      // or a concurrent run that won the check-then-act race).
      if (!(error instanceof pg.DatabaseError) || error.code !== "42P04") {
        throw error;
      }
    }
  } finally {
    await maintenancePool.end();
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }

  // Never print credentials: host and port only, never the connection
  // string (which carries the password).
  console.log(`[e2e] database: ${dbName} on ${url.hostname}:${url.port}`);
}
