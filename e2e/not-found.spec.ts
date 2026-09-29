import { expect, test, type Page } from "@playwright/test";

import { PLAY_JOURNEY_HREF, PLAY_JOURNEY_LABEL } from "@/lib/demo";

import { evidencePath } from "./setup/evidence";

/**
 * Ticket 60: the app's own not-found page for a route that exists nowhere
 * and for `/authors/<unknown>`. `/p/<unknown>` and `/j/<unknown>` widened
 * the same idea (ticket 42, decision 4), but read their own copy in the
 * runner's own frame instead of the generic page's: a Project or a Journey
 * not being there is a more specific answer than "nothing is at this
 * address." Both the generic page and the RunnerFrame `home` header carry
 * no horizontal overflow at phone width. Anonymous: no session read
 * anywhere here.
 */

/** Well-formed ids no row ever carries (the seed's are `…5eed…`). */
const UNKNOWN_ID = "00000000-0000-4000-8000-00000000dead";

const GENERIC_MISSING_ROUTES = ["/nope", `/authors/${UNKNOWN_ID}`] as const;

/** The generic page a route that exists nowhere, and an off or unknown Author, render. */
async function expectGenericNotFoundPage(page: Page) {
  await expect(page).toHaveTitle("Page not found · Journeys");

  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Page not found", level: 1 }),
  ).toBeVisible();
  await expect(
    main.getByText(
      "There is nothing at this address. A Journey or a Project is found only by the link its Authors hand out.",
    ),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Go to the front page" }),
  ).toHaveAttribute("href", "/");
  await expect(
    main.getByRole("link", { name: PLAY_JOURNEY_LABEL }),
  ).toHaveAttribute("href", PLAY_JOURNEY_HREF);

  // The prose shell around it: the header's wordmark as the other way
  // home, and the one footer.
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Journeys" }),
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "About" }),
  ).toHaveAttribute("href", "/about");

  // The framework's default page, which this replaces, is never shown.
  await expect(page.getByText("This page could not be found")).toHaveCount(0);
}

test("not-found", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });

  // Every generic missing route: a 404 carrying the app's own page.
  for (const route of GENERIC_MISSING_ROUTES) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} answers 404`).toBe(404);
    await expectGenericNotFoundPage(page);
  }

  // `/p/<unknown>` and `/j/<unknown>` (ticket 42, decision 4): their own
  // 404, in the runner's own frame with the wordmark standing in for a
  // title, since a link to nothing here says nothing about whether the
  // row exists.
  const projectResponse = await page.goto(`/p/${UNKNOWN_ID}`);
  expect(projectResponse?.status()).toBe(404);
  await expect(page).toHaveTitle("Project not available · Journeys");
  await expect(
    page.getByRole("heading", { name: "This project isn't available" }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Journeys" }),
  ).toHaveAttribute("href", "/");

  const journeyResponse = await page.goto(`/j/${UNKNOWN_ID}`);
  expect(journeyResponse?.status()).toBe(404);
  await expect(page).toHaveTitle("Journey not available · Journeys");
  await expect(
    page.getByRole("heading", { name: "This journey isn't available" }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Journeys" }),
  ).toHaveAttribute("href", "/");

  await page.goto("/nope");
  await expectGenericNotFoundPage(page);
  await page.screenshot({
    path: evidencePath("not-found", "not-found-light.png"),
    fullPage: true,
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.screenshot({
    path: evidencePath("not-found", "not-found-dark.png"),
    fullPage: true,
  });

  // Phone width: nothing wider than the viewport, on the generic page and
  // on the runner-framed ones.
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/nope");
  await expectGenericNotFoundPage(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "no horizontal scroll at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: evidencePath("not-found", "not-found-375.png"),
    fullPage: true,
  });

  await page.goto(`/p/${UNKNOWN_ID}`);
  const projectOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(
    projectOverflow,
    "no horizontal scroll at 375px on /p/<unknown>",
  ).toBeLessThanOrEqual(0);
});
