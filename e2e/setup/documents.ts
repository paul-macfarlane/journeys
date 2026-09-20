import type { Content } from "@/lib/graph/content";
import type { Choice, GraphDocument, Step } from "@/lib/graph/document";

import { queryE2eDatabase } from "./session";

/**
 * Draft documents a spec needs in front of the app, and the one way to put
 * them there.
 *
 * The editor arrives with ticket 08, so a Draft bigger than the one Step a
 * new Journey is created with can only be written straight into the `draft`
 * row. Every field is written out, exactly as `createDraftDocument()` does,
 * so what is stored here is what the contract reads back.
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
