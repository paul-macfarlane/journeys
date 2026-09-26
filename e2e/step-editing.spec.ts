import { expect, test, type Locator, type Page } from "@playwright/test";

import type { GraphDocument } from "@/lib/graph/document";

import {
  arrowLabelled,
  chooseStep,
  openFindStep,
  tagWithOutcome,
} from "./setup/authoring";
import { readDraft } from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import {
  addChoiceToStep,
  expectSaved,
  renameStep,
  startJourney,
} from "./setup/editor";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools } from "./setup/session";

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

/** Ids are minted by the app, so a spec can only ever look one up by name. */
function stepIdByTitle(draft: GraphDocument, title: string): string {
  const match = Object.values(draft.steps).find((step) => step.title === title);
  if (!match) throw new Error(`No step titled "${title}"`);
  return match.id;
}

/** One Step offered by "Find step", named by its title alone. */
function stepOption(page: Page, title: string) {
  return page
    .getByRole("listbox", { name: "Steps" })
    .getByRole("option", { name: title, exact: true });
}

/**
 * The Ending's own Outcome field, which is where an Outcome is made now: a
 * button that reads as a select and opens the list of Outcomes.
 */
function outcomeField(page: Page) {
  return page.getByRole("combobox", { name: "Outcome", exact: true });
}

/** The filter at the top of the open Outcome list. */
function outcomeFilter(page: Page) {
  return page.getByRole("combobox", { name: "Filter outcomes", exact: true });
}

/** One Outcome taken from the list the field offers, by name. */
async function chooseOutcome(page: Page, name: string): Promise<void> {
  await outcomeField(page).click();
  await page
    .getByRole("listbox", { name: "Outcomes" })
    .getByRole("option", { name, exact: true })
    .click();

  await expect(outcomeField(page)).toHaveText(name);
}

/**
 * A Choice pointed at another Step the way an Author points it: part of the
 * Step's title typed into the row's target field, and the Step of that name
 * taken from what the field offers.
 */
async function retargetChoice(
  row: Locator,
  query: string,
  title: string,
): Promise<void> {
  const field = row.getByLabel("Choice target");
  await field.fill(query);

  const option = row.getByRole("option", { name: title, exact: true });
  await expect(option).toBeVisible();
  await option.click();

  await expect(field).toHaveValue(title);
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

test("step-editing-build-and-publish", async ({ page }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);

  // The Start is what the panel opens on.
  await expect(page.getByLabel("Step title")).toHaveValue("Start");
  await renameStep(page, "Border post");

  // Six Steps, built forwards: every Choice names the Step it needs and the
  // panel opens that Step to be written.
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");

  await chooseStep(page, "Border post");
  await addChoiceToNewStep(page, "Walk away", "Turned back");

  await addChoiceToNewStep(page, "Find the clinic", "Clinic tent");

  await chooseStep(page, "Waved through");
  await addChoiceToStep(page, "Follow the road", "Clinic tent");

  await chooseStep(page, "Clinic tent");
  await addChoiceToNewStep(page, "Ask for help", "Reached the ward");

  await chooseStep(page, "Clinic tent");
  await addChoiceToNewStep(page, "Wait outside", "Sent away");

  await expect(page.getByText("6 steps · 0 outcomes")).toBeVisible();

  // The header's live count, while the two Endings have nothing to be
  // grouped by: an Ending needs no Outcome, so what was built is already
  // publishable.
  await expect(page.getByText("No problems", { exact: true })).toBeVisible();

  // Each Outcome made from the Ending it groups, which is the only place one
  // is made now — grouping the Endings, never unblocking them.
  await chooseStep(page, "Reached the ward");
  await tagWithOutcome(page, "Reached care");
  await chooseStep(page, "Sent away");
  await tagWithOutcome(page, "Turned away");
  await expect(page.getByText("6 steps · 2 outcomes")).toBeVisible();
  await expect(page.getByText("No problems", { exact: true })).toBeVisible();

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
    path: evidencePath(
      "step-editing-build-and-publish",
      "step-editing-build-and-publish.png",
    ),
    fullPage: true,
  });
});

