import { expect, test } from "@playwright/test";

import { PLAY_JOURNEY_HREF, PLAY_JOURNEY_LABEL } from "@/lib/demo";

import { evidencePath } from "./setup/evidence";
import { expectFooterOnOneRow } from "./setup/footer";

/**
 * Ticket 54: the About page, first person from Paul. The heading, the
 * paragraph that names Medha and her purpose, the link to the legacy site,
 * the Play link to the seed Project, the guide link, and no mention of the
 * tooling the platform was built with. Anonymous, no session read;
 * screenshots in both themes and at phone width.
 */
test("about", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/about");

  await expect(page).toHaveTitle("About · Journeys");
  await expect(
    page.getByRole("heading", { name: "About Journeys", level: 1 }),
  ).toBeVisible();

  const main = page.getByRole("main");

  // The origin: Medha, a family medicine doctor, and what the cases are for.
  const origin = main.getByText(
    /Medha is a family medicine doctor.*trauma-informed healthcare education/,
  );
  await expect(origin).toBeVisible();

  // The legacy site, linked once.
  const legacy = main.getByRole("link", { name: "static site" });
  await expect(legacy).toHaveAttribute(
    "href",
    "https://journey-stories.netlify.app",
  );
  await expect(
    main.locator('a[href="https://journey-stories.netlify.app"]'),
  ).toHaveCount(1);

  // Play the three cases, and the guide for new Authors.
  await expect(
    main.getByRole("link", { name: PLAY_JOURNEY_LABEL }),
  ).toHaveAttribute("href", PLAY_JOURNEY_HREF);
  await expect(main.getByRole("link", { name: "guide" })).toHaveAttribute(
    "href",
    "/guide",
  );

  // Decision 4: nothing about how the platform was built.
  await expect(main).not.toContainText(/Claude|Atlas|agent/i);

  // The footer links to this page and to the guide.
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "About" })).toHaveAttribute(
    "href",
    "/about",
  );
  await expect(footer.getByRole("link", { name: "Guide" })).toHaveAttribute(
    "href",
    "/guide",
  );
  // Ticket 62: the footer spans the page on one row, as on the splash.
  await expectFooterOnOneRow(page);

  await page.screenshot({
    path: evidencePath("about", "about-light.png"),
    fullPage: true,
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.screenshot({
    path: evidencePath("about", "about-dark.png"),
    fullPage: true,
  });

  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(origin).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow, "no horizontal scroll at 375px").toBe(false);
  await page.screenshot({
    path: evidencePath("about", "about-375.png"),
    fullPage: true,
  });
});
