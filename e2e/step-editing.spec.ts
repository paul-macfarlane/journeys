import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 08: an Author building a Journey out of Steps, Choices,
 * and Outcomes through the panel on the Journey page.
 *
 * Every Draft here is built the way an Author would build it — no spec writes
 * a document into the `draft` row — because what is being tested is the
 * editor, not the storage the earlier tickets already proved. Where a claim is
 * structural (how many Steps, whether an Outcome kept its id, what a Step's
 * rich text holds) it is made against the row the editor wrote.
 */

// Building a Journey is a few dozen interactions, each carrying the autosave's
// quiet window; the default per-test budget is sized for far shorter specs.
test.describe.configure({ timeout: 180_000 });

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  // Deleting the Project cascades its Journeys, and each Journey its Draft.
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

/** Ids are minted by the app, so a spec can only ever look one up by name. */
function stepIdByTitle(draft: GraphDocument, title: string): string {
  const match = Object.values(draft.steps).find((step) => step.title === title);
  if (!match) throw new Error(`No step titled "${title}"`);
  return match.id;
}

/**
 * Autosave is debounced, so "the Draft is stored" is a thing to wait for
 * rather than assume. Every reload, Preview, row read, and Publish in this
 * file goes through here first.
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

  return { projectId, journeyId };
}

function stepButton(page: Page, title: string) {
  return page
    .getByRole("list", { name: "Steps" })
    .getByRole("button", { name: title, exact: true });
}

// The panel has no heading repeating the title: the title field is the
// Step's name there, so it is what these read.
async function selectStep(page: Page, title: string): Promise<void> {
  await stepButton(page, title).click();
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

async function renameStep(page: Page, title: string): Promise<void> {
  await page.getByLabel("Step title").fill(title);
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

/** "Add choice" pointed at a Step that does not exist yet — the same motion. */
async function addChoiceToNewStep(
  page: Page,
  label: string,
  title: string,
): Promise<void> {
  await page.getByRole("button", { name: "Add choice", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill(label);
  await page
    .getByLabel("Target", { exact: true })
    .selectOption({ label: "New step" });
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // The new Step is what the panel opens on, with its title field focused,
  // so it can be named right away.
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await expect(page.getByLabel("Step title")).toBeFocused();
  await renameStep(page, title);
}

/** "Add choice" pointed at a Step that is already in the Draft. */
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

test("step-editing-build-and-publish", async ({ page, context }) => {
  const { journeyId } = await startJourney(page, context);

  // The Start is what the panel opens on.
  await expect(page.getByLabel("Step title")).toHaveValue("Start");
  await renameStep(page, "Border post");

  // Six Steps, built forwards: every Choice names the Step it needs and the
  // panel opens that Step to be written.
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");

  await selectStep(page, "Border post");
  await addChoiceToNewStep(page, "Walk away", "Turned back");

  await addChoiceToNewStep(page, "Find the clinic", "Clinic tent");

  await selectStep(page, "Waved through");
  await addChoiceToStep(page, "Follow the road", "Clinic tent");

  await selectStep(page, "Clinic tent");
  await addChoiceToNewStep(page, "Ask for help", "Reached the ward");

  await selectStep(page, "Clinic tent");
  await addChoiceToNewStep(page, "Wait outside", "Sent away");

  await expect(page.getByText("6 steps · 0 outcomes")).toBeVisible();

  // Validation on demand, while the two Endings have nothing to be grouped by.
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  const problems = page.getByRole("list", { name: "Validation problems" });
  await expect(
    problems.getByText('Ending "Reached the ward" has no outcome'),
  ).toBeVisible();
  await expect(
    problems.getByText('Ending "Sent away" has no outcome'),
  ).toBeVisible();

  await page.getByLabel("New outcome", { exact: true }).fill("Reached care");
  await page.getByRole("button", { name: "Add outcome", exact: true }).click();
  await page.getByLabel("New outcome", { exact: true }).fill("Turned away");
  await page.getByRole("button", { name: "Add outcome", exact: true }).click();
  await expect(page.getByText("6 steps · 2 outcomes")).toBeVisible();

  await selectStep(page, "Reached the ward");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Reached care" });
  await selectStep(page, "Sent away");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Turned away" });

  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByText("No problems found.")).toBeVisible();

  // Nothing about publishing is this ticket's, except that what was built
  // here is publishable.
  await expectSaved(page);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // What the panel built is what the row holds.
  const stored = await readDraft(journeyId);
  expect(Object.keys(stored.steps)).toHaveLength(6);
  expect(Object.keys(stored.outcomes)).toHaveLength(2);

  const endings = Object.values(stored.steps).filter(
    (step) => step.choices.length === 0,
  );
  expect(endings).toHaveLength(2);
  expect(endings.every((step) => step.outcomeId !== null)).toBe(true);

  await page.screenshot({
    path: "test-results/step-editing-build-and-publish/step-editing-build-and-publish.png",
    fullPage: true,
  });
});

test("step-editing-delete-and-validate", async ({ page, context }) => {
  const { journeyId } = await startJourney(page, context);

  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");

  // Deleting the Step a Choice points at says which Choice it breaks first.
  // The panel's button: the selected box on the map carries one of its own,
  // with the same name, that opens the same confirmation.
  await page
    .getByRole("region", { name: "Step" })
    .getByRole("button", { name: "Delete step", exact: true })
    .click();
  const confirmation = page.getByRole("alertdialog");
  await expect(
    confirmation.getByText("Wait your turn on Border post"),
  ).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Delete step", exact: true })
    .click();
  await expect(confirmation).toBeHidden();

  // The Start is what the panel falls back to, and its Choice now dangles.
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  const choiceRow = page
    .getByRole("list", { name: "Choices" })
    .getByRole("listitem")
    .first();
  await expect(
    choiceRow.getByText("This choice points at a step that no longer exists"),
  ).toBeVisible();
  await expect(choiceRow.getByLabel("Choice target")).toHaveValue("");
  await expect(
    choiceRow.getByRole("option", { name: "Missing step" }),
  ).toBeAttached();

  // Validation says the same thing in the words publishing would use.
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Validation problems" })
      .getByText(
        'Step "Border post" has a choice pointing at a step that no longer exists',
      ),
  ).toBeVisible();

  const stored = await readDraft(journeyId);
  expect(Object.keys(stored.steps)).toHaveLength(1);

  await page.screenshot({
    path: "test-results/step-editing-delete-and-validate/step-editing-delete-and-validate.png",
    fullPage: true,
  });
});

