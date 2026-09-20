import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

import { graphDocumentSchema, isEnding } from "@/lib/graph/document";

import {
  SEED_JOURNEY_ID,
  SEED_JOURNEY_TITLE,
  SEED_PROJECT_ID,
  SEED_PROJECT_TITLE,
} from "../scripts/seed-case-3/ids";
import { uniqueSuffix } from "./setup/authoring";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 04: the seed script as a person runs it, and what an
 * Author sees afterwards.
 *
 * The script is run as a real child process against the e2e database — no
 * import, no stub — so its argument handling, its exit codes, and its
 * transaction are all exercised as written. It scrapes the live legacy site
 * each time, which is deliberate: the point of the seed is that the legacy
 * content arrives, and a spec that mocked the site away would not show that.
 *
 * `--write-fixture` is never passed here. The fixture is a committed artifact
 * of a deliberate run, not something an e2e run rewrites underneath it.
 */

// Two scrapes of 36 pages plus two browser navigations.
const SEED_TEST_TIMEOUT = 300_000;

const runCommand = promisify(execFile);

const mintedAuthorIds: string[] = [];

type SeedRun = { code: number; output: string };

/**
 * `loadE2eEnv()` — reached through the session helper's module load — has
 * already pointed `process.env.DATABASE_URL` at `journeys_e2e`, so the child
 * inherits the e2e database and never touches the dev one.
 */
async function runSeed(email: string): Promise<SeedRun> {
  try {
    const { stdout, stderr } = await runCommand(
      "pnpm",
      ["exec", "tsx", "scripts/seed-case-3/index.ts", email],
      {
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const failed = error as {
      code?: unknown;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: typeof failed.code === "number" ? failed.code : 1,
      output: `${failed.stdout ?? ""}${failed.stderr ?? ""}`,
    };
  }
}

function countSeedProjects(): Promise<Array<{ count: string }>> {
  return queryE2eDatabase<{ count: string }>(
    'SELECT count(*)::text AS count FROM "project" WHERE id = $1',
    [SEED_PROJECT_ID],
  );
}

/**
 * By title, not by id: a second run that failed to be idempotent would insert
 * a *new* Project row, which a count on the fixed primary key can never see.
 */
function countProjectsTitled(): Promise<Array<{ count: string }>> {
  return queryE2eDatabase<{ count: string }>(
    'SELECT count(*)::text AS count FROM "project" WHERE title = $1',
    [SEED_PROJECT_TITLE],
  );
}

function countJourneysTitled(): Promise<Array<{ count: string }>> {
  return queryE2eDatabase<{ count: string }>(
    'SELECT count(*)::text AS count FROM "journey" WHERE project_id = $1 AND title = $2',
    [SEED_PROJECT_ID, SEED_JOURNEY_TITLE],
  );
}

async function deleteSeedProject(): Promise<void> {
  // Cascades the Member, the Journey, and the Journey's Draft.
  await queryE2eDatabase('DELETE FROM "project" WHERE id = $1', [
    SEED_PROJECT_ID,
  ]);
}

test.afterAll(async () => {
  await deleteSeedProject();
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("seed-case-3", async ({ page, context }) => {
  test.setTimeout(SEED_TEST_TIMEOUT);

  // The e2e database persists between runs, so an earlier run's seed Project
  // must not be mistaken for this one's.
  await deleteSeedProject();

  const suffix = uniqueSuffix();

  // An email no user has: the script names it, writes nothing, and fails.
  const unknownEmail = `seed-nobody-${suffix}@example.com`;
  const refused = await runSeed(unknownEmail);

  expect(refused.code).not.toBe(0);
  expect(refused.output).toContain(unknownEmail);
  expect(await countSeedProjects()).toEqual([{ count: "0" }]);

  const author = await signInAs(context, {
    email: `seed-author-${suffix}@example.com`,
  });
  mintedAuthorIds.push(author.id);

  const seeded = await runSeed(author.email);
  expect(seeded.code, seeded.output).toBe(0);

  // Run again: seeding is something a person does repeatedly while editing
  // `outcomes.json`, so a second run has to update rather than duplicate.
  const reseeded = await runSeed(author.email);
  expect(reseeded.code, reseeded.output).toBe(0);

  expect(await countSeedProjects()).toEqual([{ count: "1" }]);
  expect(await countProjectsTitled()).toEqual([{ count: "1" }]);
  expect(await countJourneysTitled()).toEqual([{ count: "1" }]);
  expect(
    await queryE2eDatabase('SELECT id FROM "journey" WHERE id = $1', [
      SEED_JOURNEY_ID,
    ]),
  ).toEqual([{ id: SEED_JOURNEY_ID }]);
  expect(
    await queryE2eDatabase(
      'SELECT user_id FROM "member" WHERE project_id = $1 AND user_id = $2',
      [SEED_PROJECT_ID, author.id],
    ),
  ).toEqual([{ user_id: author.id }]);

  const drafts = await queryE2eDatabase<{ document: unknown }>(
    'SELECT document FROM "draft" WHERE journey_id = $1',
    [SEED_JOURNEY_ID],
  );
  expect(drafts).toHaveLength(1);
  const draft = graphDocumentSchema.parse(drafts[0].document);
  const steps = Object.values(draft.steps);
  expect(steps).toHaveLength(36);
  expect(draft.startStepId).toBe("step-7");

  // The shape of the live case, asserted where the scrape actually happens:
  // markup that changed under the converter shows up here as a lost Choice or
  // a Step that stopped being an Ending, not as a fixture that still passes.
  expect(steps.flatMap((step) => step.choices)).toHaveLength(50);
  expect(steps.filter((step) => isEnding(step)).map((step) => step.id)).toEqual(
    ["step-10", "step-20", "step-29", "step-30", "step-35", "step-36"],
  );

  // What the Author signed in as that email now sees.
  await page.goto("/projects");
  const projectItem = page
    .getByRole("listitem")
    .filter({ hasText: SEED_PROJECT_TITLE });
  await expect(projectItem).toBeVisible();
  await projectItem.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/projects/${SEED_PROJECT_ID}$`));

  const journeyItem = page
    .getByRole("listitem")
    .filter({ hasText: SEED_JOURNEY_TITLE });
  await expect(journeyItem).toBeVisible();
  await journeyItem.getByRole("link").click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${SEED_PROJECT_ID}/journeys/${SEED_JOURNEY_ID}$`),
  );

  await expect(page.getByText("36 steps · 3 outcomes")).toBeVisible();
  const startItem = page
    .getByRole("list", { name: "Steps" })
    .getByRole("listitem")
    .filter({ hasText: "Preface" });
  await expect(startItem).toHaveCount(1);
  await expect(startItem.getByText("Start", { exact: true })).toBeVisible();

  await page.screenshot({
    path: "test-results/seed-case-3/seed-case-3.png",
    fullPage: true,
  });
});
