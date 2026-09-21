import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

import caseThreeJson from "../scripts/seed/journey-stories/case-3.json";
import caseTwoJson from "../scripts/seed/journey-stories/case-2.json";
import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  loopDocument,
  publishDocument,
  QUEUE_STEP_ID,
  QUEUE_STEP_TITLE,
  readRuns,
  runnerDocument,
  START_STEP_ID,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 06: an anonymous Participant walking a published Journey
 * at `/j/{journey-id}`, and the Run each walk records.
 *
 * Every Participant browses in a context of its own, so a Run cookie never
 * leaks between them and "a new browser is a new Participant" is what the
 * specs actually exercise. Authoring happens in the default (signed-in)
 * context; the walk never does.
 */

// A Run is deliberately invisible from the browser, so each walk is checked
// twice: what the Participant reads, and what the row recorded.
test.setTimeout(120_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  // Deleting the Project cascades Journeys → Published Versions → Runs.
  await cleanup(mintedAuthorIds);
  await closePools();
});

/**
 * A grey placeholder served in place of every off-origin image. The seeded
 * case-3 document credits real photographs on third-party hosts; fetching
 * them would make this suite depend on the internet and on somebody else's
 * uptime, while fulfilling the request keeps the page honest — an image box
 * of a known size still sits above its credit line.
 */
const PLACEHOLDER_IMAGE = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240">',
  '<rect width="400" height="240" fill="#d4d4d4" />',
  '<text x="200" y="130" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#525252">image</text>',
  "</svg>",
].join("");

async function stubOffOriginImages(context: BrowserContext): Promise<void> {
  await context.route("**/*.{png,jpg,jpeg,gif,webp}", async (route) => {
    const { hostname } = new URL(route.request().url());
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    await route.fulfill({
      contentType: "image/svg+xml",
      body: PLACEHOLDER_IMAGE,
    });
  });
}

/**
 * The shortest route of Choice labels from the Start to `targetStepId`,
 * found by breadth-first search over the document's own Choices (in each
 * Step's own order). Computed rather than hand-copied so a future content
 * edit to the seeded case upstream does not silently break this walk — the
 * route always matches whatever the document currently says.
 */
function shortestRouteTo(
  document: GraphDocument,
  targetStepId: string,
): string[] {
  const visited = new Set<string>([document.startStepId]);
  const queue: { stepId: string; route: string[] }[] = [
    { stepId: document.startStepId, route: [] },
  ];

  while (queue.length > 0) {
    const { stepId, route } = queue.shift()!;
    if (stepId === targetStepId) return route;

    for (const choice of document.steps[stepId].choices) {
      if (visited.has(choice.targetStepId)) continue;
      visited.add(choice.targetStepId);
      queue.push({
        stepId: choice.targetStepId,
        route: [...route, choice.label],
      });
    }
  }

  throw new Error(`No route from Start to ${targetStepId}`);
}

/** Mobile-first means this, on every screen of the walk. */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const fits = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(fits).toBe(true);
}

