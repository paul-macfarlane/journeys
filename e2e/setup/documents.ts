import { randomUUID } from "node:crypto";

import type { Content } from "@/lib/graph/content";
import type { Choice, GraphDocument, Prompt, Step } from "@/lib/graph/document";

import { queryE2eDatabase } from "./session";

/**
 * The documents a spec needs in front of the app, and the ways to put them
 * there without driving the editor or the Publish button: written into a
 * Draft, published straight into a `published_version` row, and — for the
 * participant runner — the Run rows read back afterwards.
 *
 * Writing the `draft` row directly keeps a spec about publishing, previewing,
 * or restoring from also being a spec about the editor (`step-editing.spec.ts`
 * is that one). Every field is written out, exactly as
 * `createDraftDocument()` does, so what is stored here is what the contract
 * reads back.
 */

/** Readable ids, so a person reading a failure can follow the graph. */
export const START_STEP_ID = "start";
export const START_STEP_TITLE = "Border post";

function content(text: string): Content {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function choice(id: string, label: string, targetStepId: string): Choice {
  return { id, label, targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  title: string,
  text: string,
  choices: Choice[],
  outcomeId: string | null,
): Step {
  return {
    id,
    title,
    content: content(text),
    choices,
    prompt: null,
    outcomeId,
    position: null,
  };
}

/**
 * The smallest Journey that publishes: a Start with two Choices, each
 * leading to an Ending, and an Outcome on each Ending. No cycle, nothing
 * unreachable, nothing dangling — `validateForPublish` has no complaint.
 */
export function publishableDocument(): GraphDocument {
  const steps = [
    step(
      START_STEP_ID,
      START_STEP_TITLE,
      "The queue has not moved in an hour.",
      [
        choice("choice-wait", "Wait your turn", "waved-through"),
        choice("choice-leave", "Walk away", "turned-back"),
      ],
      null,
    ),
    step(
      "waved-through",
      "Waved through",
      "The officer stamps the paper and points you on.",
      [],
      "reached-care",
    ),
    step(
      "turned-back",
      "Turned back",
      "You lose your place, and the post closes behind you.",
      [],
      "turned-away",
    ),
  ];

  const outcomes = [
    { id: "reached-care", label: "Reached care" },
    { id: "turned-away", label: "Turned away" },
  ];

  return {
    schemaVersion: 1,
    startStepId: START_STEP_ID,
    allowBack: true,
    steps: Object.fromEntries(steps.map((item) => [item.id, item])),
    outcomes: Object.fromEntries(outcomes.map((item) => [item.id, item])),
    layoutDirection: "TB",
  };
}

/** The middle Step of `runnerDocument()`, the one a Participant backtracks to. */
export const QUEUE_STEP_ID = "queue";
export const QUEUE_STEP_TITLE = "Still waiting";

/**
 * The Journey the participant runner is walked on: `publishableDocument()`
 * with one Step of depth added, so a Participant can reach an Ending, go back
 * to the middle Step, and choose differently from there. Two Choices lead out
 * of the Start and two out of the middle Step, and both Endings carry an
 * Outcome, so this publishes exactly as the flatter document does.
 */
export function runnerDocument(): GraphDocument {
  const steps = [
    step(
      START_STEP_ID,
      START_STEP_TITLE,
      "The queue has not moved in an hour.",
      [
        choice("choice-wait", "Wait your turn", QUEUE_STEP_ID),
        choice("choice-leave", "Walk away", "turned-back"),
      ],
      null,
    ),
    step(
      QUEUE_STEP_ID,
      QUEUE_STEP_TITLE,
      "The line inches forward, then stops again.",
      [
        choice("choice-papers", "Show your papers", "waved-through"),
        choice("choice-give-up", "Leave the queue", "turned-back"),
      ],
      null,
    ),
    step(
      "waved-through",
      "Waved through",
      "The officer stamps the paper and points you on.",
      [],
      "reached-care",
    ),
    step(
      "turned-back",
      "Turned back",
      "You lose your place, and the post closes behind you.",
      [],
      "turned-away",
    ),
  ];

  const outcomes = [
    { id: "reached-care", label: "Reached care" },
    { id: "turned-away", label: "Turned away" },
  ];

  return {
    schemaVersion: 1,
    startStepId: START_STEP_ID,
    allowBack: true,
    steps: Object.fromEntries(steps.map((item) => [item.id, item])),
    outcomes: Object.fromEntries(outcomes.map((item) => [item.id, item])),
    layoutDirection: "TB",
  };
}

/** The three Prompts `promptDocument()` asks, by the Step that asks each. */
export const START_PROMPT = "How are you feeling as you arrive?";
export const QUEUE_PROMPT = "What is going through your mind while you wait?";
export const ENDING_PROMPT = "What would you do differently?";

function prompt(label: string, required: boolean, decides = false): Prompt {
  return { type: "free_text", label, required, decides };
}

/**
 * `runnerDocument()` with a Prompt on three of its Steps: an optional one on
 * the Start, a required one on the middle Step, and an optional one on the
 * "Waved through" Ending — the three places a Prompt behaves differently in
 * the runner. "Turned back" asks nothing, so a walk that way records no
 * Response at all.
 */
export function promptDocument(): GraphDocument {
  const document = runnerDocument();
  document.steps[START_STEP_ID].prompt = prompt(START_PROMPT, false);
  document.steps[QUEUE_STEP_ID].prompt = prompt(QUEUE_PROMPT, true);
  document.steps["waved-through"].prompt = prompt(ENDING_PROMPT, false);
  return document;
}

/** The deciding Prompt `decidingDocument()` asks on the queue Step. */
export const DECIDING_PROMPT = "What do you do when the officer looks up?";

/**
 * `runnerDocument()` with a deciding Prompt (ticket 43) on the queue Step:
 * its Response, not a button, picks between "Show your papers" and "Leave
 * the queue". The e2e server runs with no gateway key, so the judge never
 * answers here and the runner always falls back to the Choices.
 */
export function decidingDocument(): GraphDocument {
  const document = runnerDocument();
  document.steps[QUEUE_STEP_ID].prompt = prompt(DECIDING_PROMPT, true, true);
  return document;
}

/**
 * A Journey with a loop in it, which a Published Version is allowed to hold
 * since ticket 18: the queue Step leads back to the Start, so a Participant
 * may walk the same two Steps as many times as they like before showing their
 * papers. The Start is the loop-closing Step — from there the queue Step is
 * both the entry behind the Participant and a Choice in front of them, which
 * is the one navigation the path index has to settle.
 */
export function loopDocument(): GraphDocument {
  const steps = [
    step(
      START_STEP_ID,
      START_STEP_TITLE,
      "The queue has not moved in an hour.",
      [choice("choice-wait", "Wait your turn", QUEUE_STEP_ID)],
      null,
    ),
    step(
      QUEUE_STEP_ID,
      QUEUE_STEP_TITLE,
      "The line inches forward, then stops again.",
      [
        choice("choice-ask", "Ask again", START_STEP_ID),
        choice("choice-papers", "Show your papers", "waved-through"),
      ],
      null,
    ),
    step(
      "waved-through",
      "Waved through",
      "The officer stamps the paper and points you on.",
      [],
      "reached-care",
    ),
  ];

  const outcomes = [{ id: "reached-care", label: "Reached care" }];

  return {
    schemaVersion: 1,
    startStepId: START_STEP_ID,
    allowBack: true,
    steps: Object.fromEntries(steps.map((item) => [item.id, item])),
    outcomes: Object.fromEntries(outcomes.map((item) => [item.id, item])),
    layoutDirection: "TB",
  };
}

/**
 * The smallest Draft with an arrow attached to neither end of a selection:
 * a Start with a Choice to each of two Steps, and a Choice from the first of
 * those to the second, so whichever box is open one arrow is always someone
 * else's. Readable Choice ids, because the canvas spec names them.
 */
export function dimmingDocument(): GraphDocument {
  const steps = [
    step(
      START_STEP_ID,
      START_STEP_TITLE,
      "The queue has not moved in an hour.",
      [
        choice("to-clinic", "Find the clinic", "clinic"),
        choice("to-ward", "Walk away", "ward"),
      ],
      null,
    ),
    step(
      "clinic",
      "Clinic tent",
      "A nurse looks up from her notes.",
      [choice("clinic-to-ward", "Ask for help", "ward")],
      null,
    ),
    step(
      "ward",
      "Waved through",
      "The officer stamps the paper and points you on.",
      [],
      "reached-care",
    ),
  ];

  return {
    schemaVersion: 1,
    startStepId: START_STEP_ID,
    allowBack: true,
    steps: Object.fromEntries(steps.map((item) => [item.id, item])),
    outcomes: {
      "reached-care": { id: "reached-care", label: "Reached care" },
    },
    layoutDirection: "TB",
  };
}

/** Writes a document into a Journey's Draft, replacing what is there. */
export async function writeDraftDocument(
  journeyId: string,
  document: GraphDocument,
): Promise<void> {
  await queryE2eDatabase(
    'UPDATE "draft" SET document = $1::jsonb, updated_at = now() WHERE journey_id = $2',
    [JSON.stringify(document), journeyId],
  );
}

/**
 * Publishes a document straight into a `published_version` row and points the
 * Journey's live pointer at it, returning the new version's id.
 *
 * Writing the row keeps a spec about the participant runner from also being a
 * spec about the Publish button (`publish.spec.ts` is that one), and it is the
 * only way to publish two versions of a Journey whose Draft a spec never
 * touched. Title and description are copied from the `journey` row exactly as
 * publishing does, unless the caller overrides them.
 */
export async function publishDocument(
  journeyId: string,
  document: GraphDocument,
  overrides: { title?: string; description?: string } = {},
): Promise<string> {
  const versionId = randomUUID();

  await queryE2eDatabase(
    `INSERT INTO "published_version" (id, journey_id, version_number, title, description, document)
     SELECT $1, j.id,
            COALESCE((SELECT MAX(v.version_number) FROM "published_version" v WHERE v.journey_id = j.id), 0) + 1,
            COALESCE($3::text, j.title),
            COALESCE($4::text, j.description),
            $5::jsonb
     FROM "journey" j WHERE j.id = $2`,
    [
      versionId,
      journeyId,
      overrides.title ?? null,
      overrides.description ?? null,
      JSON.stringify(document),
    ],
  );

  await queryE2eDatabase(
    'UPDATE "journey" SET live_version_id = $1 WHERE id = $2',
    [versionId, journeyId],
  );

  return versionId;
}

/** A `run` row as the specs read it back — the whole of what a Run records. */
export type RunRow = {
  id: string;
  participant_id: string;
  path: string[];
  backtrack_count: number;
  ended_at: Date | null;
  outcome_id: string | null;
};

/**
 * Every Run of one Published Version, oldest first. A Run is invisible from
 * the browser by design (a Participant is anonymous and authors' analytics are
 * ticket 10), so the row is the only place to prove what was recorded.
 */
export function readRuns(versionId: string): Promise<RunRow[]> {
  return queryE2eDatabase<RunRow>(
    'SELECT id, participant_id, path, backtrack_count, ended_at, outcome_id FROM "run" WHERE version_id = $1 ORDER BY started_at',
    [versionId],
  );
}

/** A `response` row as the specs read it back: the Step, the words, the Run. */
export type StoredResponse = { run_id: string; step_id: string; text: string };

/**
 * Every Response recorded against any Run of one Published Version, oldest
 * first. Like a Run, a Response is invisible from the Participant's side by
 * design, so the row is where a spec proves what was and was not written.
 */
export function readResponses(versionId: string): Promise<StoredResponse[]> {
  return queryE2eDatabase<StoredResponse>(
    `SELECT r.run_id, r.step_id, r.text
     FROM "response" r JOIN "run" ON "run".id = r.run_id
     WHERE "run".version_id = $1
     ORDER BY r.created_at, r.step_id`,
    [versionId],
  );
}
