import { expect, test } from "@playwright/test";

import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("sign-in page offers Google and Discord with their logos", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/sign-in`);
  await expect(
    page.getByRole("heading", { name: "Sign in", level: 1 }),
  ).toBeVisible();

  const google = page.getByRole("button", { name: "Sign in with Google" });
  const discord = page.getByRole("button", { name: "Sign in with Discord" });
  await expect(google).toBeVisible();
  await expect(discord).toBeVisible();
  await expect(google.getByRole("img", { name: "Google" })).toBeVisible();
  await expect(discord.getByRole("img", { name: "Discord" })).toBeVisible();

  await page.screenshot({
    path: evidencePath("sign-in", "sign-in.png"),
    fullPage: true,
  });
});

test("a signed-in Author visiting /sign-in is sent to their projects", async ({
  page,
  context,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  await page.goto("/sign-in");

  await expect(page).toHaveURL(`${E2E_BASE_URL}/projects`);
});

/**
 * Ticket 42: `/sign-in` carries `noindex` (nobody should land on it from a
 * search result), and the paragraph under the buttons links both legal
 * pages rather than naming one only "below" — a phrase that means nothing
 * once a reader has scrolled.
 */
test("sign-in-links", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  const legal = page.getByText(/By signing in you agree/);
  await expect(
    legal.getByRole("link", { name: "terms of service" }),
  ).toHaveAttribute("href", "/terms");
  await expect(
    legal.getByRole("link", { name: "privacy policy" }),
  ).toHaveAttribute("href", "/privacy");
  await expect(page.getByText("below")).toHaveCount(0);

  await page.screenshot({
    path: evidencePath("sign-in-links", "sign-in-links.png"),
    fullPage: true,
  });
});
