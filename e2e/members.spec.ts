import { expect, test } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import { E2E_BASE_URL } from "./setup/e2e-env";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 13: Members, driven entirely through the browser by two
 * independently minted Authors.
 *
 * Every test mints its own Author(s), so tests never see each other's
 * Projects, and the e2e database keeps nothing between runs.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

test("members-add-and-edit", async ({ page, context, browser }) => {
  test.setTimeout(90_000);

  // B exists before A adds them: minted first, in a browser context of its
  // own so nothing of A's session leaks across.
  const bContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const authorA = await signInAs(context);
    mintedAuthorIds.push(authorA.id);

    const authorB = await signInAs(bContext);
    mintedAuthorIds.push(authorB.id);

    const suffix = uniqueSuffix();
    const projectTitle = `Refugee Health ${suffix}`;
    const journeyTitle = `Border Crossing ${suffix}`;
    const renamedTitle = `Night Crossing ${suffix}`;

    await page.goto("/projects");
    const projectId = await createProject(page, projectTitle);
    await page.goto(`/projects/${projectId}`);
    const journeyId = await createJourney(page, projectId, journeyTitle);

    // A's page starts with exactly A's own row.
    const membersList = page.getByRole("list", { name: "Members" });
    await expect(membersList.getByRole("listitem")).toHaveCount(1);
    const authorARow = membersList.getByRole("listitem").filter({
      hasText: authorA.email,
    });
    await expect(authorARow).toContainText(authorA.name);
    await expect(authorARow.getByText("You")).toBeVisible();

    // Adding B by email, typed in upper case.
    await page.getByLabel("Email").fill(authorB.email.toUpperCase());
    await page.getByRole("button", { name: "Add member" }).click();

    await expect(membersList.getByRole("listitem")).toHaveCount(2);
    const authorBRow = membersList.getByRole("listitem").filter({
      hasText: authorB.email,
    });
    // Exact, so the lower-cased address is what is shown, not merely a
    // case-insensitive match of what was typed.
    await expect(
      authorBRow.getByText(authorB.email, { exact: true }),
    ).toBeVisible();

    await page.screenshot({
      path: "test-results/members-add-and-edit/members-add-and-edit.png",
      fullPage: true,
    });

    const memberRows = await queryE2eDatabase<{ user_id: string }>(
      'SELECT user_id FROM "member" WHERE project_id = $1',
      [projectId],
    );
    expect(new Set(memberRows.map((row) => row.user_id))).toEqual(
      new Set([authorA.id, authorB.id]),
    );

    // B: the Project is now listed, and opening it shows two Members.
    const bPage = await bContext.newPage();
    await bPage.goto("/projects");
    await expect(
      bPage.getByRole("listitem").filter({ hasText: projectTitle }),
    ).toHaveCount(1);

    await bPage.goto(`/projects/${projectId}`);
    await expect(
      bPage.getByRole("list", { name: "Members" }).getByRole("listitem"),
    ).toHaveCount(2);

    // B renames the Journey.
    const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;
    await bPage.goto(journeyPath);
    await bPage.getByRole("button", { name: "Edit" }).click();
    await bPage.getByLabel("Title", { exact: true }).fill(renamedTitle);
    await bPage.getByRole("button", { name: "Save changes" }).click();
    await expect(
      bPage.getByRole("heading", { name: renamedTitle }),
    ).toBeVisible();

    // A sees the rename.
    await page.goto(`/projects/${projectId}`);
    await expect(
      page.getByRole("listitem").filter({ hasText: renamedTitle }),
    ).toHaveCount(1);

    // B removes themself.
    await bPage.goto(`/projects/${projectId}`);
    const bOwnRow = bPage
      .getByRole("list", { name: "Members" })
      .getByRole("listitem")
      .filter({ hasText: authorB.email });
    await bOwnRow.getByRole("button", { name: "Remove" }).click();
    await bPage.getByRole("button", { name: "Remove member" }).click();

    await expect(bPage).toHaveURL(`${E2E_BASE_URL}/projects`);
    await expect(
      bPage.getByRole("listitem").filter({ hasText: projectTitle }),
    ).toHaveCount(0);
  } finally {
    await bContext.close();
  }
});