test("runner-case-3-on-a-phone", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const journeyTitle = `Case 3 ${suffix}`;
  const description =
    "Ten years without legal status, and a body keeping score.";

  await page.goto("/projects");
  const projectId = await createProject(page, `Migrant Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    journeyTitle,
    description,
  );

  // The committed seed document, read through the same contract the app
  // reads a stored version with.
  const caseThree = graphDocumentSchema.parse(caseThreeJson);
  await writeDraftDocument(journeyId, caseThree);
  const versionId = await publishDocument(journeyId, caseThree);

  const phone = await browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  try {
    await stubOffOriginImages(phone);
    const participant = await phone.newPage();

    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: journeyTitle }),
    ).toBeVisible();
    await expect(participant.getByText(description)).toBeVisible();
    await expectNoSidewaysScroll(participant);

    await participant.getByRole("button", { name: "Begin" }).click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/step-7`,
    );
    await expect(
      participant.getByRole("heading", { name: "Preface" }),
    ).toBeVisible();
    await expectNoSidewaysScroll(participant);

    await participant.getByRole("link", { name: "Next" }).click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/step-1`,
    );
    await expect(
      participant.getByRole("heading", { name: "The Horses" }),
    ).toBeVisible();

    // The image and the credit that must travel with it.
    const figure = participant.locator("figure").first();
    await expect(figure.locator("img")).toHaveAttribute("src", /^https:\/\//);
    await expect(figure.locator("figcaption")).toContainText("Steven Lilley");
    await expectNoSidewaysScroll(participant);

    await participant.screenshot({
      path: "test-results/runner-case-3-on-a-phone/runner-case-3-on-a-phone.png",
      fullPage: true,
    });

    await participant.getByRole("link", { name: "Next" }).click();
    await expect(
      participant.getByRole("heading", { name: "HHS" }),
    ).toBeVisible();
    await expectNoSidewaysScroll(participant);

    await participant
      .getByRole("link", {
        name: "Ask your friend to drive you to the hospital",
      })
      .click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/step-3`,
    );
    await expect(
      participant.getByRole("heading", { name: "Drive to Hospital" }),
    ).toBeVisible();
    await expectNoSidewaysScroll(participant);

    await participant.getByRole("link", { name: "Next" }).click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/step-10`,
    );
    await expect(
      participant.getByRole("heading", { name: "After a Wait" }),
    ).toBeVisible();
    await expect(participant.getByText("The end")).toBeVisible();
    await expect(
      participant.getByText("Outcome: Died waiting for emergency care"),
    ).toBeVisible();
    await expectNoSidewaysScroll(participant);
  } finally {
    await phone.close();
  }

  const runs = await readRuns(versionId);
  expect(runs).toHaveLength(1);
  expect(runs[0].path).toEqual([
    "step-7",
    "step-1",
    "step-8",
    "step-3",
    "step-10",
  ]);
  expect(runs[0].ended_at).not.toBeNull();
  expect(runs[0].outcome_id).toBe("outcome-died-in-emergency");
});

test("runner-back-and-choose-again", async ({ page, context, browser }) => {
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

  const versionId = await publishDocument(journeyId, runnerDocument());

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await participant.getByRole("button", { name: "Begin" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("link", { name: "Show your papers" }).click();
    await expect(
      participant.getByRole("heading", { name: "Waved through" }),
    ).toBeVisible();
    await expect(participant.getByText("The end")).toBeVisible();

    const ended = await readRuns(versionId);
    expect(ended).toHaveLength(1);
    expect(ended[0].path).toEqual([
      START_STEP_ID,
      QUEUE_STEP_ID,
      "waved-through",
    ]);
    expect(ended[0].ended_at).not.toBeNull();
    expect(ended[0].outcome_id).toBe("reached-care");
    expect(ended[0].backtrack_count).toBe(0);

    // The browser's own back button is a backtrack, recorded like any other:
    // the Ending is undone and the path truncates to the Step returned to.
    await participant.goBack();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    // The browser restores the previous page from its own cache and the page
    // sends itself back to the server, so the row settles a moment after the
    // heading is on screen — the two screens look identical either way.
    await expect
      .poll(async () => (await readRuns(versionId))[0].path)
      .toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    const afterBrowserBack = await readRuns(versionId);
    expect(afterBrowserBack[0].backtrack_count).toBe(1);
    expect(afterBrowserBack[0].ended_at).toBeNull();
    expect(afterBrowserBack[0].outcome_id).toBeNull();

    // The in-app Back control does exactly the same thing.
    await participant.getByRole("link", { name: "← Back" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    const afterInAppBack = await readRuns(versionId);
    expect(afterInAppBack[0].path).toEqual([START_STEP_ID]);
    expect(afterInAppBack[0].backtrack_count).toBe(2);

    // And from there the Participant chooses differently.
    await participant.getByRole("link", { name: "Walk away" }).click();
    await expect(
      participant.getByRole("heading", { name: "Turned back" }),
    ).toBeVisible();
    await expect(participant.getByText("The end")).toBeVisible();

    const afterSecondChoice = await readRuns(versionId);
    expect(afterSecondChoice).toHaveLength(1);
    expect(afterSecondChoice[0].path).toEqual([START_STEP_ID, "turned-back"]);
    expect(afterSecondChoice[0].outcome_id).toBe("turned-away");
    expect(afterSecondChoice[0].ended_at).not.toBeNull();

    await participant.screenshot({
      path: "test-results/runner-back-and-choose-again/runner-back-and-choose-again.png",
      fullPage: true,
    });

    // Starting over from the Ending is a new Run, not a reset: the finished
    // one keeps its path and Outcome, and the walk begins again at the Start.
    await participant.getByRole("button", { name: "Start over" }).click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/${START_STEP_ID}`,
    );
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    const afterStartOver = await readRuns(versionId);
    expect(afterStartOver).toHaveLength(2);
    expect(afterStartOver[0].id).toBe(afterSecondChoice[0].id);
    expect(afterStartOver[0].path).toEqual([START_STEP_ID, "turned-back"]);
    expect(afterStartOver[0].outcome_id).toBe("turned-away");
    expect(afterStartOver[1].path).toEqual([START_STEP_ID]);
    expect(afterStartOver[1].ended_at).toBeNull();
  } finally {
    await participantContext.close();
  }
});

