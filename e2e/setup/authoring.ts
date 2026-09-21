import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

/**
 * The authoring moves every spec needs before it can test anything else:
 * making a Project and making a Journey inside it, both driven through the
 * browser exactly as an Author would. Shared so a spec about Drafts spends no
 * lines re-describing how a Journey comes into being.
 */

/**
 * The e2e database is shared across runs, so every title carries a suffix
 * that keeps a spec's list filtering exact. Hex only, so a title never
 * accidentally reads as another run's.
 */
export function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/** The shape of a `crypto.randomUUID()` id, which is every address now. */
export const ID_PATTERN = "[0-9a-f-]{36}";

/**
 * A Project and a Journey are addressed by their id, and a spec cannot know
 * one before the app hands it back: every id here is read out of the href
 * the page rendered.
 */
export function idFromHref(href: string | null, prefix: string): string {
  const value = href ?? "";
  expect(value).toMatch(new RegExp(`^${prefix}${ID_PATTERN}$`));
  return value.slice(prefix.length);
}

/**
 * The "Find step" field above the map, opened on the listbox of every Step in
 * the Draft. Finding a Step by name is the second way around a Draft — the
 * map is the first — so every spec that reads a Step out of it opens it the
 * same way. With nothing typed the listbox holds every Step, in map order.
 */
export async function openFindStep(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: "Find step" }).click();
  await expect(page.getByRole("listbox", { name: "Steps" })).toBeVisible();
}

/**
 * One Step opened the way an Author opens one by name: found in "Find step"
 * and chosen. Choosing closes the listbox, so a spec that reads it again
 * opens it again.
 */
export async function chooseStep(page: Page, title: string): Promise<void> {
  await openFindStep(page);
  await page
    .getByRole("listbox", { name: "Steps" })
    .getByRole("option", { name: title, exact: true })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

export async function createProject(
  page: Page,
  title: string,
): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  const item = page.getByRole("listitem").filter({ hasText: title });
  await expect(item).toHaveCount(1);

  return idFromHref(
    await item.getByRole("link").getAttribute("href"),
    "/projects/",
  );
}

export async function createJourney(
  page: Page,
  projectId: string,
  title: string,
  description = "",
): Promise<string> {
  await page.getByRole("button", { name: "New journey" }).click();
  await page.getByLabel("Title").fill(title);
  if (description) {
    await page.getByLabel("Description").fill(description);
  }
  await page.getByRole("button", { name: "Create journey" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  const item = page.getByRole("listitem").filter({ hasText: title });
  await expect(item).toHaveCount(1);

  return idFromHref(
    await item.getByRole("link").getAttribute("href"),
    `/projects/${projectId}/journeys/`,
  );
}
