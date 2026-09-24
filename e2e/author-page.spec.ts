import { expect, test } from "@playwright/test";

import { APP_NAME } from "@/lib/brand";
import type { Content } from "@/lib/graph/content";
import { linkPreviewPalette } from "@/lib/link-preview";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import { publishableDocument, publishDocument } from "./setup/documents";
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
 * Ticket 52's public Author page and the "By …" line. An Author's row is
 * set directly — bio, links, picture, and the public switch; the Settings
 * page that writes them is proved in `author-settings.spec.ts` — and a
 * Participant, a phone-sized context with no session, reads:
 *
 * - off: `/authors/<id>` is the same 404 an unknown id gets, the card is the
 *   site's own, and the Project page names no one;
 * - on: the avatar, name, bio (line breaks kept), and links; the Projects
 *   list holds only a Project with a live Journey, appearing once one is
 *   published; the link preview names the Author in the app's own Theme;
 * - the Project pages of every Project the Author is a Member of carry a
 *   "By …" link to the page, and the runner does not;
 * - off again: the page, the card, and the line all go at once.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** An id no account has; account ids are 32-character strings, not UUIDs. */
const UNKNOWN_AUTHOR_ID = "unknown-author-id-00000000000000";

/** A 64×64 filled circle, so the avatar's `<img>` actually loads. */
const AVATAR_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#2f6f5e"/></svg>',
)}`;

const BIO = "I write branching journeys about care.\nSecond line.";

test("author-page", async ({ page, context, browser }) => {
  const suffix = uniqueSuffix();
  const name = `Ada Lovelace ${suffix}`;
  const author = await signInAs(context, { name });
  mintedAuthorIds.push(author.id);

  const titleA = `Refugee Health ${suffix}`;
  const titleB = `Empty Project ${suffix}`;

  await page.goto("/projects");
  const projectA = await createProject(page, titleA);
  const projectB = await createProject(page, titleB);
  await page.goto(`/projects/${projectA}`);
  // Created, not yet published: the Author page starts with no Projects.
  const journeyId = await createJourney(page, projectA, `Border ${suffix}`);

  const description: Content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Three cases from the northern route." },
        ],
      },
    ],
  };
  await queryE2eDatabase(
    'UPDATE "project" SET description_content = $1::jsonb WHERE id = $2',
    [JSON.stringify(description), projectA],
  );
  await queryE2eDatabase(
    'UPDATE "user" SET bio = $1, links = $2::jsonb, image = $3 WHERE id = $4',
    [
      BIO,
      JSON.stringify([
        { kind: "linkedin", url: "https://www.linkedin.com/in/ada" },
        { kind: "website", url: "https://example.com/ada" },
      ]),
      AVATAR_URL,
      author.id,
    ],
  );

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
  });
  try {
    const participant = await participantContext.newPage();
    const byLine = participant.getByText(/^By /);

    // Off: a 404 exactly as an unknown id gets, and the site's own card.
    const offPage = await participant.goto(`/authors/${author.id}`);
    expect(offPage?.status()).toBe(404);
    const unknownPage = await participant.goto(`/authors/${UNKNOWN_AUTHOR_ID}`);
    expect(unknownPage?.status()).toBe(404);
    const offCard = await readPng(
      await participant.request.get(`/authors/${author.id}/opengraph-image`),
    );
    expect(offCard.status).toBe(200);
    expect(offCard.contentType).toContain("image/png");

    await participant.goto(`/p/${projectA}`);
    await expect(
      participant.getByRole("heading", { name: titleA, level: 1 }),
    ).toBeVisible();
    await expect(byLine).toHaveCount(0);
    await expect(participant.locator('a[href*="/authors/"]')).toHaveCount(0);

    // On, with no live Journey yet.
    await queryE2eDatabase('UPDATE "user" SET "public" = true WHERE id = $1', [
      author.id,
    ]);
    const onPage = await participant.goto(`/authors/${author.id}`);
    expect(onPage?.status()).toBe(200);

    await expect(
      participant.getByRole("heading", { name, level: 1 }),
    ).toBeVisible();
    await expect(participant.locator("main img")).toBeVisible();
    await expect(
      participant.getByText("I write branching journeys about care."),
    ).toBeVisible();
    await expect(participant.getByText("Second line.")).toBeVisible();
    // Both lines sit in one paragraph, and the break between them is kept.
    const bio = participant.getByText(/I write branching journeys about care/);
    expect(await bio.innerText()).toContain("\n");

    const links = participant.getByRole("navigation", { name: "Links" });
    await expect(links.getByRole("link")).toHaveCount(2);
    await expect(links.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/ada",
    );
    await expect(links.getByRole("link", { name: "Website" })).toHaveAttribute(
      "href",
      "https://example.com/ada",
    );

    await expect(
      participant.getByText("No published journeys yet."),
    ).toBeVisible();
    await expect(
      participant.getByRole("list", { name: "Projects" }),
    ).toHaveCount(0);

    // Publishing a Journey in A lists A — and only A.
    await publishDocument(journeyId, publishableDocument());
    await participant.reload();

    const projects = participant.getByRole("list", { name: "Projects" });
    await expect(projects.getByRole("link")).toHaveCount(1);
    const projectLink = projects.getByRole("link", {
      name: new RegExp(titleA),
    });
    await expect(projectLink).toHaveAttribute("href", `/p/${projectA}`);
    await expect(projectLink).toContainText(
      "Three cases from the northern route.",
    );
    await expect(participant.getByText(titleB)).toHaveCount(0);

    // The link preview: the name, the bio with its line break collapsed.
    await expect(participant).toHaveTitle(`${name} · ${APP_NAME}`);
    expect(await metaContent(participant, "og:title")).toBe(name);
    expect(await metaContent(participant, "og:description")).toBe(
      "I write branching journeys about care. Second line.",
    );
    expect(await metaContent(participant, "og:url")).toBe(
      `${E2E_BASE_URL}/authors/${author.id}`,
    );
    expect(await metaContent(participant, "og:site_name")).toBe(APP_NAME);
    expect(await metaContent(participant, "twitter:card")).toBe(
      "summary_large_image",
    );
    const imageUrl = await metaContent(participant, "og:image");
    expect(imageUrl).toMatch(
      new RegExp(`^${E2E_BASE_URL}/authors/${author.id}/opengraph-image`),
    );

    const card = await readPng(await participant.request.get(imageUrl!));
    expect(card.status).toBe(200);
    expect(card.contentType).toContain("image/png");
    expect(card.cacheControl).toContain("max-age=300");
    expect([card.width, card.height]).toEqual([1200, 630]);
    saveBytes(evidencePath("author-page", "author-card.png"), card.bytes);
    expect(card.bytes.equals(offCard.bytes)).toBe(false);
    const palette = linkPreviewPalette({ preset: "trail", accent: null });
    expect(
      await pixelsAt(participant, imageUrl!, [
        { x: 40, y: 600 },
        { x: 600, y: 8 },
      ]),
    ).toEqual([palette.background, palette.primary]);

    await participant.goto(`/authors/${author.id}`);
    await expect(participant.locator("main img")).toBeVisible();
    await participant.screenshot({
      path: evidencePath("author-page", "author-page.png"),
      fullPage: true,
    });

    // The Project page names the Author and links to the page.
    await participant.goto(`/p/${projectA}`);
    await expect(byLine).toBeVisible();
    await expect(byLine).toContainText(name);
    await expect(participant.getByRole("link", { name })).toHaveAttribute(
      "href",
      `/authors/${author.id}`,
    );
    await participant.screenshot({
      path: evidencePath("author-page", "project-by-line.png"),
      fullPage: true,
    });

    // The line is about Members, not Journeys: B has none live and still
    // names its public Authors.
    await participant.goto(`/p/${projectB}`);
    await expect(
      participant.getByRole("heading", { name: titleB, level: 1 }),
    ).toBeVisible();
    await expect(byLine).toContainText(name);

    // Not on the runner.
    await participant.goto(`/j/${journeyId}`);
    await expect(participant.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(byLine).toHaveCount(0);

    // Off again: the page, the card, and the line all go at once.
    await queryE2eDatabase('UPDATE "user" SET "public" = false WHERE id = $1', [
      author.id,
    ]);
    const offAgain = await participant.goto(`/authors/${author.id}`);
    expect(offAgain?.status()).toBe(404);
    const offAgainCard = await readPng(
      await participant.request.get(`/authors/${author.id}/opengraph-image`),
    );
    expect(offAgainCard.bytes.equals(offCard.bytes)).toBe(true);
    await participant.goto(`/p/${projectA}`);
    await expect(
      participant.getByRole("heading", { name: titleA, level: 1 }),
    ).toBeVisible();
    await expect(byLine).toHaveCount(0);
  } finally {
    await participantContext.close();
  }
});
