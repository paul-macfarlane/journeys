import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

import case3 from "../scripts/seed/journey-stories/case-3.json";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import { writeDraftDocument } from "./setup/documents";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 09: the Draft as a map on the Journey page — every Step a
 * node, every Choice an edge, the Start and the Endings set apart, publish
 * problems marked on the exact node and edge, and the two moves an Author
 * makes from the map itself (add a Step, open one in the panel).
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
  await expect(page.getByLabel("Outcome label")).toHaveValue(label);
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

    await page.screenshot({
      path: "test-results/canvas-case-3-map/canvas-case-3-map.png",
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

  // Taking that Choice away leaves the loop just as unmarked as it was.
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
  await page.getByRole("button", { name: "Delete step", exact: true }).click();
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
