import { expect, test } from "@playwright/test";

import {
  createJourney,
  createProject,
  editJourneyField,
  openFindStep,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  loopDocument,
  publishableDocument,
  readRuns,
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
import { readDraftRow } from "./setup/documents";

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

type VersionRow = {
  id: string;
  version_number: number;
  description: string;
  document: unknown;
};

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

  // The refusal is a dialog with everything wrong in it.
  const refusal = page.getByRole("alertdialog");
  await expect(refusal).toContainText("This journey can't be published yet");
  const problems = refusal.getByRole("list", { name: "Publishing problems" });
  await expect(problems).toContainText(
    `Step "${START_STEP_TITLE}" has a choice pointing at a step that no longer exists`,
  );
  await expect(problems).toContainText(
    'Step "Waved through" cannot be reached from the start',
  );

  await page.screenshot({
    path: evidencePath("publish-invalid-draft", "publish-invalid-draft.png"),
    fullPage: true,
  });

  await refusal.getByRole("button", { name: "Close" }).click();
  await expect(refusal).toBeHidden();

  // Refused means nothing was written, and the Journey is where it was.
  expect(await readVersionRows(journeyId)).toHaveLength(0);
  await expect(
    page.getByText("Never published", { exact: true }),
  ).toBeVisible();
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
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await openTab(page, "Versions");
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

    // The Start is the Ending, so the Journey opens straight onto "The end"
    // — and, a Run being created by the first Choice, with none to take it
    // records no Run at all (ticket 27).
    await participant.goto(`/j/${journeyId}`);
    await expect(participant.getByText("The end")).toBeVisible();
    await expect(participant.getByText("Outcome:")).toHaveCount(0);
    await expect(
      participant.getByRole("button", { name: "Start over" }),
    ).toHaveCount(0);

    await participant.screenshot({
      path: evidencePath(
        "publish-untagged-ending",
        "publish-untagged-ending.png",
      ),
      fullPage: true,
    });
  } finally {
    await participantContext.close();
  }

  const [version] = await readVersionRows(journeyId);
  expect(await readRuns(version.id)).toHaveLength(0);
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
    path: evidencePath(
      "publish-draft-with-loop",
      "publish-draft-with-loop.png",
    ),
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
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // The versions are on their own tab, and the tab is in the address, so a
  // reload comes back to it.
  await openTab(page, "Versions");
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}?tab=versions`);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Versions", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  const versions = page
    .getByRole("list", { name: "Versions" })
    .getByRole("listitem");
  await expect(versions).toHaveCount(1);

  const versionOne = versions.filter({ hasText: "Version 1" });
  await expect(versionOne.getByText("Live", { exact: true })).toBeVisible();
  await expect(versionOne.getByText(`by ${author.name}`)).toBeVisible();
  await expect(versionOne.locator("time")).toHaveCount(1);

  // Nothing to publish while the live version matches the Draft, the title,
  // and the description. The page header's button: once there is something
  // to publish, the Versions tab's Draft row carries a Publish of its own.
  const header = page.locator("main header");
  await expect(
    header.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();

  // A description edit is something participants have not seen, so it is
  // enough on its own to make Publish available again, and to say so.
  await editJourneyField(page, journeyId, "description", editedDescription);
  await expect(
    header.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  await expect(header.getByText("Unpublished changes")).toBeVisible();

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
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();

  await openTab(page, "Versions");
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
  const whileAsking = await readDraftRow(journeyId);
  expect(whileAsking.document).toEqual(edited);

  await page.getByRole("button", { name: "Restore version" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();

  // The Draft is version 1's document again, on the page and in the row —
  // including the rich text of the Start, which the editor opens on and
  // must show version 1's words, not the edit it showed before.
  await openTab(page, "Editor");
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
  const restored = await readDraftRow(journeyId);
  expect(restored.document).toEqual(versionOneDocument);

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
    path: evidencePath(
      "publish-versions-and-restore",
      "publish-versions-and-restore.png",
    ),
    fullPage: true,
  });
});

test("journey-share-link", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  // Copying writes the clipboard, and proving it means reading it back.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // Before anything is live there is no address to hand a Participant.
  // Two controls copy it once there is (ticket 65): the badge row's, for
  // as long as the Journey is live, and the acknowledgement line's, for
  // as long as that line shows. This spec is about the badge row's, so the
  // acknowledgement's — the one inside a `role="status"` — is left out.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  const copyLink = page
    .getByRole("button", { name: "Copy participant link" })
    .and(page.locator(':not([role="status"] *)'));
  await expect(copyLink).toHaveCount(0);

  // A brand-new Draft is one Step, an Ending, and publishable as it is.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // The address is the Participant's, on this origin, shown in full for
  // anyone who would rather select it by hand.
  const participantUrl = `${E2E_BASE_URL}/j/${journeyId}`;
  await expect(copyLink).toBeVisible();
  await expect(copyLink).toHaveAttribute("title", participantUrl);

  await copyLink.click();
  await expect(copyLink).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    participantUrl,
  );

  await page.screenshot({
    path: evidencePath("journey-share-link", "journey-share-link.png"),
    fullPage: true,
  });

  // Two seconds later it offers to copy again.
  await expect(copyLink).toHaveText("Copy link");

  // Taking the Journey back from participants takes the address with it.
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await page.getByRole("button", { name: "Unpublish journey" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByText("Unpublished", { exact: true })).toBeVisible();
  await expect(copyLink).toHaveCount(0);
});

/**
 * Ticket 65: the moment a Journey is published, the page says so. One line
 * in the header names the new Published Version, says Participants see it
 * now, and offers the participant link where the Author wants it. The line
 * outlives the click and goes when the Draft changes again or the page is
 * left; it is not a toast.
 */
test("publish-acknowledged", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.emulateMedia({ colorScheme: "light" });

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
  await writeDraftDocument(journeyId, publishableDocument());

  const header = page.locator("main header");
  // The header has a status line of its own for the title fields' saves;
  // the acknowledgement is the one that names a Published Version.
  const acknowledgement = header
    .getByRole("status")
    .filter({ hasText: "Published Version" });
  const publish = header.getByRole("button", { name: "Publish", exact: true });

  // Nothing to acknowledge before anything has been published.
  await page.goto(journeyPath);
  await expect(acknowledgement).toHaveCount(0);

  // Version 1: the line names it, and the badge says "Published" with an
  // entrance so the change registers. A still cannot prove motion, so the
  // entrance is proven by the class that plays it — here, where the state
  // changed under the Author, and not after the reload at the end, where
  // it did not.
  await publish.click();
  await expect(acknowledgement).toContainText(
    "Published Version 1 — participants see it now.",
  );
  const badge = header.getByText("Published", { exact: true });
  await expect(badge).toHaveClass(/animate-in/);

  await page.screenshot({
    path: evidencePath(
      "publish-acknowledged",
      "publish-acknowledged-light.png",
    ),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: evidencePath("publish-acknowledged", "publish-acknowledged-dark.png"),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });

  // The link is right there in the line, and it is the Participant's.
  const copyLink = acknowledgement.getByRole("button", {
    name: "Copy participant link",
  });
  await copyLink.click();
  await expect(copyLink).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${E2E_BASE_URL}/j/${journeyId}`,
  );

  // A Draft edit is something Participants have not seen, so the line goes
  // with the "Unpublished changes" it makes way for.
  await editJourneyField(
    page,
    journeyId,
    "description",
    "A family waits for the night crossing.",
  );
  await expect(header.getByText("Unpublished changes")).toBeVisible();
  await expect(acknowledgement).toHaveCount(0);

  // Version 2, from the header.
  await publish.click();
  await expect(acknowledgement).toContainText(
    "Published Version 2 — participants see it now.",
  );

  // Version 3, from the Versions tab's Draft row: the row goes with the
  // publish, and the header's line acknowledges it all the same.
  await editJourneyField(page, journeyId, "description", "The night crossing.");
  await expect(acknowledgement).toHaveCount(0);
  await openTab(page, "Versions");
  const draftRow = page
    .getByRole("list", { name: "Versions" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Draft", { exact: true }) });
  await draftRow.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(draftRow).toHaveCount(0);
  await expect(acknowledgement).toContainText(
    "Published Version 3 — participants see it now.",
  );
  expect(await readVersionRows(journeyId)).toHaveLength(3);

  // Leaving the page is the other way the line goes — and a page that
  // loads already published has no change to register, so no entrance.
  await page.reload();
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveClass(/animate-in/);
  await expect(acknowledgement).toHaveCount(0);
});

