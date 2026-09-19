import "server-only";

import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import {
  drizzle as drizzleNode,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";

import { env } from "@/lib/env";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Deployed environments (Vercel + Neon) use the serverless websocket driver,
// which supports interactive transactions; publishing a version writes
// several rows at once and must not half-apply. It relies on the global
// WebSocket available in Node >= 22 (enforced by package.json engines).
// Locally we talk to Docker Postgres over TCP. Both expose the same Drizzle
// PgDatabase API, so the Neon variant is safely presented as Db.
export const db: Db = process.env.VERCEL
  ? (drizzleNeon({
      client: new NeonPool({ connectionString: env.DATABASE_URL }),
      schema,
    }) as unknown as Db)
  : drizzleNode({
      client: new PgPool({ connectionString: env.DATABASE_URL }),
      schema,
    });
