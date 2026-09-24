import { expect, test } from "@playwright/test";

import {
  createJourney,
  createProject,
  editJourneyField,
  ID_PATTERN,
  openTab,
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

  // Creating lands on the new Project's page (ticket 47), headed by the
  // title just typed, with nothing in it yet.
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("No journeys yet")).toBeVisible();

  await page.screenshot({
    path: evidencePath("project-create", "project-create.png"),
    fullPage: true,
  });

  // Listed for the Author who created it, as a link to its id.
  await page.goto("/projects");
  const projectLink = page.getByRole("link").filter({ hasText: title });
  await expect(projectLink).toHaveAttribute(
    "href",
    new RegExp(`^/projects/${ID_PATTERN}$`),
  );
  await expect(projectLink).toHaveAttribute("href", `/projects/${projectId}`);
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
  const description = "Clinics and shelters along the northern route.";

  await page.goto("/projects");
  const projectId = await createProject(page, title);

  await page.goto(`/projects/${projectId}`);

  // Three tabs, in this order, Journeys open by default.
  const tabs = page.getByRole("tablist", { name: "Project" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Journeys",
    "Members",
    "Settings",
  ]);
  await expect(
    tabs.getByRole("tab", { name: "Journeys", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  // The title and description are edited on the Settings tab, saved as they
  // are typed into and when a field is left (ticket 46). The id is the
  // address, so a rename never moves the Project's URL — only the tab is
  // named in it.
  await openTab(page, "Settings");
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectId}?tab=settings`,
  );

  const titleField = page.getByLabel("Title", { exact: true });
  await titleField.fill(renamedTitle);
  await titleField.press("Enter");
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  // The description is rich text since ticket 07, written in the same
  // editor a Step's content is; its opening shows under the title.
  const descriptionField = page.getByLabel("Description", { exact: true });
  await descriptionField.click();
  await page.keyboard.type(description);
  await descriptionField.blur();
  // Leaving the editor writes at once; the row says when it has landed, the
  // form's line reads "Saved", and the heading above the tabs then shows
  // the description's opening.
  await expect
    .poll(async () => {
      const [row] = await queryE2eDatabase<{ text: string | null }>(
        `SELECT description_content #>> '{content,0,content,0,text}' AS text FROM "project" WHERE id = $1`,
        [projectId],
      );
      return row?.text;
    })
    .toBe(description);
  await expect(
    page.getByRole("region", { name: "Settings" }).getByRole("status").first(),
  ).toHaveText("Saved");
  await expect(
    page.locator("main header").getByText(description, { exact: true }),
  ).toBeVisible();

  // Stored, not only shown: a reload reads both back, and lands on the
  // Settings tab the address names.
  await page.reload();
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectId}?tab=settings`,
  );
  await expect(
    page.getByRole("tab", { name: "Settings", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    renamedTitle,
  );
  await expect(page.getByLabel("Description", { exact: true })).toHaveText(
    description,
  );

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
  // Deleting lives in the Settings tab's danger zone.
  await openTab(page, "Settings");
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

  // The dialog asks for the title alone and lands on the new Journey's page
  // (ticket 47); the description is set there, at the top of the page.
  const journeyId = await createJourney(
    page,
    projectId,
    journeyTitle,
    description,
  );
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectId}/journeys/${journeyId}`,
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    journeyTitle,
  );
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    description,
  );

  await page.screenshot({
    path: evidencePath("journey-create", "journey-create.png"),
    fullPage: true,
  });

  // Listed for its Project, as a link to its id under the Project's own,
  // with the description set on its page.
  await page.goto(`/projects/${projectId}`);
  const journeyItem = page
    .getByRole("listitem")
    .filter({ hasText: journeyTitle });
  await expect(journeyItem.getByRole("link")).toHaveAttribute(
    "href",
    `/projects/${projectId}/journeys/${journeyId}`,
  );
  await expect(journeyItem.getByText(description)).toBeVisible();
  await expect(journeyItem.getByText("Never published")).toBeVisible();
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

  // The title is the field at the top of the page: typed into and left,
  // which writes at once (ticket 46), and that is the rename. It leaves the
  // Journey's address alone.
  await editJourneyField(page, journeyId, "title", renamedTitle);
  await expect(page).toHaveURL(`${E2E_BASE_URL}${journeyPath}`);

  // The description is the field beneath it, and the line under both says
  // when everything has landed.
  await editJourneyField(page, journeyId, "description", renamedDescription);
  await expect(page.locator("main header").getByRole("status")).toHaveText(
    "Saved",
  );

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

  await page.goto(`/projects/${projectId}`);
  await openTab(page, "Settings");
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

