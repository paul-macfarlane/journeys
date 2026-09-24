import { expect, test, type Page } from "@playwright/test";

import { graphDocumentSchema, type GraphDocument } from "@/lib/graph/document";

import {
  chooseStep,
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  ENDING_PROMPT,
  promptDocument,
  publishDocument,
  QUEUE_PROMPT,
  QUEUE_STEP_ID,
  QUEUE_STEP_TITLE,
  readResponses,
  readRuns,
  START_PROMPT,
  START_STEP_ID,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Seam B for ticket 12: an Author attaches a Prompt to a Step, a Participant
 * answers it (or does not) before choosing, and the Author reads what was
 * written — while Preview, walked the same way, writes nothing at all.
 *
 * Every Participant browses in a context of their own, as in
 * `runner.spec.ts`, and every Response is checked twice: what the screen
 * showed, and what the row holds. The answers typed here are the spec's own
 * fixture text, never a real Participant's.
 */

test.setTimeout(120_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  // Deleting the Project cascades Journeys → Published Versions → Runs →
  // Responses.
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** The Draft exactly as the editor stored it. */
async function readDraft(journeyId: string): Promise<GraphDocument> {
  const rows = await queryE2eDatabase<{ document: unknown }>(
    'SELECT document FROM "draft" WHERE journey_id = $1',
    [journeyId],
  );
  expect(rows).toHaveLength(1);
  return graphDocumentSchema.parse(rows[0].document);
}

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
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  return { projectId, journeyId };
}

/** The Step panel's deciding option (ticket 49), named for what it does. */
const DECIDES_LABEL = "AI decides the next step from the response";

/** The Prompt's textbox on a runner or Preview screen, found by its question. */
function promptBox(page: Page, label: string) {
  return page.getByRole("textbox", { name: label });
}

/**
 * Waits until React is running on a runner step page before a box that
 * already shows an answer is typed into. React DOM's hydration of a
 * `<textarea>` with a non-empty default sets its value back to that default
 * (`react-dom-client`: `element.value = textContent`), so anything typed
 * before the bundle ran is lost — and under load the bundle lands a second
 * or more after the page is readable. A step page arrives with `?at` (after
 * Back) or `?notice` (after a save), and `RunHistory` strips them in its
 * first effect, so the bare step address is the page saying React is up. A
 * box whose default is empty needs no wait: the reset only restores a
 * non-empty default.
 */
async function hydrated(
  participant: Page,
  journeyId: string,
  stepId: string,
): Promise<void> {
  await expect(participant).toHaveURL(
    `${E2E_BASE_URL}/j/${journeyId}/${stepId}`,
  );
}

test("prompts-author-attaches-a-prompt", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const { projectId, journeyId } = await startJourney(page);

  // The Start is what the panel opens on, and it asks nothing yet: the
  // Prompt field is empty, and "Required" is not offered for a Prompt that
  // does not exist. The notice is there regardless — it is about the
  // question an Author is about to write.
  await expect(page.getByLabel("Step title")).toHaveValue("Start");
  const promptField = page.getByLabel("Prompt", { exact: true });
  await expect(promptField).toHaveValue("");
  await expect(page.getByLabel(/^Required/)).toHaveCount(0);
  await expect(
    page.getByText("Responses are anonymous. Don't ask for a name"),
  ).toBeVisible();

  // Writing the question attaches the Prompt, optional by default, and the
  // Draft autosaves it.
  await promptField.fill(START_PROMPT);
  const required = page.getByLabel(/^Required/);
  await expect(required).toBeVisible();
  await expect(required).not.toBeChecked();
  await expect
    .poll(async () => {
      const draft = await readDraft(journeyId);
      return draft.steps[draft.startStepId].prompt;
    })
    .toEqual({
      type: "free_text",
      label: START_PROMPT,
      required: false,
      decides: false,
    });

  await required.check();
  await expect
    .poll(async () => {
      const draft = await readDraft(journeyId);
      return draft.steps[draft.startStepId].prompt;
    })
    .toEqual({
      type: "free_text",
      label: START_PROMPT,
      required: true,
      decides: false,
    });

  // The deciding option (ticket 49) is offered as soon as the Step has a
  // Prompt, and says why it cannot be turned on yet: a judge needs two
  // Choices to pick between, and the Start has none. The copy says what a
  // Participant will meet.
  const decides = page.getByLabel(DECIDES_LABEL);
  await expect(decides).toBeVisible();
  await expect(decides).toBeDisabled();
  await expect(decides).not.toBeChecked();
  await expect(page.getByText("Needs two or more choices.")).toBeVisible();
  await expect(
    page.getByText(
      "Participants answer and press Continue; the choices appear only when the judge is unsure.",
    ),
  ).toBeVisible();

  // One Choice is not yet a choice: the option stays off. The Choice is
  // pointed at a new Step, which the panel then opens on, so the Start is
  // found again by name.
  await page.getByRole("button", { name: "Add choice", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill("Wait your turn");
  await page
    .getByLabel("Target", { exact: true })
    .selectOption({ label: "New step" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Step title")).toHaveValue("Untitled step");
  await chooseStep(page, "Start");
  await expect(page.getByLabel(DECIDES_LABEL)).toBeDisabled();
  await expect(page.getByText("Needs two or more choices.")).toBeVisible();

  // A second Choice, and the option can be turned on.
  await page.getByRole("button", { name: "Add choice", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill("Walk away");
  await page
    .getByLabel("Target", { exact: true })
    .selectOption({ label: "Untitled step" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel(DECIDES_LABEL)).toBeEnabled();
  await expect(page.getByText("Needs two or more choices.")).toHaveCount(0);

  await page.getByLabel(DECIDES_LABEL).check();
  await expect
    .poll(async () => {
      const draft = await readDraft(journeyId);
      return draft.steps[draft.startStepId].prompt;
    })
    .toEqual({
      type: "free_text",
      label: START_PROMPT,
      required: true,
      decides: true,
    });

  await page.screenshot({
    path: evidencePath(
      "prompts-author-attaches-a-prompt",
      "prompts-author-attaches-a-prompt.png",
    ),
    fullPage: true,
  });

  // The Responses tab lists the Step as soon as it asks, with nothing
  // written yet. The tab reads the page's own props, so it is opened fresh.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}?tab=responses`);
  await openTab(page, "Responses");
  const startSection = page.getByRole("region", { name: "Start", exact: true });
  await expect(startSection.getByText(START_PROMPT)).toBeVisible();
  await expect(startSection.getByText("No responses yet.")).toBeVisible();

  // Blanking the question takes the Prompt away, "Required" and the
  // deciding option with it.
  await openTab(page, "Editor");
  await expect(page.getByLabel("Step title")).toHaveValue("Start");
  await page.getByLabel("Prompt", { exact: true }).fill("");
  await expect(page.getByLabel(/^Required/)).toHaveCount(0);
  await expect(page.getByLabel(DECIDES_LABEL)).toHaveCount(0);
  await expect
    .poll(async () => {
      const draft = await readDraft(journeyId);
      return draft.steps[draft.startStepId].prompt;
    })
    .toBeNull();
});

test("prompts-participant-answers-and-author-reads", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const { projectId, journeyId } = await startJourney(page);
  // In the Draft as well as live, the way a Journey an Author built and
  // published would be: the Responses tab names Steps from the Draft.
  await writeDraftDocument(journeyId, promptDocument());
  const versionId = await publishDocument(journeyId, promptDocument());

  const startAnswer = "Nervous, and glad to have made it this far.";
  const queueAnswer = "Whether the paper in my pocket is the right one.";
  const endingAnswer = "Nothing. I would wait again.";

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();

    // The Start asks an optional question, and says so. Left blank, the
    // first Choice creates the Run and records no Response.
    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE }),
    ).toBeVisible();
    const startBox = promptBox(participant, `${START_PROMPT} (optional)`);
    await expect(startBox).toBeVisible();
    await expect(startBox).toHaveAttribute("aria-required", "false");

    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(participant).toHaveURL(
      `${E2E_BASE_URL}/j/${journeyId}/${QUEUE_STEP_ID}`,
    );
    expect(await readRuns(versionId)).toHaveLength(1);
    expect(await readResponses(versionId)).toEqual([]);

    // The middle Step's Prompt is required: the server refuses the Choice
    // while the box is blank, refusing at the field itself, and the Run has
    // not moved.
    const queueBox = promptBox(participant, QUEUE_PROMPT);
    await expect(queueBox).toBeVisible();
    await expect(queueBox).toHaveAttribute("aria-required", "true");
    await participant.getByRole("button", { name: "Show your papers" }).click();
    await expect(queueBox).toHaveAttribute("aria-invalid", "true");
    await expect(
      participant
        .getByRole("alert")
        .filter({ hasText: "This step needs a response before you go on." }),
    ).toBeVisible();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();
    expect((await readRuns(versionId))[0].path).toEqual([
      START_STEP_ID,
      QUEUE_STEP_ID,
    ]);
    expect(await readResponses(versionId)).toEqual([]);

    await queueBox.fill(queueAnswer);
    await participant.screenshot({
      path: evidencePath(
        "prompts-participant-answers-and-author-reads",
        "prompts-participant-answers-and-author-reads-queue.png",
      ),
      fullPage: true,
    });

    // Answered, the Choice goes through: the Response is stored against the
    // Run and the Step it was asked on, and the Run has moved on.
    await participant.getByRole("button", { name: "Show your papers" }).click();
    await expect(
      participant.getByRole("heading", { name: "Waved through" }),
    ).toBeVisible();
    await expect(participant.getByText("The end")).toBeVisible();

    const [run] = await readRuns(versionId);
    expect(run.path).toEqual([START_STEP_ID, QUEUE_STEP_ID, "waved-through"]);
    expect(await readResponses(versionId)).toEqual([
      { run_id: run.id, step_id: QUEUE_STEP_ID, text: queueAnswer },
    ]);

    // The Ending asks too, with a button of its own since there is nothing
    // to choose; saving says so and shows the answer back.
    const endingBox = promptBox(participant, `${ENDING_PROMPT} (optional)`);
    await endingBox.fill(endingAnswer);
    await participant.getByRole("button", { name: "Save response" }).click();
    await expect(participant.getByRole("status")).toHaveText(
      "Your response was saved.",
    );
    await expect(
      promptBox(participant, `${ENDING_PROMPT} (optional)`),
    ).toHaveValue(endingAnswer);
    expect(await readResponses(versionId)).toEqual([
      { run_id: run.id, step_id: QUEUE_STEP_ID, text: queueAnswer },
      { run_id: run.id, step_id: "waved-through", text: endingAnswer },
    ]);

    // Emptied and saved again, the Ending's optional answer is taken back:
    // the box showed it, and the Participant chose not to keep it.
    await hydrated(participant, journeyId, "waved-through");
    await promptBox(participant, `${ENDING_PROMPT} (optional)`).fill("");
    await participant.getByRole("button", { name: "Save response" }).click();
    await expect(participant.getByRole("status")).toHaveText(
      "Your response was removed.",
    );
    expect(await readResponses(versionId)).toEqual([
      { run_id: run.id, step_id: QUEUE_STEP_ID, text: queueAnswer },
    ]);
    await promptBox(participant, `${ENDING_PROMPT} (optional)`).fill(
      endingAnswer,
    );
    await participant.getByRole("button", { name: "Save response" }).click();
    await expect(participant.getByRole("status")).toHaveText(
      "Your response was saved.",
    );

    // Back to the middle Step: the answer given there is shown again, and
    // answering differently replaces it rather than adding a second one.
    await participant.getByRole("link", { name: "← Back" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE }),
    ).toBeVisible();
    await expect(promptBox(participant, QUEUE_PROMPT)).toHaveValue(queueAnswer);
    await hydrated(participant, journeyId, QUEUE_STEP_ID);
    await promptBox(participant, QUEUE_PROMPT).fill(startAnswer);
    await participant.getByRole("button", { name: "Show your papers" }).click();
    await expect(
      participant.getByRole("heading", { name: "Waved through" }),
    ).toBeVisible();
    expect(await readResponses(versionId)).toEqual([
      { run_id: run.id, step_id: QUEUE_STEP_ID, text: startAnswer },
      { run_id: run.id, step_id: "waved-through", text: endingAnswer },
    ]);
  } finally {
    await participantContext.close();
  }

  // The Author reads every answer per Step, and nothing that says whose it
  // was: the Start asked and got nothing, the middle Step and the Ending
  // each show what was written.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}?tab=responses`);
  await openTab(page, "Responses");

  const startSection = page.getByRole("region", { name: START_STEP_TITLE });
  await expect(startSection.getByText(START_PROMPT)).toBeVisible();
  await expect(startSection.getByText("No responses yet.")).toBeVisible();

  const queueSection = page.getByRole("region", { name: QUEUE_STEP_TITLE });
  await expect(queueSection.getByText(QUEUE_PROMPT)).toBeVisible();
  const queueList = queueSection.getByRole("list", {
    name: `Responses to ${QUEUE_STEP_TITLE}`,
  });
  await expect(queueList.getByRole("listitem")).toHaveText([startAnswer]);
  await expect(queueSection.getByText("1 response")).toBeVisible();

  const endingSection = page.getByRole("region", { name: "Waved through" });
  await expect(
    endingSection.getByRole("list").getByRole("listitem"),
  ).toHaveText([endingAnswer]);

  const [{ id: runId, participant_id: participantId }] =
    await readRuns(versionId);
  const pageText = await page.locator("main").innerText();
  expect(pageText).not.toContain(runId);
  expect(pageText).not.toContain(participantId);

  await page.screenshot({
    path: evidencePath(
      "prompts-participant-answers-and-author-reads",
      "prompts-participant-answers-and-author-reads.png",
    ),
    fullPage: true,
  });

  // A second Author, not a Member: the Journey page — Responses tab and all
  // — is not theirs to see.
  const strangerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const stranger = await signInAs(strangerContext);
    mintedAuthorIds.push(stranger.id);
    const strangerPage = await strangerContext.newPage();

    const response = await strangerPage.goto(
      `/projects/${projectId}/journeys/${journeyId}?tab=responses`,
    );
    expect(response?.status()).toBe(404);
    await expect(strangerPage.getByText(startAnswer)).toHaveCount(0);
  } finally {
    await strangerContext.close();
  }
});

