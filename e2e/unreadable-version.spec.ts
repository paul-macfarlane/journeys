import { expect, test } from "@playwright/test";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  publishableDocument,
  publishRawDocument,
  writeDraftDocument,
  START_STEP_TITLE,
} from "./setup/documents";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Ticket 83: a Published Version whose row fails the document contract.
 * The runner shows the same unavailable page a never-published Journey
 * gets (status 200, not 500) rather than starting a Run against it, and
 * the Author's Journey page keeps working around it — the Editor tab loads
 * the Draft's canvas, and the Versions tab names the version that cannot
 * be read.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("unreadable-version", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const journeyTitle = `Border Crossing ${suffix}`;
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // A readable Draft, so the Editor tab still has something to show.
  await writeDraftDocument(journeyId, publishableDocument());

  // A live Published Version whose row the document contract refuses.
  await publishRawDocument(journeyId, {
    schemaVersion: 1,
    steps: "broken",
  });

  // The runner: not a 500, and the same screen a never-published Journey
  // shows — no Run is started against a version that cannot be read.
  const runnerResponse = await page.goto(`/j/${journeyId}`);
  expect(runnerResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "This journey isn't available" }),
  ).toBeVisible();

  await page.screenshot({
    path: evidencePath("unreadable-version", "runner-unavailable.png"),
    fullPage: true,
  });

  // The Author's Journey page: not a 500 either. The Editor tab still
  // loads the Draft's canvas —
  const journeyResponse = await page.goto(
    `/projects/${projectId}/journeys/${journeyId}`,
  );
  expect(journeyResponse?.status()).toBe(200);
  await expect(page.getByLabel("Step title")).toHaveValue(START_STEP_TITLE);

  // — and the Versions tab names the version that cannot be read.
  await openTab(page, "Versions");
  const notice = page.getByRole("region", {
    name: "Version 1 can't be read",
  });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Version 1");

  await page.screenshot({
    path: evidencePath("unreadable-version", "unreadable-version.png"),
    fullPage: true,
  });
});
