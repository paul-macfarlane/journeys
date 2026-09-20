import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { E2E_BASE_URL } from "./setup/e2e-env";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Seam B for ticket 02: an Author's Projects (and, from D2, the Journeys
 * inside them) driven entirely through the browser.
 *
 * Every test mints its own Author, so tests never see each other's Projects,
 * and the e2e database keeps nothing between runs.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/**
 * Slugs are globally unique and the e2e database is shared across runs, so
 * every title carries a suffix. Hex only: it survives slugification
 * unchanged, which lets each test spell out the slug it expects rather than
 * recomputing it the way the app does.
 */
function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

async function createProject(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toHaveCount(1);
}

test("project-create", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Refugee Health ${suffix}`;
  const slug = `refugee-health-${suffix}`;

  await page.goto("/projects");
  await expect(page.getByText("No projects yet")).toBeVisible();

  await createProject(page, title);

  // Listed for the Author who created it, as a link to the slug derived
  // from the title.
  const projectLink = page.getByRole("link").filter({ hasText: title });
  await expect(projectLink).toHaveAttribute("href", `/projects/${slug}`);

  await projectLink.click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${slug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/projects");
  await page.screenshot({
    path: "test-results/project-create/project-create.png",
    fullPage: true,
  });
});

test("project-non-member", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Clinic Access ${suffix}`;
  const slug = `clinic-access-${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeySlug = `border-crossing-${suffix}`;

  await page.goto("/projects");
  await createProject(page, title);
  await page.goto(`/projects/${slug}`);
  await createJourney(page, journeyTitle);

  // A second Author, in a browser context of their own, so nothing of the
  // first Author's session leaks across.
  const strangerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const stranger = await signInAs(strangerContext);
    mintedAuthorIds.push(stranger.id);

    const strangerPage = await strangerContext.newPage();
    const response = await strangerPage.goto(`/projects/${slug}`);

    // Not a Member: the same 404 an Author gets for a slug that never
    // existed, and no sign of the Project's title anywhere on it.
    expect(response?.status()).toBe(404);
    await expect(strangerPage.getByText(title)).toHaveCount(0);

    // The Journey inside it is just as invisible: its slug is globally
    // unique, so the page must not be reachable through the Project URL.
    const journeyResponse = await strangerPage.goto(
      `/projects/${slug}/journeys/${journeySlug}`,
    );
    expect(journeyResponse?.status()).toBe(404);
    await expect(strangerPage.getByText(journeyTitle)).toHaveCount(0);

    await strangerPage.screenshot({
      path: "test-results/project-non-member/project-non-member.png",
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
  const slug = `refugee-health-${suffix}`;
  const otherTitle = `Clinic Access ${suffix}`;
  const otherSlug = `clinic-access-${suffix}`;
  const renamedTitle = `Refugee Care ${suffix}`;
  const renamedSlug = `refugee-care-${suffix}`;

  await page.goto("/projects");
  await createProject(page, title);
  await createProject(page, otherTitle);

  await page.goto(`/projects/${slug}`);

  // A new title on its own leaves the slug — and so the URL — alone.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill(renamedTitle);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${slug}`);

  // "Regenerate from title" proposes the slug the new title would get; the
  // Author still chooses whether to keep it.
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Slug")).toHaveValue(slug);
  await page.getByRole("button", { name: "Regenerate from title" }).click();
  await expect(page.getByLabel("Slug")).toHaveValue(renamedSlug);

  // Editing the slug moves the Project to a new URL.
  await page.getByLabel("Slug").fill(renamedSlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${renamedSlug}`);
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  // A slug another Project already holds is refused, in words.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Slug").fill(otherSlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("That slug is already taken")).toBeVisible();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${renamedSlug}`);

  await page.screenshot({
    path: "test-results/project-rename/project-rename.png",
    fullPage: true,
  });
});

