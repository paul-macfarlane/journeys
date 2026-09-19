import { createHmac, randomUUID } from "node:crypto";

import type { BrowserContext } from "@playwright/test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// `@/db/schema` only (never `@/lib/auth`, `@/lib/env`, or `@/db`): those
// three import `server-only`, which throws when imported outside a React
// Server context. This builds an equivalent better-auth instance directly,
// against the e2e database, using nothing but the plain Drizzle schema.
import * as schema from "@/db/schema";

import { E2E_BASE_URL, loadE2eEnv } from "./e2e-env";

// The e2e overrides, applied once per worker process at module load — the
// same values `playwright.config.ts` hands the Next server it starts, so a
// minted cookie authenticates against the exact server a spec's `page.goto`
// will hit, against the e2e database rather than the dev one.
loadE2eEnv();

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("session helper: BETTER_AUTH_SECRET is not set");
}

// Created lazily and recreated after `closePools()`: Playwright reuses a
// worker process across spec files, so a pool ended by one file's `afterAll`
// must not poison the next file that mints an Author.
let pool: pg.Pool | null = null;
let auth: ReturnType<typeof createAuth> | null = null;

function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

function createAuth() {
  return betterAuth({
    baseURL: E2E_BASE_URL,
    secret,
    database: drizzleAdapter(drizzle(getPool(), { schema }), {
      provider: "pg",
      schema,
    }),
  });
}

function getAuth() {
  auth ??= createAuth();
  return auth;
}

const SESSION_COOKIE_NAME = "better-auth.session_token";

export type MintedAuthor = { id: string; email: string; name: string };

export type MintedCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
};

type MintOverrides = {
  email?: string;
  name?: string;
};

/**
 * Signs a session token the way better-auth's cookie verification expects.
 *
 * The pinned better-auth (1.7.5) ships `signCookieValue`/`createCookieHeaders`
 * helpers, but not at the public `better-auth/test-utils` entry point: that
 * entry (`dist/test-utils/index.mjs`) exports only `getTestInstance`,
 * `createHttpTestServer`, `getHttpTestInstance`, and
 * `convertSetCookieToCookie`. The cookie-signing helpers live in
 * `dist/plugins/test-utils/cookie-builder.mjs`, a path `package.json`'s
 * `exports` map never lists — there is no `better-auth/plugins/test-utils`
 * subpath export — so importing it isn't a supported path. Hand-rolled
 * instead, matching better-call's own verification: standard-alphabet
 * (not URL-safe) base64 of HMAC-SHA256(secret, token).
 */
function signSessionToken(token: string, tokenSecret: string): string {
  const signature = createHmac("sha256", tokenSecret)
    .update(token)
    .digest("base64");
  return `${token}.${signature}`;
}

/**
 * Mints a real better-auth session through better-auth's own internal
 * adapter — no OAuth, no test-only auth provider. Each call creates a
 * distinct Author (unique email), so tests that mint independently never
 * collide.
 */
export async function mintSession(
  overrides: MintOverrides = {},
): Promise<{ user: MintedAuthor; cookie: MintedCookie }> {
  const ctx = await getAuth().$context;

  const user = await ctx.internalAdapter.createUser(
    {
      email: overrides.email ?? `author-${randomUUID()}@example.com`,
      name: overrides.name ?? "Test Author",
      emailVerified: true,
    },
    // Provisioning source: `validateUserInfo` isn't configured, so this is
    // never inspected, but the type requires a method — "e2e-seed" names
    // this seam rather than misusing one of better-auth's own flow names.
    { method: "e2e-seed" },
  );
  const session = await ctx.internalAdapter.createSession(user.id);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    cookie: {
      name: SESSION_COOKIE_NAME,
      value: signSessionToken(session.token, ctx.secret),
      domain: "localhost",
      path: "/",
    },
  };
}

/**
 * Mints a session and drops it straight into the browser context's cookie
 * jar. Every spec authenticates this way instead of driving real OAuth —
 * there is no headless IdP to drive against, and both real providers are
 * only ever configured, never exercised.
 */
export async function signInAs(
  context: BrowserContext,
  overrides?: MintOverrides,
): Promise<MintedAuthor> {
  const { user, cookie } = await mintSession(overrides);
  await context.addCookies([cookie]);
  return user;
}

/**
 * Specs must remove what they create — the e2e database persists between
 * runs rather than being torn down after each. Cascades to session rows via
 * the schema's `ON DELETE CASCADE`.
 */
export async function cleanup(authorIds: string[]): Promise<void> {
  if (authorIds.length === 0) return;
  await getPool().query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    authorIds,
  ]);
}

/**
 * Closes the helper's own database connection once a spec file is done. Safe
 * to call from every spec file: the next mint in this worker reconnects.
 */
export async function closePools(): Promise<void> {
  const current = pool;
  pool = null;
  auth = null;
  await current?.end();
}
