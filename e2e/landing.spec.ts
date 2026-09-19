import { expect, test } from "@playwright/test";

test("landing page shows the product and sign-in, with no projects link while signed out", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Journeys", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Discord" }),
  ).toBeVisible();

  // Signed out: the page never links to /projects.
  await expect(page.locator('a[href="/projects"]')).toHaveCount(0);

  await page.screenshot({
    path: "test-results/landing/landing.png",
    fullPage: true,
  });
});
