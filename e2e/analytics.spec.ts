import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";

import type { GraphDocument } from "@/lib/graph/document";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  publishDocument,
  QUEUE_STEP_TITLE,
  readRuns,
  runnerDocument,
  START_STEP_TITLE,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Seam B for ticket 10: Participants walk a Published Version to different
 * Endings (and one stops short), and a Member reads what happened off the
 * map — the take-rate on every Choice, the Runs on every Ending, the
 * abandonment on every Step, the totals, and the Runs-by-Outcome chart —
 * then publishes a second version and sees each version's numbers kept
 * apart. Every Participant browses in a context of their own, as in
 * `runner.spec.ts`; the Runs are the spec's own, never a real Participant's.
 */

test.setTimeout(120_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  // Deleting the Project cascades Journeys → Published Versions → Runs.
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** A Project and a Journey, made through the browser as an Author would. */
async function startJourney(page: Page): Promise<{
  projectId: string;
  journeyId: string;
}> {
  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Border Crossing ${suffix}`,
  );
  return { projectId, journeyId };
}

/**
 * One anonymous Participant's walk of the live version: the first Choice is
 * the form button that creates the Run, every Choice after it a link. The
 * context is closed when the walk is over, so the Run is exactly what was
 * walked — a Participant who stops after `choices` has abandoned there.
 */
async function walk(
  browser: Browser,
  journeyId: string,
  choices: string[],
): Promise<void> {
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const participant = await context.newPage();
    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    for (const [index, choice] of choices.entries()) {
      const control =
        index === 0
          ? participant.getByRole("button", { name: choice })
          : participant.getByRole("link", { name: choice });
      await control.click();
      await expect(control).toBeHidden();
    }
  } finally {
    await context.close();
  }
}

/** The map's box for a Step, by the Step's title. */
function box(page: Page, title: string): Locator {
  return page
    .getByRole("region", { name: "Analytics map" })
    .getByRole("group", { name: title, exact: true });
}

/** The figure an arrow carries, by the Choice's id. */
function arrowFigure(page: Page, choiceId: string): Locator {
  return page
    .getByRole("region", { name: "Analytics map" })
    .locator(`[data-choice-id="${choiceId}"] [data-edge-figure]`);
}

/** One tile of the totals row, by its label. */
function total(page: Page, label: string): Locator {
  return page
    .locator('dl[aria-label="Totals"] > div')
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
    .getByRole("definition");
}

/** One row of the Runs-by-Outcome chart, by its group key. */
function outcomeRow(page: Page, key: string): Locator {
  return page
    .getByRole("region", { name: "Runs by outcome" })
    .locator(`tr[data-outcome-key="${key}"]`);
}

async function expectOutcomeRow(
  page: Page,
  key: string,
  label: string,
  runs: number,
  share: string,
): Promise<void> {
  const row = outcomeRow(page, key);
  await expect(row.getByRole("rowheader")).toHaveText(label);
  await expect(row.getByRole("cell").nth(0)).toHaveText(String(runs));
  await expect(row.getByRole("cell").nth(1)).toContainText(share);
}

async function expectTotals(
  page: Page,
  expected: {
    starts: number;
    completions: number;
    abandoned: number;
    rate: string;
  },
): Promise<void> {
  await expect(total(page, "Starts")).toHaveText(String(expected.starts));
  await expect(total(page, "Completions")).toHaveText(
    String(expected.completions),
  );
  await expect(total(page, "Abandoned")).toHaveText(String(expected.abandoned));
  await expect(total(page, "Completion rate")).toHaveText(expected.rate);
}

/** `runnerDocument()` with "Turned back" grouped by nothing but itself. */
function untaggedEndingDocument(): GraphDocument {
  const document = runnerDocument();
  document.steps["turned-back"].outcomeId = null;
  delete document.outcomes["turned-away"];
  return document;
}

test("analytics-two-runs-to-different-endings", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const { projectId, journeyId } = await startJourney(page);
  const versionId = await publishDocument(journeyId, runnerDocument());
  const analyticsUrl = `/projects/${projectId}/journeys/${journeyId}?tab=analytics`;

  // Before anyone has walked it: every number is zero, every rate is a
  // dash, and the chart says so.
  await page.goto(analyticsUrl);
  await openTab(page, "Analytics");
  await expect(page.getByLabel("Version")).toHaveValue(versionId);
  await expect(page.getByRole("option", { selected: true })).toHaveText(
    "Version 1 (live)",
  );
  await expectTotals(page, {
    starts: 0,
    completions: 0,
    abandoned: 0,
    rate: "—",
  });
  await expect(box(page, "Waved through")).toContainText("0 runs");
  await expect(box(page, QUEUE_STEP_TITLE)).toContainText("0 abandoned");
  await expect(arrowFigure(page, "choice-wait")).toHaveText("— · 0 times");
  await expect(page.getByText("No runs yet.")).toBeVisible();

  // Three Participants: one to each Ending, and one who stops in the queue.
  await walk(browser, journeyId, ["Wait your turn", "Show your papers"]);
  await walk(browser, journeyId, ["Walk away"]);
  await walk(browser, journeyId, ["Wait your turn"]);
  expect(await readRuns(versionId)).toHaveLength(3);

  // The Member reads it all off the map.
  await page.goto(analyticsUrl);
  await openTab(page, "Analytics");
  await expectTotals(page, {
    starts: 3,
    completions: 2,
    abandoned: 1,
    rate: "67%",
  });

  // Every Step: the Runs that ended on an Ending, the Runs that stopped
  // short anywhere else.
  await expect(box(page, START_STEP_TITLE)).toContainText("0 abandoned");
  await expect(box(page, QUEUE_STEP_TITLE)).toContainText("1 abandoned");
  await expect(box(page, "Waved through")).toContainText("1 run");
  await expect(box(page, "Turned back")).toContainText("1 run");

  // Every Choice: its share of the visits to its Step, and how many times
  // it was walked. Three visited the Start; two waited, one walked away.
  // Two reached the queue; one showed papers, nobody left it, one stopped.
  await expect(arrowFigure(page, "choice-wait")).toHaveText("67% · 2 times");
  await expect(arrowFigure(page, "choice-leave")).toHaveText("33% · 1 time");
  await expect(arrowFigure(page, "choice-papers")).toHaveText("50% · 1 time");
  await expect(arrowFigure(page, "choice-give-up")).toHaveText("0% · 0 times");

  // The chart says the same in the Author's words, every start in one bar,
  // and its Outcome bars add up to the Runs on the map's Endings.
  await expectOutcomeRow(
    page,
    "outcome:reached-care",
    "Reached care",
    1,
    "33%",
  );
  await expectOutcomeRow(page, "outcome:turned-away", "Turned away", 1, "33%");
  await expectOutcomeRow(page, "abandoned", "Abandoned", 1, "33%");
  await expect(
    page.getByRole("region", { name: "Runs by outcome" }).getByRole("row"),
  ).toHaveCount(4);

  // Nothing here names a Run or a Participant.
  const runs = await readRuns(versionId);
  const pageText = await page.locator("main").innerText();
  for (const run of runs) {
    expect(pageText).not.toContain(run.id);
    expect(pageText).not.toContain(run.participant_id);
  }

  await page.screenshot({
    path: evidencePath(
      "analytics-two-runs-to-different-endings",
      "analytics-two-runs-to-different-endings.png",
    ),
    fullPage: true,
  });

  // A second Author, not a Member: the Journey page — Analytics tab and all
  // — is not theirs to see.
  const strangerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const stranger = await signInAs(strangerContext);
    mintedAuthorIds.push(stranger.id);
    const strangerPage = await strangerContext.newPage();

    const response = await strangerPage.goto(analyticsUrl);
    expect(response?.status()).toBe(404);
    await expect(
      strangerPage.getByRole("region", { name: "Analytics map" }),
    ).toHaveCount(0);
  } finally {
    await strangerContext.close();
  }
});

test("analytics-scoped-to-a-version", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const { projectId, journeyId } = await startJourney(page);
  const analyticsUrl = `/projects/${projectId}/journeys/${journeyId}?tab=analytics`;

  // Version 1, walked once to "Waved through".
  const firstVersionId = await publishDocument(journeyId, runnerDocument());
  await walk(browser, journeyId, ["Wait your turn", "Show your papers"]);
  expect(await readRuns(firstVersionId)).toHaveLength(1);

  // Version 2 drops "Turned back"'s Outcome, and is walked once to it.
  const secondVersionId = await publishDocument(
    journeyId,
    untaggedEndingDocument(),
  );
  await walk(browser, journeyId, ["Walk away"]);
  expect(await readRuns(secondVersionId)).toHaveLength(1);

  // The tab opens on the live version and reads its Run alone; the untagged
  // Ending stands in the chart under its own title.
  await page.goto(analyticsUrl);
  await openTab(page, "Analytics");
  await expect(page.getByLabel("Version")).toHaveValue(secondVersionId);
  await expect(page.getByRole("option", { selected: true })).toHaveText(
    "Version 2 (live)",
  );
  await expectTotals(page, {
    starts: 1,
    completions: 1,
    abandoned: 0,
    rate: "100%",
  });
  await expect(box(page, "Turned back")).toContainText("1 run");
  await expect(box(page, "Waved through")).toContainText("0 runs");
  await expectOutcomeRow(page, "ending:turned-back", "Turned back", 1, "100%");
  await expectOutcomeRow(page, "outcome:reached-care", "Reached care", 0, "0%");
  await expect(outcomeRow(page, "outcome:turned-away")).toHaveCount(0);

  // Switching to version 1 names it in the address and reads its Run
  // alone: the other Ending, the other Outcome, nothing of version 2.
  await page.getByLabel("Version").selectOption({ label: "Version 1" });
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}${analyticsUrl}&version=${firstVersionId}`,
  );
  await expect(page.getByLabel("Version")).toHaveValue(firstVersionId);
  await expectTotals(page, {
    starts: 1,
    completions: 1,
    abandoned: 0,
    rate: "100%",
  });
  await expect(box(page, "Waved through")).toContainText("1 run");
  await expect(box(page, "Turned back")).toContainText("0 runs");
  await expect(arrowFigure(page, "choice-papers")).toHaveText("100% · 1 time");
  await expectOutcomeRow(
    page,
    "outcome:reached-care",
    "Reached care",
    1,
    "100%",
  );
  await expectOutcomeRow(page, "outcome:turned-away", "Turned away", 0, "0%");
  await expect(outcomeRow(page, "ending:turned-back")).toHaveCount(0);

  await page.screenshot({
    path: evidencePath(
      "analytics-scoped-to-a-version",
      "analytics-scoped-to-a-version.png",
    ),
    fullPage: true,
  });

  // A reload keeps the version the address names.
  await page.reload();
  await expect(page.getByLabel("Version")).toHaveValue(firstVersionId);
  await expect(box(page, "Waved through")).toContainText("1 run");

  // An id that is not one of this Journey's versions is no version at all:
  // the tab falls back to the live one.
  await page.goto(`${analyticsUrl}&version=not-a-version-of-this-journey`);
  await openTab(page, "Analytics");
  await expect(page.getByLabel("Version")).toHaveValue(secondVersionId);
  await expect(box(page, "Turned back")).toContainText("1 run");
});
