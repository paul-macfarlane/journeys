import {
  hasStep,
  stepName,
  walkSteps,
  type GraphDocument,
} from "@/lib/graph/document";

/**
 * The Responses tab's arrangement of what a Journey has recorded: one group
 * per Step, each a plain list of answers. Pure and database-free — the page
 * reads the rows and the Draft, and this decides what a Member sees.
 */

/** A Response as the tab reads it: which Step, what was written, and when. */
export type ResponseRow = {
  stepId: string;
  text: string;
  createdAt: Date;
};

export type StepResponses = {
  stepId: string;
  /** The Step's name in the Draft, or its id once the Draft no longer has it. */
  title: string;
  /** What the Draft asks on this Step, or null when it no longer asks anything. */
  promptLabel: string | null;
  /** Oldest first, as the rows arrive; never a Run or Participant identifier. */
  responses: { text: string; createdAt: Date }[];
};

/**
 * Every Step the Draft asks a Prompt on, in walk order from the Start and
 * whether or not anything has been written yet, followed by any other Step
 * a Response was recorded against — a Prompt since removed, or a Step only
 * an older Published Version had — in the order their rows first appear.
 * Nothing a Participant wrote is dropped because the Author has moved on.
 */
export function groupResponsesByStep(
  document: GraphDocument,
  rows: ResponseRow[],
): StepResponses[] {
  const groups = new Map<string, StepResponses>();

  // The order a Participant meets the Steps in (`walkSteps`), not the map's
  // — the map is laid out on the client — and not the document's own, which
  // jsonb does not keep.
  for (const stepId of walkSteps(document).order) {
    const step = document.steps[stepId];
    if (step.prompt === null) continue;
    groups.set(step.id, {
      stepId: step.id,
      title: stepName(step),
      promptLabel: step.prompt.label,
      responses: [],
    });
  }

  for (const row of rows) {
    let group = groups.get(row.stepId);
    if (!group) {
      const step = hasStep(document, row.stepId)
        ? document.steps[row.stepId]
        : null;
      group = {
        stepId: row.stepId,
        title: step ? stepName(step) : row.stepId,
        promptLabel: null,
        responses: [],
      };
      groups.set(row.stepId, group);
    }
    group.responses.push({ text: row.text, createdAt: row.createdAt });
  }

  return [...groups.values()];
}