test("runner-loop-and-back", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Border Queue ${suffix}`,
  );

  const versionId = await publishDocument(journeyId, loopDocument());

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await participant.getByRole("button", { name: "Begin" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    // Twice around the loop: every visit is its own entry, and choosing the
    // Step behind you is a forward move, not a backtrack.
    await participant.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("link", { name: "Ask again" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("link", { name: "Ask again" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    const aroundTheLoop = await readRuns(versionId);
    expect(aroundTheLoop).toHaveLength(1);
    expect(aroundTheLoop[0].path).toEqual([
      START_STEP_ID,
      QUEUE_STEP_ID,
      START_STEP_ID,
      QUEUE_STEP_ID,
      START_STEP_ID,
    ]);
    expect(aroundTheLoop[0].backtrack_count).toBe(0);

    // The ambiguous navigation: the queue Step is both the entry behind the
    // Participant and a Choice of the Step they are on. Back means the entry,
    // which only holds if the index reaches the server.
    await participant.goBack();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    await expect
      .poll(async () => (await readRuns(versionId))[0].path)
      .toEqual([START_STEP_ID, QUEUE_STEP_ID, START_STEP_ID, QUEUE_STEP_ID]);

    const afterBrowserBack = await readRuns(versionId);
    expect(afterBrowserBack[0].backtrack_count).toBe(1);
    expect(afterBrowserBack[0].ended_at).toBeNull();

    // The index did its work and left: the address bar shows the Step alone.
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/${QUEUE_STEP_ID}`,
    );

    // Round the loop once more from there, and out.
    await participant.getByRole("link", { name: "Ask again" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    const afterLoopingAgain = await readRuns(versionId);
    expect(afterLoopingAgain[0].path).toHaveLength(5);
    expect(afterLoopingAgain[0].backtrack_count).toBe(1);

    await participant.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("link", { name: "Show your papers" }).click();
    await expect(
      participant.getByRole("heading", { name: "Waved through" }),
    ).toBeVisible();
    await expect(participant.getByText("The end")).toBeVisible();

    await participant.screenshot({
      path: "test-results/runner-loop-and-back/runner-loop-and-back.png",
      fullPage: true,
    });

    const ended = await readRuns(versionId);
    expect(ended).toHaveLength(1);
    expect(ended[0].path).toEqual([
      START_STEP_ID,
      QUEUE_STEP_ID,
      START_STEP_ID,
      QUEUE_STEP_ID,
      START_STEP_ID,
      QUEUE_STEP_ID,
      "waved-through",
    ]);
    expect(ended[0].outcome_id).toBe("reached-care");
    expect(ended[0].ended_at).not.toBeNull();
    expect(ended[0].backtrack_count).toBe(1);
  } finally {
    await participantContext.close();
  }
});

