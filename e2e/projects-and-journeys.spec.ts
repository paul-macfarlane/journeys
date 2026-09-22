import { expect, test } from "@playwright/test";

import {
  createJourney,
  createProject,
  editJourneyField,
  ID_PATTERN,
  uniqueSuffix,
} from "./setup/authoring";
import {
  publishableDocument,
  readRuns,
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
 * Seam B for ticket 02: an Author's Projects (and the Journeys inside them)
 * driven entirely through the browser.
 *
 * Every test mints its own Author, so tests never see each other's Projects,
 * and the e2e database keeps nothing between runs.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("project-create", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Refugee Health ${suffix}`;

  await page.goto("/projects");
  await expect(page.getByText("No projects yet")).toBeVisible();

  const projectId = await createProject(page, title);

  // Listed for the Author who created it, as a link to its id.
  const projectLink = page.getByRole("link").filter({ hasText: title });
  await expect(projectLink).toHaveAttribute(
    "href",
    new RegExp(`^/projects/${ID_PATTERN}$`),
  );
  await expect(projectLink).toHaveAttribute("href", `/projects/${projectId}`);

  await projectLink.click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/projects");
  await page.screenshot({
    path: evidencePath("project-create", "project-create.png"),
    fullPage: true,
  });
});

test("project-non-member", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Clinic Access ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, title);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // A second Author, in a browser context of their own, so nothing of the
  // first Author's session leaks across.
  const strangerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const stranger = await signInAs(strangerContext);
    mintedAuthorIds.push(stranger.id);

    const strangerPage = await strangerContext.newPage();
    const response = await strangerPage.goto(`/projects/${projectId}`);

    // Not a Member: the same 404 an Author gets for an id that never
    // existed, and no sign of the Project's title anywhere on it.
    expect(response?.status()).toBe(404);
    await expect(strangerPage.getByText(title)).toHaveCount(0);

    // The Journey inside it is just as invisible, even to an Author holding
    // both ids.
    const journeyResponse = await strangerPage.goto(
      `/projects/${projectId}/journeys/${journeyId}`,
    );
    expect(journeyResponse?.status()).toBe(404);
    await expect(strangerPage.getByText(journeyTitle)).toHaveCount(0);

    await strangerPage.screenshot({
      path: evidencePath("project-non-member", "project-non-member.png"),
      fullPage: true,
    });
  } finally {
    await strangerContext.close();
  }
});

test("project-rename", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Refugee Health ${suffix}`;
  const renamedTitle = `Refugee Care ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, title);

  await page.goto(`/projects/${projectId}`);

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill(renamedTitle);
  await page.getByRole("button", { name: "Save changes" }).click();

  // The id is the address, so a rename never moves the Project's URL.
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectId}`);

  await page.screenshot({
    path: evidencePath("project-rename", "project-rename.png"),
    fullPage: true,
  });

  // And the new title is what the Author's list shows.
  await page.goto("/projects");
  await expect(
    page.getByRole("listitem").filter({ hasText: renamedTitle }),
  ).toHaveCount(1);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("project-delete", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Clinic Access ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, title);

  await page.goto(`/projects/${projectId}`);
  await page.getByRole("button", { name: "Delete project" }).click();

  // Nothing is gone until the Author confirms it.
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(page.getByText(title)).toHaveCount(0);

  const response = await page.goto(`/projects/${projectId}`);
  expect(response?.status()).toBe(404);

  await page.screenshot({
    path: evidencePath("project-delete", "project-delete.png"),
    fullPage: true,
  });
});

test("journey-create", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const description =
    "A family decides whether to cross at night or wait for daylight.";

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);

  const journeyId = await createJourney(
    page,
    projectId,
    journeyTitle,
    description,
  );

  // Listed for its Project, as a link to its id under the Project's own.
  const journeyItem = page
    .getByRole("listitem")
    .filter({ hasText: journeyTitle });
  await expect(journeyItem.getByRole("link")).toHaveAttribute(
    "href",
    `/projects/${projectId}/journeys/${journeyId}`,
  );
  await expect(journeyItem.getByText(description)).toBeVisible();
  await expect(journeyItem.getByText("Never published")).toBeVisible();

  await page.screenshot({
    path: evidencePath("journey-create", "journey-create.png"),
    fullPage: true,
  });
});

