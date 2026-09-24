import { expect, test, type Locator, type Page } from "@playwright/test";

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
  for (const title of titles) {
    ids.push(await createProject(page, title));
    await page.goto("/projects");
  }
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
  // menu opens as a popover under its trigger, as at every width, never a
  // full-width sheet pinned to the bottom edge (ticket 34).
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/projects/${p1Id}`);
  await account.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText(author.email)).toBeVisible();
  // Polled: the popover zooms into place, so its box only settles once the
  // enter animation has finished.
  await expect
    .poll(async () => {
      const box = await menu.boundingBox();
      if (!box) return "absent";
      const inside =
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= 375 &&
        box.y + box.height <= 812;
      const sheet = box.x === 0 && Math.round(box.y + box.height) === 812;
      return inside && !sheet && box.width < 375 ? "popover" : "elsewhere";
    })
    .toBe("popover");
  await menu.getByRole("menuitemradio", { name: "Dark" }).click();
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

/** Where a locator's box sits, rounded, for polling while things settle. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  return box
    ? {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    : null;
}

test("navbar-sticky-and-phone-menu: the navbar and tab row stick while the header scrolls away, and the phone user menu is a popover", async ({
  page,
  context,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Sticky project ${suffix}`;
  const journeyTitle = `Sticky journey ${suffix}`;
  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // The default 1280 × 720: scroll the Journey page and the navbar stays on
  // the top edge, the tab row sits directly beneath it, and the header — the
  // Journey's title with it — has scrolled away above the viewport.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  const banner = page.getByRole("banner").filter({ has: appNav(page) });
  const tablist = page.getByRole("tablist", { name: "Journey" });
  // The Journey page's header edits the title in place: its Title field.
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await expect(title).toHaveValue(journeyTitle);
  await expect(tablist).toBeVisible();
  const restingTabs = await boxOf(tablist);

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await expect.poll(async () => (await boxOf(banner))?.y).toBe(0);
  await expect
    .poll(async () => {
      const bar = await boxOf(banner);
      const tabs = await boxOf(tablist);
      if (!bar || !tabs) return null;
      // The tab list sits inside the sticky band, whose top meets the bar.
      const band = await boxOf(
        page.locator("[data-slot=sticky-tabs]").filter({ has: tablist }),
      );
      return band ? Math.abs(band.y - (bar.y + bar.height)) <= 1 : null;
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const box = await boxOf(title);
      return box ? box.y + box.height <= 0 : null;
    })
    .toBe(true);
  // The tab list itself moved up with the page and then stopped under the bar.
  expect((await boxOf(tablist))!.y).toBeLessThan(restingTabs!.y);
  await page.screenshot({
    path: evidencePath("navbar-sticky-and-phone-menu", "sticky-tabs.png"),
  });

  // The one site footer, on an Author page too: the wordmark home, the
  // copyright line, the GitHub link, and the legal links.
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveCount(1);
  await expect(footer.getByRole("link", { name: "Journeys" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(footer).toContainText("Paul Macfarlane");
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/paul-macfarlane/journeys",
  );
  await expect(
    footer.getByRole("navigation", { name: "Legal" }).getByRole("link"),
  ).toHaveCount(2);

  // At phone width nothing but the navbar sticks: scrolling carries the tab
  // row away with the page.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await expect(tablist).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const phoneTabs = await boxOf(tablist);
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const scrolledBy = await page.evaluate(() => window.scrollY);
  await expect
    .poll(async () => (await boxOf(tablist))?.y)
    .toBe(phoneTabs!.y - scrolledBy);
  await expect.poll(async () => (await boxOf(banner))?.y).toBe(0);

  // The user menu opens as a popover with every Theme choice and Sign out
  // inside the viewport.
  const account = page.getByRole("button", { name: "Account: Test Author" });
  await account.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const rows = [
    menu.getByRole("menuitemradio", { name: "Light" }),
    menu.getByRole("menuitemradio", { name: "Dark" }),
    menu.getByRole("menuitemradio", { name: "System" }),
    menu.getByRole("menuitem", { name: "Sign out" }),
  ];
  for (const row of rows) {
    await expect
      .poll(async () => {
        const box = await row.boundingBox();
        return box
          ? box.x >= 0 &&
              box.y >= 0 &&
              box.x + box.width <= 375 &&
              box.y + box.height <= 667
          : null;
      })
      .toBe(true);
  }
  await page.screenshot({
    path: evidencePath("navbar-sticky-and-phone-menu", "phone-menu.png"),
  });

  await menu.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await account.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/sign-in`);
});
