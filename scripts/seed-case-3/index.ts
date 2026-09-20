import { writeFileSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// `@/db/schema` only — never `@/db`, `@/lib/env`, or `@/lib/auth`. Those
// import `server-only`, which throws outside a React Server context, and the
// startup env validation would demand OAuth values a seed never needs.
import * as schema from "@/db/schema";
import { isEnding, prepareDocumentForWrite } from "@/lib/graph/document";
import { validateForPublish } from "@/lib/graph/validate";

import { readArguments, USAGE } from "./arguments";
import {
  buildGraphDocument,
  convertStepPage,
  outcomeMappingSchema,
} from "./convert";
import type { ScrapedStep } from "./convert";
import { serializeFixture } from "./fixture";
import {
  SEED_JOURNEY_DESCRIPTION,
  SEED_JOURNEY_ID,
  SEED_JOURNEY_TITLE,
  SEED_PROJECT_ID,
  SEED_PROJECT_TITLE,
} from "./ids";
import outcomesMapping from "./outcomes.json";
import { CASE_3_START_STEP, scrapeCase3 } from "./scrape";

/**
 * Seeds the legacy site's case 3 as a Journey Draft in a seed Project.
 *
 * Development only, and deliberately throwaway: it scrapes the markup the
 * legacy Astro site emits today (see `convert.ts`). Nothing is copied — every
 * seeded image points at the third-party host the legacy page itself linked
 * (pexels, rawpixel, flickr, one WordPress site), so an image stops loading
 * when its own host does, not when the legacy site goes away.
 *
 * `outcomes.json` beside this file is the hand-written map from each legacy
 * Ending to an Outcome; it is the file a human edits to rename an Outcome,
 * and this script refuses to write anything it does not cover.
 *
 *   pnpm seed:case-3 <author-email> [--write-fixture]
 *
 * Exit codes: 0 seeded, 1 refused (no such user, a scrape or validation
 * problem), 2 wrong usage. The named user must already exist — signing people
 * in is better-auth's job, never this script's.
 */

const FIXTURE_PATH = "src/lib/graph/fixtures/case-3.json";

/** Host and port only: a connection string carries a password. */
function describeDatabase(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `${url.hostname}:${url.port === "" ? "5432" : url.port}`;
}

async function main(): Promise<number> {
  const parsed = readArguments(process.argv.slice(2));
  if (parsed === null) {
    console.error(USAGE);
    return 2;
  }

  // Before anything else: a hand-edited mapping that is the wrong shape
  // should be named here, not read as `undefined` halfway through a build.
  const mapping = outcomeMappingSchema.safeParse(outcomesMapping);
  if (!mapping.success) {
    console.error("outcomes.json is not in the expected shape:");
    for (const issue of mapping.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    return 1;
  }

  // No override, exactly like `drizzle.config.ts`: an explicit DATABASE_URL
  // in the environment (a one-off against Neon staging, the e2e harness) wins
  // over the local file.
  config({ path: ".env.local" });
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error(
      "DATABASE_URL is not set (checked .env.local and the process environment)",
    );
    return 1;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(pool, { schema });
    console.log(`Database: ${describeDatabase(databaseUrl)}`);

    // Before scraping: a run that is going to be refused should not spend a
    // minute on the legacy site first.
    const authors = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, parsed.email));
    const author = authors[0];
    if (author === undefined) {
      console.error(
        `No user has the email ${parsed.email}. This script never creates users: sign in once as that account first (see .scratch/journeys-platform/human-prerequisites.md, §10), then run it again. Nothing was written.`,
      );
      return 1;
    }

    console.log(
      `Scraping the legacy case-3 pages from step ${CASE_3_START_STEP}…`,
    );
    const fetched = await scrapeCase3();
    console.log(`Read ${fetched.length} pages.`);

    const scrapedSteps: ScrapedStep[] = fetched.map((page) => ({
      step: page.step,
      ...convertStepPage(page.html),
    }));

    const built = buildGraphDocument(
      scrapedSteps,
      mapping.data,
      CASE_3_START_STEP,
    );
    for (const warning of built.warnings) {
      console.warn(`Warning: ${warning}`);
    }
    if (!built.ok) {
      console.error("Refusing to seed — outcomes.json needs an edit:");
      for (const problem of built.problems) {
        console.error(`  - ${problem}`);
      }
      return 1;
    }

    // Sanitized on the way in, so what is stored is the stored shape and
    // nothing else — the same path every Author write takes.
    const prepared = prepareDocumentForWrite(built.document);
    if (!prepared.ok) {
      console.error(
        `Refusing to seed — the document was rejected: ${prepared.error}`,
      );
      return 1;
    }

    const problems = validateForPublish(prepared.document);
    if (problems.length > 0) {
      console.error("Refusing to seed — the document would not pass publish:");
      for (const problem of problems) {
        console.error(`  - [${problem.code}] ${problem.message}`);
      }
      return 1;
    }

    const document = prepared.document;
    if (parsed.writeFixture) {
      const fixture = path.join(process.cwd(), FIXTURE_PATH);
      writeFileSync(fixture, serializeFixture(document));
      console.log(`Wrote ${FIXTURE_PATH}.`);
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.project)
        .values({ id: SEED_PROJECT_ID, title: SEED_PROJECT_TITLE })
        .onConflictDoUpdate({
          target: schema.project.id,
          set: { title: SEED_PROJECT_TITLE, updatedAt: now },
        });

      // A seed Project that already exists gains this Author as a Member;
      // one that already has them is left alone.
      await tx
        .insert(schema.member)
        .values({ projectId: SEED_PROJECT_ID, userId: author.id })
        .onConflictDoNothing();

      await tx
        .insert(schema.journey)
        .values({
          id: SEED_JOURNEY_ID,
          projectId: SEED_PROJECT_ID,
          title: SEED_JOURNEY_TITLE,
          description: SEED_JOURNEY_DESCRIPTION,
        })
        .onConflictDoUpdate({
          target: schema.journey.id,
          set: {
            projectId: SEED_PROJECT_ID,
            title: SEED_JOURNEY_TITLE,
            description: SEED_JOURNEY_DESCRIPTION,
            updatedAt: now,
          },
        });

      await tx
        .insert(schema.draft)
        .values({ journeyId: SEED_JOURNEY_ID, document })
        .onConflictDoUpdate({
          target: schema.draft.journeyId,
          set: { document, updatedAt: now },
        });
    });

    const steps = Object.values(document.steps);
    const stepCount = steps.length;
    const choiceCount = steps.reduce(
      (total, step) => total + step.choices.length,
      0,
    );
    const endingCount = steps.filter((step) => isEnding(step)).length;
    const outcomeCount = Object.keys(document.outcomes).length;

    console.log(
      `Seeded ${stepCount} steps, ${choiceCount} choices, ${endingCount} endings, ${outcomeCount} outcomes.`,
    );
    console.log(`Project ${SEED_PROJECT_ID} "${SEED_PROJECT_TITLE}"`);
    console.log(`Journey ${SEED_JOURNEY_ID} "${SEED_JOURNEY_TITLE}"`);
    // The email only: the Author's display name is a person's name, and this
    // output is captured as evidence.
    console.log(`Member: ${parsed.email}`);
    return 0;
  } finally {
    await pool.end();
  }
}

// `process.exitCode` rather than `process.exit`: the e2e spec reads this
// process's piped stdout, and exiting outright can cut a pending write off.
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
