import { expect, test } from "@playwright/test";

import { evidencePath } from "./setup/evidence";
import { expectFooterOnOneRow } from "./setup/footer";
import { purpleShare } from "./setup/hue-probe";
import { cleanup, closePools, signInAs } from "./setup/session";

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/**
 * Ticket 55: the user guide at /guide. Public and static: the heading, the
 * table of contents whose links resolve to the three sections, one of the
 * ticket 38 stills rendered in the page's theme, in both themes and at
 * phone width (one screenshot, light). Ticket 93: "For Authors" in the
 * order an Author meets it. Then the Projects page header links to it.
 */
test("guide", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/guide");

  await expect(
    page.getByRole("heading", { name: "Guide", level: 1 }),
  ).toBeVisible();

  // The table of contents: every link resolves to a section carrying that
  // heading, and following one lands on it.
  const contents = page.getByRole("navigation", { name: "On this page" });
  for (const [title, id] of [
    ["For Authors", "for-authors"],
    ["For Participants", "for-participants"],
    ["Good to know", "good-to-know"],
  ] as const) {
    await expect(contents.getByRole("link", { name: title })).toHaveAttribute(
      "href",
      `#${id}`,
    );
    const section = page.locator(`section#${id}`);
    await expect(
      section.getByRole("heading", { name: title, level: 2 }),
    ).toBeVisible();
  }

  // Ticket 93 item 4: "For Authors" follows an Author's lifecycle, each
  // stage an h3 the contents list links to beneath "For Authors".
  const stages = [
    ["Sign in", "sign-in"],
    ["Create a Project", "create-a-project"],
    ["Add Members", "add-members"],
    ["Create a Journey", "create-a-journey"],
    ["Build it", "build-it"],
    ["Customise it", "customise-it"],
    ["Preview", "preview"],
    ["Publish", "publish"],
    ["Share the link", "share-the-link"],
    ["Edit after publishing", "edit-after-publishing"],
    ["Read Analytics and Responses", "analytics-and-responses"],
    ["Your Author page", "your-author-page"],
  ] as const;
  await expect(page.locator("section#for-authors h3")).toHaveText(
    stages.map(([title]) => title),
  );
  expect(
    await page
      .locator("section#for-authors h3")
      .evaluateAll((headings) => headings.map((h) => h.id)),
  ).toEqual(stages.map(([, id]) => id));
  const stageLinks = contents.getByRole("list", {
    name: "Stages for Authors",
  });
  await expect(stageLinks.getByRole("link")).toHaveText(
    stages.map(([title]) => title),
  );
  for (const [title, id] of stages) {
    await expect(
      stageLinks.getByRole("link", { name: title, exact: true }),
    ).toHaveAttribute("href", `#${id}`);
    await expect(page.locator(`section#for-authors h3#${id}`)).toHaveText(
      title,
    );
  }
  // "For Participants" and "Good to know" still follow it.
  const sectionOrder = await page
    .locator("main section[id]")
    .evaluateAll((sections) => sections.map((s) => s.id));
  expect(sectionOrder).toEqual([
    "for-authors",
    "for-participants",
    "good-to-know",
  ]);

  // Ticket 93 items 3 and 5: "choice" only ever means a Choice, and an
  // Author is a user, not a person.
  const authors = page.locator("section#for-authors");
  await expect(authors).not.toContainText("The choice is remembered");
  await expect(authors).toContainText(
    "Your browser remembers whether the panel is hidden; it isn’t saved on the Journey.",
  );
  await expect(authors).toContainText("An Author is a signed-in user");
  await expect(authors).toContainText(
    "Members are the Authors you share a Project with",
  );

  await contents.getByRole("link", { name: "For Participants" }).click();
  await expect(page).toHaveURL(/#for-participants$/);

  // The stills: the light one shown, the dark one there but hidden, and
  // the file itself served as a PNG from the app's own origin.
  const still = (scheme: "light" | "dark") =>
    page.locator(`img[data-still="canvas"][data-scheme="${scheme}"]`);
  await expect(still("light")).toBeVisible();
  await expect(still("light")).toHaveAttribute("src", "/demo/canvas-light.png");
  await expect(still("dark")).toBeHidden();
  const png = await page.request.get("/demo/canvas-light.png");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");

  // The themes still (ticket 93 item 1): the one still that shows a Theme
  // other than the Project's own, Trail — the runner wearing Dusk.
  const themesStill = page.locator(
    'img[data-still="themes"][data-scheme="light"]',
  );
  await expect(themesStill).toBeVisible();
  await expect(themesStill).toHaveAttribute("src", "/demo/themes-light.png");
  const themesPng = await page.request.get("/demo/themes-light.png");
  expect(themesPng.status()).toBe(200);
  expect(themesPng.headers()["content-type"]).toBe("image/png");

  // A hue probe on the committed stills themselves: the prompt still (the
  // runner in the Project's own Theme, the green Trail) reads as almost no
  // purple, and the themes still (the runner in Dusk, a plum) reads as
  // mostly purple. Measured on the files committed with this ticket: prompt
  // ~0%, themes ~55–65% (Dusk's paper, stripe, and Choice borders are
  // purple; the Step's body text and background are not) — the thresholds
  // below sit with a wide margin either side of those. A page of its own,
  // so navigating to the PNGs never carries the guide page away.
  const probe = await page.context().newPage();
  const promptShare = await purpleShare(probe, "/demo/prompt-light.png");
  const themesShare = await purpleShare(probe, "/demo/themes-light.png");
  await probe.close();
  expect(promptShare).toBeLessThan(0.05);
  expect(themesShare).toBeGreaterThan(0.3);

  // The footer is the site's own.
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Journeys" }),
  ).toHaveAttribute("href", "/");
  // Ticket 62: on one row across the page, as on the landing page.
  await expectFooterOnOneRow(page);

  await page.screenshot({
    path: evidencePath("guide", "guide.png"),
    fullPage: true,
  });

  // Dark: the dark still and nothing else.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(still("dark")).toBeVisible();
  await expect(still("light")).toBeHidden();

  // Phone width: no horizontal overflow, the contents and a still in view.
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "Guide", level: 1 }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("guide-link-from-projects", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  await page.goto("/projects");

  // The link sits in the page header beside New project; the footer's
  // Guide link (ticket 54) is outside `main`.
  const link = page.getByRole("main").getByRole("link", { name: "Guide" });
  await expect(link).toHaveAttribute("href", "/guide");
  await page.screenshot({
    path: evidencePath("guide-link-from-projects", "projects-header.png"),
    fullPage: true,
  });

  await link.click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(
    page.getByRole("heading", { name: "Guide", level: 1 }),
  ).toBeVisible();
});
