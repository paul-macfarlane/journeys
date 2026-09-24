import { expect, test, type Page } from "@playwright/test";

import { PLAY_JOURNEY_HREF, PLAY_JOURNEY_LABEL } from "@/lib/demo";

import { evidencePath } from "./setup/evidence";

/**
 * Ticket 60: the app's own not-found page. A route that exists nowhere and
 * the three public pages answering an unknown id all render the same page
 * with status 404 inside the prose shell — the header with the wordmark,
 * a `main` landmark, the footer — with the title, the heading, a link
 * home, and the Play link; in both themes and at phone width with no
 * horizontal overflow. Anonymous: no session read anywhere here.
 */

/** Well-formed ids no row ever carries (the seed's are `…5eed…`). */
const UNKNOWN_ID = "00000000-0000-4000-8000-00000000dead";

const MISSING_ROUTES = [
  "/nope",
  `/p/${UNKNOWN_ID}`,
  `/j/${UNKNOWN_ID}`,
  `/authors/${UNKNOWN_ID}`,
] as const;

/** The page every missing route renders, by what a visitor can see of it. */
async function expectNotFoundPage(page: Page) {
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

  // Every missing route: a 404 carrying the app's own page.
  for (const route of MISSING_ROUTES) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} answers 404`).toBe(404);
    await expectNotFoundPage(page);
  }

  await page.goto("/nope");
  await expectNotFoundPage(page);
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

  // Phone width: nothing wider than the viewport.
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/nope");
  await expectNotFoundPage(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "no horizontal scroll at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: evidencePath("not-found", "not-found-375.png"),
    fullPage: true,
  });
});
