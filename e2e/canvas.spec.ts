import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import {
  countCrossingPairs,
  type Point,
  type Polyline,
} from "@/lib/graph/crossings";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

import case3 from "../scripts/seed/journey-stories/case-3.json";

import {
  createJourney,
  createProject,
  openStepList,
  uniqueSuffix,
} from "./setup/authoring";
import { dimmingDocument, writeDraftDocument } from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 09: the Draft as a map on the Journey page — every Step a
 * node, every Choice an edge, the Start and the Endings set apart, publish
 * problems marked on the exact node and edge, and the moves an Author makes
 * from the map itself: adding a Step, opening one in the panel, the toolbar
 * on the open box, drawing a Choice by dragging from one box to another,
 * moving an arrow's head to another box, and clicking an arrow to open or
 * delete the Choice it draws — up to building a whole Journey by dragging
 * and walking it as a Participant.
 *
 * Every Journey here is built through the browser, the way an Author builds
 * one, except the seeded case-3 document: 36 Steps is what the map is being
 * asked to *display*, not what the editor is being asked to build, so that one
 * document is written into the `draft` row with `writeDraftDocument`.
 */

// The same budget `step-editing.spec.ts` takes: building a Journey is dozens
// of interactions, each carrying the autosave's quiet window.
test.describe.configure({ timeout: 180_000 });

// `docs/agents/testing.md` names the canvas editor as the case for video: what
// the two authoring tests below prove is a sequence of moves, not a final
// screen. `video` is a worker option, which Playwright refuses inside a
// describe, so it is set for the file; only those two tests keep their
// recording, and the rest is Playwright's own scratch output.
test.use({ video: "on" });

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** The Draft exactly as the editor stored it. */
async function readDraft(journeyId: string): Promise<GraphDocument> {
  const rows = await queryE2eDatabase<{ document: unknown }>(
    'SELECT document FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
  expect(rows).toHaveLength(1);
  return graphDocumentSchema.parse(rows[0].document);
}

/**
 * Autosave is debounced, so "the Draft is stored" is a thing to wait for
 * rather than assume. Every reload, row read, and Publish in this file goes
 * through here first.
 */
async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByRole("status")).toHaveText("Saved");
}

