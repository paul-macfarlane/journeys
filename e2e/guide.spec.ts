import { expect, test } from "@playwright/test";

import { evidencePath } from "./setup/evidence";
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
 * phone width. Then the Projects page header links to it.
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

  // The footer is the site's own.
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Journeys" }),
  ).toHaveAttribute("href", "/");

  await page.screenshot({
    path: evidencePath("guide", "guide-light.png"),
    fullPage: true,
  });

  // Dark: the dark still and nothing else.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(still("dark")).toBeVisible();
  await expect(still("light")).toBeHidden();
  await page.screenshot({
    path: evidencePath("guide", "guide-dark.png"),
    fullPage: true,
  });

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
  await page.screenshot({
    path: evidencePath("guide", "guide-375.png"),
    fullPage: true,
  });
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
