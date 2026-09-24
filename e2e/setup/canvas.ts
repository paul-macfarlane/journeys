import { expect, type Locator, type Page } from "@playwright/test";

import type { Point } from "@/lib/graph/crossings";

/**
 * The map on the Journey page, addressed the way `canvas.spec.ts` addresses
 * it, and the waits and readings every move on it needs first. Shared with
 * `scripts/record-landing-demo.ts`, which drives the same map for the
 * landing page's recording: one place to say where a box's connect dot is
 * and what "the map has stopped moving" means.
 */

export function canvas(page: Page): Locator {
  return page.getByRole("region", { name: "Canvas" });
}

/** One box on the map, named by the Step it stands for. */
export function canvasNode(page: Page, title: string): Locator {
  return canvas(page).getByRole("button", { name: title, exact: true });
}

/** One box's wrapper on the map, which is what carries its handles. */
export function canvasNodeBox(page: Page, title: string): Locator {
  return canvas(page)
    .locator(".react-flow__node")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
}

/** The dot an Author drags from to connect a box to another. */
export function connectHandle(page: Page, title: string): Locator {
  return canvasNodeBox(page, title).locator('[data-handleid="connect"]');
}

/**
 * How many polls apart the transform has to be the same before the map counts
 * as stopped. `expect.poll` runs its first check straight away, so one
 * agreement proves only that nothing moved in the millisecond between two
 * readings — and a `fitView` the browser has been asked for but has not
 * started yet reads exactly like a map standing still. Two agreements at the
 * interval below are half a second of stillness, comfortably longer than the
 * 200ms every `fitView` in the canvas animates for.
 */
const SETTLED_POLLS = 2;
const SETTLE_INTERVAL_MS = 250;

/**
 * The whole map frame inside the window, scrolled the least that gets it
 * there. The page above the map is taller than a 720px window leaves room
 * for, so a box low on the map can lie below the fold: a pointer cannot
 * reach one there, and Playwright's own scroll-into-view is undone by React
 * Flow, which scrolls its pane straight back. Every helper that settles the
 * map before touching it passes through here, so no move below depends on
 * where the window was left, or on whether a reload restored its scroll in
 * time.
 */
export async function mapInView(page: Page): Promise<void> {
  await canvas(page).evaluate((element) =>
    element.scrollIntoView({ block: "nearest" }),
  );
}

/**
 * The map's transform once it has stopped moving. `fitView` animates, so
 * "the viewport did not move" is only worth asserting against a reading taken
 * after the last animation finished rather than before or during one.
 *
 * Read off the viewport's inline style: React Flow pans and zooms the map by
 * writing a CSS transform there, and the `transform` attribute an SVG would
 * carry is not something it ever sets — read as an attribute, every reading
 * is the same empty nothing and any two of them agree.
 */
export async function settledTransform(page: Page): Promise<string> {
  await mapInView(page);
  const viewport = canvas(page).locator(".react-flow__viewport");
  let last: string | null = null;
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
      { timeout: 10_000, intervals: [SETTLE_INTERVAL_MS] },
    )
    .toBeGreaterThanOrEqual(SETTLED_POLLS);

  return last ?? "";
}

/**
 * A patch of the map with nothing on it: the point inside the Canvas frame
 * furthest from every box, and over the pane rather than an overlay — what
 * "dropped on nothing" has to be dropped on.
 */
export async function emptySpot(page: Page): Promise<Point> {
  await settledTransform(page);
  const frame = await canvas(page).boundingBox();
  expect(frame, "the canvas has no box yet").not.toBeNull();

  const spot = await page.evaluate((f) => {
    const boxes = Array.from(
      window.document.querySelectorAll(".react-flow__node"),
    ).map((element) => element.getBoundingClientRect());

    let best: { x: number; y: number; clear: number } | null = null;
    for (let x = f.x + 20; x <= f.x + f.width - 20; x += 20) {
      for (let y = f.y + 20; y <= f.y + f.height - 20; y += 20) {
        const under = window.document.elementFromPoint(x, y);
        if (under === null || !under.classList.contains("react-flow__pane")) {
          continue;
        }
        let clear = Number.POSITIVE_INFINITY;
        for (const box of boxes) {
          const dx = Math.max(box.left - x, 0, x - box.right);
          const dy = Math.max(box.top - y, 0, y - box.bottom);
          clear = Math.min(clear, Math.hypot(dx, dy));
        }
        if (best === null || clear > best.clear) {
          best = { x, y, clear };
        }
      }
    }
    return best;
  }, frame!);

  expect(spot, "no empty patch of map to drop on").not.toBeNull();
  expect(spot!.clear).toBeGreaterThan(60);
  return { x: spot!.x, y: spot!.y };
}
