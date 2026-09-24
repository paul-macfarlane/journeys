import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { contentPreview, PREVIEW_LIMIT } from "@/lib/graph/content";
import {
  countCrossingPairs,
  type Point,
  type Polyline,
} from "@/lib/graph/crossings";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

import case3 from "../scripts/seed/journey-stories/case-3.json";

import {
  arrowLabelled,
  chooseStep,
  createJourney,
  createProject,
  findStepByName,
  openFindStep,
  tagWithOutcome,
  uniqueSuffix,
} from "./setup/authoring";
import { dimmingDocument, writeDraftDocument } from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
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
 * from the map itself: adding a Step, opening one in the panel, the moves on
 * the box the Author clicked, drawing a Choice by dragging from one box to
 * another, dropping one on bare map to make the Step it leads to as well,
 * moving the head of the arrow in hand onto another box, and clicking an
 * arrow to take the Choice it draws in hand or delete it — up to building a
 * whole Journey by dragging, and another by dropping, and walking each as a
 * Participant.
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
// the authoring tests below prove is a sequence of moves, not a final screen.
// `video` is a worker option, which Playwright refuses inside a describe, so it
// is set for the file; only the tests under the "authoring from the map"
// describe keep their recording — its `afterEach` saves each one under the test
// that made it — and the rest is Playwright's own scratch output.
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
  // The Draft's line, not the title form's above the tabs (ticket 46).
  await expect(
    page.getByRole("tabpanel", { name: "Editor" }).getByRole("status"),
  ).toHaveText("Saved");
}

/** A signed-in Author on the Journey page of a brand-new Journey. */
async function startJourney(
  page: Page,
  context: BrowserContext,
): Promise<{ projectId: string; journeyId: string }> {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  // Chrome's scroll anchoring, off for every page this context opens. A
  // full-page screenshot resizes the viewport to the page's whole height and
  // back, and Chrome keeps the anchor it chose while the viewport was tall;
  // the next layout change on the map — a box's peek mounting as the pointer
  // reaches it — then makes Chrome "restore" that stale offset, and the page
  // scrolls out from under a click that had already been aimed. No Author's
  // viewport is ever resized like that, so this is the screenshot's artifact
  // to remove, not the app's to guard against. (Found by ticket 12, whose
  // taller panel moved this page's anchor into the live problems list.)
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.overflowAnchor = "none";
    });
  });

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

/**
 * The panel beside the map, on whichever Step the Author has open. Named
 * exactly, because the problems a Step carries are a region inside it.
 */
function stepPanel(page: Page) {
  return page.getByRole("region", { name: "Step", exact: true });
}

/**
 * The Choice row the panel has marked as the one in hand: the arrow the
 * Author clicked, or the Choice they have just drawn. Marked is all it is —
 * nothing here ever holds the keyboard.
 */
function markedChoiceRow(page: Page) {
  return page
    .getByRole("list", { name: "Choices" })
    .locator('li[aria-current="true"]');
}

/** The button on the canvas that brings a hidden panel back. */
function showPanelButton(page: Page) {
  return canvas(page).getByRole("button", { name: "Show panel", exact: true });
}

/**
 * The map given the whole width: the panel put away from its own button. The
 * map is waited out afterwards, because giving it the width re-fits it and a
 * coordinate read mid-fit is a coordinate of somewhere a box no longer is.
 * The transform it settles at is handed back, for a test that asks whether
 * the map was re-fitted at all.
 */
async function hidePanel(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Hide panel", exact: true }).click();
  await expect(stepPanel(page)).toHaveCount(0);
  return settledTransform(page);
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

/**
 * The label drawn on an arrow — the chip halfway along it — by its text. The
 * arrow also carries the whole label as its `<title>`, which a text search
 * would find too, so the chip is asked for by name.
 */
function arrowLabel(arrows: Locator, text: string) {
  return arrows.locator("[data-edge-label]", { hasText: text });
}

/** The arrows marked with a problem. */
function problemEdges(page: Page) {
  return canvas(page).locator('[data-choice-id]:not([data-problems="0"])');
}

/**
 * The Steps "Find step" is offering, in the order it offers them. An option's
 * accessible name is the Step's title alone — the Start and Ending badges and
 * the choice count inside it are decoration — so the name is read rather than
 * the text.
 */
function optionNames(listbox: Locator): Promise<string[]> {
  return listbox
    .getByRole("option")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label") ?? ""),
    );
}

/** Every box's title and where it sits on screen, in one round trip. */
function boxPositions(
  page: Page,
): Promise<{ title: string; top: number; left: number }[]> {
  return canvasNodes(page).evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        title: element.getAttribute("aria-label") ?? "",
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      };
    }),
  );
}