test("step-editing-image-credit-and-preview", async ({ page, context }) => {
  const { projectId, journeyId } = await startJourney(page, context);

  await renameStep(page, "Border post");

  // Rich text, typed the way an Author types it.
  await page.getByLabel("Step content").click();
  await page.getByRole("button", { name: "Heading 2", exact: true }).click();
  await page.keyboard.type("The queue");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.keyboard.type("Papers ready");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await page.keyboard.type("Water");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Shade");
  await expectSaved(page);

  // An image goes in at the top of the Step, above the heading.
  await page
    .getByLabel("Step content")
    .getByRole("heading", { name: "The queue" })
    .click();
  await page.keyboard.press("Home");

  await page.getByRole("button", { name: "Image", exact: true }).click();
  const imageDialog = page.getByRole("dialog");
  await imageDialog
    .getByLabel("Image URL")
    .fill("https://example.com/border.jpg");

  // Refused before it ever reaches the Draft, and the row proves it.
  await imageDialog.getByRole("button", { name: "Insert image" }).click();
  await expect(
    imageDialog.getByText("Every image needs a credit"),
  ).toBeVisible();

  const withoutImage = await readDraft(journeyId);
  expect(
    withoutImage.steps[withoutImage.startStepId].content.content.map(
      (block) => block.type,
    ),
  ).not.toContain("image");

  await imageDialog
    .getByLabel("Credit", { exact: true })
    .fill("Photo: Ada Lovelace");
  await imageDialog.getByRole("button", { name: "Insert image" }).click();
  await expect(imageDialog).toBeHidden();
  await expectSaved(page);

  // Stored as Tiptap JSON, credit and all.
  const withImage = await readDraft(journeyId);
  const blocks = withImage.steps[withImage.startStepId].content.content;
  expect(blocks.find((block) => block.type === "image")).toEqual({
    type: "image",
    attrs: {
      src: "https://example.com/border.jpg",
      credit: "Photo: Ada Lovelace",
      alt: null,
    },
  });

  // The same content, read the way a participant reads it.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}/preview`);
  await page.getByRole("link", { name: "Begin" }).click();
  await expect(
    page.getByRole("heading", { name: "Border post" }),
  ).toBeVisible();

  await expect(page.locator("figure img")).toHaveAttribute(
    "src",
    "https://example.com/border.jpg",
  );
  await expect(page.locator("figcaption")).toHaveText("Photo: Ada Lovelace");
  await expect(
    page.getByRole("heading", { name: "The queue", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("strong")).toHaveText("Papers ready");
  await expect(page.locator("li", { hasText: "Water" })).toHaveCount(1);
  await expect(page.locator("li", { hasText: "Shade" })).toHaveCount(1);

  await page.screenshot({
    path: "test-results/step-editing-image-credit-and-preview/step-editing-image-credit-and-preview.png",
    fullPage: true,
  });
});

test("step-editing-choices-reorder-retarget", async ({ page, context }) => {
  const { journeyId } = await startJourney(page, context);

  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");
  await selectStep(page, "Border post");
  await addChoiceToNewStep(page, "Walk away", "Turned back");
  await selectStep(page, "Border post");

  const rows = page
    .getByRole("list", { name: "Choices" })
    .getByRole("listitem");
  await expect(rows.nth(0).getByLabel("Choice label")).toHaveValue(
    "Wait your turn",
  );

  // The order a participant reads them in.
  await rows
    .nth(1)
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await expectSaved(page);
  await page.reload();
  await expect(rows.nth(0).getByLabel("Choice label")).toHaveValue("Walk away");
  await expect(rows.nth(1).getByLabel("Choice label")).toHaveValue(
    "Wait your turn",
  );

  // Retargeting an existing Choice at an existing Step.
  const stored = await readDraft(journeyId);
  const wavedThroughId = stepIdByTitle(stored, "Waved through");
  await rows
    .nth(0)
    .getByLabel("Choice target")
    .selectOption({ label: "Waved through" });
  await expectSaved(page);
  await page.reload();
  await expect(rows.nth(0).getByLabel("Choice target")).toHaveValue(
    wavedThroughId,
  );

  // Retargeting at a Step that does not exist yet makes it and opens it.
  await rows
    .nth(1)
    .getByLabel("Choice target")
    .selectOption({ label: "New step…" });
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await expect(page.getByLabel("Step title")).toBeFocused();
  await expect(stepButton(page, "Untitled step")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expectSaved(page);

  const after = await readDraft(journeyId);
  expect(Object.keys(after.steps)).toHaveLength(4);

  // Walking from the panel: "Leads here from" goes back up the Choice that
  // made this Step, "Open" on that Choice comes back down, and the Step no
  // Choice points at any more ("Turned back") is set apart from the walk.
  await page
    .getByRole("group", { name: "Leads here from" })
    .getByRole("button", { name: "Wait your turn on Border post" })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue("Border post");
  await rows.nth(1).getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await expect(
    page
      .getByRole("list", { name: "Not yet reached" })
      .getByRole("button", { name: "Turned back", exact: true }),
  ).toBeVisible();
  await expect(stepButton(page, "Turned back")).toHaveCount(0);

  await page.screenshot({
    path: "test-results/step-editing-choices-reorder-retarget/step-editing-choices-reorder-retarget.png",
    fullPage: true,
  });
});

test("step-editing-outcome-rename", async ({ page, context }) => {
  const { projectId, journeyId } = await startJourney(page, context);

  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");

  // "Waved through" has no Choices of its own, so it is an Ending and carries
  // an Outcome.
  await page.getByLabel("New outcome", { exact: true }).fill("Reached care");
  await page.getByRole("button", { name: "Add outcome", exact: true }).click();
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption({ label: "Reached care" });
  await expectSaved(page);

  const before = await readDraft(journeyId);
  const [outcomeId] = Object.keys(before.outcomes);
  const endingId = stepIdByTitle(before, "Waved through");
  expect(before.steps[endingId].outcomeId).toBe(outcomeId);

  // The rename is a label edit: the id it is filed under does not move, so
  // the Ending is still tagged with the same Outcome afterwards.
  await page.getByLabel("Outcome label").fill("Reached the clinic");
  await expectSaved(page);

  const after = await readDraft(journeyId);
  expect(Object.keys(after.outcomes)).toEqual([outcomeId]);
  expect(after.outcomes[outcomeId].label).toBe("Reached the clinic");
  expect(after.steps[endingId].outcomeId).toBe(outcomeId);

  // What a participant would be told at the end.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}/preview`);
  await page.getByRole("link", { name: "Begin" }).click();
  await page.getByRole("link", { name: "Wait your turn" }).click();
  await expect(page.getByText("Outcome: Reached the clinic")).toBeVisible();

  await page.screenshot({
    path: "test-results/step-editing-outcome-rename/step-editing-outcome-rename.png",
    fullPage: true,
  });
});