test("step-editing-delete-and-validate", async ({ page }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);

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
    choiceRow.getByText(
      'Step "Border post" has a choice pointing at a step that no longer exists',
    ),
  ).toBeVisible();
  // The deleted Step's place, said in the field itself and kept there until
  // the Author points the Choice somewhere real.
  await expect(choiceRow.getByLabel("Choice target")).toHaveValue(
    "Missing step",
  );

  // The header's count says the same thing in the words publishing would
  // use, and opens the list of everything wrong.
  await page.getByRole("button", { name: "1 problem", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "All problems" })
      .getByText(
        'Step "Border post" has a choice pointing at a step that no longer exists',
      ),
  ).toBeVisible();

  // The delete is written on the editor's own schedule; the row is read
  // once it says so.
  await expectSaved(page);
  const stored = await readDraft(journeyId);
  expect(Object.keys(stored.steps)).toHaveLength(1);

  await page.screenshot({
    path: evidencePath(
      "step-editing-delete-and-validate",
      "step-editing-delete-and-validate.png",
    ),
    fullPage: true,
  });
});

test("step-editing-image-caption-alt-and-preview", async ({
  page,
  context,
}) => {
  const { projectId, journeyId } = await startJourney(page, mintedAuthorIds);

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

  // A hover on Bold reads its tooltip: the name and the platform's shortcut
  // (Chromium on this runner reports whichever platform it runs on, so the
  // modifier is matched loosely). Base UI gives the popup no ARIA role on
  // purpose — the button's own name is what a screen reader hears — so it
  // is found by the slot the vendored component marks it with.
  const tooltip = page.locator('[data-slot="tooltip-content"]');
  await page.getByRole("button", { name: "Bold", exact: true }).hover();
  await expect(tooltip).toHaveText(/^Bold(⌘|Ctrl\+)B$/);
  await expect(
    page.getByRole("button", { name: "Bold", exact: true }),
  ).not.toHaveAttribute("aria-describedby", /.+/);
  await page.getByLabel("Step content").hover();
  await expect(tooltip).toHaveCount(0);

  // An image goes in at the top of the Step, above the heading.
  await page
    .getByLabel("Step content")
    .getByRole("heading", { name: "The queue" })
    .click();
  await page.keyboard.press("Home");

  await page.getByRole("button", { name: "Image", exact: true }).click();
  const imageDialog = page.getByRole("dialog");
  await expect(
    imageDialog.getByText("Describe the image for people who cannot see it"),
  ).toBeVisible();
  await imageDialog
    .getByLabel("Image URL")
    .fill("https://example.com/border.jpg");

  // Alt text is required: refused before it ever reaches the Draft, and the
  // row proves it.
  await imageDialog.getByRole("button", { name: "Insert image" }).click();
  await expect(
    imageDialog.getByText("Every image needs alt text"),
  ).toBeVisible();

  const withoutImage = await readDraft(journeyId);
  expect(
    withoutImage.steps[withoutImage.startStepId].content.content.map(
      (block) => block.type,
    ),
  ).not.toContain("image");

  await imageDialog
    .getByLabel("Alt text", { exact: true })
    .fill("A queue at a border post");
  await imageDialog
    .getByLabel("Caption (optional)")
    .fill("Photo: Ada Lovelace");
  await imageDialog.getByRole("button", { name: "Insert image" }).click();
  await expect(imageDialog).toBeHidden();
  await expectSaved(page);

  // Stored as Tiptap JSON, alt and caption and all.
  const withImage = await readDraft(journeyId);
  const blocks = withImage.steps[withImage.startStepId].content.content;
  expect(blocks.find((block) => block.type === "image")).toEqual({
    type: "image",
    attrs: {
      src: "https://example.com/border.jpg",
      alt: "A queue at a border post",
      caption: "Photo: Ada Lovelace",
    },
  });

  // Selecting the image shows the ring and the floating toolbar.
  const figure = page.getByLabel("Step content").locator("figure");
  await expect(figure.locator("figcaption")).toHaveText("Photo: Ada Lovelace");
  await figure.locator("img").click();
  await expect(figure).toHaveClass(/ProseMirror-selectednode/);
  const imageTools = page.getByRole("toolbar", { name: "Image tools" });
  await expect(
    imageTools.getByRole("button", { name: "Remove" }),
  ).toBeVisible();

  await page.screenshot({
    path: evidencePath(
      "step-editing-image-caption-alt-and-preview",
      "selected-image.png",
    ),
    fullPage: true,
  });

  // Editing rewrites the selected image's caption and alt in place.
  await imageTools.getByRole("button", { name: "Edit image" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit image" });
  await expect(editDialog.getByLabel("Image URL")).toHaveValue(
    "https://example.com/border.jpg",
  );
  await expect(editDialog.getByLabel("Alt text", { exact: true })).toHaveValue(
    "A queue at a border post",
  );
  await editDialog
    .getByLabel("Alt text", { exact: true })
    .fill("Travellers waiting at a border post");
  await editDialog
    .getByLabel("Caption (optional)")
    .fill("Photo: Ada Lovelace, CC BY 4.0");
  await editDialog.getByRole("button", { name: "Save image" }).click();
  await expect(editDialog).toBeHidden();
  await expect(figure.locator("figcaption")).toHaveText(
    "Photo: Ada Lovelace, CC BY 4.0",
  );
  await expectSaved(page);

  const edited = await readDraft(journeyId);
  expect(
    edited.steps[edited.startStepId].content.content.filter(
      (block) => block.type === "image",
    ),
  ).toEqual([
    {
      type: "image",
      attrs: {
        src: "https://example.com/border.jpg",
        alt: "Travellers waiting at a border post",
        caption: "Photo: Ada Lovelace, CC BY 4.0",
      },
    },
  ]);

  // The same content, read the way a participant reads it.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}/preview`);
  await expect(
    page.getByRole("heading", { name: "Border post" }),
  ).toBeVisible();

  await expect(page.locator("figure img")).toHaveAttribute(
    "src",
    "https://example.com/border.jpg",
  );
  await expect(page.locator("figure img")).toHaveAttribute(
    "alt",
    "Travellers waiting at a border post",
  );
  await expect(page.locator("figcaption")).toHaveText(
    "Photo: Ada Lovelace, CC BY 4.0",
  );
  await expect(
    page.getByRole("heading", { name: "The queue", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("strong")).toHaveText("Papers ready");
  await expect(page.locator("li", { hasText: "Water" })).toHaveCount(1);
  await expect(page.locator("li", { hasText: "Shade" })).toHaveCount(1);

  await page.screenshot({
    path: evidencePath(
      "step-editing-image-caption-alt-and-preview",
      "step-editing-image-caption-alt-and-preview.png",
    ),
    fullPage: true,
  });

  // Publish, and read alt and caption on the runner: the Published Version
  // carries the new names from the start.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await expectSaved(page);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // A participant reads the Published Version anonymously.
  const participant = await context.browser()!.newContext();
  const runner = await participant.newPage();
  await runner.goto(`${E2E_BASE_URL}/j/${journeyId}`);
  await expect(runner.locator("figure img")).toHaveAttribute(
    "alt",
    "Travellers waiting at a border post",
  );
  await expect(runner.locator("figcaption")).toHaveText(
    "Photo: Ada Lovelace, CC BY 4.0",
  );
  await runner.screenshot({
    path: evidencePath(
      "step-editing-image-caption-alt-and-preview",
      "runner.png",
    ),
    fullPage: true,
  });
  await participant.close();
});

test("rich-text-underline-strike-quote", async ({ page, context }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);
  await renameStep(page, "Lamp room");

  // Every mark and the quote go on by one of button or shortcut and the
  // marks come off by the other, so all three shortcuts and all three
  // buttons are pressed; the line break is Shift+Enter.
  const surface = page.getByLabel("Step content");
  const underline = page.getByRole("button", {
    name: "Underline",
    exact: true,
  });
  await surface.click();
  const strike = page.getByRole("button", {
    name: "Strikethrough",
    exact: true,
  });
  const quoteButton = page.getByRole("button", { name: "Quote", exact: true });
  await underline.click();
  await page.keyboard.type("Never");
  await page.keyboard.press("ControlOrMeta+u");
  await expect(underline).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.type(" ");
  await page.keyboard.press("ControlOrMeta+Shift+s");
  await page.keyboard.type("leave");
  await strike.click();
  await expect(strike).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("the light");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+Shift+b");
  await expect(quoteButton).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Keep the light burning.");
  await expectSaved(page);

  // The tooltip names the shortcut the editor answered to. The pointer is
  // still over Strikethrough from the click that took the mark off, so it
  // leaves first: a hover where it already is opens nothing.
  const tooltip = page.locator('[data-slot="tooltip-content"]');
  await surface.hover();
  await expect(tooltip).toHaveCount(0);
  await page
    .getByRole("button", { name: "Strikethrough", exact: true })
    .hover();
  await expect(tooltip).toHaveText(/^Strikethrough(⌘⇧|Ctrl\+Shift\+)S$/);
  await surface.hover();

  // The Draft row holds all four, in the stored shape.
  const draft = await readDraft(journeyId);
  expect(draft.steps[draft.startStepId].content).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Never", marks: [{ type: "underline" }] },
          { type: "text", text: " " },
          { type: "text", text: "leave", marks: [{ type: "strike" }] },
          { type: "hardBreak" },
          { type: "text", text: "the light" },
        ],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Keep the light burning." }],
          },
        ],
      },
    ],
  });

  // A reload reads them back into the editor.
  await page.reload();
  await expect(surface.locator("u")).toHaveText("Never");
  await expect(surface.locator("s")).toHaveText("leave");
  await expect(surface.locator("p br")).toHaveCount(1);
  await expect(surface.locator("blockquote")).toHaveText(
    "Keep the light burning.",
  );
  await page.screenshot({
    path: evidencePath("rich-text-underline-strike-quote", "editor.png"),
    fullPage: true,
  });

  await expectSaved(page);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // A participant reads the Published Version: the marks, the break, and a
  // quote set off by a rule and left upright.
  const participant = await context.browser()!.newContext();
  const runner = await participant.newPage();
  await runner.goto(`${E2E_BASE_URL}/j/${journeyId}`);
  await expect(runner.locator("u")).toHaveText("Never");
  await expect(runner.locator("s")).toHaveText("leave");
  // The break sits between the struck word and the next line, in one
  // paragraph.
  const broken = runner.locator("p", { has: runner.locator("u") });
  await expect(broken).toHaveText("Never leavethe light");
  await expect(broken.locator("br")).toHaveCount(1);
  const quote = runner.locator("blockquote");
  await expect(quote).toHaveText("Keep the light burning.");
  await expect(quote).toHaveCSS("border-left-style", "solid");
  await expect(quote).toHaveCSS("font-style", "normal");
  await runner.screenshot({
    path: evidencePath("rich-text-underline-strike-quote", "runner.png"),
    fullPage: true,
  });
  await participant.close();
});

