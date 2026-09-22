import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page } from "@playwright/test";

import { queryE2eDatabase } from "./session";

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

/**
 * One Step found the way an Author finds one from the keyboard: Cmd/Ctrl+K
 * from anywhere on the Journey page, part of the title typed into "Find step",
 * and the Step of that name chosen from what is offered. `query` is what is
 * typed and `title` the whole title of the Step it has to pick out.
 */
export async function findStepByName(
  page: Page,
  query: string,
  title: string,
): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("combobox", { name: "Find step" })).toBeFocused();

  await page.keyboard.type(query);
  const option = page
    .getByRole("listbox", { name: "Steps" })
    .getByRole("option", { name: title, exact: true });
  await expect(option).toBeVisible();
  await option.click();

  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

/**
 * One arrow on the map, named by the Choice's label rather than by its id —
 * for a Journey built through the browser, where the ids are the app's to
 * invent. The arrow's accessible name is `"<label>: <from> → <to>"`.
 */
export function arrowLabelled(page: Page, label: string): Locator {
  return page
    .getByRole("region", { name: "Canvas" })
    .locator(`[data-choice-id][aria-label^="${label}:"]`);
}

/**
 * The Outcome an Ending is grouped by, set from the Ending the panel already
 * has open: the label typed into the field, and the Outcome taken either from
 * the ones the Journey already has or from the "Create outcome" the field
 * offers for a label it has none for. Which of the two is offered is the
 * field's own rule, so this takes whichever is there.
 */
export async function tagWithOutcome(page: Page, label: string): Promise<void> {
  const field = page.getByRole("combobox", { name: "Outcome", exact: true });
  await field.fill(label);

  const list = page.getByRole("listbox", { name: "Outcomes" });
  const option = list.getByRole("option", { name: label, exact: true }).or(
    list.getByRole("option", {
      name: `Create outcome “${label}”`,
      exact: true,
    }),
  );
  await expect(option).toHaveCount(1);
  await option.click();

  await expect(field).toHaveValue(label);
}

/**
 * One of the Journey page's tabs opened. The open tab is named in the
 * address (`?tab=versions`, nothing for the default), so a spec that reloads
 * lands where it was.
 */
export async function openTab(
  page: Page,
  name: "Editor" | "Versions",
): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/**
 * The Journey's title or description, edited where it sits at the top of
 * the page: typed into the field and left, which is the save. Waits for the
 * row, since the save is a write the page shows nothing for on its own.
 */
export async function editJourneyField(
  page: Page,
  journeyId: string,
  field: "title" | "description",
  value: string,
): Promise<void> {
  // Exactly "Title": the step panel on this page has a "Step title" too.
  const input = page.getByLabel(field === "title" ? "Title" : "Description", {
    exact: true,
  });
  await input.fill(value);
  if (field === "title") await input.press("Enter");
  else await input.blur();

  await expect
    .poll(async () => {
      const [row] = await queryE2eDatabase<{ value: string }>(
        `SELECT ${field} AS value FROM "journey" WHERE id = $1`,
        [journeyId],
      );
      return row?.value;
    })
    .toBe(value);
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