test("members-add-refused", async ({ page, context }) => {
  test.setTimeout(90_000);

  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Clinic Access ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);

  const membersList = page.getByRole("list", { name: "Members" });

  // An unknown email.
  await page.getByLabel("Email").fill(`nobody-${suffix}@example.com`);
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(
    page.getByText(
      "No account has that email — they need to sign in once first",
    ),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/members-add-refused/members-add-refused.png",
    fullPage: true,
  });

  // A's own email: already a Member.
  await page.getByLabel("Email").fill(author.email);
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(
    page.getByText("Already a member of this project"),
  ).toBeVisible();

  // Not an email address at all.
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Enter an email address")).toBeVisible();

  await expect(membersList.getByRole("listitem")).toHaveCount(1);

  const memberRows = await queryE2eDatabase<{ user_id: string }>(
    'SELECT user_id FROM "member" WHERE project_id = $1',
    [projectId],
  );
  expect(memberRows.map((row) => row.user_id)).toEqual([author.id]);
});

test("members-remove-and-last-refused", async ({ page, context, browser }) => {
  test.setTimeout(90_000);

  const bContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const authorA = await signInAs(context);
    mintedAuthorIds.push(authorA.id);

    // B minted first, so it exists before A adds it.
    const authorB = await signInAs(bContext);
    mintedAuthorIds.push(authorB.id);

    const suffix = uniqueSuffix();
    const projectTitle = `Refugee Health ${suffix}`;

    await page.goto("/projects");
    const projectId = await createProject(page, projectTitle);
    await page.goto(`/projects/${projectId}`);

    await page.getByLabel("Email").fill(authorB.email);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(
      page.getByRole("list", { name: "Members" }).getByRole("listitem"),
    ).toHaveCount(2);

    // A's stale second page, in A's own browser context, opened before
    // either removal below — its render still shows both Members.
    const stalePage = await context.newPage();
    try {
      await stalePage.goto(`/projects/${projectId}`);
      const staleList = stalePage.getByRole("list", { name: "Members" });
      await expect(staleList.getByRole("listitem")).toHaveCount(2);
      const staleButtons = staleList.getByRole("button", { name: "Remove" });
      await expect(staleButtons.first()).toBeEnabled();
      await expect(staleButtons.last()).toBeEnabled();

      // B opens the Project page in B's own context.
      const bPage = await bContext.newPage();
      await bPage.goto(`/projects/${projectId}`);

      // A's first page (not the stale one) removes B.
      const membersList = page.getByRole("list", { name: "Members" });
      const authorBRow = membersList
        .getByRole("listitem")
        .filter({ hasText: authorB.email });
      await authorBRow.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("button", { name: "Remove member" }).click();

      await expect(membersList.getByRole("listitem")).toHaveCount(1);
      const authorARow = membersList
        .getByRole("listitem")
        .filter({ hasText: authorA.email });
      await expect(
        authorARow.getByRole("button", { name: "Remove" }),
      ).toBeDisabled();
      await expect(
        page.getByText("A project keeps its last member"),
      ).toBeVisible();

      await page.screenshot({
        path: "test-results/members-remove-and-last-refused/members-remove-and-last-refused.png",
        fullPage: true,
      });

      // B reloads: 404, and B's own project list no longer shows it.
      const bResponse = await bPage.reload();
      expect(bResponse?.status()).toBe(404);
      await bPage.goto("/projects");
      await expect(
        bPage.getByRole("listitem").filter({ hasText: projectTitle }),
      ).toHaveCount(0);

      // A's stale second page attempts to remove A: refused server-side.
      const staleAuthorARow = staleList
        .getByRole("listitem")
        .filter({ hasText: authorA.email });
      await staleAuthorARow.getByRole("button", { name: "Remove" }).click();
      await stalePage.getByRole("button", { name: "Remove member" }).click();
      await expect(
        stalePage.getByText("A project must keep at least one member"),
      ).toBeVisible();

      const memberRows = await queryE2eDatabase<{ user_id: string }>(
        'SELECT user_id FROM "member" WHERE project_id = $1',
        [projectId],
      );
      expect(memberRows.map((row) => row.user_id)).toEqual([authorA.id]);
    } finally {
      await stalePage.close();
    }
  } finally {
    await bContext.close();
  }
});
