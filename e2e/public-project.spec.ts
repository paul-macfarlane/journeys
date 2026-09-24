import { expect, test } from "@playwright/test";

import { APP_NAME } from "@/lib/brand";
import type { Content } from "@/lib/graph/content";
import { linkPreviewPalette } from "@/lib/link-preview";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  publishableDocument,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import {
  metaContent,
  pixelsAt,
  readPng,
  saveBytes,
} from "./setup/link-preview";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 07: the public Project page. An Author writes the
 * Project's description in the rich-text editor on the Settings tab and
 * publishes one of two Journeys; a Participant — a second browser context
 * with no session, on a phone-sized viewport — opens `/p/<id>` and sees the
 * title, the description as rich text, and only the published Journey;
 * the Author unpublishes it and the Participant's next load no longer lists
 * it. An unknown id is a 404, and the site root names no Project.
 *
 * The description is proved against the row as well as the screen: what
 * the editor stored is the closed content shape, not markup.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** An id no Project has: every real one is a `crypto.randomUUID()`. */
const UNKNOWN_PROJECT_ID = "00000000-0000-4000-8000-000000000000";

async function readDescription(projectId: string): Promise<Content> {
  const [row] = await queryE2eDatabase<{ description_content: Content }>(
    'SELECT description_content FROM "project" WHERE id = $1',
    [projectId],
  );
  return row.description_content;
}

test("public-project-page", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const publishedTitle = `Border Crossing ${suffix}`;
  const publishedDescription = "Goal: cross the border.";
  const draftOnlyTitle = `Clinic Visit ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);

  // The description, written the way an Author writes a Step: a heading,
  // a bold run, and a list — the shared allowed set — and saved when the
  // editor is left.
  await openTab(page, "Settings");
  const editor = page.getByLabel("Description", { exact: true });
  await editor.click();
  await page.getByRole("button", { name: "Heading 2", exact: true }).click();
  await page.keyboard.type("About these journeys");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.keyboard.type("Three");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.keyboard.type(" cases from the northern route.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await page.keyboard.type("Water");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Shade");
  await editor.blur();

  // Stored as content, not markup, exactly as the editor cleaned it.
  await expect
    .poll(() => readDescription(projectId))
    .toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "About these journeys" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Three", marks: [{ type: "bold" }] },
            { type: "text", text: " cases from the northern route." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Water" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Shade" }],
                },
              ],
            },
          ],
        },
      ],
    });

  // The Author's own page shows the description's opening as plain text
  // under the title, and the editor reads the rich text back after a
  // reload.
  await expect(
    page.getByText(
      "About these journeys Three cases from the northern route. Water Shade",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByLabel("Description", { exact: true })
      .getByRole("heading", { name: "About these journeys", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Description", { exact: true }).getByRole("listitem"),
  ).toHaveText(["Water", "Shade"]);

  await page.screenshot({
    path: evidencePath("public-project-page", "settings-description.png"),
    fullPage: true,
  });

  // Two Journeys: one published through the Publish button, one left as a
  // Draft that was never published.
  await openTab(page, "Journeys");
  const publishedId = await createJourney(
    page,
    projectId,
    publishedTitle,
    publishedDescription,
  );
  await page.goto(`/projects/${projectId}`);
  const draftOnlyId = await createJourney(page, projectId, draftOnlyTitle);
  await writeDraftDocument(publishedId, publishableDocument());

  await page.goto(`/projects/${projectId}/journeys/${publishedId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  // A Participant: no session, on a phone, holding only the link.
  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
  });
  try {
    const participant = await participantContext.newPage();
    await participant.goto(`/p/${projectId}`);

    await expect(
      participant.getByRole("heading", { name: projectTitle, level: 1 }),
    ).toBeVisible();
    await expect(
      participant.getByRole("heading", {
        name: "About these journeys",
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      participant.locator("strong", { hasText: "Three" }),
    ).toBeVisible();
    await expect(
      participant.getByRole("listitem").filter({ hasText: /^(Water|Shade)$/ }),
    ).toHaveCount(2);

    // Only the published Journey is listed, titled and described as its
    // live version is, and linked into the runner.
    const journeys = participant.getByRole("list", { name: "Journeys" });
    const link = journeys.getByRole("link", {
      name: new RegExp(publishedTitle),
    });
    await expect(link).toHaveAttribute("href", `/j/${publishedId}`);
    await expect(link).toContainText(publishedDescription);
    await expect(journeys.getByRole("link")).toHaveCount(1);
    await expect(participant.getByText(draftOnlyTitle)).toHaveCount(0);

    await participant.screenshot({
      path: evidencePath("public-project-page", "public-project-page.png"),
      fullPage: true,
    });

    // The link leads into the runner, on the Start Step.
    await link.click();
    await expect(participant).toHaveURL(new RegExp(`/j/${publishedId}$`));
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE, level: 1 }),
    ).toBeVisible();

    // The Author unpublishes it; the Participant's next load no longer
    // lists it — no deploy, no cache in between.
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Unpublish journey" }).click();
    await expect(page.getByText("Unpublished", { exact: true })).toBeVisible();

    await participant.goto(`/p/${projectId}`);
    await expect(
      participant.getByRole("heading", { name: projectTitle, level: 1 }),
    ).toBeVisible();
    await expect(
      participant.getByRole("list", { name: "Journeys" }),
    ).toHaveCount(0);
    await expect(
      participant.getByText("No journeys are available right now."),
    ).toBeVisible();
    await expect(participant.getByText(publishedTitle)).toHaveCount(0);

    await participant.screenshot({
      path: evidencePath("public-project-page", "after-unpublish.png"),
      fullPage: true,
    });

    // An unknown id is a 404, and the root still lists nothing.
    const missing = await participant.goto(`/p/${UNKNOWN_PROJECT_ID}`);
    expect(missing?.status()).toBe(404);

    await participant.goto("/");
    await expect(
      participant.getByRole("heading", { name: "Journeys", level: 1 }),
    ).toBeVisible();
    await expect(participant.getByText(projectTitle)).toHaveCount(0);
    await expect(participant.getByText(publishedTitle)).toHaveCount(0);
    await expect(participant.locator(`a[href*="/p/"]`)).toHaveCount(0);
    await expect(participant.locator(`a[href*="/j/"]`)).toHaveCount(0);
  } finally {
    await participantContext.close();
  }

  // The Draft-only Journey never reached participants either way.
  const [draftRow] = await queryE2eDatabase<{ live_version_id: string | null }>(
    'SELECT live_version_id FROM "journey" WHERE id = $1',
    [draftOnlyId],
  );
  expect(draftRow.live_version_id).toBeNull();
});