test("rich-text-image-in-list-item", async ({ page }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);
  await renameStep(page, "Lamp room");
  await addChoiceToNewStep(page, "Go down", "Cellar");
  await chooseStep(page, "Lamp room");

  // The cursor is in the list's last item when the image goes in (ticket 71):
  // an image cannot live in a list item, so it lands after the list, whole.
  const surface = page.getByLabel("Step content");
  await surface.click();
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await page.keyboard.type("Oil");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Wick");

  await page.getByRole("button", { name: "Image", exact: true }).click();
  const imageDialog = page.getByRole("dialog");
  await imageDialog
    .getByLabel("Image URL")
    .fill("https://example.com/lamp.jpg");
  await imageDialog
    .getByLabel("Alt text", { exact: true })
    .fill("A brass lamp");
  await imageDialog.getByRole("button", { name: "Insert image" }).click();
  await expect(imageDialog).toBeHidden();
  await expect(surface.locator("ul > li")).toHaveText(["Oil", "Wick"]);
  await expect(surface.locator("ul + figure img")).toHaveAttribute(
    "alt",
    "A brass lamp",
  );
  await expectSaved(page);

  // Away to another Step and back: the figure the Author saw is the one
  // that was saved.
  await chooseStep(page, "Cellar");
  await expect(surface.locator("figure")).toHaveCount(0);
  await chooseStep(page, "Lamp room");
  await expect(surface.locator("ul > li")).toHaveText(["Oil", "Wick"]);
  await expect(surface.locator("ul + figure img")).toHaveAttribute(
    "alt",
    "A brass lamp",
  );
  await page.screenshot({
    path: evidencePath("rich-text-image-in-list-item", "reopened.png"),
    fullPage: true,
  });

  const draft = await readDraft(journeyId);
  const content = draft.steps[stepIdByTitle(draft, "Lamp room")].content;
  expect(content.content.map((block) => block.type)).toEqual([
    "bulletList",
    "image",
  ]);
  expect(content.content[1]).toEqual({
    type: "image",
    attrs: {
      src: "https://example.com/lamp.jpg",
      alt: "A brass lamp",
      caption: "",
    },
  });
});

