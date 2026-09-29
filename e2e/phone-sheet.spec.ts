import { expect, test, type Locator, type Page } from "@playwright/test";

import { canvasNode, clickBox } from "./setup/canvas";
import { expectSaved, renameStep, startJourney } from "./setup/editor";
import { evidencePath } from "./setup/evidence";
import { holdServerAction } from "./setup/server-action";
import { cleanup, closePools } from "./setup/session";

/**
 * Ticket 53: the Step panel on a phone is a bottom sheet over the map —
 * opened by tapping a box, with the map brought on screen above it and the
 * opened box in that strip, holding the same panel, undone and redone in
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

const PHONE = { width: 375, height: 667 };

/** The Step panel as a phone shows it: the sheet, marked as the Step's. */
function stepSheet(page: Page): Locator {
  return page.locator('[role="dialog"][data-step-sheet]');
}

/** The panel as a column, stacked under the map below `lg`. */
function stepPanel(page: Page): Locator {
  return page.getByRole("region", { name: "Step", exact: true });
}

/**
 * One box on the map, found by its markup rather than its role: while the
 * sheet is open the map behind it is out of the accessibility tree.
 */
function boxBehindSheet(page: Page, title: string): Locator {
  return page.locator(
    `.react-flow__node button[aria-label=${JSON.stringify(title)}]`,
  );
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

/**
 * The opened Step's box is in the strip of map left in sight: wholly below
 * the sticky rows at the top of the page and wholly above the sheet, once
 * the map has stopped moving. Returns the measurements it judged by.
 */
async function expectBoxInStrip(
  page: Page,
  title: string,
): Promise<{ stickyBottom: number; sheetTop: number; box: string }> {
  const sheet = stepSheet(page);
  await expect(sheet).toBeVisible();
  await settled(sheet);

  const viewport = page.locator(".react-flow__viewport");
  let last = "";
  let unchanged = 0;
  await expect
    .poll(
      async () => {
        const now = await viewport.evaluate(
          (element) => (element as HTMLElement).style.transform,
        );
        unchanged = now === last ? unchanged + 1 : 0;
        last = now;
        return unchanged;
      },
      { timeout: 10_000, intervals: [250] },
    )
    .toBeGreaterThanOrEqual(2);

  // The rows pinned to the top of the page: the navbar, and the tab row
  // where it is sticky too (from `sm`, so not here — measured all the same).
  const stickyBottom = await page.evaluate(() =>
    Math.max(
      0,
      ...[
        ...document.querySelectorAll(
          '[data-slot="app-navbar"], [data-slot="sticky-tabs"]',
        ),
      ]
        .filter((row) => getComputedStyle(row).position === "sticky")
        .map((row) => row.getBoundingClientRect().bottom),
    ),
  );
  const sheetBox = await sheet.boundingBox();
  const box = await boxBehindSheet(page, title).boundingBox();
  expect(sheetBox && box, "the sheet and the box have boxes").toBeTruthy();
  if (sheetBox === null || box === null) throw new Error("boxes");

  const measured = {
    stickyBottom,
    sheetTop: sheetBox.y,
    box: `x ${box.x.toFixed(1)} y ${box.y.toFixed(1)} w ${box.width.toFixed(1)} h ${box.height.toFixed(1)}`,
  };
  console.log(`strip for "${title}": ${JSON.stringify(measured)}`);

  expect(
    sheetBox.height,
    "the sheet covers no more than 55% of the screen",
  ).toBeLessThanOrEqual(PHONE.height * 0.55 + 1);
  expect(Math.round(sheetBox.y + sheetBox.height)).toBe(PHONE.height);
  expect(box.y, `"${title}" is below the sticky rows`).toBeGreaterThanOrEqual(
    stickyBottom - 1,
  );
  expect(
    box.y + box.height,
    `"${title}" is above the sheet`,
  ).toBeLessThanOrEqual(sheetBox.y + 1);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width + 1);
  return measured;
}

test("canvas-phone-sheet", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { projectId, journeyId } = await startJourney(page, mintedAuthorIds);
  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;

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
  // button, and the grab handle along the top — but not the column's own
  // "Hide panel", which Close stands in for.
  const title = sheet.getByLabel("Step title");
  await expect(title).toHaveValue("Start");
  const close = sheet.getByRole("button", { name: "Close", exact: true });
  await expect(close).toBeVisible();
  await expect(sheet.locator('[data-slot="sheet-handle"]')).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "Hide panel", exact: true }),
  ).toHaveCount(0);

  // The map brought on screen above the sheet, with the opened box in the
  // strip between the navbar and the sheet's top.
  await expectBoxInStrip(page, "Start");
  await page.screenshot({
    path: evidencePath("canvas-phone-sheet", "canvas-phone-sheet.png"),
  });

  // An edit in the sheet, undone with the keyboard still in the field it
  // was typed into, and redone with the keyboard off it: the Draft's one
  // undo answers while the sheet is open.
  await renameStep(page, "Border post");
  await expect(title).toBeFocused();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(title).toHaveValue("Start");
  await close.focus();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(title).toHaveValue("Border post");

  // "Find step" stays shut: it is behind the sheet.
  await close.focus();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("listbox", { name: "Steps" })).toHaveCount(0);
  // The map behind the sheet is out of the accessibility tree while the
  // sheet is open, so what proves the press was left alone is where the
  // keyboard still is.
  await expect(close).toBeFocused();
  await expect(sheet).toBeVisible();

  // Closed straight after an edit, the keyboard still in the field: the
  // close is what writes it. The write is held so it is seen to start
  // while the sheet is already gone, and let through to land.
  const closeWrite = await holdServerAction(page, journeyPath);
  await renameStep(page, "Border crossing");
  await close.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await closeWrite.request;
  await closeWrite.release();
  await expectSaved(page);
  await expect(canvasNode(page, "Border crossing")).toBeVisible();

  // A second box: made from the sheet ("Duplicate" opens the copy in it,
  // in the strip), put down, and tapped on the map to open it afresh.
  await clickBox(page, "Border crossing");
  await expectBoxInStrip(page, "Border crossing");
  await sheet.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(title).toHaveValue("Border crossing copy");
  await expectBoxInStrip(page, "Border crossing copy");
  await close.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectSaved(page);

  await clickBox(page, "Border crossing copy");
  await expect(title).toHaveValue("Border crossing copy");
  await expectBoxInStrip(page, "Border crossing copy");
  await close.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.reload();
  await expect(canvasNode(page, "Border crossing")).toBeVisible();
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