async function renameStep(page: Page, title: string): Promise<void> {
  await page.getByLabel("Step title").fill(title);
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

/**
 * A field typed into key by key, over whatever it already says. Every other
 * write in this file arrives whole, through `fill`, which is one edit however
 * long the text is; only a run of real keystrokes can show that a run of them
 * comes back in a single press. The clearing and the typing are the same field
 * within the same moment, so they are one thing to undo.
 */
async function retypeField(field: Locator, text: string): Promise<void> {
  await field.click();
  await field.press("ControlOrMeta+a");
  await field.pressSequentially(text);
  await expect(field).toHaveValue(text);
}

/** One Step of a stored Draft, by the title the Author gave it. */
function storedStep(document: GraphDocument, title: string) {
  const step = Object.values(document.steps).find(
    (candidate) => candidate.title === title,
  );
  expect(step, `the Draft holds no Step titled "${title}"`).toBeDefined();
  return step!;
}

/** The two buttons the map carries for the Draft's one undo and redo. */
function undoButton(page: Page) {
  return canvas(page).getByRole("button", { name: "Undo", exact: true });
}

function redoButton(page: Page) {
  return canvas(page).getByRole("button", { name: "Redo", exact: true });
}

/** Which way the map is asked to run, as the control says it. */
function directionRadio(page: Page, name: "Top to bottom" | "Left to right") {
  return canvas(page).getByRole("radio", { name, exact: true });
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

/**
 * The Outcome an Ending is grouped by, for an Ending this spec has not opened
 * yet: found by name first, and then tagged the way the panel tags whichever
 * Ending it is showing.
 */
async function tagEndingWithOutcome(
  page: Page,
  endingTitle: string,
  label: string,
): Promise<void> {
  await chooseStep(page, endingTitle);
  await tagWithOutcome(page, label);
}

/** Every arrow's rendered path, sampled every 4 units into a polyline in flow coordinates. */
function sampleArrowPaths(page: Page): Promise<Polyline[]> {
  return samplePaths(
    canvas(page).locator("[data-choice-id] path.react-flow__edge-path"),
  );
}

/** The same sampling, over whichever arrows' drawn paths are handed to it. */
function samplePaths(paths: Locator): Promise<Polyline[]> {
  return paths.evaluateAll((elements) =>
    elements.map((element) => {
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

/**
 * A handle's own centre sits a pixel inside the box it belongs to, so an arrow
 * that leaves one starts a pixel inside too: a route that runs "through the
 * box" is one that goes further in than that.
 */
const ROUTE_TOLERANCE = 2;

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
 * on its middle would reach the box rather than an overlay (the Controls)
 * sitting on top of it.
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
async function mapInView(page: Page): Promise<void> {
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
async function settledTransform(page: Page): Promise<string> {
  await mapInView(page);
  const viewport = canvas(page).locator(".react-flow__viewport");
  let last: string | null = null;
  let still = 0;

  await expect
    .poll(
      async () => {
        const now = await viewport.evaluate(
          (element) => (element as HTMLElement).style.transform,
        );
        still = now === last ? still + 1 : 0;
        last = now;
        return still;
      },
      { timeout: 10_000, intervals: [SETTLE_INTERVAL_MS] },
    )
    .toBeGreaterThanOrEqual(SETTLED_POLLS);

  return last ?? "";
}

/**
 * One box brought onto the map: the whole of it inside the Canvas frame.
 * Polled, because bringing it there is an animation the browser finishes when
 * it finishes.
 */
async function expectBoxOnMap(page: Page, title: string): Promise<void> {
  await expect
    .poll(
      async () =>
        (await nodeViews(page)).find((view) => view.title === title)
          ?.fullyInside,
      { timeout: 10_000 },
    )
    .toBe(true);
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
async function fitWholeMap(page: Page, boxes: number): Promise<void> {
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
 * The map centered on a box rather than nudged just far enough to fit it in:
 * the box's middle within a quarter of the frame's width and height of the
 * frame's own middle.
 */
async function expectCenteredOnMap(page: Page, title: string): Promise<void> {
  await settledTransform(page);

  const frame = await canvas(page).boundingBox();
  expect(frame).not.toBeNull();
  const box = await canvasNode(page, title).boundingBox();
  expect(box).not.toBeNull();

  expect(
    Math.abs(box!.x + box!.width / 2 - (frame!.x + frame!.width / 2)),
  ).toBeLessThan(frame!.width / 4);
  expect(
    Math.abs(box!.y + box!.height / 2 - (frame!.y + frame!.height / 2)),
  ).toBeLessThan(frame!.height / 4);
}

/** One box's wrapper on the map, which is what carries its handles. */
function canvasNodeBox(page: Page, title: string) {
  return canvas(page)
    .locator(".react-flow__node")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
}

/**
 * One box's rectangle in flow coordinates — the coordinates an arrow's path is
 * drawn in, so the two can be compared. React Flow places a box by translating
 * it inside the viewport, and the viewport carries the zoom, so the box's own
 * offsets are its flow size whatever the map is zoomed to.
 */
function nodeFlowRect(page: Page, title: string): Promise<Box> {
  return canvasNodeBox(page, title).evaluate((element) => {
    const node = element as HTMLElement;
    const at = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(
      node.style.transform,
    );
    return {
      x: at === null ? Number.NaN : Number(at[1]),
      y: at === null ? Number.NaN : Number(at[2]),
      width: node.offsetWidth,
      height: node.offsetHeight,
    };
  });
}

/**
 * Where the Steps a Step leads to stand relative to its own box: past its
 * right edge when the map runs left to right, past its bottom edge when it
 * runs top to bottom. Read in flow coordinates, so whatever zoom the fit
 * landed on does not come into it.
 */
async function expectTargetsPast(
  page: Page,
  from: string,
  targets: string[],
  edge: "right" | "bottom",
): Promise<void> {
  await settledTransform(page);
  const fromRect = await nodeFlowRect(page, from);

  for (const title of targets) {
    const target = await nodeFlowRect(page, title);
    if (edge === "right") {
      expect(
        target.x,
        `"${title}" is not past the right edge of "${from}"`,
      ).toBeGreaterThan(fromRect.x + fromRect.width);
    } else {
      expect(
        target.y,
        `"${title}" is not past the bottom edge of "${from}"`,
      ).toBeGreaterThan(fromRect.y + fromRect.height);
    }
  }
}

/**
 * Where the Steps a Step's Choices lead to stand relative to one another: in
 * Choice order across the map — left to right when it runs top to bottom,
 * top to bottom when it runs left to right — so the map reads the same way
 * round as the panel's Choice list. Read in flow coordinates like
 * `expectTargetsPast`.
 */
async function expectTargetsInChoiceOrder(
  page: Page,
  targets: string[],
  across: "x" | "y",
): Promise<void> {
  await settledTransform(page);
  const rects = await Promise.all(
    targets.map((title) => nodeFlowRect(page, title)),
  );
  for (let index = 1; index < rects.length; index += 1) {
    expect(
      rects[index][across],
      `"${targets[index]}" is not past "${targets[index - 1]}" across the map`,
    ).toBeGreaterThan(rects[index - 1][across]);
  }
}

/**
 * Every arrow's label, checked against the boxes at its two ends: on a map
 * running left to right the label is drawn in the gap between them — past
 * the right edge of the box it leaves and short of the left edge of the box
 * it reaches — rather than over either. Read off the screen, where the boxes
 * and the labels share one zoom. A fault per label that is not; `[]` when
 * every one is.
 */
async function labelsOutsideGaps(
  page: Page,
  document: GraphDocument,
): Promise<string[]> {
  const targetByEdgeId = new Map<string, string>();
  for (const [stepId, step] of Object.entries(document.steps)) {
    for (const choice of step.choices) {
      targetByEdgeId.set(`${stepId}:${choice.id}`, choice.targetStepId);
    }
  }

  return canvas(page)
    .locator(".react-flow__edge")
    .evaluateAll((elements, targets) => {
      const faults: string[] = [];
      const boxRect = (stepId: string) =>
        window.document
          .querySelector(`.react-flow__node[data-id="${stepId}"]`)
          ?.getBoundingClientRect();

      for (const element of elements) {
        const edgeId = element.getAttribute("data-id") ?? "";
        const label = element.querySelector("[data-edge-label]");
        if (label === null) {
          faults.push(`${edgeId} has no label`);
          continue;
        }
        const sourceId = edgeId.slice(0, edgeId.indexOf(":"));
        const source = boxRect(sourceId);
        const target = boxRect(targets[edgeId] ?? "");
        if (source === undefined || target === undefined) {
          faults.push(`${edgeId} has no boxes to measure against`);
          continue;
        }
        const rect = label.getBoundingClientRect();
        if (rect.left < source.right - 1 || rect.right > target.left + 1) {
          faults.push(
            `${edgeId} label spans ${Math.round(rect.left)} to ${Math.round(rect.right)}, gap ${Math.round(source.right)} to ${Math.round(target.left)}`,
          );
        }
      }
      return faults;
    }, Object.fromEntries(targetByEdgeId));
}

/** Two rectangles on the screen that share any area. */
function rectsOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** The dot an Author drags from to connect a box to another. */
function connectHandle(page: Page, title: string) {
  return canvasNodeBox(page, title).locator('[data-handleid="connect"]');
}

/**
 * One box clicked, the way an Author clicks one: once the map has stopped
 * moving. Adding a Step, opening the problems list above the map, or a
 * fit-to-view can all still be moving the box when the next line runs, and
 * a click made while it moves lands where the box was.
 */
async function clickBox(page: Page, title: string): Promise<void> {
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

/** The group of moves a box carries, once the Author has clicked that box. */
function boxToolbar(page: Page, title: string) {
  return canvas(page).getByRole("group", { name: `${title} actions` });
}

/**
 * The moves on a box, reached the way an Author reaches them: the box clicked,
 * which is what puts them there at all, and the one button they stay folded
 * into until it is pressed.
 */
async function stepActions(page: Page, title: string): Promise<Locator> {
  await clickBox(page, title);

  const opener = boxToolbar(page, title).getByRole("button", {
    name: "Step actions",
    exact: true,
  });
  await expect(opener).toBeVisible();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  return opener;
}

/** The same box with its moves folded out: the group holding all five. */
async function expandStepActions(page: Page, title: string): Promise<Locator> {
  const opener = await stepActions(page, title);
  // Clicking the box can have taken the map to it, and a button pressed while
  // the map is still moving is a button pressed where it no longer is.
  await settledTransform(page);
  await toolbarOntoMap(page, title);
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");

  return boxToolbar(page, title);
}

/**
 * A box's moves brought inside the map's frame before they are pressed. After
 * a fit of the whole map at a high zoom the top box sits a few pixels under
 * the frame's top edge and its moves, drawn above it, hang over the edge,
 * where the frame clips them beneath the Map controls row: a pointer aimed
 * there lands on the row. Before the navbar was sticky (ticket 34) the click
 * went through by accident — Playwright's last-resort scroll put the frame's
 * top edge on the window's, and the sliver of a button still inside the
 * frame took the click; with the bar covering the window's top 56px there is
 * no sliver to take it. So the map is zoomed out a notch, through its own
 * control, until the moves are inside the frame — what an Author does when a
 * box's moves are cut off — which never fires the pane click that would fold
 * them away.
 */
async function toolbarOntoMap(page: Page, title: string): Promise<void> {
  const pane = canvas(page).locator(".react-flow");
  for (let notch = 0; notch < 3; notch += 1) {
    const frame = await pane.boundingBox();
    const moves = await boxToolbar(page, title).boundingBox();
    if (frame === null || moves === null || moves.y >= frame.y + 4) return;

    await canvas(page)
      .getByRole("button", { name: /zoom out/i })
      .click();
    await settledTransform(page);
  }
}

/** What the map is zoomed to, read off the transform it has settled at. */
async function zoomOf(page: Page): Promise<number> {
  const transform = await settledTransform(page);
  const scale = /scale\(([\d.]+)\)/.exec(transform);
  expect(scale, `no zoom in the map's transform "${transform}"`).not.toBeNull();
  return Number(scale![1]);
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
 * The pointer moved onto a box, at the coordinates the box is actually at.
 * Playwright's own `hover()` first asks the browser to scroll the box into
 * view, which scrolls the map's pane; React Flow answers a scrolled pane by
 * scrolling it straight back, and the box slides out from under the pointer
 * that had just arrived on it.
 */
async function hoverBox(page: Page, title: string): Promise<void> {
  await settledTransform(page);
  const at = await centerOf(canvasNode(page, title));
  await page.mouse.move(at.x, at.y);
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
 * the new Choice's row marked as the one in hand. The label field on that row
 * is handed back, because what the drag left to say is what the Choice is
 * called — and it is reached for rather than typed into, the Author's hands
 * being still on the map.
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
): Promise<Locator> {
  await dragTo(page, connectHandle(page, from), canvasNode(page, to));

  await expect(canvasEdges(page)).toHaveCount(expectedEdges);
  await expect(page.getByLabel("Step title")).toHaveValue(from);

  const marked = markedChoiceRow(page);
  await expect(marked).toHaveCount(1);
  const label = marked.getByLabel("Choice label");
  await expect(label).toHaveValue("");
  return label;
}

/**
 * One Choice dropped where there is no Step to lead to: dragged from the
 * box's connect dot onto bare map, which makes the Step as well and opens it
 * with its title field waiting to be written into.
 */
async function dropChoiceOnEmptyMap(
  page: Page,
  fromTitle: string,
): Promise<void> {
  // The whole map inside the window first: a drag runs between two points the
  // pointer has to be able to reach, and on a map zoomed in on one box the
  // connect dot can sit below the fold of a short window.
  await settledTransform(page);
  await canvas(page).scrollIntoViewIfNeeded();

  const nowhere = await emptySpot(page);
  await dragTo(page, connectHandle(page, fromTitle), nowhere);

  const title = page.getByLabel("Step title");
  await expect(title).toHaveValue("Untitled step");
  await expect(title).toBeFocused();
}

/**
 * The finish both branch-building tests share, whichever way round the map
 * they built it on runs: the one Outcome added and both Endings tagged with
 * it, the Draft validated, saved and published, and the Journey walked by a
 * Participant down the Choice they take to an Ending. What each of those
 * tests proves is the way its branch was made; everything after that is the
 * same, and is done here once. The map and the runner are photographed under
 * the test's own name, so each keeps its own proof.
 */
async function tagEndingsPublishAndWalk(
  page: Page,
  context: BrowserContext,
  journeyId: string,
  testInfo: TestInfo,
): Promise<void> {
  for (const ending of ["Waved through", "Turned back"]) {
    await tagEndingWithOutcome(page, ending, "Reached care");
    await expect(canvasNode(page, ending)).toHaveAttribute(
      "data-problems",
      "0",
    );
  }

  await expect(page.getByText("No problems", { exact: true })).toBeVisible();

  await expectSaved(page);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await page.screenshot({
    path: evidencePath(testInfo.title, `${testInfo.title}.png`),
    fullPage: true,
  });

  // And a Participant walks what was drawn: how the Journey was built, and
  // how the Author was looking at it while they built it, is nothing the walk
  // knows about.
  const participantContext = await context.browser()!.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: "Border post" }),
    ).toBeVisible();

    await participant.getByRole("button", { name: "Walk away" }).click();
    await expect(
      participant.getByRole("heading", { name: "Turned back" }),
    ).toBeVisible();
    await expect(participant.getByText("The end")).toBeVisible();

    await participant.screenshot({
      path: evidencePath(testInfo.title, `${testInfo.title}-runner.png`),
      fullPage: true,
    });
  } finally {
    await participantContext.close();
  }
}

/**
 * The two directions the map can be drawn in: which edge of a box the Step a
 * Choice leads to stands past, and which edge a Choice that leads back to its
 * own Step loops around — out past the right running top to bottom, out past
 * the bottom running left to right, the same route turned a quarter.
 *
 * The moves an Author makes from the map are proved in both, because the
 * anchors an arrow leaves and arrives at move to the sides of the box when
 * the map turns, and nothing else about making a Choice, moving one, or
 * looping one back does.
 */
const DIRECTIONS = [
  {
    name: "Top to bottom",
    suffix: "",
    /**
     * Whether the map has to be turned before the moves are made: a new Draft
     * is drawn top to bottom, so that one is already what is in front of the
     * Author.
     */
    turns: false,
    targetPast: "bottom",
    loopPast: "right",
  },
  {
    name: "Left to right",
    suffix: "-left-to-right",
    turns: true,
    targetPast: "right",
    loopPast: "bottom",
  },
] as const;

/** The map turned, from the control beside "Add step". */
async function setDirection(
  page: Page,
  name: "Top to bottom" | "Left to right",
): Promise<void> {
  const radio = canvas(page).getByRole("radio", { name, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
}

for (const direction of DIRECTIONS) {
  test(`canvas-add-next-step${direction.suffix}`, async ({
    page,
    context,
  }, testInfo) => {
    await startJourney(page, context);

    // A new Draft is drawn top to bottom, so that one is already the map in
    // front of the Author; the other is switched to first.
    if (direction.turns) await setDirection(page, direction.name);

    await renameStep(page, "Border post");
    await expect(canvasNodes(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveCount(0);

    // The box the Author clicks carries the moves that change the shape of
    // the Journey around it, folded out from the one button they arrive as.
    const toolbar = await expandStepActions(page, "Border post");
    await toolbar
      .getByRole("button", { name: "Add next step", exact: true })
      .click();

    // A Step, and the Choice that reaches it, in one motion.
    await expect(canvasNodes(page)).toHaveCount(2);
    await expect(canvasEdges(page)).toHaveCount(1);
    await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
    await expect(page.getByLabel("Step title")).toBeFocused();

    // And the map went to where it put it.
    await expectBoxOnMap(page, "Untitled step");

    await renameStep(page, "Clinic tent");
    await expect(canvasEdges(page)).toHaveAttribute(
      "aria-label",
      "Untitled choice: Border post → Clinic tent",
    );

    // Where it put it is the way the map runs: below the Step it was added
    // to, or to the right of it.
    await expectTargetsPast(
      page,
      "Border post",
      ["Clinic tent"],
      direction.targetPast,
    );

    // The same moves, on the box the Author clicks next, make the Step it is
    // on the one the Journey starts from.
    const clinicToolbar = await expandStepActions(page, "Clinic tent");
    await clinicToolbar
      .getByRole("button", { name: "Make this the start", exact: true })
      .click();
    await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
      "data-kind",
      "start",
    );

    await expectSaved(page);
    await page.screenshot({
      path: evidencePath(testInfo.title, `${testInfo.title}.png`),
      fullPage: true,
    });
  });
}

test("canvas-duplicate-step", async ({ page, context }) => {
  const { journeyId } = await startJourney(page, context);

  await renameStep(page, "Border post");

  const sentence = "Participants pass through a checkpoint before crossing.";
  await page.getByLabel("Step content").click();
  await page.keyboard.type(sentence);
  await expect(page.getByLabel("Step content")).toContainText(sentence);

  // The Start has no Choices, so it is an Ending and carries an Outcome.
  await tagEndingWithOutcome(page, "Border post", "Reached care");
  await expectSaved(page);

  // "Duplicate" on the box's own moves, folded out from the box itself.
  const toolbar = await expandStepActions(page, "Border post");
  await toolbar.getByRole("button", { name: "Duplicate", exact: true }).click();

  // The copy is what the panel opens on, with its title field focused, and
  // it carries the original's content and Outcome.
  await expect(page.getByLabel("Step title")).toHaveValue("Border post copy");
  await expect(page.getByLabel("Step title")).toBeFocused();
  await expect(page.getByLabel("Step content")).toContainText(sentence);
  await expect(page.getByLabel("Outcome", { exact: true })).toHaveText(
    "Reached care",
  );
  await expect(canvasNodes(page)).toHaveCount(2);

  await expectBoxOnMap(page, "Border post copy");

  await expectSaved(page);
  const stored = await readDraft(journeyId);
  const original = Object.values(stored.steps).find(
    (step) => step.title === "Border post",
  );
  expect(original, "the original Step is gone from the Draft").toBeDefined();
  const copies = Object.values(stored.steps).filter(
    (step) => step.title === "Border post copy",
  );
  expect(copies).toHaveLength(1);
  expect(copies[0].choices).toEqual([]);
  expect(copies[0].content).toEqual(original!.content);
  expect(copies[0].outcomeId).toBe(original!.outcomeId);
  expect(copies[0].prompt).toBeNull();

  // "Zoom to step" on the copy's own moves.
  const copyToolbar = await expandStepActions(page, "Border post copy");
  await copyToolbar
    .getByRole("button", { name: "Zoom to step", exact: true })
    .click();

  await expectBoxOnMap(page, "Border post copy");
  await expectCenteredOnMap(page, "Border post copy");

  // The panel footer's own "Duplicate", scoped off the box toolbar's.
  await page
    .getByRole("region", { name: "Step" })
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue(
    "Border post copy copy",
  );
  await expect(page.getByLabel("Step title")).toBeFocused();
  await expect(canvasNodes(page)).toHaveCount(3);

  await expectSaved(page);
  await page.screenshot({
    path: evidencePath("canvas-duplicate-step", "canvas-duplicate-step.png"),
    fullPage: true,
  });
});

test("canvas-content-peek", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");

  // Longer than a peek shows, so what the box offers is the opening of the
  // Step rather than the whole of it.
  const opening =
    "Participants queue at the border post from before first light, holding papers they cannot read, waiting on a stamp that decides where the day ends.";
  expect(opening.length).toBeGreaterThan(PREVIEW_LIMIT);

  await page.getByLabel("Step content").click();
  await page.keyboard.type(opening);
  await expect(page.getByLabel("Step content")).toContainText(opening);

  // A box reads out its problems above its content, and this one has none:
  // the Start is an Ending until it leads somewhere, and an Ending needs no
  // Outcome. So this peek is the content alone.
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );
  await expectSaved(page);

  // Nothing is peeked at until a box is hovered or focused.
  const peek = page.getByRole("tooltip");
  await expect(peek).toHaveCount(0);

  await hoverBox(page, "Border post");
  await expect(peek).toBeVisible();
  expect(await peek.textContent()).toBe(`${opening.slice(0, PREVIEW_LIMIT)}…`);
  expect(await peek.textContent()).toHaveLength(PREVIEW_LIMIT + 1);

  await page.screenshot({
    path: evidencePath("canvas-content-peek", "canvas-content-peek.png"),
    fullPage: true,
  });

  // Off the box, and the peek goes with it.
  const nowhere = await emptySpot(page);
  await page.mouse.move(nowhere.x, nowhere.y);
  await expect(peek).toHaveCount(0);

  // Focus alone shows it: skimming the map is not only a pointer's.
  await canvasNode(page, "Border post").focus();
  await expect(peek).toBeVisible();
  expect(await peek.textContent()).toBe(`${opening.slice(0, PREVIEW_LIMIT)}…`);

  // A Step with nothing written on it says so, under the problems it carries:
  // this one is a Step nothing leads to.
  await addStepFromCanvas(page, "Empty tent");
  await expect(canvasNode(page, "Empty tent")).toHaveAttribute(
    "data-problems",
    "1",
  );

  await hoverBox(page, "Empty tent");
  await expect(peek).toBeVisible();
  expect((await peek.textContent())?.split("\n")).toEqual([
    'Step "Empty tent" cannot be reached from the start',
    "No content yet",
  ]);
});

test("canvas-keyboard-navigation", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");

  // A Start with two children: the shape the arrow keys are for.
  const firstChild = await expandStepActions(page, "Border post");
  await firstChild
    .getByRole("button", { name: "Add next step", exact: true })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await renameStep(page, "Waved through");

  // The Step just made was zoomed to, at the zoom a lone Start was fitted
  // at, which leaves the Start itself off the top of the map: the whole map
  // is asked for before its box is reached for again.
  await fitWholeMap(page, 2);
  const secondChild = await expandStepActions(page, "Border post");
  await secondChild
    .getByRole("button", { name: "Add next step", exact: true })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await renameStep(page, "Turned back");
  await expectSaved(page);

  // A Step added takes the map to its own box rather than out to the whole
  // map, and walking the whole map with the arrow keys is what this is
  // about: the Author asks for the whole map back first, as they would.
  await fitWholeMap(page, 3);

  /** Which box the keyboard is on, by the name the map gives it. */
  const focusedBox = () =>
    page.evaluate(
      () => window.document.activeElement?.getAttribute("aria-label") ?? "",
    );

  await canvasNode(page, "Border post").focus();
  await expect.poll(focusedBox).toBe("Border post");

  // Down from the Start reaches one of the two children below it.
  await page.keyboard.press("ArrowDown");
  await expect.poll(focusedBox).toMatch(/^(Waved through|Turned back)$/);
  const child = await focusedBox();
  const sibling = child === "Waved through" ? "Turned back" : "Waved through";

  // And sideways reaches the other, whichever side of it the map laid it on.
  const positions = await boxPositions(page);
  const leftOf = (title: string) =>
    positions.find((box) => box.title === title)?.left ?? 0;
  await page.keyboard.press(
    leftOf(sibling) > leftOf(child) ? "ArrowRight" : "ArrowLeft",
  );
  await expect.poll(focusedBox).toBe(sibling);

  // Up returns to the Start: the only box above either child.
  await page.keyboard.press("ArrowUp");
  await expect.poll(focusedBox).toBe("Border post");

  // Enter on a focused box opens it in the panel, as a click does.
  await page.keyboard.press("ArrowDown");
  const opened = await focusedBox();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Step title")).toHaveValue(opened);

  await page.screenshot({
    path: evidencePath(
      "canvas-keyboard-navigation",
      "canvas-keyboard-navigation.png",
    ),
    fullPage: true,
  });

  // Escape leaves the map itself holding the keyboard, and no box.
  await canvasNode(page, opened).focus();
  await expect.poll(focusedBox).toBe(opened);
  await page.keyboard.press("Escape");
  await expect.poll(focusedBox).toBe("Canvas");
});

test("canvas-hide-and-show-panel", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Clinic tent");
  await expectBoxOnMap(page, "Clinic tent");
  await addStepFromCanvas(page, "Waved through");
  await expectBoxOnMap(page, "Waved through");
  await fitWholeMap(page, 3);

  // How wide the map is with the panel beside it, and where it sits in that
  // width, to measure the rest by.
  const besideTransform = await settledTransform(page);
  const beside = await canvas(page).boundingBox();
  expect(beside, "the canvas has no box yet").not.toBeNull();
  const besideWidth = beside!.width;

  // Put away, the panel gives the map the whole width — and the map is laid
  // out into it rather than left sitting in the middle of it.
  const widenedTransform = await hidePanel(page);
  await expect
    .poll(async () => (await canvas(page).boundingBox())?.width ?? 0, {
      timeout: 10_000,
    })
    .toBeGreaterThan(besideWidth);
  expect(
    widenedTransform,
    "the map was left in the view it had in the narrower frame",
  ).not.toBe(besideTransform);
  await expect.poll(() => mapFaults(page, 3), { timeout: 20_000 }).toEqual([]);

  // Remembered by the browser, never written to the Journey: how an Author
  // reads the map is theirs, and the Draft says nothing about it.
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("journeys:step-panel"),
    ),
  ).toBe("hidden");
  await expect(showPanelButton(page)).toBeVisible();

  // Opening a Step brings the panel back on its own: the gesture an Author
  // edits with never changes for the panel being away. It brings it back for
  // this page only — what the browser remembers is the choice the Author
  // made, and clicking a box is not that choice.
  await clickBox(page, "Clinic tent");
  await expect(stepPanel(page)).toBeVisible();
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  // The frame narrows around the box that was clicked rather than the whole
  // map being fitted into it again: the box the Author reached for is what
  // the map is left showing.
  await expectBoxOnMap(page, "Clinic tent");
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("journeys:step-panel"),
    ),
  ).toBe("hidden");

  await expectSaved(page);
  await page.reload();
  await expect(canvas(page)).toBeVisible();

  // So the choice outlives the page: the panel is away again after a reload,
  // though it was on screen when the reload happened.
  await expect.poll(() => stepPanel(page).count(), { timeout: 10_000 }).toBe(0);
  await expect(showPanelButton(page)).toBeVisible();

  await showPanelButton(page).click();
  await expect(stepPanel(page)).toBeVisible();
  await expect
    .poll(
      async () =>
        Math.abs(
          ((await canvas(page).boundingBox())?.width ?? 0) - besideWidth,
        ),
      { timeout: 10_000 },
    )
    .toBeLessThanOrEqual(1);
  // And the map is laid out into the width it has back, as it was into the
  // width it was given.
  await expect.poll(() => mapFaults(page, 3), { timeout: 20_000 }).toEqual([]);

  // Escape off a box lands the keyboard on the map; a second Escape, with the
  // map itself holding it, puts the panel away.
  await clickBox(page, "Border post");
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await canvasNode(page, "Border post").focus();
  await page.keyboard.press("Escape");
  await expect(canvas(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(stepPanel(page)).toHaveCount(0);

  await settledTransform(page);
  await page.screenshot({
    path: evidencePath(
      "canvas-hide-and-show-panel",
      "canvas-hide-and-show-panel.png",
    ),
    fullPage: true,
  });
});

test("canvas-step-actions", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Clinic tent");
  await addStepFromCanvas(page, "Waved through");
  await expectSaved(page);

  // The map as an Author finds it on opening the Journey: the panel is on the
  // Start, and no box on the map says anything about the moves it carries.
  await page.reload();
  await expect(canvas(page)).toBeVisible();
  await expect(canvasNodes(page)).toHaveCount(3);
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");

  const anyActions = page.getByRole("button", {
    name: "Step actions",
    exact: true,
  });
  const anyToolbar = canvas(page).getByRole("group", { name: / actions$/ });
  await expect(anyActions).toHaveCount(0);
  await expect(anyToolbar).toHaveCount(0);

  // Clicking a box is what puts them there, and they arrive folded into one
  // button rather than lying over the map.
  const opener = await stepActions(page, "Clinic tent");
  const toolbar = boxToolbar(page, "Clinic tent");
  const moves = [
    "Add next step",
    "Duplicate",
    "Zoom to step",
    "Make this the start",
    "Delete step",
  ];
  for (const move of moves) {
    await expect(
      toolbar.getByRole("button", { name: move, exact: true }),
    ).toHaveCount(0);
  }

  // And folded out, they are the five the panel's foot carries plus the one
  // that only moves the view.
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  for (const move of moves) {
    await expect(
      toolbar.getByRole("button", { name: move, exact: true }),
    ).toBeVisible();
  }

  await page.screenshot({
    path: evidencePath("canvas-step-actions", "canvas-step-actions.png"),
    fullPage: true,
  });

  // Escape anywhere inside the group folds it back up and leaves the keyboard
  // on the button it folded into, rather than on a button that has gone.
  await toolbar.getByRole("button", { name: "Duplicate", exact: true }).focus();
  await page.keyboard.press("Escape");

  await expect(opener).toHaveAttribute("aria-expanded", "false");
  for (const move of moves) {
    await expect(
      toolbar.getByRole("button", { name: move, exact: true }),
    ).toHaveCount(0);
  }
  await expect(opener).toBeFocused();

  // A Step opened by name carries none of it: the moves belong to the box the
  // Author clicked, not to whichever Step the panel has open.
  await chooseStep(page, "Border post");
  await expect(anyActions).toHaveCount(0);
  await expect(anyToolbar).toHaveCount(0);

  // The Start is never offered a delete — not on its box, not at the foot
  // of the panel — because it cannot be deleted while it is the Start, and a
  // button that only ever refuses is not a move. Another Step's box and
  // panel still carry one.
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await expect(
    stepPanel(page).getByRole("button", { name: "Delete step", exact: true }),
  ).toHaveCount(0);
  const startToolbar = await expandStepActions(page, "Border post");
  await expect(
    startToolbar.getByRole("button", { name: "Add next step", exact: true }),
  ).toBeVisible();
  await expect(
    startToolbar.getByRole("button", { name: "Delete step", exact: true }),
  ).toHaveCount(0);

  // The Start is the top box of the map, and its moves fold out above it:
  // the controls that are always there — "Find step", "Add step", which way
  // the map runs — are a row of their own above the map, so the two never
  // lie over one another, and the controls are where they were once the map
  // is zoomed.
  const controls = canvas(page).getByRole("group", { name: "Map controls" });
  const controlsBox = await controls.boundingBox();
  const toolbarBox = await startToolbar.boundingBox();
  expect(controlsBox, "the map controls have no box").not.toBeNull();
  expect(toolbarBox, "the Start's moves have no box").not.toBeNull();
  expect(rectsOverlap(controlsBox!, toolbarBox!)).toBe(false);
  // Reaching for the Controls at the foot of the map scrolls the page, so
  // where the controls sit is read against the Canvas rather than the window.
  const frameBox = await canvas(page).boundingBox();
  expect(frameBox, "the canvas has no box").not.toBeNull();
  await canvas(page)
    .getByRole("button", { name: /zoom in/i })
    .click();
  await settledTransform(page);
  await expect(controls).toBeVisible();
  const controlsAfter = await controls.boundingBox();
  const frameAfter = await canvas(page).boundingBox();
  expect(controlsAfter!.y - frameAfter!.y).toBe(controlsBox!.y - frameBox!.y);
  expect(controlsAfter!.height).toBe(controlsBox!.height);

  // And no minimap: nothing on the map but the map.
  await expect(canvas(page).locator(".react-flow__minimap")).toHaveCount(0);

  // While another Step's box still offers the delete, and so does the panel
  // once that Step is open. Zooming in with the view on the Start pushed the
  // other boxes toward the frame's edge — past it on a machine whose fonts
  // make the boxes taller — and a box outside the frame cannot be clicked,
  // so the whole map is asked for first.
  await fitWholeMap(page, 3);
  const clinicToolbar = await expandStepActions(page, "Clinic tent");
  await expect(
    clinicToolbar.getByRole("button", { name: "Delete step", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
  await expect(
    stepPanel(page).getByRole("button", { name: "Delete step", exact: true }),
  ).toBeVisible();
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
      path: evidencePath("canvas-case-3-map", "canvas-case-3-map.png"),
      fullPage: true,
    });
  });

  test("canvas-layout-direction", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    const seeded = graphDocumentSchema.parse(case3);
    const stepCount = Object.keys(seeded.steps).length;

    // A Draft with nothing said about it is drawn top to bottom, and the
    // seeded document says nothing about it.
    expect(seeded.layoutDirection).toBe("TB");

    // Where the Start's own Choices lead, by the titles the seeded document
    // gives those Steps: what turning the map has to move.
    const start = seeded.steps[seeded.startStepId];
    const targets = [
      ...new Set(
        start.choices.map((choice) => seeded.steps[choice.targetStepId].title),
      ),
    ];
    expect(targets.length).toBeGreaterThan(0);

    await expectSaved(page);
    await writeDraftDocument(journeyId, seeded);
    await page.reload();

    await expect(canvasNodes(page)).toHaveCount(stepCount);
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    // Turned a quarter from the control beside "Add step": the whole map is
    // fitted again on its own, thirty-six boxes still fit inside the Canvas
    // without one lying over another, and every Step the Start leads to now
    // stands past the right edge of its box rather than below it.
    await setDirection(page, "Left to right");
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);
    await expectTargetsPast(page, start.title, targets, "right");

    // Running left to right a Choice's label lies along its arrow, so the
    // gap between ranks is wide enough for one and a long one is cut short
    // with an ellipsis: every label is drawn in the gap between its boxes.
    expect(await labelsOutsideGaps(page, seeded)).toEqual([]);

    // The whole of the longest Choice in the Draft is still there to be
    // read: it is the arrow's accessible name and its title, and the panel's
    // row shows it in full.
    const longest = Object.values(seeded.steps)
      .flatMap((step) =>
        step.choices.map((choice, index) => ({ step, choice, index })),
      )
      .toSorted((a, b) => b.choice.label.length - a.choice.label.length)[0];
    expect(longest.choice.label.length).toBeGreaterThan(60);
    const longestArrow = canvasEdge(page, longest.choice.id);
    await expect(longestArrow).toHaveAttribute(
      "aria-label",
      new RegExp(`^${longest.choice.label}: `),
    );
    await expect(longestArrow.locator("title")).toHaveText(
      longest.choice.label,
    );
    await chooseStep(page, longest.step.title);
    await expect(
      page
        .getByRole("list", { name: "Choices" })
        .getByLabel("Choice label", { exact: true })
        .nth(longest.index),
    ).toHaveValue(longest.choice.label);

    // And it is the Journey's direction, not this browser's: it is stored on
    // the Draft, where the next Member to open it reads it.
    await expectSaved(page);
    expect((await readDraft(journeyId)).layoutDirection).toBe("LR");

    await page.screenshot({
      path: evidencePath(
        "canvas-layout-direction",
        "canvas-layout-direction-left-to-right.png",
      ),
      fullPage: true,
    });

    // A reload stands in for that Member: the same map, and the control says
    // which one it is.
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect(canvasNodes(page)).toHaveCount(stepCount);
    await expect(
      canvas(page).getByRole("radio", { name: "Left to right", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);
    await expectTargetsPast(page, start.title, targets, "right");

    // And back again, which puts them below the Start once more.
    await setDirection(page, "Top to bottom");
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);
    await expectTargetsPast(page, start.title, targets, "bottom");

    await expectSaved(page);
    expect((await readDraft(journeyId)).layoutDirection).toBe("TB");

    await page.screenshot({
      path: evidencePath(
        "canvas-layout-direction",
        "canvas-layout-direction-top-to-bottom.png",
      ),
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

    // The Step to open: the last one "Find step" offers that is off the map
    // right now, falling back to any that is not wholly on it.
    await openFindStep(page);
    const stepsListbox = page.getByRole("listbox", { name: "Steps" });
    const listed = await optionNames(stepsListbox);
    const views = await nodeViews(page);
    const isOffScreen = (title: string) =>
      views.some((view) => view.title === title && !view.showing);
    const isPartly = (title: string) =>
      views.some((view) => view.title === title && !view.fullyInside);
    const target =
      listed.findLast(isOffScreen) ?? listed.findLast(isPartly) ?? "";
    expect(target).not.toBe("");

    await stepsListbox
      .getByRole("option", { name: target, exact: true })
      .click();
    await expect(page.getByLabel("Step title")).toHaveValue(target);

    // Opening it brought its box onto the map — centered on it, as a Step
    // chosen from "Find step" always is.
    await expectBoxOnMap(page, target);

    await page.screenshot({
      path: evidencePath("canvas-locate-on-map", "canvas-locate-on-map.png"),
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
          // Reused from an existing case-3 Ending, so the tag names an
          // Outcome this document still defines: the one live problem this
          // Step carries is that nothing leads to it.
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
    await expectBoxOnMap(page, "Lost tent");

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
    await expectBoxOnMap(page, "Lost tent");
  });

  test("canvas-find-step", async ({ page, context }) => {
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

    // The Step at the foot of the map, read off the map itself: the furthest
    // one from where an Author zoomed into the top of it is looking.
    const bottomMost = (await boxPositions(page))
      .slice()
      .sort((a, b) => b.top - a.top)[0];
    expect(bottomMost.title).not.toBe("");

    // Zoomed in until that box is no longer wholly on the map, which is the
    // state a Step found by name has to be brought back from. Bounded, so a
    // layout that never pushes it off fails the assertion rather than hangs.
    const zoomIn = canvas(page).getByRole("button", { name: /zoom in/i });
    let offMap = false;
    for (let click = 0; click < 8 && !offMap; click += 1) {
      await zoomIn.click();
      // Each zoom animates, and a box read while the map is still moving is
      // read at coordinates it is no longer at.
      await settledTransform(page);
      offMap =
        (await nodeViews(page)).find((view) => view.title === bottomMost.title)
          ?.fullyInside === false;
    }
    expect(
      offMap,
      `"${bottomMost.title}" was still fully inside the canvas frame after zooming in`,
    ).toBe(true);

    // Cmd/Ctrl+K from anywhere on the Journey page, and part of the title in
    // lower case: what is matched on is the letters, not the capitals.
    await findStepByName(
      page,
      bottomMost.title.slice(0, 6).toLowerCase(),
      bottomMost.title,
    );

    // Choosing it brought its box back onto the map, and centered it there
    // rather than nudging it just far enough in to fit: a Step found by name
    // is one the Author is going to read.
    await expectBoxOnMap(page, bottomMost.title);
    await expectCenteredOnMap(page, bottomMost.title);

    // And the field is closed and empty behind it, ready for the next find.
    const find = page.getByRole("combobox", { name: "Find step" });
    const stepsListbox = page.getByRole("listbox", { name: "Steps" });
    await expect(stepsListbox).toHaveCount(0);
    await expect(find).toHaveValue("");

    await page.screenshot({
      path: evidencePath("canvas-find-step", "canvas-find-step.png"),
      fullPage: true,
    });

    // The same field without the pointer, on the same seeded map: back into
    // it with Cmd/Ctrl+K, and everything after this is typed.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(find).toBeFocused();

    // A query no Step answers: nothing to choose from, and the field says so
    // rather than offering an empty list.
    const options = stepsListbox.getByRole("option");
    await page.keyboard.type("zzzzz");
    await expect(options).toHaveCount(0);
    await expect(
      page.getByText("No steps match", { exact: true }),
    ).toBeVisible();

    // Escape twice: the list first, so an Author who opened it by mistake
    // still has what they typed, and what they typed second.
    await page.keyboard.press("Escape");
    await expect(stepsListbox).toHaveCount(0);
    await expect(find).toHaveValue("zzzzz");
    await page.keyboard.press("Escape");
    await expect(find).toHaveValue("");

    // Arrowing opens the list on its first Step, and wraps round its end.
    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    // Another Step entirely, typed and taken with Enter: one whose title no
    // other Step's title contains, so the single match is the Step meant.
    const everyTitle = await optionNames(stepsListbox);
    const another = everyTitle.find(
      (title) =>
        title !== bottomMost.title &&
        everyTitle.filter((other) =>
          other.toLowerCase().includes(title.toLowerCase()),
        ).length === 1,
    );
    expect(another, "no Step's title picks out only itself").toBeDefined();

    await page.keyboard.type(another!);
    await expect(options).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // That Step is what the panel opens on, and the field is empty and closed
    // behind it again.
    await expect(page.getByLabel("Step title")).toHaveValue(another!);
    await expect(find).toHaveValue("");
    await expect(stepsListbox).toHaveCount(0);
  });

  test("canvas-find-step-lists-map-order", async ({ page, context }) => {
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

    // Nothing typed: every Step in the Draft is offered.
    await openFindStep(page);
    const listedTitles = await optionNames(
      page.getByRole("listbox", { name: "Steps" }),
    );

    // Every box's title and rect in one round trip, sorted the way
    // `mapOrder` orders the canvas: top to bottom, then left to right.
    const mapOrderedTitles = (await boxPositions(page))
      .slice()
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .map((box) => box.title);

    expect(listedTitles).toHaveLength(stepCount);
    expect(listedTitles).toEqual(mapOrderedTitles);

    await page.screenshot({
      path: evidencePath(
        "canvas-find-step-lists-map-order",
        "canvas-find-step-lists-map-order.png",
      ),
      fullPage: true,
    });
  });

  test("canvas-view-stays-put", async ({ page, context }) => {
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

    // The map given the whole width and zoomed into: an Author reading one
    // corner of a thirty-six step Journey, which is the view every move
    // below has to leave no further out than they set it.
    await hidePanel(page);
    const zoomIn = canvas(page).getByRole("button", { name: /zoom in/i });
    for (let click = 0; click < 4; click += 1) {
      await zoomIn.click();
    }
    const zoomed = await zoomOf(page);

    // The box to work from: one wholly on the map and clickable, with as
    // many boxes around it as the map has, so there is still another box
    // beside it to click once this one has been zoomed to. Titles the
    // seeded document uses twice are left out — a box is reached by name.
    //
    // How far apart two boxes can be laid out and still count as neighbours:
    // near enough, in the map's own units, that zooming to one leaves the
    // other on the map with something else to click.
    const NEIGHBOUR_REACH = 400;

    const positions = await boxPositions(page);
    const unique = (title: string) =>
      positions.filter((entry) => entry.title === title).length === 1;
    const neighbours = (title: string) => {
      const box = positions.find((entry) => entry.title === title);
      if (box === undefined) return 0;
      return positions.filter(
        (other) =>
          other.title !== title &&
          Math.hypot(other.left - box.left, other.top - box.top) / zoomed <
            NEIGHBOUR_REACH,
      ).length;
    };
    const busiest = (await nodeViews(page))
      .filter(
        (view) => view.fullyInside && view.clickable && unique(view.title),
      )
      .sort((a, b) => neighbours(b.title) - neighbours(a.title))[0];
    expect(busiest, "no box is clickable on the map").toBeDefined();
    const first = busiest?.title ?? "";

    // Clicking it brings the panel back, and the map goes in to that box
    // rather than out to the whole map: the frame narrows around the box the
    // Author reached for, no further out than they were reading at.
    await canvasNode(page, first).click();
    await expect(stepPanel(page)).toBeVisible();
    await expect(page.getByLabel("Step title")).toHaveValue(first);
    expect(await zoomOf(page)).toBeGreaterThanOrEqual(zoomed);
    await expectBoxOnMap(page, first);

    // Zoomed to from the box's own moves: the reading the rest of this test
    // is measured against.
    const firstToolbar = await expandStepActions(page, first);
    await firstToolbar
      .getByRole("button", { name: "Zoom to step", exact: true })
      .click();
    await expectBoxOnMap(page, first);
    const before = await zoomOf(page);

    // Another box, clicked: the panel opens on it, the zoom is no lower than
    // it was, and the box is wholly on the map.
    const beside = (await nodeViews(page)).find(
      (view) =>
        view.title !== first &&
        view.fullyInside &&
        view.clickable &&
        unique(view.title),
    );
    expect(
      beside,
      `no second box is clickable beside "${first}"`,
    ).toBeDefined();
    const second = beside?.title ?? "";

    await canvasNode(page, second).click();
    await expect(page.getByLabel("Step title")).toHaveValue(second);
    expect(await zoomOf(page)).toBeGreaterThanOrEqual(before);
    await expectBoxOnMap(page, second);

    // "Add next step" from that box: the Step opens with its title waiting,
    // the map goes to the box it landed on rather than out to all of them,
    // and the zoom is still no lower than the Author set it.
    const secondToolbar = await expandStepActions(page, second);
    await secondToolbar
      .getByRole("button", { name: "Add next step", exact: true })
      .click();

    await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
    await expect(page.getByLabel("Step title")).toBeFocused();
    await expect(canvasNodes(page)).toHaveCount(stepCount + 1);
    await expectBoxOnMap(page, "Untitled step");
    expect(await zoomOf(page)).toBeGreaterThanOrEqual(before);

    await page.screenshot({
      path: evidencePath("canvas-view-stays-put", "canvas-view-stays-put.png"),
      fullPage: true,
    });

    // And a Step deleted leaves the view exactly where it was: a Step going
    // is not somewhere the Author asked to be taken.
    const settled = await settledTransform(page);
    await stepPanel(page)
      .getByRole("button", { name: "Delete step", exact: true })
      .click();
    const confirmation = page.getByRole("alertdialog");
    await confirmation
      .getByRole("button", { name: "Delete step", exact: true })
      .click();
    await expect(confirmation).toBeHidden();

    await expect(canvasNode(page, "Untitled step")).toHaveCount(0);
    expect(await settledTransform(page)).toBe(settled);
  });

  test("canvas-endings-uncolored", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    const seeded = graphDocumentSchema.parse(case3);
    const stepCount = Object.keys(seeded.steps).length;
    // The case the colors were for: three Outcomes over its Endings.
    expect(Object.keys(seeded.outcomes)).toHaveLength(3);

    await expectSaved(page);
    await writeDraftDocument(journeyId, seeded);
    await page.reload();

    await expect(canvasNodes(page)).toHaveCount(stepCount);
    await expect
      .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
      .toEqual([]);

    // Nothing on the map is drawn by Outcome: no bar across an Ending, no
    // index to read one back by, and no legend to read them against.
    await expect(canvas(page).locator("[data-outcome-bar]")).toHaveCount(0);
    await expect(canvas(page).locator("[data-outcome-index]")).toHaveCount(0);
    await expect(
      canvas(page).getByRole("list", { name: "Legend" }),
    ).toHaveCount(0);

    // What an Ending says about its Outcome, it says in words: an Ending
    // whose title no other Step shares, so the box is reached by name.
    const titles = Object.values(seeded.steps).map((step) => step.title);
    const ending = Object.values(seeded.steps).find(
      (step) =>
        step.choices.length === 0 &&
        step.outcomeId !== null &&
        titles.filter((title) => title === step.title).length === 1,
    );
    expect(
      ending,
      "the seeded case has no Ending with an Outcome",
    ).toBeDefined();
    const label = seeded.outcomes[ending?.outcomeId ?? ""].label;
    await expect(canvasNodeBox(page, ending?.title ?? "")).toContainText(label);

    await page.screenshot({
      path: evidencePath(
        "canvas-endings-uncolored",
        "canvas-endings-uncolored.png",
      ),
      fullPage: true,
    });
  });
});

test("canvas-validation-marks", async ({ page, context }) => {
  await startJourney(page, context);

  // A brand-new Draft's one Step is both the Start and an Ending, and an
  // Ending needs no Outcome: there is nothing wrong with it to mark.
  await renameStep(page, "Border post");
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );

  // A Step nothing leads to yet: that nothing does is the one thing wrong
  // with it. The map goes to the box it made rather than out to the whole
  // map, so the whole map is asked for before the Step it was added beside is
  // reached for.
  await addStepFromCanvas(page, "Clinic tent");
  await expectBoxOnMap(page, "Clinic tent");
  await fitWholeMap(page, 2);
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "1",
  );

  // A Choice from the Start reaches it, and the mark goes with the problem.
  await clickBox(page, "Border post");
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
  // The Choice just added gave its target a rank of its own, which moved the
  // boxes; the whole map is asked for before the next one is clicked.
  await fitWholeMap(page, 2);
  await clickBox(page, "Clinic tent");
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
    path: evidencePath(
      "canvas-validation-marks",
      "canvas-validation-marks.png",
    ),
    fullPage: true,
  });

  // Removing the broken Choice takes the placeholder and the mark with it,
  // and leaves the Start an Ending again — which is nothing to mark.
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

  // A brand-new Draft's one Step is the Start and an Ending, and an Ending
  // needs no Outcome: nothing is marked on its box, its panel lists no
  // problem, and the header says there is none.
  await renameStep(page, "Border post");

  await expect(page.getByText("No problems", { exact: true })).toBeVisible();
  await expect(canvasNode(page, "Border post")).toHaveAttribute(
    "data-problems",
    "0",
  );
  await expect(page.getByRole("region", { name: "Step problems" })).toHaveCount(
    0,
  );

  // So a problem is made, to be read: a Step added from the map is a Step
  // nothing leads to. It is read on that Step's own panel, in the header
  // count, and in the live list the count opens.
  await addStepFromCanvas(page, "Clinic tent");
  await expectBoxOnMap(page, "Clinic tent");
  await fitWholeMap(page, 2);

  const stepProblemsMessage =
    'Step "Clinic tent" cannot be reached from the start';
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
    path: evidencePath(
      "canvas-problems-readable",
      "canvas-problems-readable.png",
    ),
    fullPage: true,
  });

  // A Choice that reaches it clears the problem everywhere it was shown.
  await clickBox(page, "Border post");
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");

  await expect(page.getByRole("region", { name: "Step problems" })).toHaveCount(
    0,
  );
  await expect(page.getByText("No problems", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "All problems" })).toHaveCount(0);

  // A dangling Choice: read the same live message on the Choice row that
  // dangles and in that Step's own Problems section.
  // The Choice just added gave its target a rank of its own, which moved the
  // boxes; the whole map is asked for before the next one is clicked.
  await fitWholeMap(page, 2);
  await clickBox(page, "Clinic tent");
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

