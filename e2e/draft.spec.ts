import { expect, test } from "@playwright/test";

import { graphDocumentSchema } from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";

import {
  createJourney,
  createProject,
  openFindStep,
  uniqueSuffix,
} from "./setup/authoring";
import { readDraftRow } from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
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

test("journey-draft", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  // Creating lands on the Journey page (ticket 47).
  const journeyId = await createJourney(page, projectId, journeyTitle);
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectId}/journeys/${journeyId}`,
  );

  // A Journey that was only just created already has a Draft to show.
  await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();
  await expect(page.getByText("1 step · 0 outcomes")).toBeVisible();

  await openFindStep(page);
  const stepOptions = page
    .getByRole("listbox", { name: "Steps" })
    .getByRole("option");
  await expect(stepOptions).toHaveCount(1);

  // The one Step is titled "Start", is the Start, and — having no Choices
  // yet — is also an Ending, so "Start" reads twice: once as its title and
  // once as its badge.
  await expect(stepOptions.getByText("Start", { exact: true })).toHaveCount(2);
  await expect(stepOptions.getByText("Ending", { exact: true })).toBeVisible();

  // What the page summarizes is what the row holds.
  const created = await readDraftRow(journeyId);
  const draft = graphDocumentSchema.parse(created.document);
  const stepIds = Object.keys(draft.steps);
  expect(stepIds).toHaveLength(1);
  expect(draft.startStepId).toBe(stepIds[0]);
  expect(draft.steps[draft.startStepId].title).toBe("Start");

  // A journey at the size a real one reaches, written straight into the row:
  // building 44 Steps through the panel would make this a spec about the
  // editor, and what is under test here is the round trip through the column.
  await queryE2eDatabase(
    'UPDATE "draft" SET document = $1::jsonb WHERE journey_id = $2',
    [JSON.stringify(largeJourney), journeyId],
  );
  await page.reload();

  await expect(page.getByText("44 steps · 3 outcomes")).toBeVisible();
  await openFindStep(page);
  const startOption = page
    .getByRole("listbox", { name: "Steps" })
    .getByRole("option")
    .filter({ hasText: "The light fails" });
  await expect(startOption).toHaveCount(1);
  await expect(startOption.getByText("Start", { exact: true })).toBeVisible();

  // The round trip that matters: stored and read back, unchanged.
  const stored = await readDraftRow(journeyId);
  expect(stored.document).toEqual(largeJourney);

  await page.screenshot({
    path: evidencePath("journey-draft", "journey-draft.png"),
    fullPage: true,
  });
});
