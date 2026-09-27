import { expect, test } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishDocument,
  runnerDocument,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import {
  cleanup,
  closePools,
  mintSession,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Ticket 77: account deletion, driven entirely through the browser.
 *
 * Every test mints its own Author(s), so tests never see each other's rows.
 */

const mintedIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedIds);
  await closePools();
});

test("account-delete", async ({ page, context }) => {
  test.setTimeout(90_000);

  const authorA = await signInAs(context);
  mintedIds.push(authorA.id);
  // B never opens a page, so B needs only an account, not a browser context.
  const { user: authorB } = await mintSession();
  mintedIds.push(authorB.id);

  const suffix = uniqueSuffix();

  // P1: A's sole Project, with a published Journey (a Run and its Response
  // stand in for real run history, so the cascade has something to take).
  await page.goto("/projects");
  const p1Id = await createProject(page, `Sole ${suffix}`);
  await page.goto(`/projects/${p1Id}`);
  const j1Id = await createJourney(page, p1Id, `Sole journey ${suffix}`);
  await writeDraftDocument(j1Id, runnerDocument());
  const versionId = await publishDocument(j1Id, runnerDocument());
  const [{ id: runId }] = await queryE2eDatabase<{ id: string }>(
    'INSERT INTO "run" (id, version_id, participant_id, path) VALUES (gen_random_uuid(), $1, $2, $3::jsonb) RETURNING id',
    [versionId, `participant-${suffix}`, JSON.stringify(["start"])],
  );
  await queryE2eDatabase(
    'INSERT INTO "response" (run_id, step_id, text) VALUES ($1, $2, $3)',
    [runId, "start", "A fixture answer"],
  );
  expect(
    await queryE2eDatabase('SELECT run_id FROM "response" WHERE run_id = $1', [
      runId,
    ]),
  ).toHaveLength(1);

  // P2: shared with B. Membership UI (`members.spec.ts`) is not under
  // test here, so B is added by inserting the row directly — cheaper, and
  // acceptable per the ticket's own note.
  await page.goto("/projects");
  const p2Id = await createProject(page, `Shared ${suffix}`);
  await queryE2eDatabase(
    'INSERT INTO "member" (project_id, user_id) VALUES ($1, $2)',
    [p2Id, authorB.id],
  );
  const p2Title = `Shared ${suffix}`;

  // The session cookie, captured before deletion, to prove afterwards
  // that a stale copy of it is dead.
  const cookiesBeforeDeletion = await context.cookies();
  const staleCookie = cookiesBeforeDeletion.find(
    (cookie) => cookie.name === "better-auth.session_token",
  );
  expect(staleCookie).toBeDefined();

  await page.goto("/projects/settings");
  await page.getByRole("button", { name: "Delete account" }).click();

  const dialog = page.getByRole("alertdialog", {
    name: "Delete your account?",
  });
  await expect(
    dialog
      .getByRole("list", { name: "Projects that will be deleted" })
      .getByText(`Sole ${suffix}`, { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(p2Title, { exact: false })).toBeVisible();

  await dialog.getByLabel("Type your email to confirm").fill(authorA.email);
  await dialog.getByRole("button", { name: "Delete account" }).click();

  await expect(page).toHaveURL(`${E2E_BASE_URL}/?notice=account-deleted`);
  await expect(
    page.getByRole("status").filter({ hasText: "Your account was deleted." }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath("account-delete", "account-delete.png"),
    fullPage: true,
  });

  // P1 and everything in it: gone.
  expect(
    await queryE2eDatabase('SELECT id FROM "project" WHERE id = $1', [p1Id]),
  ).toHaveLength(0);
  expect(
    await queryE2eDatabase('SELECT id FROM "journey" WHERE id = $1', [j1Id]),
  ).toHaveLength(0);
  expect(
    await queryE2eDatabase(
      'SELECT id FROM "published_version" WHERE journey_id = $1',
      [j1Id],
    ),
  ).toHaveLength(0);
  expect(
    await queryE2eDatabase('SELECT id FROM "run" WHERE version_id = $1', [
      versionId,
    ]),
  ).toHaveLength(0);
  expect(
    await queryE2eDatabase('SELECT run_id FROM "response" WHERE run_id = $1', [
      runId,
    ]),
  ).toHaveLength(0);

  // P2: intact, exactly B as its Member.
  const p2Members = await queryE2eDatabase<{ user_id: string }>(
    'SELECT user_id FROM "member" WHERE project_id = $1',
    [p2Id],
  );
  expect(p2Members.map((row) => row.user_id)).toEqual([authorB.id]);

  // A's own rows: gone.
  expect(
    await queryE2eDatabase('SELECT id FROM "user" WHERE id = $1', [authorA.id]),
  ).toHaveLength(0);
  expect(
    await queryE2eDatabase('SELECT id FROM "session" WHERE user_id = $1', [
      authorA.id,
    ]),
  ).toHaveLength(0);

  // The public link of the deleted Journey: 404.
  const runnerResponse = await page.request.get(`/j/${j1Id}`);
  expect(runnerResponse.status()).toBe(404);

  // AC-3, the stale-cookie half: a copy of the old session cookie, put
  // back into the context after the app's own sign-out cleared it,
  // reaches no page — it is sent nowhere the session row still exists.
  await context.addCookies([staleCookie!]);
  const staleRequest = await page.request.get("/projects");
  expect(staleRequest.url()).toBe(`${E2E_BASE_URL}/`);

  // AC-3, the fresh-account half: signing in again with the same email
  // creates a new, empty account — a different id, no Projects.
  const { user: freshAuthor, cookie: freshCookie } = await mintSession({
    email: authorA.email,
  });
  expect(freshAuthor.id).not.toBe(authorA.id);
  mintedIds.push(freshAuthor.id);

  await context.clearCookies();
  await context.addCookies([freshCookie]);
  await page.goto("/projects");
  await expect(page.getByText("No projects yet")).toBeVisible();
});

test("account-delete-refused", async ({ page, context }) => {
  test.setTimeout(60_000);

  const author = await signInAs(context);
  mintedIds.push(author.id);

  await page.goto("/projects/settings");
  await page.getByRole("button", { name: "Delete account" }).click();

  const dialog = page.getByRole("alertdialog", {
    name: "Delete your account?",
  });
  const confirmField = dialog.getByLabel("Type your email to confirm");
  const confirmButton = dialog.getByRole("button", { name: "Delete account" });

  // Empty, then a wrong email: refused.
  await expect(confirmButton).toBeDisabled();
  await confirmField.fill("someone-else@example.com");
  await expect(confirmButton).toBeDisabled();

  // The right email enables it.
  await confirmField.fill(author.email);
  await expect(confirmButton).toBeEnabled();

  await page.screenshot({
    path: evidencePath("account-delete-refused", "account-delete-refused.png"),
    fullPage: true,
  });

  // Changing it back to a wrong email disables it again: the check is read
  // from the field's current value, not remembered from an earlier one.
  await confirmField.fill("still-wrong@example.com");
  await expect(confirmButton).toBeDisabled();

  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Nothing was deleted.
  expect(
    await queryE2eDatabase('SELECT id FROM "user" WHERE id = $1', [author.id]),
  ).toHaveLength(1);

  // better-auth's own deletion endpoint is off by default (`deleteUser` is
  // never enabled in `@/lib/auth`); it answers a disabled feature with 403,
  // not a 404 — the route exists, using it does not.
  const bypass = await page.request.post("/api/auth/delete-user", {
    data: {},
  });
  expect(bypass.status()).toBe(403);
  expect(
    await queryE2eDatabase('SELECT id FROM "user" WHERE id = $1', [author.id]),
  ).toHaveLength(1);
});
