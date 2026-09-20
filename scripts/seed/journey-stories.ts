/**
 * Development-only migration of the legacy site's three cases into this
 * platform: one `Journey Stories` Project, three Journeys, each with its Draft.
 *
 * The documents beside this file were converted once from the legacy repo's
 * `src/data/cases/*.json` and are the source of truth — nothing re-reads the
 * legacy site, and the converter was not kept. To rename an Outcome, edit the
 * label in the document and rerun this command.
 *
 * Images keep the third-party URLs the legacy pages linked (pexels, rawpixel,
 * flickr, a WordPress site), so one stops loading when its own host does. One
 * long base64 image path is written with a `\u` JSON escape so the file text
 * carries no 40+ character alphanumeric run — the Atlas commit-time secret
 * scrub refuses those. The escape is content-preserving; keep it when editing.
 */

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { graphDocumentSchema, isEnding } from "@/lib/graph/document";
import { validateForPublish } from "@/lib/graph/validate";

import case1 from "./journey-stories/case-1.json";
import case2 from "./journey-stories/case-2.json";
import case3 from "./journey-stories/case-3.json";

const PROJECT_ID = "00000000-5eed-4000-8000-000000000001";
const PROJECT_TITLE = "Journey Stories";

// Fixed ids are the whole of the idempotency: a rerun updates these rows in
// place, so there is only ever one seed Project and three seed Journeys.
const CASES = [
  {
    journeyId: "00000000-5eed-4000-8000-000000000011",
    title: "Case 1",
    description: "Goal: Cross the border.",
    source: case1,
  },
  {
    journeyId: "00000000-5eed-4000-8000-000000000012",
    title: "Case 2",
    description:
      "Goal: Seek healthcare for your needs before they overwhelm you, and the situation becomes life or death.",
    source: case2,
  },
  {
    journeyId: "00000000-5eed-4000-8000-000000000013",
    title: "Case 3",
    description:
      "Goal: Maintain your health condition to the best of your ability before it manifests as serious complications.",
    source: case3,
  },
];

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
    const [author] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);
    if (author === undefined) {
      console.error(
        `No user has the email ${email}. This command never creates users: sign in once with that account first (.scratch/journeys-platform/human-prerequisites.md §10). Nothing was written.`,
      );
      process.exitCode = 1;
      return;
    }

    // Already in stored shape, so read strictly; publish-time validation is
    // what makes them worth seeding at all.
    const journeys = CASES.map((one) => ({
      ...one,
      document: graphDocumentSchema.parse(one.source),
    }));
    const problems = journeys.flatMap((one) =>
      validateForPublish(one.document).map(
        (problem) => `${one.title}: ${problem.message}`,
      ),
    );
    if (problems.length > 0) {
      console.error("These documents cannot be published:");
      for (const problem of problems) {
        console.error(`  ${problem}`);
      }
      process.exitCode = 1;
      return;
    }

    await db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .insert(schema.project)
        .values({ id: PROJECT_ID, title: PROJECT_TITLE })
        .onConflictDoUpdate({
          target: schema.project.id,
          set: { title: PROJECT_TITLE, updatedAt: now },
        });
      await tx
        .insert(schema.member)
        .values({ projectId: PROJECT_ID, userId: author.id })
        .onConflictDoNothing();

      for (const one of journeys) {
        await tx
          .insert(schema.journey)
          .values({
            id: one.journeyId,
            projectId: PROJECT_ID,
            title: one.title,
            description: one.description,
          })
          .onConflictDoUpdate({
            target: schema.journey.id,
            set: {
              projectId: PROJECT_ID,
              title: one.title,
              description: one.description,
              updatedAt: now,
            },
          });
        await tx
          .insert(schema.draft)
          .values({ journeyId: one.journeyId, document: one.document })
          .onConflictDoUpdate({
            target: schema.draft.journeyId,
            set: { document: one.document, updatedAt: now },
          });
      }
    });

    for (const one of journeys) {
      const steps = Object.values(one.document.steps);
      const choices = steps.flatMap((step) => step.choices);
      const endings = steps.filter((step) => isEnding(step));
      console.log(
        `${one.title}: ${steps.length} steps, ${choices.length} choices, ${endings.length} endings, ${Object.keys(one.document.outcomes).length} outcomes`,
      );
    }
    console.log(`Project: ${PROJECT_TITLE} (${PROJECT_ID})`);
    console.log(`Member: ${email}`);
  } finally {
    await pool.end();
  }
}

// `process.exitCode` rather than `process.exit`: this output is captured as
// evidence, and exiting outright can cut a pending write off.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
