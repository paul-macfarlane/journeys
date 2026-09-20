import { expect, test } from "@playwright/test";

import { graphDocumentSchema } from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import { E2E_BASE_URL } from "./setup/e2e-env";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 03: a Journey's Draft, from the browser and from the row
 * it is stored in.
 *
 * Creating a Journey has to leave a Draft behind — one Start Step and nothing
 * else — and a real-sized document has to survive the trip through the jsonb
 * column unchanged. The page shows a summary of the Draft, not the document,
 * so what was actually written is read back from the row.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  // Deleting the Project cascades its Journeys, and each Journey its Draft.
  await cleanup(mintedAuthorIds);
  await closePools();
});

type DraftRow = { document: unknown };

function readDraftRow(journeyId: string): Promise<DraftRow[]> {
  return queryE2eDatabase<DraftRow>(
    'SELECT document FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
}

test("journey-draft", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  await page
    .getByRole("listitem")
    .filter({ hasText: journeyTitle })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectId}/journeys/${journeyId}`,
  );

  // A Journey that was only just created already has a Draft to show.
  await expect(page.getByRole("heading", { name: "Draft" })).toBeVisible();
  await expect(page.getByText("1 step · 0 outcomes")).toBeVisible();

  const stepItems = page
    .getByRole("list", { name: "Steps" })
    .getByRole("listitem");
  await expect(stepItems).toHaveCount(1);

  // The one Step is titled "Start", is the Start, and — having no Choices
  // yet — is also an Ending, so "Start" reads twice: once as its title and
  // once as its badge.
  await expect(stepItems.getByText("Start", { exact: true })).toHaveCount(2);
  await expect(stepItems.getByText("Ending", { exact: true })).toBeVisible();

  // What the page summarizes is what the row holds.
  const created = await readDraftRow(journeyId);
  expect(created).toHaveLength(1);

  const draft = graphDocumentSchema.parse(created[0].document);
  const stepIds = Object.keys(draft.steps);
  expect(stepIds).toHaveLength(1);
  expect(draft.startStepId).toBe(stepIds[0]);
  expect(draft.steps[draft.startStepId].title).toBe("Start");

  // A journey at the size a real one reaches, written straight into the row:
  // the editor arrives with a later ticket, so this is the only way to put a
  // document of this size in front of the page today.
  await queryE2eDatabase(
    'UPDATE "draft" SET document = $1::jsonb WHERE journey_id = $2',
    [JSON.stringify(largeJourney), journeyId],
  );
  await page.reload();

  await expect(page.getByText("44 steps · 3 outcomes")).toBeVisible();
  const startItem = page
    .getByRole("list", { name: "Steps" })
    .getByRole("listitem")
    .filter({ hasText: "The light fails" });
  await expect(startItem).toHaveCount(1);
  await expect(startItem.getByText("Start", { exact: true })).toBeVisible();

  // The round trip that matters: stored and read back, unchanged.
  const stored = await readDraftRow(journeyId);
  expect(stored).toHaveLength(1);
  expect(stored[0].document).toEqual(largeJourney);

  await page.screenshot({
    path: "test-results/journey-draft/journey-draft.png",
    fullPage: true,
  });
});
