import { expect, test } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishableDocument,
  START_STEP_ID,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 05's Preview (AC-5): walking a Draft from Start to an
 * Ending records nothing, and only a Member can open Preview at all.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("preview", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  await writeDraftDocument(journeyId, publishableDocument());

  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
  await page.goto(journeyPath);
  await page.getByRole("link", { name: "Preview" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}/preview`);
  await expect(page.getByRole("heading", { name: journeyTitle })).toBeVisible();
  await expect(
    page.getByText("Preview — nothing you do here is recorded."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Begin" }).click();
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}${journeyPath}/preview/${START_STEP_ID}`,
  );
  await expect(
    page.getByRole("heading", { name: START_STEP_TITLE }),
  ).toBeVisible();
  await expect(
    page.getByText("The queue has not moved in an hour."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Wait your turn" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Walk away" })).toBeVisible();

  await page.getByRole("link", { name: "Wait your turn" }).click();
  await expect(
    page.getByRole("heading", { name: "Waved through" }),
  ).toBeVisible();
  await expect(page.getByText("The end")).toBeVisible();
  await expect(page.getByText("Outcome: Reached care")).toBeVisible();

  await page.screenshot({
    path: "test-results/preview/preview.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Start over" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}/preview`);

  // Nothing exists that Preview could have written to.
  const runTables = await queryE2eDatabase(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('run', 'response')",
  );
  expect(runTables).toHaveLength(0);
});

test("preview-non-member", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);
  await writeDraftDocument(journeyId, publishableDocument());

  const previewPath = `/projects/${projectId}/journeys/${journeyId}/preview`;
  const stepPath = `${previewPath}/${START_STEP_ID}`;

  // A second Author, in a browser context of their own: neither preview
  // route is visible to a non-Member.
  const strangerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const stranger = await signInAs(strangerContext);
    mintedAuthorIds.push(stranger.id);
    const strangerPage = await strangerContext.newPage();

    const startResponse = await strangerPage.goto(previewPath);
    expect(startResponse?.status()).toBe(404);

    const stepResponse = await strangerPage.goto(stepPath);
    expect(stepResponse?.status()).toBe(404);

    await strangerPage.screenshot({
      path: "test-results/preview-non-member/preview-non-member.png",
      fullPage: true,
    });
  } finally {
    await strangerContext.close();
  }

  // Signed out, nobody reaches the 404: the proxy bounces the request to
  // the landing page before the route runs at all.
  const signedOutContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const signedOutPage = await signedOutContext.newPage();
    await signedOutPage.goto(previewPath);
    expect(signedOutPage.url()).toBe(`${E2E_BASE_URL}/`);
  } finally {
    await signedOutContext.close();
  }
});
