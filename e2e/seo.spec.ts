import { expect, test } from "@playwright/test";

import {
  createJourney,
  createProject,
  publishOne,
  uniqueSuffix,
} from "./setup/authoring";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { readPng } from "./setup/link-preview";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Ticket 42: `robots.txt`, `sitemap.xml`, and the 404s the 2026-09-26 scope
 * change widened this ticket to cover — an unknown Journey, a Journey that
 * was never published, and a Project with no live Journey all answer the
 * same way an unknown id does, and an Author's own `/projects` pages stay
 * out of a search index even while signed in.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** A well-formed id no row ever carries. */
const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000fe";

test("seo-robots-and-sitemap", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Allow: /");
  expect(robotsBody).toContain("Disallow: /sign-in");
  expect(robotsBody).toContain("Disallow: /projects");
  expect(robotsBody).toContain("Disallow: /api");
  expect(robotsBody).toContain(`Sitemap: ${E2E_BASE_URL}/sitemap.xml`);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapBody = await sitemap.text();
  for (const path of ["/", "/about", "/guide", "/privacy", "/terms"]) {
    expect(sitemapBody).toContain(`<loc>${E2E_BASE_URL}${path}</loc>`);
  }
  // Exactly the five static pages: nothing under /j, /p, /projects, or
  // /authors is ever in the sitemap — discovery there is link-only.
  expect(sitemapBody.match(/<url>/g)).toHaveLength(5);

  await page.goto("/robots.txt");
  await page.screenshot({
    path: evidencePath("seo-robots-and-sitemap", "robots-txt.png"),
    fullPage: true,
  });
});

test("seo-public-404s", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  // A Project with a live Journey — the one the `/projects/<id>` `noindex`
  // assertion at the bottom of this test reads — and a second Project
  // whose one Journey was created but never published, which is what a
  // Project with no live Journey at all looks like from the outside.
  const { projectId } = await publishOne(
    page,
    "Seo",
    "A short walk for the sitemap spec.",
  );

  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const barrenProjectId = await createProject(page, `Seo barren ${suffix}`);
  await page.goto(`/projects/${barrenProjectId}`);
  const draftOnlyJourneyId = await createJourney(
    page,
    barrenProjectId,
    `Seo draft only ${suffix}`,
  );

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    // An unknown Journey.
    const unknownJourney = await participant.goto(`/j/${UNKNOWN_ID}`);
    expect(unknownJourney?.status()).toBe(404);
    await expect(
      participant.getByRole("heading", {
        name: "This journey isn't available",
      }),
    ).toBeVisible();

    // A Journey created but never published — the same 404.
    const draftOnlyJourney = await participant.goto(`/j/${draftOnlyJourneyId}`);
    expect(draftOnlyJourney?.status()).toBe(404);
    await expect(
      participant.getByRole("heading", {
        name: "This journey isn't available",
      }),
    ).toBeVisible();

    // A Project with no live Journey.
    const barrenProject = await participant.goto(`/p/${barrenProjectId}`);
    expect(barrenProject?.status()).toBe(404);
    await expect(
      participant.getByRole("heading", {
        name: "This project isn't available",
      }),
    ).toBeVisible();
    await participant.screenshot({
      path: evidencePath("seo-public-404s", "project-no-live-journey.png"),
      fullPage: true,
    });

    // An unknown Project reads the same way.
    const unknownProject = await participant.goto(`/p/${UNKNOWN_ID}`);
    expect(unknownProject?.status()).toBe(404);

    // The card at that Project's own address is the site's own, exactly
    // the card an unknown id gets — both a `BrandCard`, never a
    // `LinkPreviewCard` for a Project with nothing live to preview.
    const barrenCard = await readPng(
      await participant.request.get(`/p/${barrenProjectId}/opengraph-image`),
    );
    const unknownCard = await readPng(
      await participant.request.get(`/p/${UNKNOWN_ID}/opengraph-image`),
    );
    expect(barrenCard.status).toBe(200);
    expect(barrenCard.bytes.equals(unknownCard.bytes)).toBe(true);
  } finally {
    await participantContext.close();
  }

  // The signed-in Author's own Project page still carries `noindex`, even
  // though the Project itself has a live Journey.
  await page.goto(`/projects/${projectId}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  // Preview still works for the Draft-only Journey (ticket 42's scope
  // change did not touch it): the Author, signed in, reaches it and sees
  // the Start Step, even though the same Journey 404s to a Participant.
  const previewResponse = await page.goto(
    `/projects/${barrenProjectId}/journeys/${draftOnlyJourneyId}/preview`,
  );
  expect(previewResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
