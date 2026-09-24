/**
 * Development-only migration of the legacy site's three cases into this
 * platform: one `Journey Stories` Project, three Journeys, each with its Draft.
 *
 * The seed itself — the fixed ids, the documents, the writes — is
 * `journey-stories-seed.ts`, shared with the landing-demo recording; this
 * file is the command around it: the Author looked up by email, the database
 * from the environment, and the summary printed for the evidence capture.
 */

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

import {
  describeSeedJourney,
  parseSeedJourneys,
  SEED_PROJECTS,
  seedJourneyStories,
} from "./journey-stories-seed";

async function main(): Promise<void> {
  const [email, ...rest] = process.argv.slice(2);
  if (email === undefined || email.startsWith("-") || rest.length > 0) {
    console.error("Usage: pnpm seed:journey-stories <author-email>");
    process.exitCode = 2;
    return;
  }

  // No override: an explicit DATABASE_URL (Neon staging, a one-off) must win
  // over the local file, exactly as drizzle.config.ts reads it.
  config({ path: ".env.local" });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set (.env.local or the environment)");
    process.exitCode = 1;
    return;
  }

  // The host and port only: the connection string carries a password, and
  // this output is captured as evidence.
  const target = new URL(connectionString);
  console.log(`Database: ${target.hostname}:${target.port || "5432"}`);

  const pool = new Pool({ connectionString });
  // Only the schema: `@/db`, `@/lib/env`, and `@/lib/auth` import
  // `server-only`, which throws outside React.
  const db = drizzle(pool, { schema });

  try {
    // better-auth stores emails lowercased; a pasted argument may not be.
    const [author] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email.trim().toLowerCase()))
      .limit(1);
    if (author === undefined) {
      console.error(
        `No user has the email ${email}. This command never creates users: sign in once with that account first (.scratch/journeys-platform/human-prerequisites.md §10). Nothing was written.`,
      );
      process.exitCode = 1;
      return;
    }

    let journeys;
    try {
      journeys = parseSeedJourneys();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
      return;
    }

    await seedJourneyStories(db, author.id, journeys);

    for (const journey of journeys) {
      console.log(describeSeedJourney(journey));
    }
    for (const project of SEED_PROJECTS) {
      console.log(`Project: ${project.title} (${project.projectId})`);
    }
    console.log(`Member: ${email}`);
  } finally {
    await pool.end();
  }
}

// `process.exitCode` rather than `process.exit`: this output is captured as
// evidence, and exiting outright can cut a pending write off. The whole error
// is printed, stack included: for a development-only command the stack is the
// useful part.
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
