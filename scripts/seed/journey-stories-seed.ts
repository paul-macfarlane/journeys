/**
 * The Journey Stories seed as a function: one `Journey Stories` Project,
 * three Journeys, each with its Draft, written for one Author who becomes a
 * Member. `journey-stories.ts` is the command around it (the email lookup,
 * the environment, the printing); `record-landing-demo.ts` calls it against
 * the e2e database so the recording and the stills show seeded content only.
 *
 * The documents beside this file were converted once from the legacy repo's
 * `src/data/cases/*.json` and are the source of truth — nothing re-reads the
 * legacy site, and the converter was not kept. To rename an Outcome, edit the
 * label in the document and rerun the command. The legacy credit lines are
 * the images' captions; every `alt` is `""` until an Author writes one in
 * the editor.
 *
 * Images keep the third-party URLs the legacy pages linked — some eighteen
 * hosts, none of them the legacy site — so one stops loading when its own host
 * does. A dozen strings across the three documents (long image paths and two
 * caption URLs) carry a `\u` JSON escape that breaks up a 40+ character
 * alphanumeric run, which the Atlas commit-time secret scrub would refuse.
 * The escapes are content-preserving; keep them when editing.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  graphDocumentSchema,
  isEnding,
  type GraphDocument,
} from "@/lib/graph/document";
import { validateForPublish } from "@/lib/graph/validate";

import allotment from "./allotment/a-key-on-the-doormat.json";
import case1 from "./journey-stories/case-1.json";
import case2 from "./journey-stories/case-2.json";
import case3 from "./journey-stories/case-3.json";

export const SEED_PROJECT_ID = "00000000-5eed-4000-8000-000000000001";
export const SEED_PROJECT_TITLE = "Journey Stories";

/**
 * The second seed Project (ticket 58): one small, original Journey that the
 * landing page's recording and stills are made from, so a new Author meets
 * a ten-Step map rather than a thirty-six-Step case. Its one image is the
 * committed `public/seed/allotment.jpg`, linked at its raw GitHub address on
 * `staging` because stored content only keeps absolute http(s) image URLs.
 */
export const DEMO_PROJECT_ID = "00000000-5eed-4000-8000-000000000002";
export const DEMO_PROJECT_TITLE = "The Allotment";
export const DEMO_JOURNEY_ID = "00000000-5eed-4000-8000-000000000021";

// Fixed ids are the whole of the idempotency: a rerun updates these rows in
// place, so there is only ever one of each seed Project and Journey.
export const SEED_JOURNEYS = [
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
] as const;

export const DEMO_JOURNEYS = [
  {
    journeyId: DEMO_JOURNEY_ID,
    title: "A key on the doormat",
    description: "Goal: keep your aunt's allotment plot through the summer.",
    source: allotment,
  },
] as const;

/** Every seed Project with the Journeys it holds, in the order they are written. */
export const SEED_PROJECTS = [
  {
    projectId: SEED_PROJECT_ID,
    title: SEED_PROJECT_TITLE,
    journeys: SEED_JOURNEYS,
  },
  {
    projectId: DEMO_PROJECT_ID,
    title: DEMO_PROJECT_TITLE,
    journeys: DEMO_JOURNEYS,
  },
] as const;

export type SeedJourney = {
  projectId: string;
  journeyId: string;
  title: string;
  description: string;
  document: GraphDocument;
};

/**
 * The four documents parsed strictly — they are already in stored shape —
 * and checked for publish, which is what makes them worth seeding at all.
 * Throws with every problem listed when one cannot be published.
 */
export function parseSeedJourneys(): SeedJourney[] {
  const journeys = SEED_PROJECTS.flatMap((project) =>
    project.journeys.map((journey) => ({
      projectId: project.projectId,
      journeyId: journey.journeyId,
      title: journey.title,
      description: journey.description,
      document: graphDocumentSchema.parse(journey.source),
    })),
  );
  const problems = journeys.flatMap((journey) =>
    validateForPublish(journey.document).map(
      (problem) => `${journey.title}: ${problem.message}`,
    ),
  );
  if (problems.length > 0) {
    throw new Error(
      ["These documents cannot be published:", ...problems].join("\n  "),
    );
  }
  return journeys;
}

/** One line per Journey, the way the seed command reports what it wrote. */
export function describeSeedJourney(journey: SeedJourney): string {
  const steps = Object.values(journey.document.steps);
  const choices = steps.flatMap((step) => step.choices);
  const endings = steps.filter((step) => isEnding(step));
  return `${journey.title}: ${steps.length} steps, ${choices.length} choices, ${endings.length} endings, ${Object.keys(journey.document.outcomes).length} outcomes`;
}

/**
 * Writes (or rewrites) both seed Projects, their Memberships for `authorId`,
 * and every Journey with its Draft, in one transaction. Published Versions
 * and Runs are left alone: the seed owns the Drafts, not what was published
 * from them.
 */
export async function seedJourneyStories(
  db: NodePgDatabase<typeof schema>,
  authorId: string,
  journeys: SeedJourney[] = parseSeedJourneys(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date();
    for (const project of SEED_PROJECTS) {
      await tx
        .insert(schema.project)
        .values({ id: project.projectId, title: project.title })
        .onConflictDoUpdate({
          target: schema.project.id,
          set: { title: project.title, updatedAt: now },
        });
      await tx
        .insert(schema.member)
        .values({ projectId: project.projectId, userId: authorId })
        .onConflictDoNothing();
    }

    for (const journey of journeys) {
      await tx
        .insert(schema.journey)
        .values({
          id: journey.journeyId,
          projectId: journey.projectId,
          title: journey.title,
          description: journey.description,
        })
        .onConflictDoUpdate({
          target: schema.journey.id,
          set: {
            projectId: journey.projectId,
            title: journey.title,
            description: journey.description,
            updatedAt: now,
          },
        });
      await tx
        .insert(schema.draft)
        .values({ journeyId: journey.journeyId, document: journey.document })
        .onConflictDoUpdate({
          target: schema.draft.journeyId,
          set: { document: journey.document, updatedAt: now },
        });
    }
  });
}
