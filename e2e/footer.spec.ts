import { expect, test } from "@playwright/test";

import { evidencePath } from "./setup/evidence";
import { expectFooterInTwoRows } from "./setup/footer";

/**
 * Ticket 67: the site footer on a phone. At 375 px the footer's seven
 * items cannot share a row, and `justify-between` used to scatter whichever
 * ones wrapped across the width. Now the mark and the copyright are one
 * group and the five links another, so the wrap is two rows that start at
 * the same left edge. The About page is the static, session-free surface
 * the proof uses; the footer is the one component every page renders.
 */
test("footer-wrap: at 375 px the footer wraps into two rows that share a left edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/about");
  await expect(page.getByRole("contentinfo")).toBeVisible();

  await expectFooterInTwoRows(page);

  // No horizontal scroll: the footer fits the phone's width.
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(375);

  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: evidencePath("footer-wrap", "footer-375.png"),
  });
});
