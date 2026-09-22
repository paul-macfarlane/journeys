import { stepName, type GraphDocument } from "@/lib/graph/document";

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
 * Every Step the Draft asks a Prompt on, in the Draft's order and whether or
 * not anything has been written yet, followed by any other Step a Response
 * was recorded against — a Prompt since removed, or a Step only an older
 * Published Version had — in the order their rows first appear. Nothing a
 * Participant wrote is dropped because the Author has moved on.
 */
export function groupResponsesByStep(
  document: GraphDocument,
  rows: ResponseRow[],
): StepResponses[] {
  const groups = new Map<string, StepResponses>();

  for (const step of Object.values(document.steps)) {
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
      // Own property only: the map is parsed JSON, and a Step id such as
      // "constructor" must not find a prototype method.
      const step = Object.hasOwn(document.steps, row.stepId)
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