async function createJourney(
  page: Page,
  title: string,
  description = "",
): Promise<void> {
  await page.getByRole("button", { name: "New journey" }).click();
  await page.getByLabel("Title").fill(title);
  if (description) {
    await page.getByLabel("Description").fill(description);
  }
  await page.getByRole("button", { name: "Create journey" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toHaveCount(1);
}

test("project-delete", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const title = `Clinic Access ${suffix}`;
  const slug = `clinic-access-${suffix}`;

  await page.goto("/projects");
  await createProject(page, title);

  await page.goto(`/projects/${slug}`);
  await page.getByRole("button", { name: "Delete project" }).click();

  // Nothing is gone until the Author confirms it.
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(page.getByText(title)).toHaveCount(0);

  const response = await page.goto(`/projects/${slug}`);
  expect(response?.status()).toBe(404);

  await page.screenshot({
    path: "test-results/project-delete/project-delete.png",
    fullPage: true,
  });
});

test("journey-create", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const projectSlug = `refugee-health-${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeySlug = `border-crossing-${suffix}`;
  const description =
    "A family decides whether to cross at night or wait for daylight.";

  await page.goto("/projects");
  await createProject(page, projectTitle);
  await page.goto(`/projects/${projectSlug}`);

  await createJourney(page, journeyTitle, description);

  // Listed for its Project, as a link to the slug derived from the title.
  const journeyItem = page
    .getByRole("listitem")
    .filter({ hasText: journeyTitle });
  await expect(journeyItem.getByRole("link")).toHaveAttribute(
    "href",
    `/projects/${projectSlug}/journeys/${journeySlug}`,
  );
  await expect(journeyItem.getByText(description)).toBeVisible();
  await expect(journeyItem.getByText("Never published")).toBeVisible();

  await page.screenshot({
    path: "test-results/journey-create/journey-create.png",
    fullPage: true,
  });
});

test("journey-edit-and-delete", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const projectSlug = `refugee-health-${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeySlug = `border-crossing-${suffix}`;
  const otherJourneyTitle = `Clinic Visit ${suffix}`;
  const otherJourneySlug = `clinic-visit-${suffix}`;
  const renamedTitle = `Night Crossing ${suffix}`;
  const renamedSlug = `night-crossing-${suffix}`;
  const renamedDescription = "Updated: the family waits for a guide.";

  await page.goto("/projects");
  await createProject(page, projectTitle);
  await page.goto(`/projects/${projectSlug}`);
  await createJourney(page, journeyTitle);
  await createJourney(page, otherJourneyTitle);

  await page.goto(`/projects/${projectSlug}/journeys/${journeySlug}`);

  // A new title on its own leaves the slug — and so the URL — alone.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill(renamedTitle);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectSlug}/journeys/${journeySlug}`,
  );

  // Editing the slug moves the Journey to a new URL.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Slug").fill(renamedSlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectSlug}/journeys/${renamedSlug}`,
  );
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  // Editing the description shows it back on the journey page.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Description").fill(renamedDescription);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(renamedDescription)).toBeVisible();

  // A slug another Journey already holds is refused, in words.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Slug").fill(otherJourneySlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("That slug is already taken")).toBeVisible();
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectSlug}/journeys/${renamedSlug}`,
  );
  await page.getByRole("button", { name: "Cancel" }).click();

  // Delete, with confirmation.
  await page.getByRole("button", { name: "Delete journey" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectSlug}`);
  await expect(page.getByText(renamedTitle)).toHaveCount(0);

  const response = await page.goto(
    `/projects/${projectSlug}/journeys/${renamedSlug}`,
  );
  expect(response?.status()).toBe(404);

  await page.screenshot({
    path: "test-results/journey-edit-and-delete/journey-edit-and-delete.png",
    fullPage: true,
  });
});

test("project-delete-cascade", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Clinic Access ${suffix}`;
  const projectSlug = `clinic-access-${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeySlug = `border-crossing-${suffix}`;

  await page.goto("/projects");
  await createProject(page, projectTitle);
  await page.goto(`/projects/${projectSlug}`);
  await createJourney(page, journeyTitle);

  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);

  const journeyResponse = await page.goto(
    `/projects/${projectSlug}/journeys/${journeySlug}`,
  );
  expect(journeyResponse?.status()).toBe(404);

  const projectResponse = await page.goto(`/projects/${projectSlug}`);
  expect(projectResponse?.status()).toBe(404);

  await page.screenshot({
    path: "test-results/project-delete-cascade/project-delete-cascade.png",
    fullPage: true,
  });
});

test("author-flow", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const projectSlug = `refugee-health-${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeySlug = `border-crossing-${suffix}`;
  const renamedTitle = `Night Crossing ${suffix}`;
  const renamedSlug = `night-crossing-${suffix}`;

  // Seam B, AC-6: create Project → create Journey → rename → delete, in one
  // continuous flow, one Author, one browser context.
  await page.goto("/projects");
  await createProject(page, projectTitle);

  await page.goto(`/projects/${projectSlug}`);
  await createJourney(page, journeyTitle);

  await page.goto(`/projects/${projectSlug}/journeys/${journeySlug}`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill(renamedTitle);
  await page.getByLabel("Slug").fill(renamedSlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/projects/${projectSlug}/journeys/${renamedSlug}`,
  );
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  await page.getByRole("button", { name: "Delete journey" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${projectSlug}`);
  await expect(page.getByText(renamedTitle)).toHaveCount(0);

  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(page.getByText(projectTitle)).toHaveCount(0);

  await page.screenshot({
    path: "test-results/author-flow/author-flow.png",
    fullPage: true,
  });
});