test("step-editing-choices-reorder-retarget", async ({ page }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);

  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");
  await chooseStep(page, "Border post");
  await addChoiceToNewStep(page, "Walk away", "Turned back");
  await chooseStep(page, "Border post");

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

  // Retargeting an existing Choice at an existing Step, found by name in the
  // row's own field.
  const stored = await readDraft(journeyId);
  const borderPostId = stepIdByTitle(stored, "Border post");
  const wavedThroughId = stepIdByTitle(stored, "Waved through");
  await retargetChoice(rows.nth(0), "waved", "Waved through");
  await expectSaved(page);

  // The field reads the Step's title; the Draft holds the Step's id.
  const retargeted = await readDraft(journeyId);
  expect(retargeted.steps[borderPostId].choices[0].targetStepId).toBe(
    wavedThroughId,
  );
  await page.reload();
  await expect(rows.nth(0).getByLabel("Choice target")).toHaveValue(
    "Waved through",
  );

  // Retargeting at a Step that does not exist yet makes it and opens it.
  await rows.nth(1).getByLabel("Choice target").click();
  await rows
    .nth(1)
    .getByRole("option", { name: "New step…", exact: true })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await expect(page.getByLabel("Step title")).toBeFocused();
  // And it is a Step of the Draft like any other: "Find step" offers it.
  await openFindStep(page);
  await expect(stepOption(page, "Untitled step")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectSaved(page);

  const after = await readDraft(journeyId);
  expect(Object.keys(after.steps)).toHaveLength(4);

  // Walking from the panel: "Find step" goes back up to the Step the Choice
  // that made this one is written on, "Open" on that Choice comes back down,
  // and the Step no Choice points at any more ("Turned back") now shows up as
  // a live problem, found through the header's count rather than a separate
  // "not yet reached" list.
  await chooseStep(page, "Border post");
  await rows.nth(1).getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");

  await openFindStep(page);
  await expect(stepOption(page, "Turned back")).toBeVisible();
  await page.keyboard.press("Escape");

  // What the header says now, written out rather than recomputed the way the
  // app computes it: one problem — "Turned back" dropped out of the walk when
  // its Choice was retargeted. The three Endings ("Waved through", "Turned
  // back", "Untitled step") have no Outcome between them, and none of them
  // needs one.
  const turnedBackMessage =
    'Step "Turned back" cannot be reached from the start';
  const problemsButton = page.getByRole("button", {
    name: "1 problem",
    exact: true,
  });
  await expect(problemsButton).toBeVisible();
  await problemsButton.click();
  await page
    .getByRole("list", { name: "All problems" })
    .getByRole("button", { name: turnedBackMessage, exact: true })
    .click();
  await expect(page.getByLabel("Step title")).toHaveValue("Turned back");

  await page.screenshot({
    path: evidencePath(
      "step-editing-choices-reorder-retarget",
      "step-editing-choices-reorder-retarget.png",
    ),
    fullPage: true,
  });
});

