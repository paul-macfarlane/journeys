import { expect, test } from "@playwright/test";

import { E2E_BASE_URL } from "./setup/e2e-env";
import { cleanup, closePools, signInAs } from "./setup/session";

const mintedUserIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedUserIds);
  await closePools();
});

test("signed-out visit to /projects redirects to the landing page", async ({
  page,
}) => {
  await page.goto("/projects");

  await expect(page).toHaveURL(`${E2E_BASE_URL}/`);

  await page.screenshot({
    path: "test-results/projects-signed-out-redirect/projects-signed-out-redirect.png",
    fullPage: true,
  });
});

test("signed-in visit to /projects shows the empty projects state", async ({
  page,
  context,
}) => {
  const author = await signInAs(context);
  mintedUserIds.push(author.id);

  await page.goto("/projects");

  await expect(
    page.getByRole("heading", { name: "Your projects" }),
  ).toBeVisible();
  await expect(page.getByText("Signed in as Test Author")).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();
  // No project or journey items are listed — the empty state's card body
  // renders nothing.
  await expect(page.getByRole("listitem")).toHaveCount(0);

  await page.screenshot({
    path: "test-results/projects-empty/projects-empty.png",
    fullPage: true,
  });
});

test("signing out returns to the landing page, and /projects redirects again", async ({
  page,
  context,
}) => {
  const author = await signInAs(context);
  mintedUserIds.push(author.id);

  await page.goto("/projects");
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/`);

  await page.goto("/projects");
  await expect(page).toHaveURL(`${E2E_BASE_URL}/`);

  await page.screenshot({
    path: "test-results/sign-out/sign-out.png",
    fullPage: true,
  });
});
