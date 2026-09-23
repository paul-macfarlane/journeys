import { expect, test } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishableDocument,
  START_STEP_ID,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
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
  // Preview sits under the Author navbar (ticket 29), so the page has two
  // banner landmarks; the frame's own header is the one without the App nav.
  const frameHeader = page
    .getByRole("banner")
    .filter({ hasNot: page.getByRole("navigation", { name: "App" }) });
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

  // Preview opens on the Draft's Start Step in the participant runner's own
  // frame — title in the header, the Step's content and Choices — with only
  // the banner and its way back to the editor telling it apart.
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}/preview`);
  await expect(frameHeader).toHaveText(journeyTitle);
  await expect(page.getByText("Preview — nothing is recorded.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to editor" }),
  ).toHaveAttribute("href", journeyPath);
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
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}${journeyPath}/preview/waved-through`,
  );
  await expect(
    page.getByRole("heading", { name: "Waved through" }),
  ).toBeVisible();
  await expect(page.getByText("The end")).toBeVisible();
  await expect(page.getByText("Outcome: Reached care")).toBeVisible();
  // The same frame on every Step: title and banner travel with the walk.
  await expect(frameHeader).toHaveText(journeyTitle);
  await expect(page.getByText("Preview — nothing is recorded.")).toBeVisible();

  await page.screenshot({
    path: evidencePath("preview", "preview.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Start over" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}/preview`);

  // Preview records nothing. A Run needs two things Preview must never
  // produce: a Published Version to pin to, and a Run cookie naming it — so
  // both are checked, and either would fail the moment Preview recorded a
  // walk. (Counting `run` rows would prove nothing here: with no Published
  // Version this Journey cannot own a Run, and the suite runs in parallel.)
  // Responses (ticket 12) hang off Runs, so a Journey with no Run can
  // have none; the join below proves it against the rows, not the table.
  const versionRows = await queryE2eDatabase(
    'SELECT id FROM "published_version" WHERE journey_id = $1',
    [journeyId],
  );
  expect(versionRows).toHaveLength(0);

  const runCookies = (await context.cookies()).filter((cookie) =>
    cookie.name.startsWith("journeys.run."),
  );
  expect(runCookies).toHaveLength(0);

  const responseRows = await queryE2eDatabase(
    `SELECT r.run_id FROM "response" r
     JOIN "run" ON "run".id = r.run_id
     JOIN "published_version" v ON v.id = "run".version_id
     WHERE v.journey_id = $1`,
    [journeyId],
  );
  expect(responseRows).toHaveLength(0);
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
      path: evidencePath("preview-non-member", "preview-non-member.png"),
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
