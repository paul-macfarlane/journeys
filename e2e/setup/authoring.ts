import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page } from "@playwright/test";

import {
  publishDocument,
  runnerDocument,
  writeDraftDocument,
} from "./documents";
import { queryE2eDatabase } from "./session";

/**
 * The authoring moves every spec needs before it can test anything else:
 * making a Project and making a Journey inside it, both driven through the
 * browser exactly as an Author would. Shared so a spec about Drafts spends no
 * lines re-describing how a Journey comes into being. The one read of the
 * database here waits for a write the page shows nothing for.
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
 * one before the app hands it back: every id here is read out of an address
 * the page rendered or landed on.
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
  await field.click();
  await page
    .getByRole("combobox", { name: "Filter outcomes", exact: true })
    .fill(label);

  const list = page.getByRole("listbox", { name: "Outcomes" });
  const option = list.getByRole("option", { name: label, exact: true }).or(
    list.getByRole("option", {
      name: `Create outcome “${label}”`,
      exact: true,
    }),
  );
  await expect(option).toHaveCount(1);
  await option.click();

  await expect(field).toHaveText(label);
}

/**
 * One of the Journey page's or the Project page's tabs opened. The open tab
 * is named in the address (`?tab=versions`, nothing for the default), so a
 * spec that reloads lands where it was.
 */
export async function openTab(
  page: Page,
  name:
    | "Editor"
    | "Versions"
    | "Analytics"
    | "Responses"
    | "Journeys"
    | "Members"
    | "Settings",
): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/**
 * The Journey's title or description, edited where it sits at the top of
 * the page: typed into and left, which is the save. Waits for the row, since
 * the save is a write the page shows nothing for on its own.
 *
 * Made until it takes. The field is React Hook Form's once the page has
 * hydrated, and becoming so writes the stored value into the input (the
 * ref attaching calls `setFieldValue`), over anything typed before it: on a
 * slow machine `fill`'s select and its insert have landed either side of
 * that write and the two titles came out concatenated (CI, tickets 35 and
 * 36). Nothing on the page says when hydration is done, so the edit is
 * typed, read back off the field, saved, and read back off the row, and a
 * typing that hydration wrote over — which saves nothing, because the
 * field then holds what it held — is made again.
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
  const column = { title: "title", description: "description" }[field];
  const stored = async () => {
    const [row] = await queryE2eDatabase<{ value: string }>(
      `SELECT ${column} AS value FROM "journey" WHERE id = $1`,
      [journeyId],
    );
    return row?.value;
  };

  await expect(async () => {
    await input.fill(value);
    await expect(input, `${field} holds what was typed`).toHaveValue(value, {
      timeout: 1_000,
    });
    if (field === "title") await input.press("Enter");
    else await input.blur();
    await expect.poll(stored, { timeout: 3_000 }).toBe(value);
  }).toPass({ timeout: 20_000 });
}

/**
 * The id the address bar holds once the app has landed somewhere: the
 * dialogs land on the thing they made (ticket 47), so the id is read from
 * the page's own address rather than from a list the page no longer shows.
 */
function idFromAddress(page: Page, prefix: string): string {
  return idFromHref(new URL(page.url()).pathname, prefix);
}

/**
 * A Project made from the Projects list. The dialog lands on the new
 * Project's page, so the page is there when this returns; a spec that wants
 * the list again goes back to it.
 */
export async function createProject(
  page: Page,
  title: string,
): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(new RegExp(`/projects/${ID_PATTERN}$`));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  return idFromAddress(page, "/projects/");
}

/**
 * A Journey made from its Project's Journeys tab. The dialog lands on the
 * new Journey's page, so the page is there when this returns; the
 * description, which the dialog no longer asks for, is set where it lives,
 * on that page. A spec that wants the Project page again goes back to it.
 */
export async function createJourney(
  page: Page,
  projectId: string,
  title: string,
  description = "",
): Promise<string> {
  await page.getByRole("button", { name: "New journey" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create journey" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/journeys/${ID_PATTERN}$`),
  );
  const journeyId = idFromAddress(page, `/projects/${projectId}/journeys/`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);

  if (description) {
    await editJourneyField(page, journeyId, "description", description);
  }

  return journeyId;
}

/**
 * A Project with one published Journey, made through the UI as an Author:
 * the Project and the Journey through the dialogs, the Draft and its
 * Published Version written straight into their rows with `runnerDocument()`.
 * Starts from the Projects list and leaves the page on the new Journey's page.
 */
export async function publishOne(
  page: Page,
  label: string,
  description: string,
): Promise<{ projectId: string; journeyId: string }> {
  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `${label} ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `${label} journey ${suffix}`,
    description,
  );
  await writeDraftDocument(journeyId, runnerDocument());
  await publishDocument(journeyId, runnerDocument());
  return { projectId, journeyId };
}