test("journeys-reorder", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const titles = [
    `Border Crossing ${suffix}`,
    `Night Clinic ${suffix}`,
    `Long Wait ${suffix}`,
  ];

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);

  // A new Journey goes last, so three made in turn read in that order. Each
  // create lands on the Journey it made, so the Project page is returned to
  // for the next.
  for (const title of titles) {
    await createJourney(page, projectId, title);
    await page.goto(`/projects/${projectId}`);
  }
  const list = page.getByRole("list", { name: "Journeys" });
  // `toContainText` with an array matches a subset in order, so the count
  // is pinned separately.
  const rowTitles = () => list.getByRole("link");
  await expect(rowTitles()).toHaveCount(3);
  await expect(rowTitles()).toContainText(titles);

  // The ends have nowhere to go.
  const row = (title: string) =>
    list.getByRole("listitem").filter({ hasText: title });
  await expect(
    row(titles[0]).getByRole("button", { name: "Move up" }),
  ).toBeDisabled();
  await expect(
    row(titles[2]).getByRole("button", { name: "Move down" }),
  ).toBeDisabled();

  // The third Journey moved up twice is the first.
  await row(titles[2]).getByRole("button", { name: "Move up" }).click();
  await expect(rowTitles()).toContainText([titles[0], titles[2], titles[1]]);
  await row(titles[2]).getByRole("button", { name: "Move up" }).click();
  await expect(rowTitles()).toContainText([titles[2], titles[0], titles[1]]);
  await expect(
    row(titles[2]).getByRole("button", { name: "Move up" }),
  ).toBeDisabled();

  // Stored, not only shown.
  await page.reload();
  await expect(rowTitles()).toHaveCount(3);
  await expect(rowTitles()).toContainText([titles[2], titles[0], titles[1]]);

  await page.screenshot({
    path: evidencePath("journeys-reorder", "journeys-reorder.png"),
    fullPage: true,
  });

  // And a Journey made now still goes last.
  const fourth = `Second Opinion ${suffix}`;
  await createJourney(page, projectId, fourth);
  await page.goto(`/projects/${projectId}`);
  await expect(rowTitles()).toHaveCount(4);
  await expect(rowTitles()).toContainText([
    titles[2],
    titles[0],
    titles[1],
    fourth,
  ]);

  const positions = await queryE2eDatabase<{ title: string; position: number }>(
    'SELECT title, position FROM "journey" WHERE project_id = $1 ORDER BY position, created_at',
    [projectId],
  );
  expect(positions).toEqual([
    { title: titles[2], position: 0 },
    { title: titles[0], position: 1 },
    { title: titles[1], position: 2 },
    { title: fourth, position: 3 },
  ]);
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

  await openTab(page, "Settings");
  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(page.getByText(projectTitle)).toHaveCount(0);

  await page.screenshot({
    path: evidencePath("author-flow", "author-flow.png"),
    fullPage: true,
  });
});

/**
 * Ticket 46: the metadata forms save as they are typed into, so a field
 * never has to be left for its text to reach the row. Three surfaces, three
 * ways of not blurring: the Journey description is typed into and simply
 * waited on; the Project title and the rich-text Project description are
 * typed into and the tab is switched at once, which unmounts the form.
 *
 * Each edit is made until it takes, for the reason `editJourneyField`
 * gives: hydration writes the stored value over anything typed before it.
 */
