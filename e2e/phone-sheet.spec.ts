import { expect, test, type Locator, type Page } from "@playwright/test";

import { canvas, canvasNode, clickBox } from "./setup/canvas";
import { expectSaved, renameStep, startJourney } from "./setup/editor";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools } from "./setup/session";

/**
 * Ticket 53: the Step panel on a phone is a bottom sheet over the map —
 * opened by tapping a box, holding the same panel, undone and redone in
 * place, closed the way the panel is put away and saved as it goes — while
 * a tablet, at `sm` and wider, keeps the stacked panel and ticket 48's
 * scroll to it.
 */

test.describe.configure({ timeout: 120_000 });

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** The Step panel as a phone shows it: the sheet, marked as the Step's. */
function stepSheet(page: Page): Locator {
  return page.locator('[role="dialog"][data-step-sheet]');
}

/** The panel as a column, stacked under the map below `lg`. */
function stepPanel(page: Page): Locator {
  return page.getByRole("region", { name: "Step", exact: true });
}

/** Every animation on `element` finished: the sheet has stopped sliding. */
async function settled(element: Locator): Promise<void> {
  await expect
    .poll(() =>
      element.evaluate(
        (node) =>
          node
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
}

test("canvas-phone-sheet", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startJourney(page, mintedAuthorIds);

  // A phone arrives at the map with nothing over it: the sheet waits for a
  // Step to be opened.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await clickBox(page, "Start");

  const sheet = stepSheet(page);
  await expect(sheet).toBeVisible();
  await settled(sheet);
  await expect(sheet).toHaveAttribute("data-slot", "sheet-content");
  await expect(sheet).toHaveAccessibleName("Start");

  // The same panel, with the Step's title in its title field, a Close
  // button, and the grab handle along the top.
  const title = sheet.getByLabel("Step title");
  await expect(title).toHaveValue("Start");
  const close = sheet.getByRole("button", { name: "Close", exact: true });
  await expect(close).toBeVisible();
  await expect(sheet.locator('[data-slot="sheet-handle"]')).toBeVisible();

  // Sized to at most 85% of the screen, flush with its foot, and leaving a
  // strip of the map in sight above it: below both the map's top edge and
  // the sticky navbar, so what shows between them is the map.
  const sheetBox = await sheet.boundingBox();
  const mapBox = await canvas(page).boundingBox();
  const navbarBox = await page
    .locator('[data-slot="app-navbar"]')
    .boundingBox();
  expect(sheetBox && mapBox && navbarBox).toBeTruthy();
  if (sheetBox === null || mapBox === null || navbarBox === null) {
    throw new Error("boxes");
  }
  expect(Math.round(sheetBox.y + sheetBox.height)).toBe(667);
  expect(sheetBox.height).toBeLessThanOrEqual(667 * 0.85 + 1);
  expect(
    sheetBox.y,
    "the sheet's top is below the top of the map's frame and the navbar",
  ).toBeGreaterThan(Math.max(mapBox.y, navbarBox.y + navbarBox.height, 0));
  expect(
    mapBox.y + mapBox.height,
    "the map runs on under the sheet",
  ).toBeGreaterThan(sheetBox.y);

  // An edit in the sheet, undone and redone in place with the keyboard off
  // the field: the Draft's one undo still answers while the sheet is open.
  await renameStep(page, "Border post");
  await close.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(title).toHaveValue("Start");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(title).toHaveValue("Border post");

  await page.screenshot({
    path: evidencePath("canvas-phone-sheet", "canvas-phone-sheet.png"),
  });

  // "Find step" stays shut: it is behind the sheet.
  await close.focus();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("listbox", { name: "Steps" })).toHaveCount(0);
  // The map behind the sheet is out of the accessibility tree while the
  // sheet is open, so what proves the press was left alone is where the
  // keyboard still is.
  await expect(close).toBeFocused();
  await expect(sheet).toBeVisible();

  // Closed the way the panel is put away: the edit saved, and on the map.
  await close.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectSaved(page);
  await expect(canvasNode(page, "Border post")).toBeVisible();

  await page.reload();
  await expect(canvasNode(page, "Border post")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("canvas-tablet-stacked-panel", async ({ page }) => {
  // At `sm` and wider, below `lg`: the panel stays a column stacked under
  // the map, and a click on the map scrolls it into view (ticket 48).
  await page.setViewportSize({ width: 768, height: 1024 });
  await startJourney(page, mintedAuthorIds);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const panel = stepPanel(page);
  await expect(panel).toBeVisible();
  const before = await panel.boundingBox();
  expect(before, "the panel has a box").not.toBeNull();
  if (before === null) throw new Error("panel");

  await clickBox(page, "Start");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: "the page scrolled to the panel",
    })
    .toBeGreaterThan(0);

  const tabs = page.locator('[data-slot="sticky-tabs"]');
  await expect
    .poll(async () => (await panel.boundingBox())?.y ?? Number.NaN, {
      message: "the panel's top is inside the viewport",
    })
    .toBeLessThan(1024);
  const after = await panel.boundingBox();
  const tabsBox = await tabs.boundingBox();
  expect(after && tabsBox).toBeTruthy();
  if (after === null || tabsBox === null) throw new Error("boxes");
  expect(after.y, "the panel moved up the screen").toBeLessThan(before.y);
  expect(
    after.y,
    "the panel's top is under the sticky tab row",
  ).toBeGreaterThanOrEqual(tabsBox.y + tabsBox.height - 1);

  await page.screenshot({
    path: evidencePath(
      "canvas-tablet-stacked-panel",
      "canvas-tablet-stacked-panel.png",
    ),
  });
});