test("step-editing-outcome-rename", async ({ page }) => {
  const { projectId, journeyId } = await startJourney(page, mintedAuthorIds);

  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");

  // "Waved through" has no Choices of its own, so it is an Ending and carries
  // an Outcome, made from the Ending itself.
  await tagWithOutcome(page, "Reached care");
  await expectSaved(page);

  const before = await readDraft(journeyId);
  const [outcomeId] = Object.keys(before.outcomes);
  const endingId = stepIdByTitle(before, "Waved through");
  expect(before.steps[endingId].outcomeId).toBe(outcomeId);

  // The rename is a label edit: the id it is filed under does not move, so
  // the Ending is still tagged with the same Outcome afterwards.
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const labelField = page.getByLabel("Outcome label", { exact: true });
  await expect(labelField).toBeFocused();
  await labelField.fill("Reached the clinic");
  await labelField.press("Enter");
  await expect(outcomeField(page)).toHaveText("Reached the clinic");
  await expectSaved(page);

  const after = await readDraft(journeyId);
  expect(Object.keys(after.outcomes)).toEqual([outcomeId]);
  expect(after.outcomes[outcomeId].label).toBe("Reached the clinic");
  expect(after.steps[endingId].outcomeId).toBe(outcomeId);

  // What a participant would be told at the end.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}/preview`);
  await page.getByRole("link", { name: "Wait your turn" }).click();
  await expect(page.getByText("Outcome: Reached the clinic")).toBeVisible();

  await page.screenshot({
    path: evidencePath(
      "step-editing-outcome-rename",
      "step-editing-outcome-rename.png",
    ),
    fullPage: true,
  });
});

