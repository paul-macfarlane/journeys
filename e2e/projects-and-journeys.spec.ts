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

  // Listed for its creator, as a link to the slug derived from the title.
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

  await page.goto("/projects");
  await createProject(page, title);

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
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Title").fill(renamedTitle);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${slug}`);

  // Editing the slug moves the Project to a new URL.
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Slug").fill(renamedSlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${renamedSlug}`);
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  // A slug another Project already holds is refused, in words.
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Slug").fill(otherSlug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("That slug is already taken")).toBeVisible();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${renamedSlug}`);

  await page.screenshot({
    path: "test-results/project-rename/project-rename.png",
    fullPage: true,
  });
});

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
