import { expect, test } from "@playwright/test";

import {
  createJourney,
  createProject,
  openFindStep,
  uniqueSuffix,
} from "./setup/authoring";
import {
  loopDocument,
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
type VersionRow = {
  id: string;
  version_number: number;
  description: string;
  document: unknown;
};

function readDraftDocument(journeyId: string): Promise<DocumentRow[]> {
  return queryE2eDatabase<DocumentRow>(
    'SELECT document FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
}

function readVersionRows(journeyId: string): Promise<VersionRow[]> {
  return queryE2eDatabase<VersionRow>(
    'SELECT id, version_number, description, document FROM "published_version" WHERE journey_id = $1 ORDER BY version_number',
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

  // A Draft whose Start offers a Choice leading nowhere: the Step that
  // Choice named is not in the document at all, and the Step it used to lead
  // to ("Waved through") is now reached by nothing, so the refusal names two
  // problems. Written into the `draft` row so this stays a spec about
  // publishing rather than about the editor.
  const publishable = publishableDocument();
  const start = publishable.steps[START_STEP_ID];
  await writeDraftDocument(journeyId, {
    ...publishable,
    steps: {
      ...publishable.steps,
      [START_STEP_ID]: {
        ...start,
        choices: [
          { ...start.choices[0], targetStepId: "step-that-is-gone" },
          ...start.choices.slice(1),
        ],
      },
    },
  });

  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();

  // Scoped to the page's own content: Next's route announcer is a
  // page-level `role="alert"` of its own, and it is not what refused.
  const refusal = page.locator("main").getByRole("alert");
  await expect(refusal).toContainText("This journey can't be published yet");
  await expect(refusal).toContainText(
    `Step "${START_STEP_TITLE}" has a choice pointing at a step that no longer exists`,
  );
  await expect(refusal).toContainText(
    'Step "Waved through" cannot be reached from the start',
  );

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

test("publish-untagged-ending", async ({ page, context, browser }) => {
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
  // Choices — an Ending. An Ending needs no Outcome, so there is nothing
  // wrong with it and nothing standing between it and participants.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await expect(page.getByText("No problems", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Publish", exact: true }).click();

  const versions = page
    .getByRole("list", { name: "Versions" })
    .getByRole("listitem");
  await expect(versions).toHaveCount(1);
  await expect(
    versions
      .filter({ hasText: "Version 1" })
      .getByText("Live", { exact: true }),
  ).toBeVisible();
  expect(await readVersionRows(journeyId)).toHaveLength(1);

  // And a Participant walks it, in a browser of their own: one Step, and the
  // end of the Journey on it. Nothing is said about an Outcome — what an
  // Author has or has not grouped their Endings by is not a Participant's.
  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await participant.getByRole("button", { name: "Begin" }).click();
    await expect(participant.getByText("The end")).toBeVisible();
    await expect(participant.getByText("Outcome:")).toHaveCount(0);

    await participant.screenshot({
      path: "test-results/publish-untagged-ending/publish-untagged-ending.png",
      fullPage: true,
    });
  } finally {
    await participantContext.close();
  }
});

test("publish-draft-with-loop", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // A loop is an ordinary path since ticket 18, so a Draft that holds one
  // publishes exactly as any other valid Draft does.
  const document = loopDocument();
  await writeDraftDocument(journeyId, document);

  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();

  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  const published = await readVersionRows(journeyId);
  expect(published).toHaveLength(1);
  expect(published[0].document).toEqual(document);

  await page.screenshot({
    path: "test-results/publish-draft-with-loop/publish-draft-with-loop.png",
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
  const editedDescription = "A family waits for the night crossing.";

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

  // Nothing to publish while the live version matches the Draft, the title,
  // and the description.
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();

  // A description edit is something participants have not seen, so it is
  // enough on its own to make Publish available again.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Description").fill(editedDescription);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();

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

  // An Author edits the Draft afterwards: the Start's title and its text. The
  // edit goes straight into the row so this stays a spec about versions, not
  // about the editor.
  const editedStartText = "The queue moved at last.";
  const edited = {
    ...original,
    steps: {
      ...original.steps,
      [START_STEP_ID]: {
        ...original.steps[START_STEP_ID],
        title: editedStartTitle,
        content: {
          type: "doc" as const,
          content: [
            {
              type: "paragraph" as const,
              content: [{ type: "text" as const, text: editedStartText }],
            },
          ],
        },
      },
    },
  };
  await writeDraftDocument(journeyId, edited);

  // Version 2.
  await page.goto(journeyPath);
  await openFindStep(page);
  await expect(
    page.getByRole("listbox", { name: "Steps" }).getByText(editedStartTitle),
  ).toBeVisible();
  await expect(page.getByLabel("Step content")).toContainText(editedStartText);
  // The edit is something participants have not seen, so Publish is back.
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
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
  // The description went out with version 2 and left version 1's alone.
  expect(afterSecondPublish[0].description).toBe("");
  expect(afterSecondPublish[1].description).toBe(editedDescription);

  // Restoring asks first, and changes nothing until it is answered.
  await versionOne.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const whileAsking = await readDraftDocument(journeyId);
  expect(whileAsking[0].document).toEqual(edited);

  await page.getByRole("button", { name: "Restore version" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();

  // The Draft is version 1's document again, on the page and in the row —
  // including the rich text of the Start, which was on screen throughout and
  // must show version 1's words, not the edit it showed a moment ago.
  await openFindStep(page);
  await expect(
    page
      .getByRole("listbox", { name: "Steps" })
      .getByText(START_STEP_TITLE, { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Step content")).toContainText(
    "The queue has not moved in an hour.",
  );
  await expect(page.getByLabel("Step content")).not.toContainText(
    editedStartText,
  );
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
