import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  publishableDocument,
  publishDocument,
  START_STEP_TITLE,
  writeDraftDocument,
  writeRawDraftRow,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAgain,
  signInAs,
} from "./setup/session";
import { readDraftRow } from "./setup/documents";

/**
 * Seam B for ticket 73: a stale save is refused, never silently
 * overwritten. Two browser contexts are two Members with the same thing
 * open — here one Author signed in twice, which the rule treats exactly as
 * two Members of the Project, since nothing is per-session. The first saves;
 * the second's next save is refused with the sentence and a Reload, keeps
 * the edit on screen, and after Reload shows the first one's change.
 *
 * And a Draft row that fails the document contract renders a page that
 * names the Journey and offers "Restore from Version N", which works.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

const STALE_DRAFT =
  "Someone else changed this draft since you opened it. Reload to see their changes.";
const STALE_PROJECT =
  "Someone else changed this project since you opened it. Reload to see their changes.";

/** A second browser signed in as the same Author: the other Member. */
async function secondMember(
  browser: Browser,
  authorId: string,
): Promise<BrowserContext> {
  const other = await browser.newContext({ baseURL: E2E_BASE_URL });
  await signInAgain(other, authorId);
  return other;
}

type DraftRow = { document: { steps: Record<string, { title: string }> } };

async function storedStartTitle(journeyId: string): Promise<string> {
  const { document } = await readDraftRow(journeyId);
  const draft = document as DraftRow["document"] & { startStepId: string };
  return draft.steps[draft.startStepId].title;
}

async function storedProjectTitle(projectId: string): Promise<string> {
  const [row] = await queryE2eDatabase<{ title: string }>(
    'SELECT title FROM "project" WHERE id = $1',
    [projectId],
  );
  return row.title;
}

/** The Draft's own status line, not the title form's above the tabs. */
function draftStatus(page: Page) {
  return page.getByRole("tabpanel", { name: "Editor" }).getByRole("status");
}