test("metadata-autosave", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const renamedProjectTitle = `Refugee Care ${suffix}`;
  const projectDescription = "Clinics along the northern route.";
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeyDescription = "The family waits for a guide at dusk.";

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // The Journey description: typed into and never left. The line beneath
  // the fields says when the write has landed, and the row agrees.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  const journeyStatus = page.locator("main header").getByRole("status");
  await expect(journeyStatus).toHaveText("Saved");
  const descriptionField = page.getByLabel("Description", { exact: true });
  const storedJourneyDescription = async () => {
    const [row] = await queryE2eDatabase<{ value: string }>(
      `SELECT description AS value FROM "journey" WHERE id = $1`,
      [journeyId],
    );
    return row?.value;
  };
  // Whether the page would ask before it let itself be left: the guard is
  // asked directly, since a real leave prompt is not something a test can
  // read, and it must say yes while the edit is in its window and no once
  // the write has landed.
  const wouldAskBeforeLeaving = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  await expect(async () => {
    await descriptionField.fill(journeyDescription);
    await expect(descriptionField).toHaveValue(journeyDescription, {
      timeout: 1_000,
    });
    expect(await wouldAskBeforeLeaving()).toBe(true);
    await expect
      .poll(storedJourneyDescription, { timeout: 3_000 })
      .toBe(journeyDescription);
  }).toPass({ timeout: 20_000 });
  await expect(descriptionField).toBeFocused();
  await expect(journeyStatus).toHaveText("Saved");
  expect(await wouldAskBeforeLeaving()).toBe(false);

  await page.reload();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    journeyDescription,
  );

  // "Saving…" is on screen only as long as the write is in flight, so the
  // write is held: the Journey title is typed into (the page is hydrated
  // by now, the description's save proved it), the line reads "Unsaved
  // changes" while the timer runs and "Saving…" once the action is sent,
  // and "Saved" only once the action is let through.
  const renamedJourneyTitle = `Night Crossing ${suffix}`;
  let releaseWrite = () => {};
  const writeHeld = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const isServerAction = (request: {
    method(): string;
    headers(): Record<string, string>;
  }) => request.method() === "POST" && "next-action" in request.headers();
  await page.route(
    (url) => url.pathname === `/projects/${projectId}/journeys/${journeyId}`,
    async (route) => {
      if (isServerAction(route.request())) await writeHeld;
      await route.continue();
    },
  );
  const titleField = page.getByLabel("Title", { exact: true });
  await titleField.fill(renamedJourneyTitle);
  await expect(journeyStatus).toHaveText("Unsaved changes");
  await expect(journeyStatus).toHaveText("Saving…");
  releaseWrite();
  await expect(journeyStatus).toHaveText("Saved");
  await page.unrouteAll();
  await expect
    .poll(async () => {
      const [row] = await queryE2eDatabase<{ value: string }>(
        `SELECT title AS value FROM "journey" WHERE id = $1`,
        [journeyId],
      );
      return row?.value;
    })
    .toBe(renamedJourneyTitle);

  // The Project title: typed into, then straight to another tab. Only the
  // open tab's content is mounted, so the form goes away with the edit
  // still in its window, and writes it on the way out.
  await page.goto(`/projects/${projectId}?tab=settings`);
  const storedProjectTitle = async () => {
    const [row] = await queryE2eDatabase<{ value: string }>(
      `SELECT title AS value FROM "project" WHERE id = $1`,
      [projectId],
    );
    return row?.value;
  };
  await expect(async () => {
    await openTab(page, "Settings");
    const titleField = page.getByLabel("Title", { exact: true });
    await titleField.fill(renamedProjectTitle);
    await expect(titleField).toHaveValue(renamedProjectTitle, {
      timeout: 1_000,
    });
    await openTab(page, "Journeys");
    await expect
      .poll(storedProjectTitle, { timeout: 3_000 })
      .toBe(renamedProjectTitle);
  }).toPass({ timeout: 20_000 });
  // The refresh after the write is what the heading reads.
  await expect(
    page.getByRole("heading", { name: renamedProjectTitle }),
  ).toBeVisible();
  await openTab(page, "Settings");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    renamedProjectTitle,
  );

  // The rich-text Project description, the same way: typed into, tab
  // switched, read back. The editor is not a form field, so it appears
  // only once the page is hydrated, and the typing needs no retry.
  const storedProjectDescription = async () => {
    const [row] = await queryE2eDatabase<{ text: string | null }>(
      `SELECT description_content #>> '{content,0,content,0,text}' AS text FROM "project" WHERE id = $1`,
      [projectId],
    );
    return row?.text;
  };
  const projectDescriptionField = page.getByLabel("Description", {
    exact: true,
  });
  await projectDescriptionField.click();
  await page.keyboard.type(projectDescription);
  await expect(projectDescriptionField).toHaveText(projectDescription);
  await openTab(page, "Journeys");
  await expect.poll(storedProjectDescription).toBe(projectDescription);
  await expect(
    page.locator("main header").getByText(projectDescription, { exact: true }),
  ).toBeVisible();
  await openTab(page, "Settings");
  await expect(page.getByLabel("Description", { exact: true })).toHaveText(
    projectDescription,
  );

  // The Settings form's own line, with both of its surfaces landed. The
  // Theme picker below has a line of its own, so the form's is the first.
  const settingsStatus = page
    .getByRole("region", { name: "Settings" })
    .getByRole("status")
    .first();
  await expect(settingsStatus).toHaveText("Saved");

  await page.screenshot({
    path: evidencePath("metadata-autosave", "metadata-autosave.png"),
    fullPage: true,
  });
});
