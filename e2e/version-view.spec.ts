import { expect, test, type Page } from "@playwright/test";

import type { GraphDocument } from "@/lib/graph/document";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import { expectNoViolations } from "./setup/axe";
import {
  publishableDocument,
  publishDocument,
  publishRawDocument,
  readDraft,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { evidencePath } from "./setup/evidence";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Ticket 94: an older Published Version, looked at on its own. Its view
 * (`…/versions/<n>`) draws the Version's map read-only — the Analytics
 * map with no numbers on it — and shows the selected Step's content, its
 * Prompt, and its Choices in a panel that edits nothing; the Start is
 * selected until the Member picks another box. Restore works from there,
 * through the same confirmation as the Versions tab. A non-Member gets the
 * Journey page's own 404, and a Version whose row fails the document
 * contract says it cannot be read rather than 500ing.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** Version 1's Start content and the Ending Version 2 renames. */
const V1_START_TEXT = "The queue has not moved in an hour.";
const V1_ENDING_TITLE = "Turned back";
const V2_START_TEXT = "The queue has grown since the rain began.";
const V2_ENDING_TITLE = "Sent home";

/** Version 2: Version 1 with its Start rewritten and an Ending renamed. */
function versionTwoDocument(): GraphDocument {
  const document = publishableDocument();
  document.steps.start.content = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: V2_START_TEXT }] },
    ],
  };
  document.steps["turned-back"].title = V2_ENDING_TITLE;
  return document;
}

/**
 * A Journey published twice, Version 2 live, signed in as its only
 * Member. The Draft holds Version 2's document, so a restore of Version 1
 * is a change a spec can see.
 */
async function journeyWithTwoVersions(
  page: Page,
  context: Parameters<typeof signInAs>[0],
) {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeyId = await createJourney(page, projectId, journeyTitle);

  const versionOneId = await publishDocument(journeyId, publishableDocument());
  await publishDocument(journeyId, versionTwoDocument());
  await writeDraftDocument(journeyId, versionTwoDocument());

  return { projectId, journeyId, journeyTitle, versionOneId };
}

function viewPath(projectId: string, journeyId: string, n: number): string {
  return `/projects/${projectId}/journeys/${journeyId}/versions/${n}`;
}