test("prompts-preview-stores-nothing", async ({ page, context }) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);

  const { projectId, journeyId } = await startJourney(page);
  await writeDraftDocument(journeyId, promptDocument());
  // Published as well, so "nothing stored" is checked against the one place
  // a Response could be stored — a Run of this version — and not just
  // against a Journey that could not have recorded anything anyway.
  const versionId = await publishDocument(journeyId, promptDocument());

  const previewPath = `/projects/${projectId}/journeys/${journeyId}/preview`;
  await page.goto(previewPath);
  await expect(page.getByText("Preview — nothing is recorded.")).toBeVisible();

  // The Start's optional question, answered: the Choice goes through and
  // no Run or Response comes into being.
  await promptBox(page, `${START_PROMPT} (optional)`).fill("Anxious.");
  await page.getByRole("button", { name: "Wait your turn" }).click();
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}${previewPath}/${QUEUE_STEP_ID}`,
  );

  // The required Prompt is required here too — the same box, the same
  // server refusal — and then walks on to the Ending.
  const queueBox = promptBox(page, QUEUE_PROMPT);
  await expect(queueBox).toHaveAttribute("aria-required", "true");
  await page.getByRole("button", { name: "Show your papers" }).click();
  await expect(queueBox).toHaveAttribute("aria-invalid", "true");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "This step needs a response before you go on." }),
  ).toBeVisible();
  await queueBox.fill("Whether I will be believed.");
  await page.getByRole("button", { name: "Show your papers" }).click();
  await expect(
    page.getByRole("heading", { name: "Waved through" }),
  ).toBeVisible();

  // The Ending's own button says what would have happened live.
  await promptBox(page, `${ENDING_PROMPT} (optional)`).fill("Nothing.");
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Nothing was recorded. In the live journey, this response would be saved.",
  );

  await page.screenshot({
    path: evidencePath(
      "prompts-preview-stores-nothing",
      "prompts-preview-stores-nothing.png",
    ),
    fullPage: true,
  });

  expect(await readRuns(versionId)).toEqual([]);
  expect(await readResponses(versionId)).toEqual([]);
});
