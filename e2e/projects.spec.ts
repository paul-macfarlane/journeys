import { expect, test } from "@playwright/test";

import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("signed-out visit to /projects redirects to the landing page", async ({
  page,
}) => {
  await page.goto("/projects");

  await expect(page).toHaveURL(`${E2E_BASE_URL}/`);

  await page.screenshot({
    path: evidencePath(
      "projects-signed-out-redirect",
      "projects-signed-out-redirect.png",
    ),
    fullPage: true,
  });
});

test("signed-in visit to /projects shows the empty projects state", async ({
  page,
  context,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

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
    path: evidencePath("projects-empty", "projects-empty.png"),
    fullPage: true,
  });
});

test("signing out from the user menu lands on sign-in, and /projects redirects again", async ({
  page,
  context,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  // Sign out lives in the navbar's user menu (ticket 29), not on the page.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Account: Test Author" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/sign-in`);
  await expect(
    page.getByRole("heading", { name: "Sign in", level: 1 }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath("sign-out", "sign-out.png"),
    fullPage: true,
  });

  await page.goto("/projects");
  await expect(page).toHaveURL(`${E2E_BASE_URL}/`);
});