/** A signed-in Author on the Journey page of a brand-new Journey. */
async function startJourney(
  page: Page,
  context: BrowserContext,
): Promise<{ projectId: string; journeyId: string }> {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Border Crossing ${suffix}`,
  );

  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();
  await expect(canvas(page)).toBeVisible();

  return { projectId, journeyId };
}

function canvas(page: Page) {
  return page.getByRole("region", { name: "Canvas" });
}

/** One box on the map, named by the Step it stands for. */
function canvasNode(page: Page, title: string) {
  return canvas(page).getByRole("button", { name: title, exact: true });
}

/** Every box on the map, by the mark the app puts on each one's button. */
function canvasNodes(page: Page) {
  return canvas(page).locator("button[data-kind]");
}

/** Every arrow on the map, by the Choice the app says it is. */
function canvasEdges(page: Page) {
  return canvas(page).locator("[data-choice-id]");
}

/** The arrows marked with a problem. */
function problemEdges(page: Page) {
  return canvas(page).locator('[data-choice-id]:not([data-problems="0"])');
}

async function renameStep(page: Page, title: string): Promise<void> {
  await page.getByLabel("Step title").fill(title);
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

/** "Add step" is the canvas's, beside the map the new Step lands on. */
async function addStepFromCanvas(page: Page, title: string): Promise<void> {
  const before = await canvasNodes(page).count();
  await canvas(page)
    .getByRole("button", { name: "Add step", exact: true })
    .click();

  // The new Step is what the panel opens on, with its title field focused.
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await expect(page.getByLabel("Step title")).toBeFocused();
  await expect(canvasNodes(page)).toHaveCount(before + 1);

  await renameStep(page, title);
  await expect(canvasNode(page, title)).toBeVisible();
}

/** "Add choice" in the panel, pointed at a Step that already exists. */
async function addChoiceToStep(
  page: Page,
  label: string,
  target: string,
): Promise<void> {
  await page.getByRole("button", { name: "Add choice", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill(label);
  await page
    .getByLabel("Target", { exact: true })
    .selectOption({ label: target });
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // The form closes on adding, which is what makes "Add" go away.
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toHaveCount(0);
}

async function addOutcome(page: Page, label: string): Promise<void> {
  await page.getByLabel("New outcome", { exact: true }).fill(label);
  await page.getByRole("button", { name: "Add outcome", exact: true }).click();
  // Outcomes are listed in document order and a new one is appended, so the
  // last field is the one just added — with one Outcome it is the only one.
  await expect(page.getByLabel("Outcome label").last()).toHaveValue(label);
}

/** Every arrow's rendered path, sampled every 4 units into a polyline in flow coordinates. */
function sampleArrowPaths(page: Page): Promise<Polyline[]> {
  return canvas(page)
    .locator("[data-choice-id] path.react-flow__edge-path")
    .evaluateAll((paths) =>
      paths.map((element) => {
        const path = element as SVGPathElement;
        const length = path.getTotalLength();
        const samples = Math.max(16, Math.ceil(length / 4));
        const points: { x: number; y: number }[] = [];
        for (let index = 0; index <= samples; index += 1) {
          const point = path.getPointAtLength((length * index) / samples);
          points.push({ x: point.x, y: point.y });
        }
        return points;
      }),
    );
}

type Box = { x: number; y: number; width: number; height: number };

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

/** Sub-pixel rounding, so a node flush against the edge is not "outside". */
const TOLERANCE = 1;

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
async function mapFaults(page: Page, expected: number): Promise<string[]> {
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
 * on its middle would reach the box rather than an overlay (the Controls, the
 * minimap, the legend) sitting on top of it.
 */
type NodeView = {
  title: string;
  fullyInside: boolean;
  showing: boolean;
  clickable: boolean;
};

async function nodeViews(page: Page): Promise<NodeView[]> {
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
 * The map's transform once it has stopped moving. `fitView` animates, so
 * "the viewport did not move" is only worth asserting against a reading taken
 * after the last animation finished rather than during one.
 */
async function settledTransform(page: Page): Promise<string> {
  const viewport = canvas(page).locator(".react-flow__viewport");
  let last = await viewport.getAttribute("transform");

  await expect
    .poll(
      async () => {
        const now = await viewport.getAttribute("transform");
        const unchanged = now === last;
        last = now;
        return unchanged;
      },
      { timeout: 10_000, intervals: [250] },
    )
    .toBe(true);

  return last ?? "";
}

/** One box's wrapper on the map, which is what carries its handles. */
function canvasNodeBox(page: Page, title: string) {
  return canvas(page)
    .locator(".react-flow__node")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
}

/** The dot an Author drags from to connect a box to another. */
function connectHandle(page: Page, title: string) {
  return canvasNodeBox(page, title).locator('[data-handleid="connect"]');
}

/** The group of moves the selected box shows above itself. */
function boxToolbar(page: Page, title: string) {
  return canvas(page).getByRole("group", { name: `${title} actions` });
}

async function centerOf(locator: Locator): Promise<Point> {
  await expect(locator).toBeAttached();
  const box = await locator.boundingBox();
  expect(box, "the element to drag has no box").not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

/**
 * One drag, from the middle of `from` to the middle of `to`. React Flow
 * listens for pointer events, which Chromium synthesises from these. The map
 * is waited out first: `fitView` animates, and coordinates read while it is
 * still moving are coordinates of somewhere the box no longer is.
 */
async function dragTo(
  page: Page,
  from: Locator,
  to: Locator | Point,
): Promise<void> {
  await settledTransform(page);

  const start = await centerOf(from);
  const end = "x" in to ? to : await centerOf(to);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  // One more at the destination: React Flow decides what a drop lands on
  // from the last move it saw, not from the mouse-up.
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
}

/**
 * A patch of the map with nothing on it: the point inside the Canvas frame
 * furthest from every box, and over the pane rather than an overlay — what
 * "dropped on nothing" has to be dropped on.
 */
async function emptySpot(page: Page): Promise<Point> {
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

/**
 * One Choice made the way the map makes one: dragged from the source box's
 * connect dot onto the target box, leaving the panel on the source Step with
 * the new Choice's empty label field focused and waiting to be typed into.
 */
async function connectByDragging(
  page: Page,
  from: string,
  to: string,
  /**
   * How many arrows the map should hold afterwards, said rather than counted
   * beforehand: an arrow is unmounted for the frame in which its boxes are
   * being re-measured after a relayout, so a count taken at the wrong moment
   * is a count of nothing.
   */
  expectedEdges: number,
): Promise<void> {
  await dragTo(page, connectHandle(page, from), canvasNode(page, to));

  await expect(canvasEdges(page)).toHaveCount(expectedEdges);
  await expect(page.getByLabel("Step title")).toHaveValue(from);
  const label = page.getByLabel("Choice label").last();
  await expect(label).toHaveValue("");
  await expect(label).toBeFocused();
}

test("canvas-add-next-step", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await expect(canvasNodes(page)).toHaveCount(1);
  await expect(canvasEdges(page)).toHaveCount(0);

  // The box the panel has open carries the moves that change the shape of
  // the Journey around it.
  const toolbar = boxToolbar(page, "Border post");
  await expect(toolbar).toBeVisible();
  await toolbar
    .getByRole("button", { name: "Add next step", exact: true })
    .click();

  // A Step, and the Choice that reaches it, in one motion.
  await expect(canvasNodes(page)).toHaveCount(2);
  await expect(canvasEdges(page)).toHaveCount(1);
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await expect(page.getByLabel("Step title")).toBeFocused();

  // And the map went to where it put it.
  await expect
    .poll(
      async () =>
        (await nodeViews(page))
          .filter((view) => view.title === "Untitled step")
          .map((view) => view.fullyInside),
      { timeout: 10_000 },
    )
    .toEqual([true]);

  await renameStep(page, "Clinic tent");
  await expect(canvasEdges(page)).toHaveAttribute(
    "aria-label",
    "Untitled choice: Border post → Clinic tent",
  );

  // The same toolbar makes the Step it is on the one the Journey starts from.
  const clinicToolbar = boxToolbar(page, "Clinic tent");
  await expect(clinicToolbar).toBeVisible();
  await clinicToolbar
    .getByRole("button", { name: "Make this the start", exact: true })
    .click();
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-kind",
    "start",
  );

  await expectSaved(page);
  await page.screenshot({
    path: "test-results/canvas-add-next-step/canvas-add-next-step.png",
    fullPage: true,
  });
});

test.describe("the seeded map", () => {
  // Thirty-six Steps is a map to be read, not a thumbnail: the widest screen
  // an Author would use is what it is laid out against.
  test.use({ viewport: { width: 1600, height: 1200 } });

  test("canvas-case-3-map", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    const document = graphDocumentSchema.parse(case3);
    const stepCount = Object.keys(document.steps).length;
    const choiceCount = Object.values(document.steps).reduce(
      (total, step) => total + step.choices.length,
      0,
    );

    await expectSaved(page);
    await writeDraftDocument(journeyId, document);
    await page.reload();

    await expect(canvasNodes(page)).toHaveCount(stepCount);
    await expect(canvasEdges(page)).toHaveCount(choiceCount);

    // A published case has nothing dangling, so nothing stands in for a Step
    // that is gone.
    await expect(
      canvas(page).locator('button[data-kind="missing"]'),
    ).toHaveCount(0);
    await expect(canvas(page).locator('button[data-kind="start"]')).toHaveCount(
      1,
    );

    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    // And again after the Author asks for the whole map at once.
    await canvas(page)
      .getByRole("button", { name: /fit view/i })
      .click();
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    // How tangled the map is, counted off the arrows the browser drew. The
    // baseline — 15 crossing pairs over these 36 boxes and 50 arrows — was
    // measured on ticket 09's `f24a106`, with this same sampling and the same
    // `countCrossingPairs` (`test-results/ac-5-crossings.txt`), so the two
    // numbers are comparable.
    const F24A106_CROSSING_BASELINE = 15;

    // And comparable only against the fixture it was measured on: a case-3
    // that grew or shrank is a different map, and a baseline quietly compared
    // against a different map proves nothing.
    expect(
      stepCount,
      "the crossing baseline was measured on a 36-step case-3",
    ).toBe(36);
    expect(
      choiceCount,
      "the crossing baseline was measured on a 50-choice case-3",
    ).toBe(50);

    const arrows = await sampleArrowPaths(page);
    expect(arrows).toHaveLength(choiceCount);
    for (const arrow of arrows) {
      expect(arrow.length).toBeGreaterThanOrEqual(16);
    }
    const crossings = countCrossingPairs(arrows);
    console.log(
      `case-3 crossing pairs: f24a106 baseline=${F24A106_CROSSING_BASELINE} now=${crossings}`,
    );
    expect(crossings).toBeLessThan(F24A106_CROSSING_BASELINE);

    await page.screenshot({
      path: "test-results/canvas-case-3-map/canvas-case-3-map.png",
      fullPage: true,
    });
  });

  test("canvas-locate-on-map", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    const seeded = graphDocumentSchema.parse(case3);
    const stepCount = Object.keys(seeded.steps).length;

    await expectSaved(page);
    await writeDraftDocument(journeyId, seeded);
    await page.reload();

    await expect(canvasNodes(page)).toHaveCount(stepCount);
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    // Zoomed in far enough that the map no longer fits, which is the state a
    // Step opened from the list has to be found in.
    const zoomIn = canvas(page).getByRole("button", { name: /zoom in/i });
    for (let click = 0; click < 4; click += 1) {
      await zoomIn.click();
    }
    await expect
      .poll(
        async () =>
          (await nodeViews(page)).filter((view) => !view.fullyInside).length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    // The Step to open: the last one the list offers that is off the map
    // right now, falling back to any that is not wholly on it.
    await openStepList(page);
    const stepsList = page.getByRole("list", { name: "Steps" });
    const listed = await stepsList.getByRole("button").allInnerTexts();
    const views = await nodeViews(page);
    const isOffScreen = (title: string) =>
      views.some((view) => view.title === title && !view.showing);
    const isPartly = (title: string) =>
      views.some((view) => view.title === title && !view.fullyInside);
    const target =
      listed.findLast(isOffScreen) ?? listed.findLast(isPartly) ?? "";
    expect(target).not.toBe("");

    await stepsList.getByRole("button", { name: target, exact: true }).click();
    await expect(page.getByLabel("Step title")).toHaveValue(target);

    // Opening it brought its box onto the map.
    await expect
      .poll(
        async () =>
          (await nodeViews(page)).find((view) => view.title === target)
            ?.fullyInside,
        { timeout: 10_000 },
      )
      .toBe(true);

    await page.screenshot({
      path: "test-results/canvas-locate-on-map/canvas-locate-on-map.png",
      fullPage: true,
    });

    // A box already on the map is opened where it stands: nothing moves. The
    // whole map is asked for first, so "already on the map" is every box
    // rather than whichever ones happened to sit near the one just located.
    await canvas(page)
      .getByRole("button", { name: /fit view/i })
      .click();
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    const before = await settledTransform(page);
    const settled = await nodeViews(page);
    const showing = settled.find(
      (view) => view.title !== target && view.fullyInside && view.clickable,
    );
    expect(
      showing,
      `no box is clickable on the map: ${JSON.stringify(settled)}`,
    ).toBeDefined();
    const showingTitle = showing?.title ?? "";

    await canvasNode(page, showingTitle).click();
    await expect(page.getByLabel("Step title")).toHaveValue(showingTitle);
    expect(await settledTransform(page)).toBe(before);

    // A Step no walk reaches is found the same way: through the problem it
    // shows up as, not only through the Steps list.
    const withUnreachable: GraphDocument = graphDocumentSchema.parse({
      ...seeded,
      steps: {
        ...seeded.steps,
        "lost-tent": {
          id: "lost-tent",
          title: "Lost tent",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "The tent is gone by morning." },
                ],
              },
            ],
          },
          choices: [],
          prompt: null,
          // Reused from an existing case-3 Ending so this Step carries
          // exactly one live problem — unreachable — not also a missing
          // Outcome of its own.
          outcomeId: "outcome-good-control",
          position: null,
        },
      },
    });
    await writeDraftDocument(journeyId, withUnreachable);
    await page.reload();

    await expect(canvasNodes(page)).toHaveCount(stepCount + 1);
    await expect
      .poll(() => mapFaults(page, stepCount + 1), { timeout: 20_000 })
      .toEqual([]);

    // Zoomed in until "Lost tent" is no longer fully on screen — panning if a
    // zoom step alone leaves it inside, bounded so a layout that never pushes
    // it off screen fails the assertion below instead of hanging.
    const zoomInFurther = canvas(page).getByRole("button", {
      name: /zoom in/i,
    });
    let lostTentOutside = false;
    let zoomAttempts = 0;
    const maxZoomAttempts = 15;
    while (!lostTentOutside && zoomAttempts < maxZoomAttempts) {
      zoomAttempts += 1;
      await zoomInFurther.click();
      const lostTent = (await nodeViews(page)).find(
        (view) => view.title === "Lost tent",
      );
      if (lostTent !== undefined && !lostTent.fullyInside) {
        lostTentOutside = true;
        break;
      }
      // A zoom that carried "Lost tent" clean off screen still needs a pan
      // back toward the middle, or the next zoom only zooms in on empty map.
      if (lostTent !== undefined && !lostTent.showing) {
        const frame = await canvas(page).boundingBox();
        if (frame !== null) {
          await page.mouse.move(
            frame.x + frame.width / 2,
            frame.y + frame.height / 2,
          );
          await page.mouse.down();
          await page.mouse.move(
            frame.x + frame.width * 0.75,
            frame.y + frame.height * 0.75,
            { steps: 8 },
          );
          await page.mouse.up();
        }
      }
    }
    expect(
      lostTentOutside,
      `"Lost tent" was still fully inside the canvas frame after ${zoomAttempts} zoom attempts`,
    ).toBe(true);

    const problemsButton = page.getByRole("button", {
      name: "1 problem",
      exact: true,
    });
    await expect(problemsButton).toBeVisible();
    await problemsButton.click();

    const lostTentEntry = page
      .getByRole("list", { name: "All problems" })
      .getByRole("button", {
        name: 'Step "Lost tent" cannot be reached from the start',
        exact: true,
      });
    await lostTentEntry.click();

    await expect(page.getByLabel("Step title")).toHaveValue("Lost tent");
    await expect
      .poll(
        async () =>
          (await nodeViews(page)).find((view) => view.title === "Lost tent")
            ?.fullyInside,
        { timeout: 10_000 },
      )
      .toBe(true);

    // Asking for the Step that is already open counts too: the map is dragged
    // away from "Lost tent", and the same entry brings it back rather than
    // doing nothing because the panel never changed.
    let pushedOff = false;
    for (let pan = 0; pan < 8 && !pushedOff; pan += 1) {
      const from = await emptySpot(page);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x - 300, from.y - 220, { steps: 8 });
      await page.mouse.move(from.x - 300, from.y - 220);
      await page.mouse.up();
      pushedOff =
        (await nodeViews(page)).find((view) => view.title === "Lost tent")
          ?.fullyInside === false;
    }
    expect(
      pushedOff,
      '"Lost tent" was still fully inside the canvas frame after panning away',
    ).toBe(true);

    // The list is a toggle the Author left open; a pan is not something that
    // closes it, but it is reopened rather than assumed.
    if ((await lostTentEntry.count()) === 0) await problemsButton.click();
    await lostTentEntry.click();

    await expect(page.getByLabel("Step title")).toHaveValue("Lost tent");
    await expect
      .poll(
        async () =>
          (await nodeViews(page)).find((view) => view.title === "Lost tent")
            ?.fullyInside,
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("canvas-step-list-follows-map", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    const document = graphDocumentSchema.parse(case3);
    const stepCount = Object.keys(document.steps).length;

    await expectSaved(page);
    await writeDraftDocument(journeyId, document);
    await page.reload();

    await expect(canvasNodes(page)).toHaveCount(stepCount);
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    await openStepList(page);
    const stepsList = page.getByRole("list", { name: "Steps" });
    const listedTitles = await stepsList.getByRole("button").allInnerTexts();

    // Every box's title and rect in one round trip, sorted the way
    // `mapOrder` orders the canvas: top to bottom, then left to right.
    const boxes = await canvasNodes(page).evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          title: element.getAttribute("aria-label") ?? "",
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        };
      }),
    );
    const mapOrderedTitles = boxes
      .slice()
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .map((box) => box.title);

    expect(listedTitles).toHaveLength(stepCount);
    expect(listedTitles).toEqual(mapOrderedTitles);

    await expect(
      page.getByRole("list", { name: "Not yet reached" }),
    ).toHaveCount(0);
    await expect(page.getByText("Not reachable from the start")).toHaveCount(0);

    await page.screenshot({
      path: "test-results/canvas-step-list-follows-map/canvas-step-list-follows-map.png",
      fullPage: true,
    });
  });
});

test("canvas-validation-marks", async ({ page, context }) => {
  await startJourney(page, context);

  // A brand-new Draft's one Step is both the Start and an Ending, and an
  // Ending with nothing to be grouped by is the first thing to fix.
  await renameStep(page, "Border post");
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "1",
  );

  await addOutcome(page, "Reached care");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Reached care" });
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );

  // A Step nothing leads to yet, and with no Outcome on it either.
  await addStepFromCanvas(page, "Clinic tent");
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "2",
  );
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Reached care" });
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "1",
  );

  // A Choice from the Start reaches it, and the Start stops being an Ending.
  await canvasNode(page, "Border post").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");

  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "0",
  );
  await expect(problemEdges(page)).toHaveCount(0);

  // A Choice back to the Start closes a loop, and a loop is allowed since
  // ticket 18: it leaves no mark on either Step or either arrow.
  await canvasNode(page, "Clinic tent").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  await addChoiceToStep(page, "Go back", "Border post");
  await expect(canvasEdges(page)).toHaveCount(2);
  await expect(problemEdges(page)).toHaveCount(0);
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "0",
  );

  // Taking the Choice away removes the arrow; there was never a mark to clear.
  await page
    .getByRole("button", { name: "Remove choice", exact: true })
    .click();
  await expect(canvasEdges(page)).toHaveCount(1);
  await expect(problemEdges(page)).toHaveCount(0);
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "0",
  );

  // Deleting the Step that Choice points at leaves it dangling, and the map
  // says so in both places: a placeholder where the Step was, and the edge.
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  // The panel's, not the one on the selected box: both open the same
  // confirmation, and both are called "Delete step".
  await page
    .getByRole("region", { name: "Step" })
    .getByRole("button", { name: "Delete step", exact: true })
    .click();
  const confirmation = page.getByRole("alertdialog");
  await confirmation
    .getByRole("button", { name: "Delete step", exact: true })
    .click();
  await expect(confirmation).toBeHidden();

  await expect(canvasNode(page, "Missing step")).toBeVisible();
  await expect(problemEdges(page)).toHaveCount(1);
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "1",
  );

  await page.screenshot({
    path: "test-results/canvas-validation-marks/canvas-validation-marks.png",
    fullPage: true,
  });

  // Removing the broken Choice takes the placeholder and the mark with it.
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await page
    .getByRole("button", { name: "Remove choice", exact: true })
    .click();

  await expect(canvasNode(page, "Missing step")).toHaveCount(0);
  await expect(canvasEdges(page)).toHaveCount(0);
  await expect(canvasNodes(page)).toHaveCount(1);
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );
});

test("canvas-problems-readable", async ({ page, context }) => {
  await startJourney(page, context);

  // A brand-new Draft's one Step is an Ending with no Outcome: read on the
  // Step's own panel, in the header count, and in the live list the count
  // opens.
  await renameStep(page, "Border post");

  const stepProblemsMessage = 'Ending "Border post" has no outcome';
  const stepProblems = page
    .getByRole("region", { name: "Step" })
    .getByRole("list", { name: "Step problems list" });
  await expect(stepProblems.getByRole("listitem")).toHaveCount(1);
  await expect(stepProblems).toHaveText(stepProblemsMessage);

  const problemsButton = page.getByRole("button", {
    name: "1 problem",
    exact: true,
  });
  await expect(problemsButton).toBeVisible();
  await problemsButton.click();
  const allProblems = page.getByRole("list", { name: "All problems" });
  await expect(allProblems.getByRole("listitem")).toHaveCount(1);
  await expect(allProblems).toHaveText(stepProblemsMessage);

  await page.screenshot({
    path: "test-results/canvas-problems-readable/canvas-problems-readable.png",
    fullPage: true,
  });

  // Giving it an Outcome clears the problem everywhere it was shown.
  await addOutcome(page, "Reached care");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Reached care" });

  await expect(page.getByRole("region", { name: "Step problems" })).toHaveCount(
    0,
  );
  await expect(page.getByText("No problems", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "All problems" })).toHaveCount(0);

  // A dangling Choice: read the same live message on the Choice row that
  // dangles and in that Step's own Problems section.
  await addStepFromCanvas(page, "Clinic tent");
  await canvasNode(page, "Border post").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");

  await canvasNode(page, "Clinic tent").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  await page
    .getByRole("region", { name: "Step" })
    .getByRole("button", { name: "Delete step", exact: true })
    .click();
  const confirmation = page.getByRole("alertdialog");
  await confirmation
    .getByRole("button", { name: "Delete step", exact: true })
    .click();
  await expect(confirmation).toBeHidden();

  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  const danglingMessage =
    'Step "Border post" has a choice pointing at a step that no longer exists';
  const choiceRow = page
    .getByRole("list", { name: "Choices" })
    .getByRole("listitem")
    .first();
  await expect(choiceRow.getByText(danglingMessage)).toBeVisible();

  const stepProblemsAfter = page
    .getByRole("region", { name: "Step" })
    .getByRole("list", { name: "Step problems list" });
  await expect(stepProblemsAfter.getByRole("listitem")).toHaveCount(1);
  await expect(stepProblemsAfter).toHaveText(danglingMessage);

  await expect(
    page.getByRole("button", { name: "1 problem", exact: true }),
  ).toBeVisible();
});

/** One arrow on the map, named by the Choice it draws. */
function canvasEdge(page: Page, choiceId: string) {
  return canvas(page).locator(`[data-choice-id="${choiceId}"]`);
}

/**
 * One arrow on the map, named by the Choice's label instead of its id — for a
 * Journey built through the browser, where the ids are the app's to invent.
 * The arrow's accessible name is `"<label>: <from> → <to>"`.
 */
function arrowLabelled(page: Page, label: string) {
  return canvas(page).locator(`[data-choice-id][aria-label^="${label}:"]`);
}

/**
 * A click on an arrow's own line rather than on the label chip sitting over
 * its middle: the interaction path React Flow lays over every arrow is
 * sampled along its length, and the first sample the browser says is on top
 * is the one clicked. Falling back to the midpoint keeps a browser that
 * hit-tests the transparent stroke differently from failing here rather than
 * where the assertion is.
 */
async function clickArrow(page: Page, arrow: Locator): Promise<void> {
  await settledTransform(page);
  const path = arrow.locator("path.react-flow__edge-interaction");
  await expect(path).toHaveCount(1);

  const point = await path.evaluate((element) => {
    const line = element as SVGPathElement;
    const length = line.getTotalLength();
    const matrix = line.getScreenCTM();
    if (matrix === null) return null;

    let midpoint: Point | null = null;
    for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const at = line
        .getPointAtLength(length * fraction)
        .matrixTransform(matrix);
      midpoint ??= { x: at.x, y: at.y };
      if (window.document.elementFromPoint(at.x, at.y) === line) {
        return { x: at.x, y: at.y };
      }
    }
    return midpoint;
  });

  expect(point, "the arrow's line has no point to click").not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
}

test("canvas-selection-dims-arrows", async ({ page, context }) => {
  const { journeyId } = await startJourney(page, context);

  await expectSaved(page);
  await writeDraftDocument(journeyId, dimmingDocument());
  await page.reload();
  await expect(canvasEdges(page)).toHaveCount(3);

  async function expectEmphasis(emphasis: Record<string, string>) {
    for (const [choiceId, value] of Object.entries(emphasis)) {
      await expect(canvasEdge(page, choiceId)).toHaveAttribute(
        "data-emphasis",
        value,
      );
    }
  }

  /** What the arrow is actually drawn at, off the group carrying its opacity. */
  async function arrowOpacity(choiceId: string): Promise<number> {
    const group = canvasEdge(page, choiceId).locator("[data-emphasis-group]");
    await expect(group).toHaveCount(1);
    return Number(
      await group.evaluate(
        (element) => window.getComputedStyle(element).opacity,
      ),
    );
  }

  // The panel opens on the Start, so the Start's two arrows are the ones in
  // hand and the arrow between the other two Steps is not.
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await expectEmphasis({
    "to-clinic": "attached",
    "to-ward": "attached",
    "clinic-to-ward": "dimmed",
  });

  // A Step in the middle: the arrow into it and the arrow out of it.
  await canvasNode(page, "Clinic tent").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  await expectEmphasis({
    "to-clinic": "attached",
    "clinic-to-ward": "attached",
    "to-ward": "dimmed",
  });

  // And "dimmed" is a thing the Author can see, not only an attribute: the
  // arrow that is nobody's is drawn faint, and the one in hand at full.
  expect(await arrowOpacity("to-ward")).toBeLessThan(0.5);
  expect(await arrowOpacity("to-clinic")).toBe(1);

  await page.screenshot({
    path: "test-results/canvas-selection-dims-arrows/canvas-selection-dims-arrows.png",
    fullPage: true,
  });

  // An Ending: both arrows that reach it, and neither of the Start's others.
  await canvasNode(page, "Waved through").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Waved through");
  await expectEmphasis({
    "to-ward": "attached",
    "clinic-to-ward": "attached",
    "to-clinic": "dimmed",
  });
});

test("canvas-legend-outcomes", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Waved through");
  await addStepFromCanvas(page, "Turned back");

  await canvasNode(page, "Border post").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Wait your turn", "Waved through");
  await addChoiceToStep(page, "Walk away", "Turned back");

  await addOutcome(page, "Reached care");
  await addOutcome(page, "Turned away");

  const assigned: Array<[string, string]> = [
    ["Waved through", "Reached care"],
    ["Turned back", "Turned away"],
  ];
  for (const [ending, outcome] of assigned) {
    await canvasNode(page, ending).click();
    await expect(page.getByLabel("Step title")).toHaveValue(ending);
    await page
      .getByLabel("Outcome", { exact: true })
      .selectOption({ label: outcome });
    await expect(canvasNode(page, ending)).toHaveAttribute(
      "data-problems",
      "0",
    );
  }

  // Every Outcome the Journey defines, in document order, between the Start
  // and the Problem marks — and no generic "Ending" entry any more.
  const legend = canvas(page).getByRole("list", { name: "Legend" });
  await expect(legend.getByRole("listitem")).toHaveText([
    "Start",
    "Reached care",
    "Turned away",
    "Problem",
  ]);

  // The color a legend entry shows is the color its Endings carry.
  for (const [index, [ending]] of assigned.entries()) {
    const swatch = legend.locator(
      `[data-outcome-index="${index}"] [data-outcome-swatch]`,
    );
    const bar = canvasNode(page, ending).locator("[data-outcome-bar]");
    const swatchColor = await swatch.evaluate(
      (element) => window.getComputedStyle(element).backgroundColor,
    );
    const barColor = await bar.evaluate(
      (element) => window.getComputedStyle(element).backgroundColor,
    );
    expect(swatchColor).toBe(barColor);
  }

  await expectSaved(page);
  await page.screenshot({
    path: "test-results/canvas-legend-outcomes/canvas-legend-outcomes.png",
    fullPage: true,
  });
});

test("canvas-arrow-select-and-delete", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Clinic tent");

  await canvasNode(page, "Border post").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");
  await expect(canvasEdges(page)).toHaveCount(1);

  // Tagged while it is still reachable, so that when the Choice goes the one
  // thing left wrong with it is that nothing leads there any more.
  await addOutcome(page, "Reached care");
  await canvasNode(page, "Clinic tent").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Reached care" });
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "0",
  );

  // An arrow is clicked to open the Choice it draws, wherever the panel
  // happens to be: the Step the Choice is written on, with its label in hand.
  const choiceId = await canvasEdges(page).getAttribute("data-choice-id");
  expect(choiceId).not.toBeNull();
  const arrow = canvasEdge(page, choiceId!);
  await expect(arrow.getByText("Find the clinic")).toBeVisible();
  // The label as it is drawn: its text sits inside a background chip, so the
  // chip is what a pointer lands on.
  await settledTransform(page);
  await arrow.locator(".react-flow__edge-textwrapper").click();

  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  const label = page.getByLabel("Choice label");
  await expect(label).toHaveValue("Find the clinic");
  await expect(label).toBeFocused();
  await expect(arrow).toHaveAttribute("data-emphasis", "selected");

  await page.screenshot({
    path: "test-results/canvas-arrow-select-and-delete/canvas-arrow-select-and-delete.png",
    fullPage: true,
  });

  // Backspace in the label is typing, never deleting: the field opens with
  // its text selected, so the caret is collapsed to the end of it first.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Backspace");
  await expect(label).toHaveValue("Find the clini");
  await expect(canvasEdges(page)).toHaveCount(1);

  // On the arrow itself, it is the Choice that goes.
  await arrow.focus();
  await expect(arrow).toBeFocused();
  await page.keyboard.press("Delete");

  await expect(canvasEdges(page)).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Choices" }).getByRole("listitem"),
  ).toHaveCount(0);
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "1",
  );

  await expectSaved(page);
});

test("canvas-arrow-select-second-arrow", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Clinic tent");
  await addStepFromCanvas(page, "Turned back");

  await canvasNode(page, "Border post").click();
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");
  await addChoiceToStep(page, "Walk away", "Turned back");
  await expect(canvasEdges(page)).toHaveCount(2);

  // Two arrows out of the same box, in the order the Step writes its
  // Choices: whichever one is clicked is the one in hand, whichever end of
  // the map's own list it happens to sit at.
  const findTheClinic = arrowLabelled(page, "Find the clinic");
  const walkAway = arrowLabelled(page, "Walk away");
  const labels = page.getByLabel("Choice label");

  await clickArrow(page, findTheClinic);
  await expect(findTheClinic).toHaveAttribute("data-emphasis", "selected");
  await expect(walkAway).not.toHaveAttribute("data-emphasis", "selected");
  await expect(labels.nth(0)).toHaveValue("Find the clinic");
  await expect(labels.nth(0)).toBeFocused();

  // The second arrow takes the selection off the first.
  await clickArrow(page, walkAway);
  await expect(walkAway).toHaveAttribute("data-emphasis", "selected");
  await expect(findTheClinic).not.toHaveAttribute("data-emphasis", "selected");
  await expect(labels.nth(1)).toHaveValue("Walk away");
  await expect(labels.nth(1)).toBeFocused();

  // And back: this is the way round that the map used to answer with nothing
  // selected at all, because the arrow being let go of came second.
  await clickArrow(page, findTheClinic);
  await expect(findTheClinic).toHaveAttribute("data-emphasis", "selected");
  await expect(walkAway).not.toHaveAttribute("data-emphasis", "selected");
  await expect(labels.nth(0)).toBeFocused();

  await page.screenshot({
    path: "test-results/canvas-arrow-select-second-arrow/canvas-arrow-select-second-arrow.png",
    fullPage: true,
  });

  // Delete on the arrow in hand takes that Choice and only that Choice.
  await findTheClinic.focus();
  await expect(findTheClinic).toBeFocused();
  await page.keyboard.press("Delete");

  await expect(canvasEdges(page)).toHaveCount(1);
  await expect(arrowLabelled(page, "Find the clinic")).toHaveCount(0);
  const remaining = page
    .getByRole("list", { name: "Choices" })
    .getByRole("listitem");
  await expect(remaining).toHaveCount(1);
  await expect(remaining.getByLabel("Choice label")).toHaveValue("Walk away");

  await expectSaved(page);
});

test.describe("authoring from the map", () => {
  // Closing the page is what finishes the recording, so the file can be
  // copied to the evidence directory named for the test.
  test.afterEach(async ({ page }, testInfo) => {
    const video = page.video();
    await page.close();
    await video?.saveAs(
      `test-results/${testInfo.title}/${testInfo.title}.webm`,
    );
  });

  test("canvas-node-opens-panel-and-edge-appears", async ({
    page,
    context,
  }) => {
    await startJourney(page, context);

    await expect(page.getByLabel("Step title")).toHaveValue("Start");
    await renameStep(page, "Border post");
    await expect(canvasNodes(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveCount(0);

    // Added from the map, and the map has it.
    await addStepFromCanvas(page, "Clinic tent");
    await expect(canvasNodes(page)).toHaveCount(2);

    // Clicking a node is how a Step is opened for editing.
    await canvasNode(page, "Border post").click();
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    // The Choice added in the panel draws its arrow with no reload.
    await addChoiceToStep(page, "Find the clinic", "Clinic tent");
    await expect(canvasEdges(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveAttribute(
      "aria-label",
      "Find the clinic: Border post → Clinic tent",
    );
    await expect(canvasEdges(page).getByText("Find the clinic")).toBeVisible();

    await expectSaved(page);
    await page.screenshot({
      path: "test-results/canvas-node-opens-panel-and-edge-appears/canvas-node-opens-panel-and-edge-appears.png",
      fullPage: true,
    });
  });

  test("canvas-connect-and-retarget-by-dragging", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Clinic tent");
    await addStepFromCanvas(page, "Waved through");
    await expect
      .poll(() => mapFaults(page, 3), { timeout: 20_000 })
      .toEqual([]);

    // Dragged from the Start's connect dot onto the middle of another box:
    // the Choice is made where the Author drew it.
    await dragTo(
      page,
      connectHandle(page, "Border post"),
      canvasNode(page, "Clinic tent"),
    );

    await expect(canvasEdges(page)).toHaveCount(1);
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    // The Choice arrives with nothing written on it, and the panel is
    // waiting on the one thing left to say about it.
    const label = page.getByLabel("Choice label");
    await expect(label).toHaveCount(1);
    await expect(label).toHaveValue("");
    await expect(label).toBeFocused();

    await page.keyboard.type("Find the clinic");
    await expect(label).toHaveValue("Find the clinic");
    await expect(canvasEdges(page).getByText("Find the clinic")).toBeVisible();

    // Dragging the arrow's head onto another box moves the Choice there.
    const choiceId = await canvasEdges(page).getAttribute("data-choice-id");
    expect(choiceId).not.toBeNull();
    const head = canvasEdge(page, choiceId!).locator(
      ".react-flow__edgeupdater-target",
    );
    await expect(head).toHaveCount(1);
    await dragTo(page, head, canvasNode(page, "Waved through"));

    await expect(canvasEdges(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveAttribute(
      "aria-label",
      "Find the clinic: Border post → Waved through",
    );

    await expectSaved(page);
    const stored = await readDraft(journeyId);
    const start = stored.steps[stored.startStepId];
    expect(start.choices).toHaveLength(1);
    expect(stored.steps[start.choices[0].targetStepId].title).toBe(
      "Waved through",
    );

    // A drag that ends on bare map leaves the Draft exactly as it was.
    const nowhere = await emptySpot(page);
    await dragTo(page, connectHandle(page, "Clinic tent"), nowhere);
    await expect(canvasEdges(page)).toHaveCount(1);
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    await page.screenshot({
      path: "test-results/canvas-connect-and-retarget-by-dragging/canvas-connect-and-retarget-by-dragging.png",
      fullPage: true,
    });
  });

  test("canvas-build-by-dragging-and-walk", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Waved through");
    await addStepFromCanvas(page, "Turned back");
    await expect
      .poll(() => mapFaults(page, 3), { timeout: 20_000 })
      .toEqual([]);

    // The whole branch drawn on the map: one drag per Choice, its label
    // typed into the field the drag left waiting.
    await connectByDragging(page, "Border post", "Waved through", 1);
    await page.keyboard.type("Wait your turn");
    await expect(page.getByLabel("Choice label").last()).toHaveValue(
      "Wait your turn",
    );

    await connectByDragging(page, "Border post", "Turned back", 2);
    await page.keyboard.type("Walk away");
    await expect(page.getByLabel("Choice label").last()).toHaveValue(
      "Walk away",
    );
    await expect(canvasEdges(page)).toHaveCount(2);

    await addOutcome(page, "Reached care");
    for (const ending of ["Waved through", "Turned back"]) {
      await canvasNode(page, ending).click();
      await expect(page.getByLabel("Step title")).toHaveValue(ending);
      await page
        .getByLabel("Outcome", { exact: true })
        .selectOption({ label: "Reached care" });
      await expect(canvasNode(page, ending)).toHaveAttribute(
        "data-problems",
        "0",
      );
    }

    await page.getByRole("button", { name: "Validate", exact: true }).click();
    await expect(page.getByText("No problems found.")).toBeVisible();

    await expectSaved(page);
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    await page.screenshot({
      path: "test-results/canvas-build-by-dragging-and-walk/canvas-build-by-dragging-and-walk.png",
      fullPage: true,
    });

    // And a Participant walks what was drawn: a Journey built entirely by
    // dragging is a Journey like any other.
    const participantContext = await context.browser()!.newContext({
      baseURL: E2E_BASE_URL,
    });
    try {
      const participant = await participantContext.newPage();

      await participant.goto(`/j/${journeyId}`);
      await participant.getByRole("button", { name: "Begin" }).click();
      await expect(
        participant.getByRole("heading", { name: "Border post" }),
      ).toBeVisible();

      await participant.getByRole("link", { name: "Walk away" }).click();
      await expect(
        participant.getByRole("heading", { name: "Turned back" }),
      ).toBeVisible();
      await expect(participant.getByText("The end")).toBeVisible();

      await participant.screenshot({
        path: "test-results/canvas-build-by-dragging-and-walk/canvas-build-by-dragging-and-walk-runner.png",
        fullPage: true,
      });
    } finally {
      await participantContext.close();
    }
  });

  test("canvas-build-branch-and-publish", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");

    // Both Endings of the branch, each added from the map.
    await addStepFromCanvas(page, "Waved through");
    await addStepFromCanvas(page, "Turned back");
    await expect(canvasNodes(page)).toHaveCount(3);

    await canvasNode(page, "Border post").click();
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    await addChoiceToStep(page, "Wait your turn", "Waved through");
    await addChoiceToStep(page, "Walk away", "Turned back");
    await expect(canvasEdges(page)).toHaveCount(2);

    await addOutcome(page, "Reached care");
    for (const ending of ["Waved through", "Turned back"]) {
      await canvasNode(page, ending).click();
      await expect(page.getByLabel("Step title")).toHaveValue(ending);
      await page
        .getByLabel("Outcome", { exact: true })
        .selectOption({ label: "Reached care" });
      await expect(canvasNode(page, ending)).toHaveAttribute(
        "data-problems",
        "0",
      );
      // Colored by the Outcome it was tagged with: the first one defined.
      await expect(canvasNode(page, ending)).toHaveAttribute(
        "data-outcome-index",
        "0",
      );
    }

    await page.getByRole("button", { name: "Validate", exact: true }).click();
    await expect(page.getByText("No problems found.")).toBeVisible();

    await expectSaved(page);
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // What the map and the panel built is what the row holds.
    const stored = await readDraft(journeyId);
    expect(Object.keys(stored.steps)).toHaveLength(3);
    expect(stored.steps[stored.startStepId].choices).toHaveLength(2);

    await page.screenshot({
      path: "test-results/canvas-build-branch-and-publish/canvas-build-branch-and-publish.png",
      fullPage: true,
    });
  });
});