test("versions-tab-shows-draft", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
  const original = publishableDocument();
  await writeDraftDocument(journeyId, original);

  const versions = page
    .getByRole("list", { name: "Versions" })
    .getByRole("listitem");
  const draftRow = versions.filter({
    has: page.getByText("Draft", { exact: true }),
  });

  // Never published: the Draft is the one row, and beneath it the tab says
  // there is nothing published yet.
  await page.goto(`${journeyPath}?tab=versions`);
  await expect(versions).toHaveCount(1);
  await expect(
    draftRow.getByText("Unpublished changes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Not published yet.", { exact: true }),
  ).toBeVisible();

  // The row's time is the Draft's own last edit, as stored.
  const [draftRecord] = await queryE2eDatabase<{ updated_at: string | Date }>(
    'SELECT updated_at FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
  await expect(draftRow.locator("time")).toHaveAttribute(
    "datetime",
    new Date(draftRecord.updated_at).toISOString(),
  );

  // "Open editor" is the way from the row to the Editor tab, which is the
  // plain address.
  await draftRow.getByRole("link", { name: "Open editor" }).click();
  await expect(
    page.getByRole("tab", { name: "Editor", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Step title")).toHaveValue(START_STEP_TITLE);
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}`);

  // Version 1.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // The live version is the Draft exactly, so the list is the versions alone.
  await openTab(page, "Versions");
  await expect(versions).toHaveCount(1);
  await expect(draftRow).toHaveCount(0);
  await expect(versions.first()).toContainText("Version 1");

  // An Author edits a Step's title afterwards, straight into the row so this
  // stays a spec about versions rather than about the editor.
  await writeDraftDocument(journeyId, {
    ...original,
    steps: {
      ...original.steps,
      [START_STEP_ID]: {
        ...original.steps[START_STEP_ID],
        title: "Border post at night",
      },
    },
  });

  // The Draft is back, first, above the live version.
  await page.goto(`${journeyPath}?tab=versions`);
  await expect(versions).toHaveCount(2);
  await expect(
    versions.nth(0).getByText("Draft", { exact: true }),
  ).toBeVisible();
  await expect(
    versions.nth(0).getByText("Unpublished changes", { exact: true }),
  ).toBeVisible();
  await expect(versions.nth(1)).toContainText("Version 1");
  await expect(
    versions.nth(1).getByText("Live", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not published yet.")).toHaveCount(0);

  await page.screenshot({
    path: evidencePath(
      "versions-tab-shows-draft",
      "versions-tab-shows-draft.png",
    ),
    fullPage: true,
  });

  // Publishing from the row makes version 2 the live one and takes the
  // Draft row with it: nothing is unpublished any more.
  await draftRow.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(draftRow).toHaveCount(0);
  await expect(versions).toHaveCount(2);
  await expect(versions.nth(0)).toContainText("Version 2");
  await expect(
    versions.nth(0).getByText("Live", { exact: true }),
  ).toBeVisible();
  expect(await readVersionRows(journeyId)).toHaveLength(2);

  // A description edit alone is an unpublished change too, so the Draft
  // row is back — and its time is that edit's, not the document's older
  // save.
  await editJourneyField(
    page,
    journeyId,
    "description",
    "A family waits for the night crossing.",
  );
  await expect(draftRow).toHaveCount(1);
  const [journeyRecord] = await queryE2eDatabase<{
    updated_at: string | Date;
  }>('SELECT updated_at FROM "journey" WHERE id = $1', [journeyId]);
  const [draftAfter] = await queryE2eDatabase<{ updated_at: string | Date }>(
    'SELECT updated_at FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
  expect(new Date(journeyRecord.updated_at).getTime()).toBeGreaterThan(
    new Date(draftAfter.updated_at).getTime(),
  );
  await expect(draftRow.locator("time")).toHaveAttribute(
    "datetime",
    new Date(journeyRecord.updated_at).toISOString(),
  );
});