test("draft-stale-save", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Border Crossing ${suffix}`,
  );
  const journeyPath = `/projects/${projectId}/journeys/${journeyId}`;

  // Both Members open the same Draft, on its one Step.
  const startTitle = "Start";
  await page.goto(journeyPath);
  await expect(page.getByLabel("Step title")).toHaveValue(startTitle);
  const other = await secondMember(browser, author.id);
  const pageB = await other.newPage();
  await pageB.goto(journeyPath);
  await expect(pageB.getByLabel("Step title")).toHaveValue(startTitle);

  // A saves: typed until the row holds it (a fill before hydration is
  // written over by the field attaching, and saves nothing).
  const theirs = "Border post at dawn";
  await expect(async () => {
    await page.getByLabel("Step title").fill(theirs);
    await expect(draftStatus(page)).toHaveText("Saved", { timeout: 3_000 });
    await expect.poll(() => storedStartTitle(journeyId)).toBe(theirs);
  }).toPass({ timeout: 20_000 });

  // B's next save is refused: the sentence and a Reload, B's edit still on
  // screen, and A's change still what is stored.
  const mine = "Border post at dusk";
  const refusal = pageB.getByRole("alert").filter({ hasText: STALE_DRAFT });
  await expect(async () => {
    await pageB.getByLabel("Step title").fill(mine);
    await expect(refusal).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(pageB.getByLabel("Step title")).toHaveValue(mine);
  await expect(refusal.getByRole("button", { name: "Reload" })).toBeVisible();
  expect(await storedStartTitle(journeyId)).toBe(theirs);

  // Editing on goes nowhere: still refused, still A's in the row.
  await pageB.getByLabel("Step title").fill(`${mine}, still`);
  await expect(refusal).toBeVisible();
  expect(await storedStartTitle(journeyId)).toBe(theirs);

  await pageB.screenshot({
    path: evidencePath("draft-stale-save", "draft-stale-save.png"),
    fullPage: true,
  });

  // Reload: no "leave this page?" in the way, and A's change is there.
  await refusal.getByRole("button", { name: "Reload" }).click();
  await expect(pageB.getByLabel("Step title")).toHaveValue(theirs);
  await expect(
    pageB.getByRole("alert").filter({ hasText: STALE_DRAFT }),
  ).toHaveCount(0);

  await other.close();
});

test("settings-stale-save", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const original = `Refugee Health ${suffix}`;
  await page.goto("/projects");
  const projectId = await createProject(page, original);
  const settingsPath = `/projects/${projectId}?tab=settings`;

  await page.goto(settingsPath);
  const titleA = page.getByLabel("Title", { exact: true });
  await expect(titleA).toHaveValue(original);
  const other = await secondMember(browser, author.id);
  const pageB = await other.newPage();
  await pageB.goto(settingsPath);
  const titleB = pageB.getByLabel("Title", { exact: true });
  await expect(titleB).toHaveValue(original);

  // A renames the Project.
  const theirs = `Refugee Health North ${suffix}`;
  await expect(async () => {
    await titleA.fill(theirs);
    await titleA.press("Enter");
    await expect
      .poll(() => storedProjectTitle(projectId), { timeout: 3_000 })
      .toBe(theirs);
  }).toPass({ timeout: 20_000 });

  // B's rename, made against the title B opened, is refused.
  const mine = `Refugee Health South ${suffix}`;
  const refusal = pageB.getByRole("alert").filter({ hasText: STALE_PROJECT });
  await expect(async () => {
    await titleB.fill(mine);
    await titleB.press("Enter");
    await expect(refusal).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(titleB).toHaveValue(mine);
  expect(await storedProjectTitle(projectId)).toBe(theirs);

  await pageB.screenshot({
    path: evidencePath("settings-stale-save", "settings-stale-save.png"),
    fullPage: true,
  });

  await refusal.getByRole("button", { name: "Reload" }).click();
  await expect(titleB).toHaveValue(theirs);
  await expect(
    pageB.getByRole("alert").filter({ hasText: STALE_PROJECT }),
  ).toHaveCount(0);

  await other.close();
});

test("draft-unreadable", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const journeyTitle = `Border Crossing ${suffix}`;
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // Version 1 exists; then the Draft's row is broken in a way the document
  // contract refuses.
  const published = publishableDocument();
  await publishDocument(journeyId, published);
  await writeRawDraftRow(journeyId, { schemaVersion: 1, steps: "broken" }, 3);

  // Not a 500: the header and tabs stay, and the Editor tab says what
  // happened, naming the Journey, with the way back.
  const response = await page.goto(
    `/projects/${projectId}/journeys/${journeyId}`,
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    journeyTitle,
  );
  await expect(page.getByRole("tab", { name: "Versions" })).toBeVisible();
  const notice = page.getByRole("region", { name: "This draft can't be read" });
  await expect(notice).toContainText(`The draft of “${journeyTitle}”`);
  const restore = notice.getByRole("button", {
    name: "Restore from Version 1",
  });
  await expect(restore).toBeVisible();

  await page.screenshot({
    path: evidencePath("draft-unreadable", "draft-unreadable.png"),
    fullPage: true,
  });

  // Restore works from here: the row is Version 1's document again, one
  // write further on, and the editor is back on it.
  await restore.click();
  await page.getByRole("button", { name: "Restore version" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByLabel("Step title")).toHaveValue(START_STEP_TITLE);
  const restored = await readDraftRow(journeyId);
  expect(restored.document).toEqual(published);
  expect(restored.version).toBe(4);

  await openTab(page, "Editor");
  await expect(notice).toHaveCount(0);
});

/**
 * Ticket 73 AC3: a Member editing alone never sees the stale sentence.
 * Clicking the header's Publish straight after an edit blurs the editor,
 * which starts that edit's save; the publish must go out after it, with the
 * version it leaves, rather than beside it with the one it replaces.
 */
test("draft-publish-right-after-edit", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Border Crossing ${suffix}`,
  );
  await writeDraftDocument(journeyId, publishableDocument());

  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  const stepTitle = page.getByLabel("Step title");
  await expect(stepTitle).toHaveValue(START_STEP_TITLE);

  // One saved edit first, typed until the row holds it: the editor is
  // hydrated (a fill before hydration is written over), and the Draft's
  // version has moved past the one the page first read.
  const first = "Border post at dawn";
  await expect(async () => {
    await stepTitle.fill(first);
    await expect(draftStatus(page)).toHaveText("Saved", { timeout: 3_000 });
    await expect.poll(() => storedStartTitle(journeyId)).toBe(first);
  }).toPass({ timeout: 20_000 });

  // Then an edit and, without waiting for it to save, Publish.
  const edited = "Border post at dusk";
  await stepTitle.fill(edited);
  const header = page.locator("main header");
  await header.getByRole("button", { name: "Publish", exact: true }).click();

  await expect(
    header.getByRole("status").filter({ hasText: "Published Version" }),
  ).toHaveText(/Published Version 1 — participants see it now\./);
  await expect(page.getByText(STALE_DRAFT)).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // What was published is the edit made just before the click.
  const [version] = await queryE2eDatabase<{
    document: DraftRow["document"] & { startStepId: string };
  }>('SELECT document FROM "published_version" WHERE journey_id = $1', [
    journeyId,
  ]);
  expect(version.document.steps[version.document.startStepId].title).toBe(
    edited,
  );
  expect(await storedStartTitle(journeyId)).toBe(edited);
});
