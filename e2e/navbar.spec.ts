import { expect, test, type Page } from "@playwright/test";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import { publishDocument, runnerDocument } from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Ticket 29: the bar above every signed-in Author page — the Project
 * switcher on the left, the user menu on the right — and the two surfaces
 * that keep their own frames, the runner and the sign-in page.
 *
 * Sign out itself is covered where it always was, in `projects.spec.ts`,
 * now reached through the user menu.
 */

// One long walk: six Projects, a Journey, the switcher and its ordering,
// the three themes, a reload, the list, the Preview, the runner, and the
// phone-width check.
test.setTimeout(90_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** The navbar's left half — the app name and the switcher — by its landmark. */
function appNav(page: Page) {
  return page.getByRole("navigation", { name: "App" });
}

/** Opens the switcher and reads its entries top to bottom. */
async function openSwitcher(page: Page, label: string): Promise<string[]> {
  await appNav(page).getByRole("button", { name: label }).click();
  const menu = page.getByRole("menu");
  await expect(
    menu.getByRole("menuitem", { name: "All projects" }),
  ).toBeVisible();
  return menu.getByRole("menuitem").allInnerTexts();
}

test("navbar-switch-project-and-theme: the switcher moves between Projects and the user menu sets the theme", async ({
  page,
  context,
}) => {
  // Signed out, the sign-in page has no navbar.
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Sign in", level: 1 }),
  ).toBeVisible();
  await expect(appNav(page)).toHaveCount(0);

  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  // Outside a Project the switcher is labelled "Projects".
  await page.goto("/projects");
  await expect(
    appNav(page).getByRole("button", { name: "Projects" }),
  ).toBeVisible();

  // Six Projects, one more than the switcher lists, made oldest first.
  const suffix = uniqueSuffix();
  const titles = [1, 2, 3, 4, 5, 6].map((n) => `Navbar p${n} ${suffix}`);
  const ids: string[] = [];
  for (const title of titles) ids.push(await createProject(page, title));
  const [p1, p2, p3, p4, p5, p6] = titles;
  const [p1Id, , p3Id, , , p6Id] = ids;

  await page.goto(`/projects/${p1Id}`);
  const journeyId = await createJourney(page, p1Id, `Navbar journey ${suffix}`);

  // From a Journey page the switcher reads its Project's title. The oldest
  // Project is outside the five most recent, so it is listed first for
  // being the current one and the fifth most recent makes room; the rest
  // follow newest first.
  await page.goto(`/projects/${p1Id}/journeys/${journeyId}`);
  expect(await openSwitcher(page, p1)).toEqual([
    p1,
    p6,
    p5,
    p4,
    p3,
    "All projects",
  ]);
  const switcherMenu = page.getByRole("menu");
  await expect(
    switcherMenu.getByRole("menuitem", { name: p1 }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    switcherMenu.getByRole("menuitem", { name: p6 }),
  ).not.toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: evidencePath("navbar-switch-project-and-theme", "switcher-open.png"),
  });

  // Choosing another Project lands on it, and the label follows. Inside the
  // five most recent, the list is simply those five.
  await switcherMenu.getByRole("menuitem", { name: p6 }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${p6Id}`);
  await expect(page.getByRole("heading", { name: p6, level: 1 })).toBeVisible();
  expect(await openSwitcher(page, p6)).toEqual([
    p6,
    p5,
    p4,
    p3,
    p2,
    "All projects",
  ]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  // "Most recently updated": renaming a Project on its Settings tab moves
  // it to the top of the list.
  const renamed = `Navbar p3 renamed ${suffix}`;
  await page.goto(`/projects/${p3Id}`);
  await openTab(page, "Settings");
  const titleField = page.getByLabel("Title", { exact: true });
  await titleField.fill(renamed);
  await titleField.press("Enter");
  await expect(page.getByRole("heading", { name: renamed })).toBeVisible();

  await page.goto(`/projects/${p6Id}`);
  expect(await openSwitcher(page, p6)).toEqual([
    renamed,
    p6,
    p5,
    p4,
    p2,
    "All projects",
  ]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  // The user menu names the Author and switches the theme from three plain
  // rows; the choice survives a reload and the menu reports it back.
  const account = page.getByRole("button", { name: "Account: Test Author" });
  await account.click();
  const accountMenu = page.getByRole("menu");
  await expect(accountMenu.getByText("Test Author")).toBeVisible();
  await expect(accountMenu.getByText(author.email)).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("heading", { name: p6, level: 1 })).toBeVisible();
  await page.screenshot({
    path: evidencePath(
      "navbar-switch-project-and-theme",
      "navbar-switch-project-and-theme.png",
    ),
    fullPage: true,
  });

  await account.click();
  await expect(
    page.getByRole("menuitemradio", { name: "Dark" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  // System follows the OS: with the OS emulated dark, the page goes dark.
  await page.emulateMedia({ colorScheme: "dark" });
  await account.click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/\blight\b/);

  // "All projects" opens the list.
  await appNav(page).getByRole("button", { name: p6 }).click();
  await page.getByRole("menuitem", { name: "All projects" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(appNav(page)).toBeVisible();

  // The Preview is an Author page and has the bar; the runner is not and
  // does not, even for a signed-in Author.
  await page.goto(`/projects/${p1Id}/journeys/${journeyId}/preview`);
  await expect(page.getByText("Preview — nothing is recorded.")).toBeVisible();
  await expect(appNav(page)).toBeVisible();

  await publishDocument(journeyId, runnerDocument());
  await page.goto(`/j/${journeyId}`);
  await expect(
    page.getByText("The queue has not moved in an hour."),
  ).toBeVisible();
  await expect(appNav(page)).toHaveCount(0);

  // At phone width the bar keeps to one row and nothing scrolls sideways:
  // the switcher shows the title alone and the user menu its avatar, and a
  // menu opens as a full-width sheet on the bottom edge rather than a
  // popover under its trigger.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/projects/${p1Id}`);
  await account.click();
  const sheet = page.getByRole("menu");
  await expect(sheet.getByText(author.email)).toBeVisible();
  // Polled: the sheet slides up into place, so its bottom edge only meets
  // the viewport's once the enter animation has finished.
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box ? Math.round(box.y + box.height) : -1;
    })
    .toBe(812);
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox?.x).toBe(0);
  expect(sheetBox?.width).toBe(375);
  await page.screenshot({
    path: evidencePath("navbar-switch-project-and-theme", "phone-sheet.png"),
  });
  await sheet.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(appNav(page).getByRole("button", { name: p1 })).toBeVisible();
  await expect(account).toBeVisible();
  const bar = await page.getByRole("banner").boundingBox();
  expect(bar?.height).toBeLessThanOrEqual(60);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: evidencePath("navbar-switch-project-and-theme", "phone.png"),
  });
});
