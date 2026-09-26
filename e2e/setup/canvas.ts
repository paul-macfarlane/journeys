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

/** Every box on the map, by the mark the app puts on each one's button. */
export function canvasNodes(page: Page): Locator {
  return canvas(page).locator("button[data-kind]");
}

export type Box = { x: number; y: number; width: number; height: number };

/** Sub-pixel rounding, so a node flush against the edge is not "outside". */
export const TOLERANCE = 1;

/**
 * Every node's box in one round trip. `getBoundingClientRect` is what
 * Playwright's own `boundingBox()` reads, and thirty-six separate calls inside
 * a poll would take longer than the layout they are watching for.
 */
function nodeBoxes(page: Page): Promise<Box[]> {
  return canvasNodes(page).evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x + TOLERANCE < b.x + b.width &&
    b.x + TOLERANCE < a.x + a.width &&
    a.y + TOLERANCE < b.y + b.height &&
    b.y + TOLERANCE < a.y + a.height
  );
}

/**
 * Everything wrong with the map right now, as sentences — empty is a map that
 * fits: the expected number of nodes, each one inside the Canvas, none of them
 * on top of another. Polled rather than slept on, because laying out and
 * fitting the view is work the browser finishes when it finishes.
 */
export async function mapFaults(
  page: Page,
  expected: number,
): Promise<string[]> {
  const frame = await canvas(page).boundingBox();
  if (frame === null) return ["the canvas has no box yet"];

  const boxes = await nodeBoxes(page);
  if (boxes.length !== expected) {
    return [`${boxes.length} nodes on the map, expected ${expected}`];
  }

  const faults: string[] = [];
  for (const box of boxes) {
    if (box.width === 0 || box.height === 0) {
      faults.push("a node has not been sized yet");
      continue;
    }
    const outside =
      box.x < frame.x - TOLERANCE ||
      box.y < frame.y - TOLERANCE ||
      box.x + box.width > frame.x + frame.width + TOLERANCE ||
      box.y + box.height > frame.y + frame.height + TOLERANCE;
    if (outside) {
      faults.push(
        `a node lies outside the canvas at ${Math.round(box.x)},${Math.round(box.y)}`,
      );
    }
  }

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (overlaps(boxes[i], boxes[j])) {
        faults.push(
          `two nodes overlap at ${Math.round(boxes[i].x)},${Math.round(boxes[i].y)}`,
        );
      }
    }
  }

  return faults;
}

/**
 * Where each box sits relative to the Canvas frame right now: whether the
 * whole box is inside it, whether any of it shows at all, and whether a click
 * on its middle would reach the box rather than an overlay (the Controls)
 * sitting on top of it.
 */
export type NodeView = {
  title: string;
  fullyInside: boolean;
  showing: boolean;
  clickable: boolean;
};

export async function nodeViews(page: Page): Promise<NodeView[]> {
  const frame = await canvas(page).boundingBox();
  if (frame === null) return [];

  return canvasNodes(page).evaluateAll(
    (elements, f) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const atCenter = window.document.elementFromPoint(centerX, centerY);
        return {
          title: element.getAttribute("aria-label") ?? "",
          fullyInside:
            rect.x >= f.x - 1 &&
            rect.y >= f.y - 1 &&
            rect.x + rect.width <= f.x + f.width + 1 &&
            rect.y + rect.height <= f.y + f.height + 1,
          showing:
            rect.x + rect.width > f.x &&
            rect.x < f.x + f.width &&
            rect.y + rect.height > f.y &&
            rect.y < f.y + f.height,
          clickable: atCenter !== null && element.contains(atCenter),
        };
      }),
    frame,
  );
}

/**
 * The whole map again, asked for from the Controls' own "fit view". A Step
 * added takes the map to its own box and a Choice gives the Step it leads to
 * a new rank of its own, which moves its box — and neither is the map asking
 * to be fitted, so on a map zoomed in far enough a box can stand off the
 * frame. An Author reaching for something takes the whole map back first, and
 * so does a spec.
 *
 * The map is waited out before it is asked: the zoom to a box is an animation,
 * and a "fit view" landing in the middle of one is undone as that animation
 * runs on to where it was going.
 */
export async function fitWholeMap(page: Page, boxes: number): Promise<void> {
  await settledTransform(page);

  // Reaching for the Controls at the foot of the map scrolls the page down to
  // them, which can leave the top of the map above the window; the whole
  // frame is put back in it before the drags that follow.
  await canvas(page)
    .getByRole("button", { name: /fit view/i })
    .click();
  await mapInView(page);

  await expect
    .poll(() => mapFaults(page, boxes), { timeout: 20_000 })
    .toEqual([]);
}

/**
 * One box clicked, the way an Author clicks one: once the map has stopped
 * moving. Adding a Step, opening the problems list above the map, or a
 * fit-to-view can all still be moving the box when the next line runs, and
 * a click made while it moves lands where the box was.
 */
export async function clickBox(page: Page, title: string): Promise<void> {
  await settledTransform(page);
  // Said outright when the box's middle — where the click lands — is not on
  // the map or on screen: Playwright would scroll the pane to reach it,
  // React Flow scrolls the pane straight back, and the click retries until
  // the test times out with no word about why.
  await expect
    .poll(
      async () =>
        (await nodeViews(page)).find((view) => view.title === title)?.clickable,
      { timeout: 10_000, message: `the box "${title}" is not clickable` },
    )
    .toBe(true);
  await canvasNode(page, title).click();
}

/**
 * Every box on a map lies inside that map's own frame: the fit held. `map`
 * is the map's region — the Canvas, or the Analytics map.
 */
export async function expectMapFitted(map: Locator): Promise<void> {
  const frame = await map.boundingBox();
  expect(frame).not.toBeNull();
  if (frame === null) return;

  await expect
    .poll(async () => {
      const boxes = await map
        .locator(".react-flow__node")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect()),
        );
      return boxes.every(
        (rect) =>
          rect.left >= frame.x &&
          rect.top >= frame.y &&
          rect.right <= frame.x + frame.width &&
          rect.bottom <= frame.y + frame.height,
      );
    })
    .toBe(true);
}

/**
 * Which way a map is asked to run, as the control in its "Map controls" row
 * says it. `map` is the map's region — the Canvas, or the Analytics map.
 */
export function directionRadio(
  map: Locator,
  name: "Top to bottom" | "Left to right",
): Locator {
  return map
    .getByRole("group", { name: "Map controls" })
    .getByRole("radio", { name, exact: true });
}
