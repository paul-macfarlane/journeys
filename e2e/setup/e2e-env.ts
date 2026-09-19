/**
 * The e2e stack's own environment: a dedicated database and a dedicated
 * port, so `pnpm test:e2e` never touches the dev database or a running
 * `pnpm dev`.
 *
 * Everything else — secrets, OAuth client pairs — still comes from
 * `.env.local` (or, in CI, the job's own env), so there is no second file of
 * credentials to keep in sync.
 */

import { config } from "dotenv";

/** Distinct from `pnpm dev`'s 3000 so both stacks can run at once. */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_DATABASE_NAME = "journeys_e2e";

/**
 * The dev `DATABASE_URL` with its database name swapped for the dedicated
 * e2e one — derived rather than hardcoded so it follows whichever host and
 * port the rest of the repo already points at (Docker locally, the CI
 * service container). Pure: the optional override is a parameter, so the
 * function can be exercised directly. `loadE2eEnv` passes `E2E_DATABASE_URL`
 * for anyone who needs to point somewhere else entirely.
 */
export function getE2eDatabaseUrl(
  devDatabaseUrl: string,
  override: string | undefined = undefined,
): string {
  if (override) return override;

  const url = new URL(devDatabaseUrl);
  url.pathname = `/${E2E_DATABASE_NAME}`;
  return url.toString();
}

/**
 * Loads `.env.local` into `process.env` (no override — an explicit
 * `DATABASE_URL` already in the environment wins, which is what lets CI run
 * with no `.env.local` at all), then applies the e2e overrides on top.
 *
 * Called by `playwright.config.ts` (to build `webServer.env`), by global
 * setup (to create and migrate the database), and by the spec-side session
 * helper (which opens its own connection to mint and clean up Authors).
 */
export function loadE2eEnv(): { databaseUrl: string } {
  config({ path: ".env.local" });

  const devDatabaseUrl = process.env.DATABASE_URL;
  if (!devDatabaseUrl) {
    throw new Error(
      "loadE2eEnv: DATABASE_URL is not set (checked .env.local and the process environment)",
    );
  }

  const databaseUrl = getE2eDatabaseUrl(
    devDatabaseUrl,
    process.env.E2E_DATABASE_URL,
  );
  process.env.DATABASE_URL = databaseUrl;
  // better-auth rejects a state-changing request whose Origin doesn't match
  // its configured base URL, and the e2e server runs on its own port.
  process.env.BETTER_AUTH_URL = E2E_BASE_URL;

  return { databaseUrl };
}