test("journey-edit-and-delete", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const renamedTitle = `Night Crossing ${suffix}`;
  const renamedDescription = "Updated: the family waits for a guide.";

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
  await page.goto(journeyPath);

  // The title is the field at the top of the page: typed into and left, and
  // that is the rename. It leaves the Journey's address alone.
  await editJourneyField(page, journeyId, "title", renamedTitle);
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}`);

  // The description is the field beneath it.
  await editJourneyField(page, journeyId, "description", renamedDescription);

  // Stored: a reload reads both back, and so does the Project's list.
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    renamedTitle,
  );
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    renamedDescription,
  );

  await page.goto(`/projects/${projectId}`);
  const listed = page.getByRole("listitem").filter({ hasText: renamedTitle });
  await expect(listed).toHaveCount(1);
  await expect(listed.getByText(renamedDescription)).toBeVisible();
  await page.goto(journeyPath);

  await page.screenshot({
    path: evidencePath(
      "journey-edit-and-delete",
      "journey-edit-and-delete.png",
    ),
    fullPage: true,
  });

  // Delete, with confirmation.
  await page.getByRole("button", { name: "Delete journey" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectId}`);
  await expect(page.getByText(renamedTitle)).toHaveCount(0);

  const response = await page.goto(journeyPath);
  expect(response?.status()).toBe(404);
});

test("project-delete-cascade", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Clinic Access ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);

  const journeyResponse = await page.goto(
    `/projects/${projectId}/journeys/${journeyId}`,
  );
  expect(journeyResponse?.status()).toBe(404);

  const projectResponse = await page.goto(`/projects/${projectId}`);
  expect(projectResponse?.status()).toBe(404);

  await page.screenshot({
    path: evidencePath("project-delete-cascade", "project-delete-cascade.png"),
    fullPage: true,
  });
});

test("author-flow", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const renamedTitle = `Night Crossing ${suffix}`;

  // Seam B, AC-6: create Project → create Journey → rename → publish → an
  // anonymous Participant walks it to an Ending → delete, in one continuous
  // flow, one Author, one browser context (and one Participant's own).
  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);

  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
  await page.goto(journeyPath);
  await editJourneyField(page, journeyId, "title", renamedTitle);
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}`);

  // Publish it the way an Author does, from the Journey page's own button.
  await writeDraftDocument(journeyId, publishableDocument());
  await page.goto(journeyPath);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  const [version] = await queryE2eDatabase<{ id: string }>(
    'SELECT id FROM "published_version" WHERE journey_id = $1',
    [journeyId],
  );

  // An anonymous Participant, in a browser context with no session at all,
  // walks the published Journey from its Start Step to an Ending.
  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();
    await participant.goto(`/j/${journeyId}`);
    await expect(participant.getByRole("banner")).toHaveText(renamedTitle);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(participant.getByText("The end")).toBeVisible();
    await expect(participant.getByText("Outcome: Reached care")).toBeVisible();
  } finally {
    await participantContext.close();
  }

  const runs = await readRuns(version.id);
  expect(runs).toHaveLength(1);
  expect(runs[0].ended_at).not.toBeNull();
  expect(runs[0].outcome_id).toBe("reached-care");

  await page.getByRole("button", { name: "Delete journey" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectId}`);
  await expect(page.getByText(renamedTitle)).toHaveCount(0);

  // Deleting the Journey cascades its Published Versions and, through them,
  // the Run the Participant left behind.
  expect(await readRuns(version.id)).toHaveLength(0);

  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(page.getByText(projectTitle)).toHaveCount(0);

  await page.screenshot({
    path: evidencePath("author-flow", "author-flow.png"),
    fullPage: true,
  });
});