test("canvas-empty-choice-label", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Clinic tent");
  // The drag below wants both boxes, and adding a Step took the map to the
  // one it made, so the whole map is taken back first.
  await expectBoxOnMap(page, "Clinic tent");
  await fitWholeMap(page, 2);

  // A Choice drawn on the map starts with no label. Drawing it reached
  // "Clinic tent", so the one thing wrong with the Draft is that the Choice
  // has no name: read on the arrow, under the Choice's own row, and in the
  // header count.
  const label = await connectByDragging(page, "Border post", "Clinic tent", 1);
  const message = 'Step "Border post" has a choice with no label';

  await expect(problemEdges(page)).toHaveCount(1);
  const choiceId = await canvasEdges(page).getAttribute("data-choice-id");
  expect(choiceId).not.toBeNull();
  const arrow = canvasEdge(page, choiceId!);
  await expect(arrow).toHaveAttribute("data-problems", "1");
  await expect(markedChoiceRow(page).getByText(message)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "1 problem", exact: true }),
  ).toBeVisible();
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "0",
  );

  await page.screenshot({
    path: evidencePath(
      "canvas-empty-choice-label",
      "canvas-empty-choice-label.png",
    ),
    fullPage: true,
  });

  // Typing the label clears all three.
  await label.fill("Find the clinic");
  await expect(label).toHaveValue("Find the clinic");
  await expect(arrow).toHaveAttribute("data-problems", "0");
  await expect(problemEdges(page)).toHaveCount(0);
  await expect(markedChoiceRow(page).getByText(message)).toHaveCount(0);
  await expect(page.getByText("No problems", { exact: true })).toBeVisible();

  // Whitespace is no label either. Blanked to spaces and saved, the Draft is
  // refused publication with the same message in the refusal's list.
  await label.fill("   ");
  await expect(problemEdges(page)).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "1 problem", exact: true }),
  ).toBeVisible();
  await label.blur();
  await expectSaved(page);

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const refusal = page.getByRole("alertdialog");
  await expect(refusal).toContainText("This journey can't be published yet");
  const problems = refusal.getByRole("list", { name: "Publishing problems" });
  await expect(problems.getByRole("listitem")).toHaveCount(1);
  await expect(problems).toHaveText(message);

  await page.screenshot({
    path: evidencePath(
      "canvas-empty-choice-label",
      "canvas-empty-choice-label-refused.png",
    ),
    fullPage: true,
  });

  await refusal.getByRole("button", { name: "Close" }).click();
  await expect(refusal).toBeHidden();
  await expect(
    page.getByText("Never published", { exact: true }),
  ).toBeVisible();
});