test("version-view", async ({ page, context }) => {
  const { projectId, journeyId, journeyTitle } = await journeyWithTwoVersions(
    page,
    context,
  );

  // From the Versions tab, Version 1's row: View.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await openTab(page, "Versions");
  const versionOne = page
    .getByRole("list", { name: "Versions" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Version 1", { exact: true }) });
  await versionOne.getByRole("link", { name: "View" }).click();
  await expect(page).toHaveURL(viewPath(projectId, journeyId, 1));

  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", {
      level: 1,
      name: `Version 1: ${journeyTitle}`,
    }),
  ).toBeVisible();

  // Version 1's Steps on its map.
  const map = main.getByRole("region", { name: "Version map" });
  for (const title of [START_STEP_TITLE, "Waved through", V1_ENDING_TITLE]) {
    await expect(
      map.getByRole("button", { name: title, exact: true }),
    ).toBeVisible();
  }
  // No numbers: the view is not the Analytics tab.
  await expect(map.locator("[data-step-figure]")).toHaveCount(0);
  await expect(map.locator("[data-edge-figure]")).toHaveCount(0);

  // The Start is selected until another box is, and its content shows.
  const panel = main.getByRole("region", { name: "Selected step" });
  await expect(
    map.getByRole("button", { name: START_STEP_TITLE, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    panel.getByRole("heading", { name: START_STEP_TITLE }),
  ).toBeVisible();
  await expect(panel).toContainText(V1_START_TEXT);
  const choices = panel.getByRole("list", { name: "Choices" });
  await expect(choices.getByRole("listitem")).toHaveText([
    "Wait your turn → Waved through",
    `Walk away → ${V1_ENDING_TITLE}`,
  ]);

  // Another box, selected by click: its content, and its Outcome.
  await map.getByRole("button", { name: V1_ENDING_TITLE, exact: true }).click();
  await expect(
    map.getByRole("button", { name: V1_ENDING_TITLE, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    panel.getByRole("heading", { name: V1_ENDING_TITLE }),
  ).toBeVisible();
  await expect(panel).toContainText(
    "You lose your place, and the post closes behind you.",
  );
  await expect(panel).toContainText("Turned away");

  // And from the keyboard: a box is a tab stop, and Enter selects it.
  const wavedThrough = map.getByRole("button", {
    name: "Waved through",
    exact: true,
  });
  await wavedThrough.focus();
  await page.keyboard.press("Enter");
  await expect(wavedThrough).toHaveAttribute("aria-pressed", "true");
  await expect(
    panel.getByRole("heading", { name: "Waved through" }),
  ).toBeVisible();
  await expect(panel).toContainText("Reached care");
  await map.getByRole("button", { name: V1_ENDING_TITLE, exact: true }).click();

  // Nothing of Version 2.
  await expect(main.getByText(V2_ENDING_TITLE)).toHaveCount(0);
  await expect(main.getByText(V2_START_TEXT)).toHaveCount(0);

  // Nothing here edits.
  await expect(main.getByRole("textbox")).toHaveCount(0);
  await expect(main.locator("[contenteditable]")).toHaveCount(0);
  await expect(
    main.getByRole("button", { name: /delete|publish/i }),
  ).toHaveCount(0);

  await expectNoViolations(page, "version view");

  await page.screenshot({
    path: evidencePath("version-view", "version-view.png"),
    fullPage: true,
  });

  // A phone: the panel stacks under the map, and nothing scrolls sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("version-view-restore", async ({ page, context }) => {
  const { projectId, journeyId, versionOneId } = await journeyWithTwoVersions(
    page,
    context,
  );

  await page.goto(viewPath(projectId, journeyId, 1));
  await page.getByRole("button", { name: "Restore" }).click();
  await page.getByRole("button", { name: "Restore version" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Restored Version 1 into the Draft.",
  );
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // The Draft now holds Version 1 exactly as it was stored.
  const [stored] = await queryE2eDatabase<{ document: unknown }>(
    'SELECT document FROM "published_version" WHERE id = $1',
    [versionOneId],
  );
  expect(await readDraft(journeyId)).toEqual(stored.document);

  await page.screenshot({
    path: evidencePath("version-view-restore", "version-view-restore.png"),
    fullPage: true,
  });
});

test("version-view-not-member", async ({ page, context, browser }) => {
  const { projectId, journeyId } = await journeyWithTwoVersions(page, context);

  const outsiderContext = await browser.newContext();
  try {
    const outsider = await signInAs(outsiderContext);
    mintedAuthorIds.push(outsider.id);
    const outsiderPage = await outsiderContext.newPage();

    const response = await outsiderPage.goto(viewPath(projectId, journeyId, 1));
    expect(response?.status()).toBe(404);
    await expect(outsiderPage).toHaveTitle("Page not found · Journeys");
    await expect(
      outsiderPage
        .getByRole("main")
        .getByRole("heading", { name: "Page not found", level: 1 }),
    ).toBeVisible();

    await outsiderPage.screenshot({
      path: evidencePath(
        "version-view-not-member",
        "version-view-not-member.png",
      ),
      fullPage: true,
    });
  } finally {
    await outsiderContext.close();
  }

  // The Member, meanwhile: a Version this Journey does not have, and an
  // address that is no Version number at all, are the same 404.
  for (const segment of ["3", "0", "one", "1.5"]) {
    const response = await page.goto(
      `/projects/${projectId}/journeys/${journeyId}/versions/${segment}`,
    );
    expect(response?.status(), `versions/${segment}`).toBe(404);
  }
});

test("version-view-unreadable", async ({ page, context }) => {
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

  await publishDocument(journeyId, publishableDocument());
  await publishRawDocument(journeyId, { schemaVersion: 1, steps: "broken" });

  const response = await page.goto(viewPath(projectId, journeyId, 2));
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("region", { name: "Version 2 can't be read" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Version map" })).toHaveCount(
    0,
  );

  await page.screenshot({
    path: evidencePath(
      "version-view-unreadable",
      "version-view-unreadable.png",
    ),
    fullPage: true,
  });
});
