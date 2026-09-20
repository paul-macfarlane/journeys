import { expect, test } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishableDocument,
  START_STEP_ID,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 05: publishing a Journey, listing its Published
 * Versions, restoring one, and unpublishing — from the browser, and from the
 * rows underneath it.
 *
 * A Published Version's immutability cannot be proven in memory, so it is
 * proven against the row: the version 1 document read back after version 2
 * was published, and again after version 1 was restored, deep-equals what
 * was stored the moment version 1 was created.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  // Deleting the Project cascades its Journeys, and each Journey its Draft
  // and its Published Versions.
  await cleanup(mintedAuthorIds);
  await closePools();
});

type DocumentRow = { document: unknown };
type VersionRow = { id: string; version_number: number; document: unknown };

function readDraftDocument(journeyId: string): Promise<DocumentRow[]> {
  return queryE2eDatabase<DocumentRow>(
    'SELECT document FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
}

function readVersionRows(journeyId: string): Promise<VersionRow[]> {
  return queryE2eDatabase<VersionRow>(
    'SELECT id, version_number, document FROM "published_version" WHERE journey_id = $1 ORDER BY version_number',
    [journeyId],
  );
}

test("publish-invalid-draft", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // A brand-new Draft is one Step, which is the Start and — having no
  // Choices — an Ending with no Outcome. That is a publish-time problem.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();

  // Scoped to the page's own content: Next's route announcer is a
  // page-level `role="alert"` of its own, and it is not what refused.
  const refusal = page.locator("main").getByRole("alert");
  await expect(refusal).toContainText("This journey can't be published yet");
  await expect(refusal).toContainText('Ending "Start" has no outcome');

  // Refused means nothing was written, and the Journey is where it was.
  expect(await readVersionRows(journeyId)).toHaveLength(0);
  await expect(
    page.getByText("Never published", { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/publish-invalid-draft/publish-invalid-draft.png",
    fullPage: true,
  });
});

test("publish-versions-and-restore", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const editedStartTitle = "Border post at night";

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
  const original = publishableDocument();
  await writeDraftDocument(journeyId, original);

  // Version 1.
  await page.goto(journeyPath);
  await page.getByRole("button", { name: "Publish", exact: true }).click();

  const versions = page
    .getByRole("list", { name: "Versions" })
    .getByRole("listitem");
  await expect(versions).toHaveCount(1);

  const versionOne = versions.filter({ hasText: "Version 1" });
  await expect(versionOne.getByText("Live", { exact: true })).toBeVisible();
  await expect(versionOne.getByText(`by ${author.name}`)).toBeVisible();
  await expect(versionOne.locator("time")).toHaveCount(1);

  // The badge is the derived state, on the Journey page and in the Project's
  // list alike.
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await page.goto(`/projects/${projectId}`);
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: journeyTitle })
      .getByText("Published", { exact: true }),
  ).toBeVisible();

  // What version 1 stored, as stored.
  const published = await readVersionRows(journeyId);
  expect(published).toHaveLength(1);
  const versionOneDocument = published[0].document;
  expect(versionOneDocument).toEqual(original);

  // An Author edits the Draft afterwards. The editor arrives with ticket 08,
  // so the edit goes straight into the row.
  const edited = {
    ...original,
    steps: {
      ...original.steps,
      [START_STEP_ID]: {
        ...original.steps[START_STEP_ID],
        title: editedStartTitle,
      },
    },
  };
  await writeDraftDocument(journeyId, edited);

  // Version 2.
  await page.goto(journeyPath);
  await expect(
    page.getByRole("list", { name: "Steps" }).getByText(editedStartTitle),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();

  await expect(versions).toHaveCount(2);
  const versionTwo = versions.filter({ hasText: "Version 2" });
  await expect(versionTwo.getByText("Live", { exact: true })).toBeVisible();
  await expect(versionOne.getByText("Live", { exact: true })).toHaveCount(0);

  // Publishing again left version 1's document exactly as it was.
  const afterSecondPublish = await readVersionRows(journeyId);
  expect(afterSecondPublish).toHaveLength(2);
  expect(afterSecondPublish[0].document).toEqual(versionOneDocument);
  expect(afterSecondPublish[1].document).toEqual(edited);

  // Restoring asks first, and changes nothing until it is answered.
  await versionOne.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const whileAsking = await readDraftDocument(journeyId);
  expect(whileAsking[0].document).toEqual(edited);

  await page.getByRole("button", { name: "Restore version" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();

  // The Draft is version 1's document again, on the page and in the row.
  await expect(
    page
      .getByRole("list", { name: "Steps" })
      .getByText(START_STEP_TITLE, { exact: true }),
  ).toBeVisible();
  const restored = await readDraftDocument(journeyId);
  expect(restored[0].document).toEqual(versionOneDocument);

  // Restoring read a version; it must not have written one.
  expect(await readVersionRows(journeyId)).toEqual(afterSecondPublish);

  // Unpublishing takes the Journey away from participants and keeps every
  // version that was ever published.
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Unpublish journey" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();

  await expect(page.getByText("Unpublished", { exact: true })).toBeVisible();

  const [journeyRow] = await queryE2eDatabase<{
    live_version_id: string | null;
  }>('SELECT live_version_id FROM "journey" WHERE id = $1', [journeyId]);
  expect(journeyRow.live_version_id).toBeNull();
  expect(await readVersionRows(journeyId)).toHaveLength(2);

  await page.goto(`/projects/${projectId}`);
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: journeyTitle })
      .getByText("Unpublished", { exact: true }),
  ).toBeVisible();

  await page.goto(journeyPath);
  await page.screenshot({
    path: "test-results/publish-versions-and-restore/publish-versions-and-restore.png",
    fullPage: true,
  });
});
