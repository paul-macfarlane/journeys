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