test("runner-case-2-restored-choice", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const journeyTitle = `Case 2 ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, `Migrant Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);

  // The committed seed document, read through the same contract the app
  // reads a stored version with — including the four Choices ticket 18
  // restored, one of which is this walk's whole point.
  const caseTwo = graphDocumentSchema.parse(caseTwoJson);
  await writeDraftDocument(journeyId, caseTwo);
  const versionId = await publishDocument(journeyId, caseTwo);

  const route = shortestRouteTo(caseTwo, "step-27");

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    await stubOffOriginImages(participantContext);
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await participant.getByRole("button", { name: "Begin" }).click();

    for (const label of route) {
      await participant.getByRole("link", { name: label, exact: true }).click();
    }
    await expect(
      participant.getByRole("heading", { name: "I quit!" }),
    ).toBeVisible();

    await participant
      .getByRole("link", {
        name: "Call your bunkmate's cousin's friend",
        exact: true,
      })
      .click();
    await expect(
      participant.getByRole("heading", { name: "Trafficking?" }),
    ).toBeVisible();

    await participant.screenshot({
      path: "test-results/runner-case-2-restored-choice/runner-case-2-restored-choice.png",
      fullPage: true,
    });

    const runs = await readRuns(versionId);
    expect(runs).toHaveLength(1);
    expect(runs[0].path.slice(-2)).toEqual(["step-27", "step-32"]);
    expect(runs[0].backtrack_count).toBe(0);
  } finally {
    await participantContext.close();
  }
});

test("runner-run-cookie-and-refresh", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const firstJourneyId = await createJourney(
    page,
    projectId,
    `Border Crossing ${suffix}`,
  );
  await page.goto(`/projects/${projectId}`);
  const secondJourneyId = await createJourney(
    page,
    projectId,
    `Night Crossing ${suffix}`,
  );

  const firstVersionId = await publishDocument(
    firstJourneyId,
    runnerDocument(),
  );
  const secondVersionId = await publishDocument(
    secondJourneyId,
    runnerDocument(),
  );

  const firstContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const participant = await firstContext.newPage();

    await participant.goto(`/j/${firstJourneyId}`);
    await participant.getByRole("button", { name: "Begin" }).click();
    await participant.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    // A refresh resumes the Run where it was, and records no second one.
    await participant.reload();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    const afterReload = await readRuns(firstVersionId);
    expect(afterReload).toHaveLength(1);
    expect(afterReload[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    // A second Participant holds no Run cookie for this Journey, so a step
    // URL sends them to the start screen rather than into somebody's Run.
    const strangerContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
    });
    try {
      const stranger = await strangerContext.newPage();
      await stranger.goto(`/j/${firstJourneyId}/${QUEUE_STEP_ID}`);
      await expect(stranger).toHaveURL(`${E2E_BASE_URL}/j/${firstJourneyId}`);

      await stranger.getByRole("button", { name: "Begin" }).click();
      await expect(
        stranger.getByRole("heading", { name: START_STEP_TITLE }),
      ).toBeVisible();
    } finally {
      await strangerContext.close();
    }

    const twoParticipants = await readRuns(firstVersionId);
    expect(twoParticipants).toHaveLength(2);
    expect(twoParticipants[0].participant_id).not.toBe(
      twoParticipants[1].participant_id,
    );

    // A second Journey open in the same browser keeps a Run of its own: the
    // Run cookie is scoped to the Journey, the Participant id is not.
    await participant.goto(`/j/${secondJourneyId}`);
    await participant.getByRole("button", { name: "Begin" }).click();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    const secondJourneyRuns = await readRuns(secondVersionId);
    expect(secondJourneyRuns).toHaveLength(1);
    expect(secondJourneyRuns[0].path).toEqual([START_STEP_ID]);
    expect(secondJourneyRuns[0].participant_id).toBe(
      afterReload[0].participant_id,
    );

    // …and the first Journey is still exactly where it was left.
    await participant.goto(`/j/${firstJourneyId}/${QUEUE_STEP_ID}`);
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();
    const firstJourneyRuns = await readRuns(firstVersionId);
    expect(firstJourneyRuns).toHaveLength(2);
    expect(firstJourneyRuns[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    await participant.goto(`/j/${firstJourneyId}`);
    await expect(
      participant.getByRole("link", { name: "Continue where you left off" }),
    ).toBeVisible();
    await participant.screenshot({
      path: "test-results/runner-run-cookie-and-refresh/runner-run-cookie-and-refresh.png",
      fullPage: true,
    });
  } finally {
    await firstContext.close();
  }
});

