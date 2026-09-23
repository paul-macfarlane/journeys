import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";
import { linkPreviewPalette } from "@/lib/link-preview";

import { MAX_PATH_LENGTH } from "@/lib/graph/run";

import caseTwoJson from "../scripts/seed/journey-stories/case-2.json";
import caseThreeJson from "../scripts/seed/journey-stories/case-3.json";
import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  loopDocument,
  promptDocument,
  publishDocument,
  QUEUE_PROMPT,
  QUEUE_STEP_ID,
  QUEUE_STEP_TITLE,
  readRuns,
  runnerDocument,
  START_STEP_ID,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { capturePath, evidencePath } from "./setup/evidence";
import { pixelsAt, readPng, saveBytes } from "./setup/images";
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
 * case-3 document captions real photographs on third-party hosts; fetching
 * them would make this suite depend on the internet and on somebody else's
 * uptime, while fulfilling the request keeps the page honest — an image box
 * of a known size still sits above its caption.
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
    const next = queue.shift();
    if (!next) break;

    const { stepId, route } = next;
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

/** The Prompt's textbox on a runner screen, found by its question. */
function promptBox(page: Page, label: string) {
  return page.getByRole("textbox", { name: label });
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

    // The Journey opens on its Start Step: the title in the header, the
    // description beneath it, and the Step's own content and Choices — no
    // title page in front of it, and no Run yet.
    await participant.goto(`/j/${journeyId}`);
    await expect(participant.getByRole("banner")).toHaveText(journeyTitle);
    await expect(participant.getByText(description)).toBeVisible();
    await expect(
      participant.getByRole("heading", { name: "Preface" }),
    ).toBeVisible();
    await expectNoSidewaysScroll(participant);
    expect(await readRuns(versionId)).toHaveLength(0);

    // The first Choice is what creates the Run, and it lands on the chosen
    // Step with the title still in the header.
    await participant.getByRole("button", { name: "Next" }).click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/step-1`,
    );
    await expect(participant.getByRole("banner")).toHaveText(journeyTitle);
    await expect(
      participant.getByRole("heading", { name: "The Horses" }),
    ).toBeVisible();

    // The image and the caption that must travel with it.
    const figure = participant.locator("figure").first();
    await expect(figure.locator("img")).toHaveAttribute("src", /^https:\/\//);
    await expect(figure.locator("figcaption")).toContainText("Steven Lilley");
    await expectNoSidewaysScroll(participant);

    await participant.screenshot({
      path: evidencePath(
        "runner-case-3-on-a-phone",
        "runner-case-3-on-a-phone.png",
      ),
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

test("runner-required-prompt-refusal", async ({ page, context, browser }) => {
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

  // The middle Step's Prompt is required; the Start's is optional.
  await writeDraftDocument(journeyId, promptDocument());
  const versionId = await publishDocument(journeyId, promptDocument());

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    // The Start's optional Prompt left blank still creates the Run.
    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    // Advancing with the required box blank is refused at the field: the
    // app's own text beside the box, not a browser bubble, and the Run stays
    // on the same Step.
    const queueBox = promptBox(participant, QUEUE_PROMPT);
    const form = participant.locator("form");
    await expect(form).toHaveJSProperty("noValidate", true);

    await participant.getByRole("button", { name: "Show your papers" }).click();

    // The refused page is the signal the server has answered; only then is
    // the Run's path worth reading, or the read could land before the
    // action does and pass whatever it did.
    await expect(queueBox).toHaveAttribute("aria-invalid", "true");
    expect((await readRuns(versionId))[0].path).toEqual([
      START_STEP_ID,
      QUEUE_STEP_ID,
    ]);

    await expect(queueBox).toHaveAttribute("aria-required", "true");
    await expect(queueBox).toHaveAttribute(
      "aria-describedby",
      `response-${QUEUE_STEP_ID}-refusal`,
    );
    await expect(queueBox).toHaveJSProperty("validationMessage", "");
    await expect(queueBox).toBeFocused();

    const refusal = participant
      .getByRole("alert")
      .filter({ hasText: "This step needs a response before you go on." });
    await expect(refusal).toBeVisible();

    // One place, the field: the same text does not also show above the Step.
    await expect(
      participant
        .getByRole("status")
        .filter({ hasText: "This step needs a response before you go on." }),
    ).toHaveCount(0);

    await participant.screenshot({
      path: evidencePath(
        "runner-required-prompt-refusal",
        "runner-required-prompt-refusal.png",
      ),
      fullPage: true,
    });

    // Answered, the Choice goes through and the Run moves on.
    await queueBox.fill("Whether the paper in my pocket is the right one.");
    await participant.getByRole("button", { name: "Show your papers" }).click();
    await expect(
      participant.getByRole("heading", { name: "Waved through" }),
    ).toBeVisible();
    expect((await readRuns(versionId))[0].path).toEqual([
      START_STEP_ID,
      QUEUE_STEP_ID,
      "waved-through",
    ]);
  } finally {
    await participantContext.close();
  }
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
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    await participant.getByRole("button", { name: "Wait your turn" }).click();
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
    // 30s budgets a second full page load on a busy server.
    await expect
      .poll(async () => (await readRuns(versionId))[0].path, {
        timeout: 30_000,
      })
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
      path: evidencePath(
        "runner-back-and-choose-again",
        "runner-back-and-choose-again.png",
      ),
      fullPage: true,
    });

    // Starting over from the Ending shows the Start Step fresh and records
    // nothing by itself: the finished Run keeps its path and Outcome, and a
    // new Run is created — not a reset — by the next Choice.
    await participant.getByRole("button", { name: "Start over" }).click();
    await expect(participant).toHaveURL(`${E2E_BASE_URL}/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();
    await expect(
      participant.getByRole("link", { name: "Continue where you left off" }),
    ).toHaveCount(0);
    expect(await readRuns(versionId)).toHaveLength(1);

    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    const afterStartOver = await readRuns(versionId);
    expect(afterStartOver).toHaveLength(2);
    expect(afterStartOver[0].id).toBe(afterSecondChoice[0].id);
    expect(afterStartOver[0].path).toEqual([START_STEP_ID, "turned-back"]);
    expect(afterStartOver[0].outcome_id).toBe("turned-away");
    expect(afterStartOver[1].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);
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
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();

    // Twice around the loop: every visit is its own entry, and choosing the
    // Step behind you is a forward move, not a backtrack. The first Choice
    // is a button (it creates the Run); every later one is a link.
    await participant.getByRole("button", { name: "Wait your turn" }).click();
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

    // 30s budgets a second full page load on a busy server.
    await expect
      .poll(async () => (await readRuns(versionId))[0].path, {
        timeout: 30_000,
      })
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
      path: evidencePath("runner-loop-and-back", "runner-loop-and-back.png"),
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

test("runner-path-cap", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `Refugee Health ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Endless Queue ${suffix}`,
  );

  const versionId = await publishDocument(journeyId, loopDocument());

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    await participant.goto(`/j/${journeyId}`);
    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    const started = await readRuns(versionId);
    expect(started).toHaveLength(1);

    // Walking to the cap would take a thousand clicks and prove nothing the
    // reducer's own cases do not; the row is grown to it directly so this
    // spec is about what a Participant is told when the walk stops. The cap
    // is an even number, so the path ends on the queue Step.
    const cappedPath = Array.from({ length: MAX_PATH_LENGTH }, (_, index) =>
      index % 2 === 0 ? START_STEP_ID : QUEUE_STEP_ID,
    );
    await queryE2eDatabase('UPDATE "run" SET path = $1::jsonb WHERE id = $2', [
      JSON.stringify(cappedPath),
      started[0].id,
    ]);

    // The Step the Run already stands on is a stay: nothing to append.
    await participant.goto(`/j/${journeyId}/${QUEUE_STEP_ID}`);
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    // A forward move past the cap is refused, and said so in one sentence.
    await participant.getByRole("link", { name: "Ask again" }).click();
    await expect(
      participant.getByText(
        "This journey has gone on too long to continue. Start over to keep going.",
      ),
    ).toBeVisible();

    // Refused means the Participant is left where they stood. The notice
    // travels as a query parameter the page strips once it hydrates, so the
    // Step is what this asserts, not whether the stripping has happened yet.
    await expect(participant).toHaveURL(
      new RegExp(`/j/${journeyId}/${QUEUE_STEP_ID}(\\?|$)`),
    );

    // Starting over is the way out, and it is offered.
    await expect(
      participant.getByRole("button", { name: "Start over" }),
    ).toBeVisible();

    await participant.screenshot({
      path: evidencePath("runner-path-cap", "runner-path-cap.png"),
      fullPage: true,
    });

    // Nothing was recorded: not an entry, and not a backtrack either.
    const capped = await readRuns(versionId);
    expect(capped).toHaveLength(1);
    expect(capped[0].path).toHaveLength(MAX_PATH_LENGTH);
    expect(capped[0].backtrack_count).toBe(0);
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

    // The first Choice is a button on the Start Step; the rest are links.
    for (const [index, label] of route.entries()) {
      await participant
        .getByRole(index === 0 ? "button" : "link", {
          name: label,
          exact: true,
        })
        .click();
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
      path: evidencePath(
        "runner-case-2-restored-choice",
        "runner-case-2-restored-choice.png",
      ),
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

    // Opening the Journey records nothing; the first Choice creates the Run,
    // already holding the Start and the chosen Step.
    await participant.goto(`/j/${firstJourneyId}`);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();
    expect(await readRuns(firstVersionId)).toHaveLength(0);

    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    const afterFirstChoice = await readRuns(firstVersionId);
    expect(afterFirstChoice).toHaveLength(1);
    expect(afterFirstChoice[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    // A refresh resumes the Run where it was, and records no second one.
    await participant.reload();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    const afterReload = await readRuns(firstVersionId);
    expect(afterReload).toHaveLength(1);
    expect(afterReload[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    // A second Participant holds no Run cookie for this Journey, so a step
    // URL sends them to the Start Step rather than into somebody's Run.
    const strangerContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
    });
    try {
      const stranger = await strangerContext.newPage();
      await stranger.goto(`/j/${firstJourneyId}/${QUEUE_STEP_ID}`);
      await expect(stranger).toHaveURL(`${E2E_BASE_URL}/j/${firstJourneyId}`);

      await expect(
        stranger.getByRole("heading", { name: START_STEP_TITLE }),
      ).toBeVisible();
      await stranger.getByRole("button", { name: "Walk away" }).click();
      await expect(stranger.getByText("The end")).toBeVisible();
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
    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    const secondJourneyRuns = await readRuns(secondVersionId);
    expect(secondJourneyRuns).toHaveLength(1);
    expect(secondJourneyRuns[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);
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

    // Reopening the Journey mid-Run offers the way back above the Start
    // Step, which is shown in full beneath it.
    await participant.goto(`/j/${firstJourneyId}`);
    const resume = participant.getByRole("link", {
      name: "Continue where you left off",
    });
    await expect(resume).toBeVisible();
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();
    await expect(
      participant.getByRole("button", { name: "Wait your turn" }),
    ).toBeVisible();
    await participant.screenshot({
      path: evidencePath(
        "runner-run-cookie-and-refresh",
        "runner-run-cookie-and-refresh.png",
      ),
      fullPage: true,
    });

    await resume.click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();
    expect(await readRuns(firstVersionId)).toHaveLength(2);

    // Starting over abandons the Run where it stands — neither ended nor
    // touched — and the next Choice is a new Run.
    await participant.goto(`/j/${firstJourneyId}`);
    await participant.getByRole("button", { name: "Start over" }).click();
    // The offer is what goes; the address stays the same, so it is checked
    // second, once the fresh page is on screen.
    await expect(resume).toHaveCount(0);
    await expect(participant).toHaveURL(`${E2E_BASE_URL}/j/${firstJourneyId}`);
    expect(await readRuns(firstVersionId)).toHaveLength(2);

    await participant.getByRole("button", { name: "Walk away" }).click();
    await expect(participant.getByText("The end")).toBeVisible();

    const afterStartOver = await readRuns(firstVersionId);
    expect(afterStartOver).toHaveLength(3);
    expect(afterStartOver[0].id).toBe(afterFirstChoice[0].id);
    expect(afterStartOver[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);
    expect(afterStartOver[0].ended_at).toBeNull();
    expect(afterStartOver[2].path).toEqual([START_STEP_ID, "turned-back"]);
    expect(afterStartOver[2].ended_at).not.toBeNull();
    expect(afterStartOver[2].participant_id).toBe(
      afterFirstChoice[0].participant_id,
    );
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
    await midRun.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      midRun.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();

    // A rename after publishing changes the Journey row, not what a
    // Participant sees: the header reads version 1's own title.
    const journeyTitle = `Border Crossing ${suffix}`;
    await queryE2eDatabase('UPDATE "journey" SET title = $1 WHERE id = $2', [
      `Renamed after publishing ${suffix}`,
      journeyId,
    ]);
    await midRun.goto(`/j/${journeyId}`);
    await expect(midRun.getByRole("banner")).toHaveText(journeyTitle);
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
    await fresh.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      fresh.getByRole("heading", { name: laterTitle }),
    ).toBeVisible();

    expect(await readRuns(versionOneId)).toHaveLength(1);
    const onVersionTwo = await readRuns(versionTwoId);
    expect(onVersionTwo).toHaveLength(1);
    expect(onVersionTwo[0].path).toEqual([START_STEP_ID, QUEUE_STEP_ID]);

    await fresh.screenshot({
      path: evidencePath("runner-pinned-version", "runner-pinned-version.png"),
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
      path: evidencePath(
        "runner-unavailable-and-unknown",
        "runner-unavailable-and-unknown.png",
      ),
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

/** The `content` of a `<meta property=…>` or `<meta name=…>` tag. */
async function metaContent(page: Page, key: string): Promise<string | null> {
  const attribute = key.startsWith("og:") ? "property" : "name";
  return page.locator(`meta[${attribute}="${key}"]`).getAttribute("content");
}

/** An id no Journey has: every real one is a `crypto.randomUUID()`. */
const UNKNOWN_JOURNEY_ID = "00000000-0000-4000-8000-000000000000";

test("journey-link-preview", async ({ page, context, browser }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const suffix = uniqueSuffix();
  const projectTitle = `Refugee Health ${suffix}`;
  const journeyTitle = `Border Crossing ${suffix}`;
  const journeyDescription = "Goal: cross the border.";

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    journeyTitle,
    journeyDescription,
  );

  // The Project's Theme and the Journey's override, as the Settings tabs
  // store them: the preview must take the override, not the Project's.
  await queryE2eDatabase(
    'UPDATE "project" SET theme_preset = $1 WHERE id = $2',
    ["tide", projectId],
  );
  await queryE2eDatabase(
    'UPDATE "journey" SET theme_preset = $1 WHERE id = $2',
    ["dusk", journeyId],
  );
  await publishDocument(journeyId, runnerDocument());
  const dusk = linkPreviewPalette({ preset: "dusk", accent: null });

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    // A live Journey: what a chat would read off the page.
    await participant.goto(`/j/${journeyId}`);
    await expect(participant).toHaveTitle(`${journeyTitle} · ${APP_NAME}`);
    expect(await metaContent(participant, "og:title")).toBe(journeyTitle);
    expect(await metaContent(participant, "og:description")).toBe(
      journeyDescription,
    );
    expect(await metaContent(participant, "og:url")).toBe(
      `${E2E_BASE_URL}/j/${journeyId}`,
    );
    expect(await metaContent(participant, "og:site_name")).toBe(APP_NAME);
    expect(await metaContent(participant, "og:type")).toBe("article");
    expect(await metaContent(participant, "twitter:card")).toBe(
      "summary_large_image",
    );
    const liveImageUrl = await metaContent(participant, "og:image");
    expect(liveImageUrl).toMatch(
      new RegExp(`^${E2E_BASE_URL}/j/${journeyId}/opengraph-image`),
    );

    // The card itself: a PNG at the Open Graph size, cached briefly, in
    // the Journey's Theme — the dusk paper and the dusk primary stripe.
    const live = await readPng(await participant.request.get(liveImageUrl!));
    expect(live.status).toBe(200);
    expect(live.contentType).toContain("image/png");
    expect(live.cacheControl).toContain("max-age=300");
    expect([live.width, live.height]).toEqual([1200, 630]);
    saveBytes(
      evidencePath("journey-link-preview", "journey-card.png"),
      live.bytes,
    );
    expect(
      await pixelsAt(participant, liveImageUrl!, [
        { x: 40, y: 600 },
        { x: 600, y: 8 },
      ]),
    ).toEqual([dusk.background, dusk.primary]);
    await participant.screenshot({
      path: evidencePath("journey-link-preview", "journey-link-preview.png"),
    });

    // A Step URL previews as the Journey, never as the Step.
    await participant.goto(`/j/${journeyId}`);
    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/${QUEUE_STEP_ID}`,
    );
    expect(await metaContent(participant, "og:title")).toBe(journeyTitle);
    expect(await metaContent(participant, "og:url")).toBe(
      `${E2E_BASE_URL}/j/${journeyId}`,
    );

    // Taken down: the page and its card read exactly as the site root does,
    // and exactly as an id that names no Journey at all.
    await queryE2eDatabase(
      'UPDATE "journey" SET live_version_id = NULL WHERE id = $1',
      [journeyId],
    );
    const unavailablePage = await participant.goto(`/j/${journeyId}`);
    await expect(participant).toHaveTitle(APP_NAME);
    const unavailableTitle = await participant.title();
    const unavailableOgTitle = await metaContent(participant, "og:title");
    const unavailableOgDescription = await metaContent(
      participant,
      "og:description",
    );
    expect(unavailableOgTitle).toBe(APP_NAME);
    expect(unavailableOgDescription).toBe(APP_TAGLINE);
    const unavailableImageUrl = await metaContent(participant, "og:image");
    const unavailable = await readPng(
      await participant.request.get(unavailableImageUrl!),
    );
    expect(unavailable.status).toBe(200);
    expect(unavailable.contentType).toContain("image/png");
    expect([unavailable.width, unavailable.height]).toEqual([1200, 630]);
    expect(unavailable.bytes.equals(live.bytes)).toBe(false);
    saveBytes(
      evidencePath("journey-link-preview", "unavailable-card.png"),
      unavailable.bytes,
    );

    const unknownPage = await participant.goto(`/j/${UNKNOWN_JOURNEY_ID}`);
    expect(unknownPage?.status()).toBe(404);
    const unknown = await readPng(
      await participant.request.get(`/j/${UNKNOWN_JOURNEY_ID}/opengraph-image`),
    );
    expect(unknown.status).toBe(200);
    expect(unknown.bytes.equals(unavailable.bytes)).toBe(true);

    saveBytes(
      capturePath("journey-link-preview", "ac-2-unavailable-journey.txt"),
      Buffer.from(
        [
          `# Ticket 37, criterion 2: an unavailable or unknown Journey previews as the site root does.`,
          `GET /j/<unpublished> -> ${unavailablePage?.status()}`,
          `  <title>: ${unavailableTitle}`,
          `  og:title: ${unavailableOgTitle}`,
          `  og:description: ${unavailableOgDescription}`,
          `  og:image: ${unavailableImageUrl!.replace(journeyId, "<unpublished>")}`,
          `GET /j/<unpublished>/opengraph-image -> ${unavailable.status} ${unavailable.contentType} ${unavailable.width}x${unavailable.height} cache-control: ${unavailable.cacheControl}`,
          `  differs from the live card: ${!unavailable.bytes.equals(live.bytes)}`,
          `GET /j/${UNKNOWN_JOURNEY_ID} -> ${unknownPage?.status()}`,
          `GET /j/${UNKNOWN_JOURNEY_ID}/opengraph-image -> ${unknown.status} ${unknown.contentType} ${unknown.width}x${unknown.height}`,
          `  byte-identical to the unpublished card: ${unknown.bytes.equals(unavailable.bytes)}`,
          "",
        ].join("\n"),
      ),
    );
  } finally {
    await participantContext.close();
  }
});