test("panel-choice-target-search", async ({ page }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);

  // A Start with two Choices, each on a Step of its own.
  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");
  await chooseStep(page, "Border post");
  await addChoiceToNewStep(page, "Find the clinic", "Clinic tent");
  await chooseStep(page, "Border post");

  const rows = page
    .getByRole("list", { name: "Choices" })
    .getByRole("listitem");
  const target = rows.nth(0).getByLabel("Choice target");
  await expect(target).toHaveValue("Waved through");

  // Part of another Step's title, and that Step is what the field offers:
  // the Steps whose titles hold what was typed, and the standing offer to
  // make a Step that does not exist yet.
  await target.fill("clin");
  await expect(rows.nth(0).getByRole("option")).toHaveText([
    "Clinic tent",
    "New step…",
  ]);
  await rows
    .nth(0)
    .getByRole("option", { name: "Clinic tent", exact: true })
    .click();
  await expect(target).toHaveValue("Clinic tent");
  await expectSaved(page);

  // What the row says is what the Draft holds.
  const stored = await readDraft(journeyId);
  const borderPostId = stepIdByTitle(stored, "Border post");
  const clinicTentId = stepIdByTitle(stored, "Clinic tent");
  const retargeted = stored.steps[borderPostId].choices.find(
    (choice) => choice.label === "Wait your turn",
  );
  expect(retargeted?.targetStepId).toBe(clinicTentId);

  // And what the map draws: the arrow names the Step it now ends on.
  await expect(arrowLabelled(page, "Wait your turn")).toHaveAttribute(
    "aria-label",
    "Wait your turn: Border post → Clinic tent",
  );

  // Nothing reads the Choices leading to a Step back out of the panel any
  // more: not on the Start, not on a Step two Choices lead to, and not on
  // one nothing leads to.
  const leadsHereFrom = page.getByRole("group", { name: "Leads here from" });
  await expect(leadsHereFrom).toHaveCount(0);
  await chooseStep(page, "Clinic tent");
  await expect(leadsHereFrom).toHaveCount(0);
  await chooseStep(page, "Waved through");
  await expect(leadsHereFrom).toHaveCount(0);

  // A Start with Choices enough to fill the panel: the last row's target
  // field sits at the foot of a tall panel, where a list opened downwards
  // would run off the page with no way to reach the rest of it. The column
  // the panel is in clips what overflows it, so the list opens upwards
  // instead, whole and reachable to the last option it offers.
  await chooseStep(page, "Border post");
  const built: [string, string][] = [
    ["Turn back", "Turned back"],
    ["Wait longer", "Waiting room"],
    ["Ask again", "Asked again"],
    ["Walk on", "Walked on"],
    ["Sit down", "Sat down"],
    ["Head north", "Headed north"],
  ];
  for (const [label, title] of built) {
    await addChoiceToNewStep(page, label, title);
    await chooseStep(page, "Border post");
  }
  await expect(rows).toHaveCount(8);

  const lastRow = rows.last();
  await lastRow.getByLabel("Choice target").click();
  const steps = lastRow.getByRole("listbox", { name: "Steps" });
  await expect(steps).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport, "the browser reports no viewport").not.toBeNull();

  // The box the list is drawn in, and the column that clips it: the column
  // never scrolls, so anything of the list outside it is gone for good.
  const drawnIn = await steps.evaluate((list) => {
    const { top, bottom } = list.parentElement!.getBoundingClientRect();
    return { top, bottom };
  });
  const column = await page
    .getByRole("region", { name: "Step", exact: true })
    .evaluate((panel) => {
      const { top, bottom } = panel.parentElement!.getBoundingClientRect();
      return { top, bottom };
    });

  expect(drawnIn.top).toBeGreaterThanOrEqual(column.top);
  expect(drawnIn.bottom).toBeLessThanOrEqual(column.bottom);
  expect(drawnIn.top).toBeGreaterThanOrEqual(0);
  expect(drawnIn.bottom).toBeLessThanOrEqual(viewport!.height);

  // Including the offer at its foot, which is the one furthest from the field.
  const newStep = lastRow.getByRole("option", {
    name: "New step…",
    exact: true,
  });
  await expect(newStep).toBeVisible();
  const offerBox = await newStep.boundingBox();
  expect(offerBox, "the last option has no box").not.toBeNull();
  expect(offerBox!.y).toBeGreaterThanOrEqual(0);
  expect(offerBox!.y + offerBox!.height).toBeLessThanOrEqual(viewport!.height);

  await page.screenshot({
    path: evidencePath(
      "panel-choice-target-search",
      "panel-choice-target-search.png",
    ),
    fullPage: true,
  });
});

