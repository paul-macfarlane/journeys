import { expect, type Page } from "@playwright/test";

import type { GraphDocument } from "@/lib/graph/document";

import { createJourney, createProject, uniqueSuffix } from "./authoring";
import { canvas, canvasNodes } from "./canvas";
import { queryE2eDatabase, signInAs } from "./session";

/**
 * The Journey page's editor, driven the way an Author drives it: a brand-new
 * Journey to edit, the Draft's save line to wait on, and the panel moves the
 * editing specs (`canvas.spec.ts`, `step-editing.spec.ts`, `prompts.spec.ts`,
 * `analytics.spec.ts`) all make. One copy each, so a fix lands once.
 */

/**
 * Autosave is debounced, so "the Draft is stored" is a thing to wait for
 * rather than assume. Every reload, Preview, row read, and Publish in the
 * editing specs goes through here first.
 */
export async function expectSaved(page: Page): Promise<void> {
  // The Draft's line, not the title form's above the tabs (ticket 46).
  await expect(
    page.getByRole("tabpanel", { name: "Editor" }).getByRole("status"),
  ).toHaveText("Saved");
}

/**
 * A Project and a Journey, made through the browser as an Author would, with
 * the page left on the new Journey's page once its editor is showing.
 *
 * `mintedAuthorIds`, when given, signs a new Author in first and records the
 * id for the spec's cleanup; without it the page's context must already hold
 * a session.
 */
export async function startJourney(
  page: Page,
  mintedAuthorIds?: string[],
): Promise<{ projectId: string; journeyId: string }> {
  const context = page.context();
  if (mintedAuthorIds !== undefined) {
    const author = await signInAs(context);
    mintedAuthorIds.push(author.id);
  }

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
  // A new Journey is its Start and nothing else: one box, drawn.
  await expect(canvasNodes(page)).toHaveCount(1);

  return { projectId, journeyId };
}

/**
 * A document put in front of the editor without building it: written into
 * the Draft row and the page reloaded onto it.
 *
 * The write is another writer as far as the editor is concerned, so it moves
 * the Draft's write counter on (ticket 73). A save the page still had in
 * hand — one `expectSaved` could not see, because the status had not left
 * "Saved" yet — is then refused as stale instead of landing over the seeded
 * document, and the reload reads the seeded document either way.
 */
export async function seedDraft(
  page: Page,
  journeyId: string,
  document: GraphDocument,
): Promise<void> {
  await expectSaved(page);
  await queryE2eDatabase(
    'UPDATE "draft" SET document = $1::jsonb, version = version + 1, updated_at = now() WHERE journey_id = $2',
    [JSON.stringify(document), journeyId],
  );
  await page.reload();
}

/** The open Step renamed through the panel's title field. */
export async function renameStep(page: Page, title: string): Promise<void> {
  await page.getByLabel("Step title").fill(title);
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

/** "Add choice" in the panel, pointed at a Step that is already in the Draft. */
export async function addChoiceToStep(
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