test("project-link-preview", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);

  // The description, Theme, and accent as the Settings tab stores them.
  const description: Content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "About these journeys" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Three cases from the northern route." },
        ],
      },
    ],
  };
  const accent = "#ffcc00";
  await queryE2eDatabase(
    'UPDATE "project" SET description_content = $1::jsonb, theme_preset = $2, theme_accent = $3 WHERE id = $4',
    [JSON.stringify(description), "ember", accent, projectId],
  );
  const palette = linkPreviewPalette({ preset: "ember", accent });

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();
    await participant.goto(`/p/${projectId}`);

    await expect(participant).toHaveTitle(`${projectTitle} · ${APP_NAME}`);
    expect(await metaContent(participant, "og:title")).toBe(projectTitle);
    expect(await metaContent(participant, "og:description")).toBe(
      "About these journeys Three cases from the northern route.",
    );
    expect(await metaContent(participant, "og:url")).toBe(
      `${E2E_BASE_URL}/p/${projectId}`,
    );
    expect(await metaContent(participant, "og:site_name")).toBe(APP_NAME);
    expect(await metaContent(participant, "twitter:card")).toBe(
      "summary_large_image",
    );
    const imageUrl = await metaContent(participant, "og:image");
    expect(imageUrl).toMatch(
      new RegExp(`^${E2E_BASE_URL}/p/${projectId}/opengraph-image`),
    );

    // The card: ember paper, and the Author's accent for the stripe.
    const card = await readPng(await participant.request.get(imageUrl!));
    expect(card.status).toBe(200);
    expect(card.contentType).toContain("image/png");
    expect(card.cacheControl).toContain("max-age=300");
    expect([card.width, card.height]).toEqual([1200, 630]);
    saveBytes(
      evidencePath("project-link-preview", "project-card.png"),
      card.bytes,
    );
    expect(
      await pixelsAt(participant, imageUrl!, [
        { x: 40, y: 600 },
        { x: 600, y: 8 },
      ]),
    ).toEqual([palette.background, accent]);
    await participant.screenshot({
      path: evidencePath("project-link-preview", "project-link-preview.png"),
    });

    // An unknown id: a 404 page, and the site's own card.
    const unknownPage = await participant.goto(`/p/${UNKNOWN_PROJECT_ID}`);
    expect(unknownPage?.status()).toBe(404);
    const unknown = await readPng(
      await participant.request.get(`/p/${UNKNOWN_PROJECT_ID}/opengraph-image`),
    );
    expect(unknown.status).toBe(200);
    expect(unknown.contentType).toContain("image/png");
    expect(unknown.bytes.equals(card.bytes)).toBe(false);
  } finally {
    await participantContext.close();
  }
});