test("panel-outcomes-from-the-ending", async ({ page }) => {
  const { journeyId } = await startJourney(page, mintedAuthorIds);

  // A Start with two Choices, so the Journey has two Endings to group.
  await renameStep(page, "Border post");
  await addChoiceToNewStep(page, "Wait your turn", "Waved through");
  await chooseStep(page, "Border post");
  await addChoiceToNewStep(page, "Walk away", "Turned back");

  // Nothing beneath the map lists the Journey's Outcomes any more.
  await expect(page.getByRole("region", { name: "Outcomes" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Outcomes" })).toHaveCount(0);

  // Closed, the field reads as a select: what the Ending carries, which is
  // nothing yet, on a button that says it opens a list.
  await chooseStep(page, "Waved through");
  const field = outcomeField(page);
  await expect(field).toHaveText("No outcome");
  await expect(field).toHaveAttribute("aria-haspopup", "listbox");
  await expect(field).toHaveAttribute("aria-expanded", "false");

  // Its label sits a clear gap above it, like every other field in the panel.
  const fieldId = await field.getAttribute("id");
  const labelBox = await page.locator(`label[for="${fieldId}"]`).boundingBox();
  const fieldBox = await field.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(fieldBox).not.toBeNull();
  expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(fieldBox!.y - 4);

  // An Outcome made from the Ending that needs it, in one motion: opened,
  // typed into the filter at the top of the list, and created.
  await field.click();
  await expect(field).toHaveAttribute("aria-expanded", "true");
  await expect(outcomeFilter(page)).toBeFocused();
  await outcomeFilter(page).fill("Reached care");
  await page
    .getByRole("listbox", { name: "Outcomes" })
    .getByRole("option", { name: "Create outcome “Reached care”", exact: true })
    .click();
  await expect(field).toHaveText("Reached care");
  await expect(page.getByText("3 steps · 1 outcome")).toBeVisible();

  // The second Ending takes it from the list, and the list says how many
  // Endings each Outcome holds.
  await chooseStep(page, "Turned back");
  await chooseOutcome(page, "Reached care");
  await outcomeField(page).click();
  await expect(
    page
      .getByRole("listbox", { name: "Outcomes" })
      .getByRole("option", { name: "Reached care", exact: true }),
  ).toContainText("2 endings");
  await page.screenshot({
    path: evidencePath("panel-outcomes-from-the-ending", "outcome-open.png"),
    fullPage: true,
  });

  // Escape puts the list away and hands the focus back to the field.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "Outcomes" })).toHaveCount(0);
  await expect(outcomeField(page)).toHaveAttribute("aria-expanded", "false");
  await expect(outcomeField(page)).toBeFocused();
  await expectSaved(page);

  const tagged = await readDraft(journeyId);
  const [outcomeId] = Object.keys(tagged.outcomes);

  // Renaming it renames it for every Ending that shares it, and the id it is
  // filed under never moves.
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const labelField = page.getByLabel("Outcome label", { exact: true });
  await expect(labelField).toBeFocused();
  await labelField.fill("Reached the clinic");
  await labelField.press("Enter");
  await expect(outcomeField(page)).toHaveText("Reached the clinic");
  await chooseStep(page, "Waved through");
  await expect(outcomeField(page)).toHaveText("Reached the clinic");
  await expectSaved(page);

  const renamed = await readDraft(journeyId);
  expect(Object.keys(renamed.outcomes)).toEqual([outcomeId]);
  expect(renamed.outcomes[outcomeId].label).toBe("Reached the clinic");
  expect(renamed.steps[stepIdByTitle(renamed, "Waved through")].outcomeId).toBe(
    outcomeId,
  );
  expect(renamed.steps[stepIdByTitle(renamed, "Turned back")].outcomeId).toBe(
    outcomeId,
  );

  // A rename committed on an emptied field is a rename let go of: an Outcome
  // is never left with nothing for a label.
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const emptied = page.getByLabel("Outcome label", { exact: true });
  await emptied.fill("");
  await emptied.press("Enter");
  await expect(outcomeField(page)).toHaveText("Reached the clinic");

  // And the same label in another case is the same label: the field offers
  // the Outcome the Journey has rather than a second one to create.
  await outcomeField(page).click();
  await outcomeFilter(page).fill("reached the clinic");
  const offered = page.getByRole("listbox", { name: "Outcomes" });
  await expect(
    offered.getByRole("option", { name: "Reached the clinic", exact: true }),
  ).toHaveCount(1);
  await expect(offered.getByRole("option")).toHaveCount(1);

  // The list put away, leaving the Ending as it was.
  await page.keyboard.press("Escape");
  await expect(offered).toHaveCount(0);
  await expect(outcomeField(page)).toHaveText("Reached the clinic");

  // An Outcome the last Ending drops goes with it: there is nothing to
  // remove by hand. The first Ending lets go of it from the keyboard alone:
  // the arrow opens the list with its first option in hand, the next arrow
  // moves to "No outcome", and Enter takes it.
  await outcomeField(page).press("ArrowDown");
  await expect(outcomeFilter(page)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    offered.getByRole("option", { name: "No outcome", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(offered).toHaveCount(0);
  await expect(outcomeField(page)).toHaveText("No outcome");
  await expect(outcomeField(page)).toBeFocused();
  await chooseStep(page, "Turned back");
  await chooseOutcome(page, "No outcome");
  await expect(page.getByText("3 steps · 0 outcomes")).toBeVisible();
  await expectSaved(page);

  const cleared = await readDraft(journeyId);
  expect(cleared.outcomes).toEqual({});

  await page.screenshot({
    path: evidencePath(
      "panel-outcomes-from-the-ending",
      "panel-outcomes-from-the-ending.png",
    ),
    fullPage: true,
  });
});