/** One arrow on the map, named by the Choice it draws. */
function canvasEdge(page: Page, choiceId: string) {
  return canvas(page).locator(`[data-choice-id="${choiceId}"]`);
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
  await clickBox(page, "Clinic tent");
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
    path: evidencePath(
      "canvas-selection-dims-arrows",
      "canvas-selection-dims-arrows.png",
    ),
    fullPage: true,
  });

  // An Ending: both arrows that reach it, and neither of the Start's others.
  await clickBox(page, "Waved through");
  await expect(page.getByLabel("Step title")).toHaveValue("Waved through");
  await expectEmphasis({
    "to-ward": "attached",
    "clinic-to-ward": "attached",
    "to-clinic": "dimmed",
  });
});

test("canvas-arrow-select-and-delete", async ({ page, context }) => {
  await startJourney(page, context);

  await renameStep(page, "Border post");
  await addStepFromCanvas(page, "Clinic tent");
  await expectBoxOnMap(page, "Clinic tent");
  await fitWholeMap(page, 2);

  await clickBox(page, "Border post");
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");
  await expect(canvasEdges(page)).toHaveCount(1);

  // Nothing is wrong with it while a Choice still reaches it — it is an
  // Ending, and an Ending needs no Outcome — so when the Choice goes, the one
  // thing wrong with it is that nothing leads there any more.
  await expect(canvasNode(page, "Clinic tent")).toHaveAttribute(
    "data-problems",
    "0",
  );

  // An arrow is clicked to take the Choice it draws in hand, wherever the
  // panel happens to be: the Step the Choice is written on opens, with that
  // Choice's row marked as the one in hand.
  const choiceId = await canvasEdges(page).getAttribute("data-choice-id");
  expect(choiceId).not.toBeNull();
  const arrow = canvasEdge(page, choiceId!);
  await expect(arrowLabel(arrow, "Find the clinic")).toBeVisible();
  // The label as it is drawn: its text sits inside a background chip, so the
  // chip is what a pointer lands on.
  await settledTransform(page);
  await arrowLabel(arrow, "Find the clinic").click();

  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  const marked = markedChoiceRow(page);
  await expect(marked).toHaveCount(1);
  const label = marked.getByLabel("Choice label");
  await expect(label).toHaveValue("Find the clinic");
  // Marked is all it is: the click left the keyboard where it was.
  await expect(label).not.toBeFocused();
  await expect(arrow).toHaveAttribute("data-emphasis", "selected");

  await page.screenshot({
    path: evidencePath(
      "canvas-arrow-select-and-delete",
      "canvas-arrow-select-and-delete.png",
    ),
    fullPage: true,
  });

  // Backspace in the label is typing, never deleting: the Author reaches for
  // the field on the row the click marked, and types at the end of it.
  await label.click();
  await page.keyboard.press("End");
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
  await expectBoxOnMap(page, "Turned back");
  await fitWholeMap(page, 3);

  await clickBox(page, "Border post");
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await addChoiceToStep(page, "Find the clinic", "Clinic tent");
  await addChoiceToStep(page, "Walk away", "Turned back");
  await expect(canvasEdges(page)).toHaveCount(2);

  // Two arrows out of the same box, in the order the Step writes its
  // Choices: whichever one is clicked is the one in hand, whichever end of
  // the map's own list it happens to sit at.
  const findTheClinic = arrowLabelled(page, "Find the clinic");
  const walkAway = arrowLabelled(page, "Walk away");
  // Whichever arrow is in hand, and only ever the one.
  const marked = markedChoiceRow(page);
  const markedLabel = marked.getByLabel("Choice label");

  await clickArrow(page, findTheClinic);
  await expect(findTheClinic).toHaveAttribute("data-emphasis", "selected");
  await expect(walkAway).not.toHaveAttribute("data-emphasis", "selected");
  await expect(marked).toHaveCount(1);
  await expect(markedLabel).toHaveValue("Find the clinic");

  // The second arrow takes the selection off the first.
  await clickArrow(page, walkAway);
  await expect(walkAway).toHaveAttribute("data-emphasis", "selected");
  await expect(findTheClinic).not.toHaveAttribute("data-emphasis", "selected");
  await expect(marked).toHaveCount(1);
  await expect(markedLabel).toHaveValue("Walk away");

  // And back: this is the way round that the map used to answer with nothing
  // selected at all, because the arrow being let go of came second.
  await clickArrow(page, findTheClinic);
  await expect(findTheClinic).toHaveAttribute("data-emphasis", "selected");
  await expect(walkAway).not.toHaveAttribute("data-emphasis", "selected");
  await expect(markedLabel).toHaveValue("Find the clinic");

  await page.screenshot({
    path: evidencePath(
      "canvas-arrow-select-second-arrow",
      "canvas-arrow-select-second-arrow.png",
    ),
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

/**
 * A window short enough that the Journey page itself scrolls, which is what
 * makes "the click moved nothing" a thing that can be measured at all.
 */
test.describe("a map read down the page", () => {
  test.use({ viewport: { width: 1280, height: 640 } });

  test("canvas-arrow-click-stays-on-canvas", async ({ page, context }) => {
    await startJourney(page, context);

    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Clinic tent");
    await expectBoxOnMap(page, "Clinic tent");
    await fitWholeMap(page, 2);

    await clickBox(page, "Border post");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    await addChoiceToStep(page, "Cross", "Clinic tent");
    await expect(canvasEdges(page)).toHaveCount(1);
    // The Choice gave "Clinic tent" a rank of its own, which moved its box;
    // the whole map is taken back so the arrow is there to be clicked.
    await fitWholeMap(page, 2);

    // The map at the top of the window, which is where an Author reading it
    // is when they reach for an arrow.
    await page.evaluate(() => {
      window.document
        .querySelector('[aria-label="Canvas"]')
        ?.scrollIntoView({ block: "start" });
    });
    await settledTransform(page);
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(
      scrolled,
      "the page does not scroll in this window, so there is nothing to keep still",
    ).toBeGreaterThan(0);

    // The Author is working on the map: the keyboard is on a box there when
    // they reach for the arrow.
    await canvasNode(page, "Border post").focus();
    await expect(canvasNode(page, "Border post")).toBeFocused();

    await clickArrow(page, arrowLabelled(page, "Cross"));

    // The Choice is in hand: the Step it is written on is open, and its row
    // is marked and ringed as the one the Author has hold of.
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    const marked = markedChoiceRow(page);
    await expect(marked).toHaveCount(1);
    await expect(marked).toHaveAttribute("aria-current", "true");
    await expect(marked).toHaveClass(/ring-ring/);
    await expect(marked.getByLabel("Choice label")).toHaveValue("Cross");

    // And the Author is left where they were working: the keyboard is still
    // somewhere on the map, and the page has not moved.
    expect(
      await page.evaluate(() => {
        const region = window.document.querySelector('[aria-label="Canvas"]');
        const active = window.document.activeElement;
        return region !== null && active !== null && region.contains(active);
      }),
      "the click took the keyboard off the map",
    ).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

    await page.screenshot({
      path: evidencePath(
        "canvas-arrow-click-stays-on-canvas",
        "canvas-arrow-click-stays-on-canvas.png",
      ),
      fullPage: true,
    });
  });
});

test.describe("authoring from the map", () => {
  // Closing the page is what finishes the recording, so the file can be
  // copied to the evidence directory named for the test.
  test.afterEach(async ({ page }, testInfo) => {
    const video = page.video();
    await page.close();
    await video?.saveAs(evidencePath(testInfo.title, `${testInfo.title}.webm`));
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

    // Added from the map, and the map has it — and the map went to it.
    await addStepFromCanvas(page, "Clinic tent");
    await expect(canvasNodes(page)).toHaveCount(2);
    await expectBoxOnMap(page, "Clinic tent");
    await fitWholeMap(page, 2);

    // Clicking a node is how a Step is opened for editing.
    await clickBox(page, "Border post");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    // The Choice added in the panel draws its arrow with no reload.
    await addChoiceToStep(page, "Find the clinic", "Clinic tent");
    await expect(canvasEdges(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveAttribute(
      "aria-label",
      "Find the clinic: Border post → Clinic tent",
    );
    await expect(
      arrowLabel(canvasEdges(page), "Find the clinic"),
    ).toBeVisible();

    await expectSaved(page);
    await page.screenshot({
      path: evidencePath(
        "canvas-node-opens-panel-and-edge-appears",
        "canvas-node-opens-panel-and-edge-appears.png",
      ),
      fullPage: true,
    });
  });

  for (const direction of DIRECTIONS) {
    test(`canvas-connect-and-retarget-by-dragging${direction.suffix}`, async ({
      page,
      context,
    }, testInfo) => {
      const { journeyId } = await startJourney(page, context);

      // A new Draft is drawn top to bottom; the other direction is switched
      // to before a single Step is named, so every move below is made on a
      // map whose anchors are on the sides of the boxes.
      if (direction.turns) await setDirection(page, direction.name);

      await renameStep(page, "Border post");
      await addStepFromCanvas(page, "Clinic tent");
      await addStepFromCanvas(page, "Waved through");
      // A Step added takes the map to its own box; a drag between two boxes
      // needs both of them, so the whole map is asked for first.
      await expectBoxOnMap(page, "Waved through");
      await fitWholeMap(page, 3);

      // Dragged from the Start's connect dot onto the middle of another box:
      // the Choice is made where the Author drew it.
      await dragTo(
        page,
        connectHandle(page, "Border post"),
        canvasNode(page, "Clinic tent"),
      );

      await expect(canvasEdges(page)).toHaveCount(1);
      await expect(page.getByLabel("Step title")).toHaveValue("Border post");

      // The Choice arrives with nothing written on it, its row marked as the
      // one just drawn, and the keyboard left on the map where the Author's
      // hands are: what the Choice is called is reached for, not typed into
      // a field that grabbed them.
      const marked = markedChoiceRow(page);
      await expect(marked).toHaveCount(1);
      const label = marked.getByLabel("Choice label");
      await expect(label).toHaveValue("");
      await expect(label).not.toBeFocused();

      await label.fill("Find the clinic");
      await expect(label).toHaveValue("Find the clinic");
      await expect(
        arrowLabel(canvasEdges(page), "Find the clinic"),
      ).toBeVisible();

      // Dragging the arrow's head onto another box moves the Choice there.
      // Only the arrow in hand has a head to take hold of, so the arrow is
      // clicked first — which is how an Author says which Choice they are
      // moving where several arrows end on the same box.
      //
      // On the left-to-right map the whole map is taken back first: the
      // Choice just made re-ranks the Step it leads to along the horizontal
      // rank axis, and an arrow is not a box added, so the map does not
      // re-fit itself for it (ticket 16's rule) — on a map zoomed in far
      // enough the box lands off the frame. Running top to bottom the map is
      // left exactly as the moves above left it.
      if (direction.turns) await fitWholeMap(page, 3);
      const choiceId = await canvasEdges(page).getAttribute("data-choice-id");
      expect(choiceId).not.toBeNull();
      const arrow = canvasEdge(page, choiceId!);
      await clickArrow(page, arrow);
      const head = arrow.locator(".react-flow__edgeupdater-target");
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

      // That same head let go of on bare map leaves the Choice exactly where
      // it now leads: a Choice that already reaches a Step is not an
      // instruction to make another one — drawing a new Choice onto bare map
      // is, and `canvas-drop-choice-on-empty-map` is where that is proved.
      // The retarget above re-ranked a Step too, so the left-to-right map is
      // taken back again for the same reason.
      if (direction.turns) await fitWholeMap(page, 3);
      const nowhere = await emptySpot(page);
      await expect(head).toHaveCount(1);
      await dragTo(page, head, nowhere);

      await expect(canvasNodes(page)).toHaveCount(3);
      await expect(canvasEdges(page)).toHaveCount(1);
      await expect(canvasEdges(page)).toHaveAttribute(
        "aria-label",
        "Find the clinic: Border post → Waved through",
      );

      // A Choice that leads back to its own Step, drawn the same way: from a
      // box's connect dot onto the box it belongs to.
      await dragTo(
        page,
        connectHandle(page, "Clinic tent"),
        canvasNode(page, "Clinic tent"),
      );

      await expect(canvasEdges(page)).toHaveCount(2);
      await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
      const loopLabel = markedChoiceRow(page).getByLabel("Choice label");
      await expect(loopLabel).toHaveValue("");
      await loopLabel.fill("Wait here");
      await expect(loopLabel).toHaveValue("Wait here");

      await expectSaved(page);
      const looped = await readDraft(journeyId);
      const clinic = Object.values(looped.steps).find(
        (step) => step.title === "Clinic tent",
      );
      expect(clinic, "the Step the loop was drawn on is gone").toBeDefined();
      expect(clinic!.choices).toHaveLength(1);
      expect(clinic!.choices[0].targetStepId).toBe(clinic!.id);

      // And it is routed beside its box rather than through it: no sample of
      // the arrow's path lies inside the box's own rectangle, and the path
      // runs out past the edge of the box it goes round — the right edge
      // running top to bottom, the bottom edge running left to right — and
      // back.
      await settledTransform(page);
      const [loop] = await samplePaths(
        canvasEdge(page, clinic!.choices[0].id).locator(
          "path.react-flow__edge-path",
        ),
      );
      expect(loop.length).toBeGreaterThanOrEqual(16);

      const clinicRect = await nodeFlowRect(page, "Clinic tent");
      const through = loop.filter(
        (point) =>
          point.x > clinicRect.x + ROUTE_TOLERANCE &&
          point.x < clinicRect.x + clinicRect.width - ROUTE_TOLERANCE &&
          point.y > clinicRect.y + ROUTE_TOLERANCE &&
          point.y < clinicRect.y + clinicRect.height - ROUTE_TOLERANCE,
      );
      expect(
        through,
        `the loop runs through its own box ${JSON.stringify(clinicRect)}`,
      ).toEqual([]);

      const middle = loop[Math.floor(loop.length / 2)];
      if (direction.loopPast === "right") {
        expect(middle.x).toBeGreaterThan(clinicRect.x + clinicRect.width);
        expect(Math.max(...loop.map((point) => point.x))).toBeGreaterThan(
          clinicRect.x + clinicRect.width,
        );
      } else {
        expect(middle.y).toBeGreaterThan(clinicRect.y + clinicRect.height);
        expect(Math.max(...loop.map((point) => point.y))).toBeGreaterThan(
          clinicRect.y + clinicRect.height,
        );
      }

      await page.screenshot({
        path: evidencePath(testInfo.title, `${testInfo.title}.png`),
        fullPage: true,
      });
    });
  }

  test("canvas-retarget-selected-arrow", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    // Two Choices from two Steps into one box, which is where their heads
    // stack: every arrow into a box ends on the same handle.
    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Clinic tent");
    await addStepFromCanvas(page, "Ward round");
    await addStepFromCanvas(page, "Waved through");
    await expectBoxOnMap(page, "Waved through");
    await fitWholeMap(page, 4);

    await clickBox(page, "Border post");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    await addChoiceToStep(page, "From the border", "Ward round");

    await clickBox(page, "Clinic tent");
    await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");
    await addChoiceToStep(page, "From the clinic", "Ward round");
    await expect(canvasEdges(page)).toHaveCount(2);
    await fitWholeMap(page, 4);

    const fromTheBorder = arrowLabelled(page, "From the border");
    const fromTheClinic = arrowLabelled(page, "From the clinic");
    /** The head of an arrow: what a drag takes hold of to move its Choice. */
    const head = ".react-flow__edgeupdater-target";

    // With no arrow in hand, neither has a head to take hold of.
    await expect(fromTheBorder.locator(head)).toHaveCount(0);
    await expect(fromTheClinic.locator(head)).toHaveCount(0);

    // The second arrow taken in hand grows one, and it is the only arrow
    // that does: a head dragged out of the stack is the Choice the Author
    // chose, never whichever one happened to be drawn last.
    await clickArrow(page, fromTheClinic);
    await expect(fromTheClinic).toHaveAttribute("data-emphasis", "selected");
    await expect(fromTheClinic.locator(head)).toHaveCount(1);
    await expect(fromTheBorder.locator(head)).toHaveCount(0);

    // And it is drawn over the arrows it stacks with, so the head is the one
    // the pointer reaches: React Flow draws each arrow in an `svg` layer of
    // its own and puts the arrow's `zIndex` on that layer.
    const layerZ = (arrow: Locator) =>
      arrow.evaluate((element) => {
        const layer = element.closest("svg");
        if (layer === null) return null;
        return Number(window.getComputedStyle(layer).zIndex || "0");
      });
    const selectedZ = await layerZ(fromTheClinic);
    const unselectedZ = await layerZ(fromTheBorder);
    expect(selectedZ, "the selected arrow is in no layer").not.toBeNull();
    expect(unselectedZ, "the unselected arrow is in no layer").not.toBeNull();
    expect(selectedZ!).toBeGreaterThan(unselectedZ!);

    await dragTo(
      page,
      fromTheClinic.locator(head),
      canvasNode(page, "Waved through"),
    );

    await expect(arrowLabelled(page, "From the clinic")).toHaveAttribute(
      "aria-label",
      "From the clinic: Clinic tent → Waved through",
    );
    await expect(arrowLabelled(page, "From the border")).toHaveAttribute(
      "aria-label",
      "From the border: Border post → Ward round",
    );

    // And the row says the same: the Choice that was moved is the Choice the
    // Draft holds pointed somewhere new, and the other is untouched.
    await expectSaved(page);
    const stored = await readDraft(journeyId);
    const stepNamed = (title: string) =>
      Object.values(stored.steps).find((step) => step.title === title);

    const clinic = stepNamed("Clinic tent");
    const border = stepNamed("Border post");
    const ward = stepNamed("Ward round");
    const waved = stepNamed("Waved through");
    expect(clinic, '"Clinic tent" is gone from the Draft').toBeDefined();
    expect(waved, '"Waved through" is gone from the Draft').toBeDefined();
    expect(clinic!.choices).toHaveLength(1);
    expect(clinic!.choices[0].targetStepId).toBe(waved!.id);
    expect(border!.choices).toHaveLength(1);
    expect(border!.choices[0].targetStepId).toBe(ward!.id);

    await page.screenshot({
      path: evidencePath(
        "canvas-retarget-selected-arrow",
        "canvas-retarget-selected-arrow.png",
      ),
      fullPage: true,
    });
  });

  test("canvas-drop-choice-on-empty-map", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");
    await expect(canvasNodes(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveCount(0);

    // Dragged from the box's connect dot onto bare map: there is no Step
    // there to lead to, so the Step is made and the Choice with it, in the
    // one motion, and the Step opens with its title waiting.
    await dropChoiceOnEmptyMap(page, "Border post");

    await expect(stepPanel(page)).toBeVisible();
    await expect(canvasNodes(page)).toHaveCount(2);
    await expect(canvasEdges(page)).toHaveCount(1);
    // And the map went to the box it made.
    await expectBoxOnMap(page, "Untitled step");

    await expectSaved(page);
    const stored = await readDraft(journeyId);
    expect(Object.keys(stored.steps)).toHaveLength(2);

    const start = stored.steps[stored.startStepId];
    expect(start.title).toBe("Border post");
    expect(start.choices).toHaveLength(1);
    // What the Choice is called is the next thing to write, not something
    // the drag decided.
    expect(start.choices[0].label).toBe("");
    expect(stored.steps[start.choices[0].targetStepId].title).toBe(
      "Untitled step",
    );

    await page.screenshot({
      path: evidencePath(
        "canvas-drop-choice-on-empty-map",
        "canvas-drop-choice-on-empty-map.png",
      ),
      fullPage: true,
    });
  });

  test("canvas-build-by-dragging-and-walk", async ({
    page,
    context,
  }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Waved through");
    await addStepFromCanvas(page, "Turned back");
    // As above: the map went to the box it made, and the drags below want
    // every box, so the whole map is taken back first.
    await expectBoxOnMap(page, "Turned back");
    await fitWholeMap(page, 3);

    // The whole branch drawn on the map: one drag per Choice, its label
    // written on the row the drag marked.
    const waved = await connectByDragging(
      page,
      "Border post",
      "Waved through",
      1,
    );
    await waved.fill("Wait your turn");
    await expect(waved).toHaveValue("Wait your turn");

    const turned = await connectByDragging(
      page,
      "Border post",
      "Turned back",
      2,
    );
    await turned.fill("Walk away");
    await expect(turned).toHaveValue("Walk away");
    await expect(canvasEdges(page)).toHaveCount(2);

    // A Journey built entirely by dragging is a Journey like any other.
    await tagEndingsPublishAndWalk(page, context, journeyId, testInfo);
  });

  test("canvas-build-by-dropping-and-walk", async ({
    page,
    context,
  }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");

    // The whole branch made where the Author dropped it: each Ending and the
    // Choice that reaches it in one motion onto bare map, named in the panel
    // the drop opened on it.
    await dropChoiceOnEmptyMap(page, "Border post");
    await renameStep(page, "Waved through");
    // The drop took the map to the box it made, and the next drop is made
    // from the Start, so the whole map is taken back first.
    await fitWholeMap(page, 2);

    await dropChoiceOnEmptyMap(page, "Border post");
    await renameStep(page, "Turned back");
    await fitWholeMap(page, 3);

    // What the drops left to say: what each Choice is called, written on the
    // rows the Start now carries.
    await clickBox(page, "Border post");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    const rows = page
      .getByRole("list", { name: "Choices" })
      .getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await rows.nth(0).getByLabel("Choice label").fill("Wait your turn");
    await rows.nth(1).getByLabel("Choice label").fill("Walk away");
    await expect(arrowLabelled(page, "Wait your turn")).toHaveCount(1);
    await expect(arrowLabelled(page, "Walk away")).toHaveCount(1);

    // A Journey built entirely by dropping is a Journey like any other.
    await tagEndingsPublishAndWalk(page, context, journeyId, testInfo);
  });

  test("canvas-build-left-to-right-and-walk", async ({
    page,
    context,
  }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    // The same branch as the test above, built on a map that runs left to
    // right and with the panel away for most of it: turning the map and
    // putting the panel aside changes where an Author works, not what the
    // moves are.
    await setDirection(page, "Left to right");
    await renameStep(page, "Border post");
    await hidePanel(page);

    // "Add step" opens the Step it made, so the panel comes back on its own:
    // the title field the helper types the name into is only there because
    // it did.
    await addStepFromCanvas(page, "Waved through");
    await hidePanel(page);
    await addStepFromCanvas(page, "Turned back");
    await hidePanel(page);
    await expect
      .poll(() => mapFaults(page, 3), { timeout: 20_000 })
      .toEqual([]);

    // A Choice drawn on the full-width map, and the panel back again on the
    // Step it leaves with the new Choice's row marked.
    const waved = await connectByDragging(
      page,
      "Border post",
      "Waved through",
      1,
    );
    await expect(stepPanel(page)).toBeVisible();
    await waved.fill("Wait your turn");
    await expect(waved).toHaveValue("Wait your turn");

    // The first Choice gave "Waved through" a rank of its own and the panel
    // came back beside the map, so the whole map is taken back before the
    // next box is dragged onto.
    await fitWholeMap(page, 3);

    const turned = await connectByDragging(
      page,
      "Border post",
      "Turned back",
      2,
    );
    await turned.fill("Walk away");
    await expect(turned).toHaveValue("Walk away");
    await expect(canvasEdges(page)).toHaveCount(2);

    // Both Steps the branch leads to stand past the Start's right edge: the
    // Journey was drawn the way the map runs. And the first Choice's Step
    // stands above the second's: the map reads the same way round as the
    // panel's Choice list.
    await expectTargetsPast(
      page,
      "Border post",
      ["Waved through", "Turned back"],
      "right",
    );
    await expectTargetsInChoiceOrder(
      page,
      ["Waved through", "Turned back"],
      "y",
    );

    await tagEndingsPublishAndWalk(page, context, journeyId, testInfo);

    // Which way the map runs is the Journey's and was stored with the rest of
    // it; whether the panel was away is the browser's and is nowhere in it.
    const stored = await readDraft(journeyId);
    expect(stored.layoutDirection).toBe("LR");
    expect(stored.steps[stored.startStepId].choices).toHaveLength(2);
  });

  test("canvas-build-branch-and-publish", async ({ page, context }) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");

    // Both Endings of the branch, each added from the map.
    await addStepFromCanvas(page, "Waved through");
    await addStepFromCanvas(page, "Turned back");
    await expect(canvasNodes(page)).toHaveCount(3);
    await expectBoxOnMap(page, "Turned back");
    await fitWholeMap(page, 3);

    await clickBox(page, "Border post");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    await addChoiceToStep(page, "Wait your turn", "Waved through");
    await addChoiceToStep(page, "Walk away", "Turned back");
    await expect(canvasEdges(page)).toHaveCount(2);

    // The first Choice's Step stands to the left of the second's, top to
    // bottom: the map reads the same way round as the panel's Choice list.
    await expectTargetsInChoiceOrder(
      page,
      ["Waved through", "Turned back"],
      "x",
    );

    for (const ending of ["Waved through", "Turned back"]) {
      await tagEndingWithOutcome(page, ending, "Reached care");
      await expect(canvasNode(page, ending)).toHaveAttribute(
        "data-problems",
        "0",
      );
      // The Outcome it was tagged with, in words on the box: nothing on the
      // map is drawn by Outcome.
      await expect(canvasNodeBox(page, ending)).toContainText("Reached care");
    }

    await expect(page.getByText("No problems", { exact: true })).toBeVisible();

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
      path: evidencePath(
        "canvas-build-branch-and-publish",
        "canvas-build-branch-and-publish.png",
      ),
      fullPage: true,
    });
  });

  test("canvas-undo-drawn-choice", async ({ page, context }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Clinic tent");
    // The drag below wants both boxes, and adding a Step took the map to the
    // one it made, so the whole map is taken back first.
    await expectBoxOnMap(page, "Clinic tent");
    await fitWholeMap(page, 2);

    await connectByDragging(page, "Border post", "Clinic tent", 1);

    // One press takes the whole drawn Choice back — the arrow and the Choice
    // under it — and leaves the Author on the Step they drew it from, which
    // is where the drag had left them.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvasEdges(page)).toHaveCount(0);
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    // An undo is written like the edit it takes back, so what stands after it
    // is what the row holds.
    await expectSaved(page);
    const undone = await readDraft(journeyId);
    expect(storedStep(undone, "Border post").choices).toEqual([]);

    // And the press that puts it back is the same press with Shift on it.
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvasEdges(page)).toHaveCount(1);

    await expectSaved(page);
    const redone = await readDraft(journeyId);
    const border = storedStep(redone, "Border post");
    expect(border.choices).toHaveLength(1);
    expect(border.choices[0].targetStepId).toBe(
      storedStep(redone, "Clinic tent").id,
    );

    await page.screenshot({
      path: evidencePath(testInfo.title, `${testInfo.title}.png`),
      fullPage: true,
    });
  });

  test("canvas-undo-build-branch-and-walk", async ({
    page,
    context,
  }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    // The branch `canvas-build-by-dragging-and-walk` builds, drawn the same
    // way: both Endings added from the map, both Choices dragged onto them.
    await renameStep(page, "Border post");
    await addStepFromCanvas(page, "Waved through");
    await addStepFromCanvas(page, "Turned back");
    await expectBoxOnMap(page, "Turned back");
    await fitWholeMap(page, 3);

    const waved = await connectByDragging(
      page,
      "Border post",
      "Waved through",
      1,
    );
    await waved.fill("Wait your turn");
    await expect(waved).toHaveValue("Wait your turn");

    const turned = await connectByDragging(
      page,
      "Border post",
      "Turned back",
      2,
    );
    await turned.fill("Walk away");
    await expect(turned).toHaveValue("Walk away");
    await expect(canvasEdges(page)).toHaveCount(2);

    // Then three more moves, of three different kinds: the map turned, the
    // Start given something to read, and a third Choice drawn from one Ending
    // to the other.
    await setDirection(page, "Left to right");

    const opening = "The queue has not moved since dawn.";
    await page.getByLabel("Step content").click();
    await page.keyboard.type(opening);
    await expect(page.getByLabel("Step content")).toContainText(opening);

    await fitWholeMap(page, 3);
    await connectByDragging(page, "Waved through", "Turned back", 3);

    // Three presses, three moves back, the newest first. The third Choice
    // goes, and the Author is left on the Step it was drawn from.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvasEdges(page)).toHaveCount(2);
    await expect(page.getByLabel("Step title")).toHaveValue("Waved through");

    // The typing was on another Step, so the panel goes to the Step it was on.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");
    await expect(page.getByLabel("Step content")).toHaveText("");

    // And the way the map runs is an edit like any other.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(directionRadio(page, "Top to bottom")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Two of the three put back, oldest first: the map turned again, and the
    // reading given back to the Start. The third Choice stays taken back.
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(directionRadio(page, "Left to right")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvasEdges(page)).toHaveCount(2);
    // A redo puts the Author back where they were standing when they undid
    // the edit, so the Step the reading is on is opened by name to read it.
    await chooseStep(page, "Border post");
    await expect(page.getByLabel("Step content")).toContainText(opening);

    // What stands is two Choices on a map that runs left to right, with the
    // third Choice nowhere in the row.
    await expectSaved(page);
    const stored = await readDraft(journeyId);
    expect(stored.layoutDirection).toBe("LR");
    expect(storedStep(stored, "Border post").choices).toHaveLength(2);
    expect(storedStep(stored, "Waved through").choices).toEqual([]);
    expect(
      contentPreview(storedStep(stored, "Border post").content, 10_000),
    ).toContain(opening);

    // And what stands is a Journey like any other: published, and walked.
    await tagEndingsPublishAndWalk(page, context, journeyId, testInfo);
  });

  test.describe("the seeded map, recorded", () => {
    // The wide viewport, for the reason the outer "the seeded map" gives.
    test.use({ viewport: { width: 1600, height: 1200 } });

    test("canvas-find-duplicate-and-edit", async ({ page, context }) => {
      const { journeyId } = await startJourney(page, context);

      const seeded = graphDocumentSchema.parse(case3);
      const stepCount = Object.keys(seeded.steps).length;
      const choiceCount = Object.values(seeded.steps).reduce(
        (total, step) => total + step.choices.length,
        0,
      );

      await expectSaved(page);
      await writeDraftDocument(journeyId, seeded);
      await page.reload();

      await expect(canvasNodes(page)).toHaveCount(stepCount);
      await expect
        .poll(() => mapFaults(page, stepCount), { timeout: 20_000 })
        .toEqual([]);

      // Found by name from anywhere on the Journey page: part of the title,
      // in lower case, and the Step is opened and centered on the map.
      await findStepByName(page, "prefa", "Preface");

      // Duplicated from its own box on the map.
      const prefaceToolbar = await expandStepActions(page, "Preface");
      await prefaceToolbar
        .getByRole("button", { name: "Duplicate", exact: true })
        .click();
      await expect(page.getByLabel("Step title")).toHaveValue("Preface copy");
      await expect(page.getByLabel("Step title")).toBeFocused();
      await expect(canvasNodes(page)).toHaveCount(stepCount + 1);
      // The map went to the copy it made rather than out to all thirty-seven.
      await expectBoxOnMap(page, "Preface copy");

      // And edited in the panel beside the map: renamed, and given content.
      await renameStep(page, "Second opinion");
      const opening = "A second reading of the same chart, by another doctor.";
      await page.getByLabel("Step content").click();
      await page.keyboard.type(opening);
      await expect(page.getByLabel("Step content")).toContainText(opening);

      // The drag below wants both boxes, so the whole map is taken back.
      await fitWholeMap(page, stepCount + 1);

      // Then reached from the Step it was copied from, by dragging on the map.
      const askAgain = await connectByDragging(
        page,
        "Preface",
        "Second opinion",
        choiceCount + 1,
      );
      await askAgain.fill("Ask again");
      await expect(askAgain).toHaveValue("Ask again");

      await expectSaved(page);
      const stored = await readDraft(journeyId);
      const copy = Object.values(stored.steps).find(
        (step) => step.title === "Second opinion",
      );
      expect(copy, "the copy is gone from the Draft").toBeDefined();
      expect(copy!.choices).toEqual([]);
      // What the Author typed into it, within the content it was copied with:
      // the whole reading rather than the peek's opening `PREVIEW_LIMIT`.
      expect(contentPreview(copy!.content, 10_000)).toContain(opening);

      const original = Object.values(stored.steps).find(
        (step) => step.title === "Preface",
      );
      expect(original, "the Step copied from is gone").toBeDefined();
      const added = original!.choices.find(
        (choice) => choice.label === "Ask again",
      );
      expect(
        added,
        '"Preface" holds no Choice labelled "Ask again"',
      ).toBeDefined();
      expect(added!.targetStepId).toBe(copy!.id);

      await page.screenshot({
        path: evidencePath(
          "canvas-find-duplicate-and-edit",
          "canvas-find-duplicate-and-edit.png",
        ),
        fullPage: true,
      });
    });
  });
});

/**
 * Ticket 23: the Draft's one undo and redo, over the whole document. What an
 * Author does to a Journey — a title typed, a Step's reading written, a Step
 * deleted, the map turned, a Choice pointed somewhere else — comes back with
 * one press of Cmd/Ctrl+Z or one press of the button beside "Add step",
 * whether their hands are on the map or in a field. The two tests that show a
 * Choice drawn on the map coming back and a whole branch being taken apart and
 * put together again are recorded, and live in "authoring from the map" above
 * with the rest of the map's own moves.
 */
test.describe("undo and redo", () => {
  test("canvas-undo-title-typing", async ({ page, context }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    // The edit before the typing: the Start renamed, arriving whole.
    await renameStep(page, "Border post");

    // Then a Step made from the box's own moves, and named key by key in the
    // panel that opened on it.
    const toolbar = await expandStepActions(page, "Border post");
    await toolbar
      .getByRole("button", { name: "Add next step", exact: true })
      .click();

    const title = page.getByLabel("Step title");
    await expect(title).toHaveValue("Untitled step");
    await expect(title).toBeFocused();

    await retypeField(title, "Clinic tent");
    await expect(canvasNode(page, "Clinic tent")).toBeVisible();

    // One press gives the field back as it stood before the typing, rather
    // than a letter at a time, and leaves the Author on the same Step.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(title).toHaveValue("Untitled step");

    await expectSaved(page);
    const undone = await readDraft(journeyId);
    expect(Object.values(undone.steps).map((step) => step.title)).not.toContain(
      "Clinic tent",
    );

    // The press after that takes back the edit before the typing: the Step
    // and the Choice that reached it go together, and the Author is back on
    // the Step they were made from.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvasNodes(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveCount(0);
    await expect(title).toHaveValue("Border post");
    await expect(redoButton(page)).toBeEnabled();

    // Typing after an undo is a new edit, and there is no longer anything to
    // put back on top of it.
    await retypeField(title, "Checkpoint");
    await expect(redoButton(page)).toBeDisabled();
    await expect(undoButton(page)).toBeEnabled();

    await expectSaved(page);
    await page.screenshot({
      path: evidencePath(testInfo.title, `${testInfo.title}.png`),
      fullPage: true,
    });
  });

  test("canvas-undo-rich-text", async ({ page, context }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    await renameStep(page, "Border post");

    const content = page.getByLabel("Step content");
    const reading = "Bring water";
    await content.click();
    await page.keyboard.type(reading);
    await expect(content).toContainText(reading);

    // The surface keeps no history of its own: the press inside it belongs to
    // the Draft, and gives back the reading as it stood before the typing.
    await page.keyboard.press("ControlOrMeta+z");
    // Empty, as it stood — not one letter shorter, which is what a surface
    // keeping a history of its own would have given back.
    await expect(content).toHaveText("");
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    await expectSaved(page);
    const undone = await readDraft(journeyId);
    expect(
      contentPreview(storedStep(undone, "Border post").content, 10_000).trim(),
    ).toBe("");

    // A second Step, named last of all — and then the Author moves away from
    // it before pressing undo, with their hands in the title field.
    await addStepFromCanvas(page, "Clinic tent");
    await chooseStep(page, "Border post");
    await page.getByLabel("Step title").click();
    await page.keyboard.press("ControlOrMeta+z");

    // The press took back the document's last edit — the naming of the other
    // Step — so the panel went to the Step that edit was on.
    await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");

    // And an edit of the open Step's own is taken back without the panel
    // moving anywhere at all.
    await retypeField(page.getByLabel("Step title"), "Clinic tent");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
    await expect(canvasNode(page, "Untitled step")).toBeVisible();

    await expectSaved(page);
    await page.screenshot({
      path: evidencePath(testInfo.title, `${testInfo.title}.png`),
      fullPage: true,
    });
  });

  test("canvas-undo-delete-direction-retarget", async ({
    page,
    context,
  }, testInfo) => {
    const { journeyId } = await startJourney(page, context);

    // Nothing has been done to this Draft yet, and both buttons say so.
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();

    await renameStep(page, "Border post");

    // With the panel put away, an undo still opens the Step it belongs to —
    // the panel comes back for it — and moves the view no further than
    // bringing its box on. The one box is on the map already, so the map
    // stays exactly where "Hide panel" left it settled.
    const wholeMap = await hidePanel(page);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByLabel("Step title")).toHaveValue("Start");
    expect(await settledTransform(page)).toBe(wholeMap);
    await redoButton(page).click();
    await expect(page.getByLabel("Step title")).toHaveValue("Border post");

    await addStepFromCanvas(page, "Clinic tent");
    await addStepFromCanvas(page, "Waved through");
    await expectBoxOnMap(page, "Waved through");
    await fitWholeMap(page, 3);

    const label = await connectByDragging(
      page,
      "Border post",
      "Clinic tent",
      1,
    );
    await label.fill("Find the clinic");
    await expect(label).toHaveValue("Find the clinic");

    // An edit made: one button has something to do and the other has not.
    await expect(undoButton(page)).toBeEnabled();
    await expect(redoButton(page)).toBeDisabled();

    // The head of the arrow taken in hand and dropped on another box.
    await fitWholeMap(page, 3);
    const arrow = arrowLabelled(page, "Find the clinic");
    await clickArrow(page, arrow);
    await expect(arrow).toHaveAttribute("data-emphasis", "selected");
    await dragTo(
      page,
      arrow.locator(".react-flow__edgeupdater-target"),
      canvasNode(page, "Waved through"),
    );
    await expect(arrow).toHaveAttribute(
      "aria-label",
      "Find the clinic: Border post → Waved through",
    );

    // One press of the button puts the Choice back where it pointed, and one
    // press of the other sends it out again.
    await undoButton(page).click();
    await expect(arrow).toHaveAttribute(
      "aria-label",
      "Find the clinic: Border post → Clinic tent",
    );
    await redoButton(page).click();
    await expect(arrow).toHaveAttribute(
      "aria-label",
      "Find the clinic: Border post → Waved through",
    );

    // The way the map runs is an edit like any other, and comes back the same.
    await setDirection(page, "Left to right");
    await undoButton(page).click();
    await expect(directionRadio(page, "Top to bottom")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await redoButton(page).click();
    await expect(directionRadio(page, "Left to right")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // A Step deleted from the panel, confirmation and all, comes back with one
    // press — and brings the Author back to it. "Clinic tent" is the one
    // deleted because the Choice was moved off it a moment ago: nothing points
    // at it, so the map loses a box outright rather than keeping a placeholder
    // in its place for a Choice left pointing at a Step that is gone.
    await chooseStep(page, "Clinic tent");
    await stepPanel(page)
      .getByRole("button", { name: "Delete step", exact: true })
      .click();
    const confirmation = page.getByRole("alertdialog");
    await confirmation
      .getByRole("button", { name: "Delete step", exact: true })
      .click();
    await expect(confirmation).toBeHidden();
    await expect(canvasNodes(page)).toHaveCount(2);

    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvasNodes(page)).toHaveCount(3);
    await expect(page.getByLabel("Step title")).toHaveValue("Clinic tent");

    // And back to the beginning, one press at a time, until the button says
    // there is nothing left. Polled, rather than looped over one read of the
    // button per press: a press lands a moment after the click, and a read
    // taken inside that moment would send one press too many at a button
    // already disabled. The press is forced past Playwright's own wait for
    // an enabled button for the same reason, and a press on nothing is
    // nothing — so the poll can only end in the one place.
    await expect
      .poll(async () => {
        if (!(await undoButton(page).isEnabled())) return "nothing left";
        await undoButton(page).click({ force: true });
        return "still pressing";
      })
      .toBe("nothing left");

    // Nothing left to take back: a Draft of one Step, named as a new Draft
    // names it, drawn the way a new Draft is drawn.
    await expect(undoButton(page)).toBeDisabled();
    await expect(canvasNodes(page)).toHaveCount(1);
    await expect(canvasEdges(page)).toHaveCount(0);
    await expect(page.getByLabel("Step title")).toHaveValue("Start");
    await expect(directionRadio(page, "Top to bottom")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await expectSaved(page);
    const stored = await readDraft(journeyId);
    expect(Object.keys(stored.steps)).toHaveLength(1);
    expect(stored.layoutDirection).toBe("TB");

    await page.screenshot({
      path: evidencePath(testInfo.title, `${testInfo.title}.png`),
      fullPage: true,
    });
  });
});

/**
 * The 8-bit sRGB Chromium paints one colour as, read the way
 * `themes.spec.ts` reads luminance: painted onto a one-pixel canvas, so a
 * token written in oklch and a button's computed colour compare as the same
 * pixel. `source` is either a CSS custom property read off `<html>` (`--card`)
 * or a selector and the property to read off the first element it matches.
 */
async function paintedRgb(
  page: Page,
  source:
    | { token: `--${string}` }
    | { selector: string; property: "background-color" | "color" },
): Promise<string> {
  const value = await page.evaluate((source) => {
    const style =
      "token" in source
        ? window
            .getComputedStyle(window.document.documentElement)
            .getPropertyValue(source.token)
        : (() => {
            const element = window.document.querySelector(source.selector);
            return element === null
              ? null
              : window
                  .getComputedStyle(element)
                  .getPropertyValue(source.property);
          })();
    if (style === null || style.trim() === "") return null;

    const canvas = window.document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (context === null) return null;
    context.fillStyle = style.trim();
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = Array.from(context.getImageData(0, 0, 1, 1).data);
    return `${r},${g},${b}`;
  }, source);
  expect(value, `${JSON.stringify(source)} painted`).not.toBeNull();
  return value as string;
}

/**
 * The zoom and fit-view buttons beside the map, read against the theme's
 * own tokens: their background is the card and their glyphs the foreground,
 * whichever theme the page is in. The tokens are read off `<html>`, where
 * the theme class puts them, so the check follows the theme rather than
 * naming a colour.
 */
async function expectControlsThemed(page: Page, where: string): Promise<void> {
  const button = '[aria-label="Canvas"] .react-flow__controls-button';
  await expect(
    canvas(page).locator(".react-flow__controls-button").first(),
  ).toBeVisible();
  // The map itself is told which theme it is in: the class React Flow
  // stamps for its own dark rules is the dark one, whichever way the page
  // was reached.
  await expect(
    canvas(page).locator(".react-flow"),
    `${where}: the map carries React Flow's dark class`,
  ).toHaveClass(/\bdark\b/);
  await expect
    .poll(
      () =>
        paintedRgb(page, { selector: button, property: "background-color" }),
      { message: `${where}: the controls' background is the card` },
    )
    .toBe(await paintedRgb(page, { token: "--card" }));
  await expect
    .poll(() => paintedRgb(page, { selector: button, property: "color" }), {
      message: `${where}: the controls' glyphs are the foreground`,
    })
    .toBe(await paintedRgb(page, { token: "--foreground" }));
}

/**
 * Ticket 35, item 19: in the dark theme the zoom and fit-view controls
 * sometimes came up white. Reproduced the way Paul met it — the dark theme
 * chosen from the user menu, then the Journey page reached by a full load and
 * again by clicking through from the Projects list, with the OS light and
 * with it dark — and read against the theme's tokens on every one of those
 * four arrivals.
 */
test("canvas-dark-controls", async ({ page, context }) => {
  const { projectId, journeyId } = await startJourney(page, context);
  const journeyUrl = `/projects/${projectId}/journeys/${journeyId}`;

  // The dark theme, chosen as an Author chooses it.
  await page.getByRole("button", { name: "Account: Test Author" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });

    // By a full load.
    await page.goto(journeyUrl);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(canvasNodes(page)).toHaveCount(1);
    await expectControlsThemed(page, `OS ${colorScheme}, full load`);

    // By client-side navigation from the Projects list: the list, the
    // Project, the Journey, each a link rather than a load.
    await page.goto("/projects");
    await page.locator(`a[href="/projects/${projectId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
    await page.locator(`a[href="${journeyUrl}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${journeyUrl}$`));
    await expect(canvasNodes(page)).toHaveCount(1);
    await expectControlsThemed(page, `OS ${colorScheme}, client navigation`);

    if (colorScheme === "dark") {
      await page.screenshot({
        path: evidencePath("canvas-dark-controls", "canvas-dark-controls.png"),
        fullPage: true,
      });
    }
  }
});
