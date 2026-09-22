import { expect, test, type Page } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
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

// One long walk: two Projects, a Journey, the switcher, the theme, a
// reload, the list, the Preview, the runner, and the phone-width check.
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

  const suffix = uniqueSuffix();
  const firstTitle = `Navbar first ${suffix}`;
  const secondTitle = `Navbar second ${suffix}`;

  // Outside a Project the switcher is labelled "Projects".
  await page.goto("/projects");
  await expect(
    appNav(page).getByRole("button", { name: "Projects" }),
  ).toBeVisible();
  const firstId = await createProject(page, firstTitle);
  const secondId = await createProject(page, secondTitle);

  await page.goto(`/projects/${firstId}`);
  const journeyId = await createJourney(
    page,
    firstId,
    `Navbar journey ${suffix}`,
  );

  // From a Journey page the switcher reads its Project's title, lists both
  // Projects with this one marked, and offers the full list.
  await page.goto(`/projects/${firstId}/journeys/${journeyId}`);
  await appNav(page).getByRole("button", { name: firstTitle }).click();
  const switcherMenu = page.getByRole("menu");
  await expect(
    switcherMenu.getByRole("menuitem", { name: firstTitle }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    switcherMenu.getByRole("menuitem", { name: secondTitle }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    switcherMenu.getByRole("menuitem", { name: "All projects" }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath("navbar-switch-project-and-theme", "switcher-open.png"),
  });

  // Choosing the other Project lands on it, and the label follows.
  await switcherMenu.getByRole("menuitem", { name: secondTitle }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects/${secondId}`);
  await expect(
    page.getByRole("heading", { name: secondTitle, level: 1 }),
  ).toBeVisible();
  await expect(
    appNav(page).getByRole("button", { name: secondTitle }),
  ).toBeVisible();

  // The user menu names the Author and switches the theme; the choice
  // survives a reload.
  await page.getByRole("button", { name: "Account: Test Author" }).click();
  const accountMenu = page.getByRole("menu");
  await expect(accountMenu.getByText("Test Author")).toBeVisible();
  await expect(accountMenu.getByText(author.email)).toBeVisible();
  await accountMenu.getByRole("menuitem", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("heading", { name: secondTitle, level: 1 }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath(
      "navbar-switch-project-and-theme",
      "navbar-switch-project-and-theme.png",
    ),
    fullPage: true,
  });

  // "All projects" opens the list.
  await appNav(page).getByRole("button", { name: secondTitle }).click();
  await page.getByRole("menuitem", { name: "All projects" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
  await expect(appNav(page)).toBeVisible();

  // The Preview is an Author page and has the bar; the runner is not and
  // does not, even for a signed-in Author.
  await page.goto(`/projects/${firstId}/journeys/${journeyId}/preview`);
  await expect(page.getByText("Preview — nothing is recorded.")).toBeVisible();
  await expect(appNav(page)).toBeVisible();

  await publishDocument(journeyId, runnerDocument());
  await page.goto(`/j/${journeyId}`);
  await expect(
    page.getByText("The queue has not moved in an hour."),
  ).toBeVisible();
  await expect(appNav(page)).toHaveCount(0);

  // At phone width the bar keeps to one row and nothing scrolls sideways:
  // the switcher shows the title alone and the user menu its avatar.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/projects/${firstId}`);
  await expect(
    appNav(page).getByRole("button", { name: firstTitle }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Account: Test Author" }),
  ).toBeVisible();
  const bar = await page.locator("body > header").boundingBox();
  expect(bar?.height).toBeLessThanOrEqual(60);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: evidencePath("navbar-switch-project-and-theme", "phone.png"),
  });
});