test("runner-pinned-version", async ({ page, context, browser }) => {
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

  const versionOneId = await publishDocument(journeyId, runnerDocument());

  const midRunContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  const freshContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const midRun = await midRunContext.newPage();
    await midRun.goto(`/j/${journeyId}`);
    await midRun.getByRole("button", { name: "Begin" }).click();
    await midRun.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      midRun.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    // A rename after publishing changes the Journey row, not what a
    // Participant sees: the start screen reads version 1's own title.
    const journeyTitle = `Border Crossing ${suffix}`;
    await queryE2eDatabase('UPDATE "journey" SET title = $1 WHERE id = $2', [
      `Renamed after publishing ${suffix}`,
      journeyId,
    ]);
    await midRun.goto(`/j/${journeyId}`);
    await expect(
      midRun.getByRole("heading", { name: journeyTitle, exact: true }),
    ).toBeVisible();
    await expect(midRun.getByText("Renamed after publishing")).toHaveCount(0);
    await midRun.goto(`/j/${journeyId}/${QUEUE_STEP_ID}`);

    // Version 2 goes live under the Participant's feet.
    const retitled = runnerDocument();
    const laterTitle = "Still waiting, hours later";
    retitled.steps[QUEUE_STEP_ID].title = laterTitle;
    const versionTwoId = await publishDocument(journeyId, retitled);

    // The in-progress Run keeps walking the version it started on.
    await midRun.getByRole("link", { name: "Show your papers" }).click();
    await expect(
      midRun.getByRole("heading", { name: "Waved through" }),
    ).toBeVisible();

    expect(await readRuns(versionOneId)).toHaveLength(1);
    expect(await readRuns(versionTwoId)).toHaveLength(0);

    await midRun.goto(`/j/${journeyId}/${QUEUE_STEP_ID}`);
    await expect(
      midRun.getByRole("heading", { name: QUEUE_STEP_TITLE, exact: true }),
    ).toBeVisible();

    // A Run started now is pinned to version 2 and reads version 2's words.
    const fresh = await freshContext.newPage();
    await fresh.goto(`/j/${journeyId}`);
    await fresh.getByRole("button", { name: "Begin" }).click();
    await fresh.getByRole("link", { name: "Wait your turn" }).click();
    await expect(
      fresh.getByRole("heading", { name: laterTitle }),
    ).toBeVisible();

    expect(await readRuns(versionOneId)).toHaveLength(1);
    const onVersionTwo = await readRuns(versionTwoId);
    expect(onVersionTwo).toHaveLength(1);
    expect(onVersionTwo[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    await fresh.screenshot({
      path: "test-results/runner-pinned-version/runner-pinned-version.png",
      fullPage: true,
    });
  } finally {
    await midRunContext.close();
    await freshContext.close();
  }
});

test("runner-unavailable-and-unknown", async ({ page, context, browser }) => {
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

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    // Never published: the Journey exists, but not for a Participant.
    const neverPublished = await participant.goto(`/j/${journeyId}`);
    expect(neverPublished?.status()).toBe(200);
    await expect(
      participant.getByText("This journey isn't available"),
    ).toBeVisible();
    await participant.screenshot({
      path: "test-results/runner-unavailable-and-unknown/runner-unavailable-and-unknown.png",
      fullPage: true,
    });

    // Published and then taken down reads exactly the same way, and a step
    // URL opened without a Run lands on that screen rather than 404ing.
    await publishDocument(journeyId, runnerDocument());
    await queryE2eDatabase(
      'UPDATE "journey" SET live_version_id = NULL WHERE id = $1',
      [journeyId],
    );

    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByText("This journey isn't available"),
    ).toBeVisible();

    await participant.goto(`/j/${journeyId}/${START_STEP_ID}`);
    await expect(participant).toHaveURL(`${E2E_BASE_URL}/j/${journeyId}`);
    await expect(
      participant.getByText("This journey isn't available"),
    ).toBeVisible();

    // An id that names no Journey at all is a 404, not an "unavailable".
    const unknown = await participant.goto(
      "/j/00000000-0000-4000-8000-000000000000",
    );
    expect(unknown?.status()).toBe(404);
  } finally {
    await participantContext.close();
  }
});
