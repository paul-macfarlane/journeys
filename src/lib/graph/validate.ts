import type { GraphDocument } from "@/lib/graph/document";
import { hasOutcome, hasStep, isEnding, stepName } from "@/lib/graph/document";

/**
 * Publish-time validation. Structural validation (`graphDocumentSchema`) runs
 * at every write; these are the rules a Draft may break while an Author is
 * still working, and must not break at the moment it becomes a Published
 * Version that participants walk.
 *
 * Pure and deterministic: the same document always produces the same list
 * regardless of the `steps`/`outcomes` key order Postgres's jsonb hands
 * back, because Steps are visited breadth-first from the Start, following
 * each Step's own Choice order — never `layout.ts`'s dagre layout, which
 * this module must not import (`layout.ts` already imports `PublishProblem`
 * from here). A Step unreachable from the Start has no such position, so
 * every unreachable Step is appended last, sorted by id. Within one Step,
 * problems are grouped by rule so the Publish dialog's list stays stable.
 */

export type PublishProblemCode =
  | "missing-start"
  | "dangling-choice-target"
  | "empty-choice-label"
  | "unreachable-step"
  | "unknown-outcome";

/**
 * One reason a Draft cannot be published. `stepId` and `choiceId` are the
 * addresses the editor needs to take an Author to the thing to fix.
 */
export type PublishProblem = {
  code: PublishProblemCode;
  message: string;
  stepId?: string;
  choiceId?: string;
};

/**
 * Every Step in publish order: breadth-first from the Start, following each
 * Step's own Choice order, so the order comes from the graph rather than
 * from `document.steps`'s own key order (which Postgres's jsonb does not
 * keep). Any Step the Start cannot reach has no such position, so it is
 * appended last, sorted by id.
 */
function publishOrder(
  document: GraphDocument,
  startStepId: string,
): { order: string[]; reached: Set<string> } {
  const reached = new Set<string>();
  const order: string[] = [];
  const pending = [startStepId];

  while (pending.length > 0) {
    const stepId = pending.shift();
    if (stepId === undefined || reached.has(stepId)) {
      continue;
    }
    if (!hasStep(document, stepId)) {
      continue;
    }
    reached.add(stepId);
    order.push(stepId);
    for (const choice of document.steps[stepId].choices) {
      pending.push(choice.targetStepId);
    }
  }

  const unreached = Object.keys(document.steps)
    .filter((stepId) => !reached.has(stepId))
    .sort();

  return { order: [...order, ...unreached], reached };
}

export function validateForPublish(document: GraphDocument): PublishProblem[] {
  const problems: PublishProblem[] = [];

  // `startStepId` is a single pointer, so "more than one Start" cannot be
  // written down; "exactly one Start" is therefore just "the pointer names a
  // Step that exists".
  const startExists = hasStep(document, document.startStepId);
  if (!startExists) {
    // No `stepId`: the pointer names nothing, so there is no Step to select.
    problems.push({
      code: "missing-start",
      message: "This journey has no start step",
    });
  }

  // With no Start there is nowhere to walk from, so every Step falls back to
  // the "unreached, sorted by id" order below.
  const { order, reached } = startExists
    ? publishOrder(document, document.startStepId)
    : { order: Object.keys(document.steps).sort(), reached: new Set<string>() };

  for (const stepId of order) {
    const step = document.steps[stepId];

    for (const choice of step.choices) {
      if (!hasStep(document, choice.targetStepId)) {
        problems.push({
          code: "dangling-choice-target",
          message: `Step "${stepName(step)}" has a choice pointing at a step that no longer exists`,
          stepId,
          choiceId: choice.id,
        });
      }
    }

    // A Choice drawn on the map starts with no label, and the editor reads
    // that as "Untitled choice" while the Author works; a Participant would
    // be shown a link with no text and no accessible name, so a Published
    // Version may not carry one. Whitespace is no label either.
    for (const choice of step.choices) {
      if (choice.label.trim().length === 0) {
        problems.push({
          code: "empty-choice-label",
          message: `Step "${stepName(step)}" has a choice with no label`,
          stepId,
          choiceId: choice.id,
        });
      }
    }

    // With no Start there is nothing to walk out from, and calling every
    // Step unreachable would bury the one problem worth fixing.
    if (startExists && !reached.has(stepId)) {
      problems.push({
        code: "unreachable-step",
        message: `Step "${stepName(step)}" cannot be reached from the start`,
        stepId,
      });
    }

    // An Ending needs no Outcome; a tag naming an Outcome the document no
    // longer defines is still broken data. Only an Ending carries one at
    // all: an outcome id left on a Step that still has Choices is ignored.
    if (
      isEnding(step) &&
      step.outcomeId !== null &&
      !hasOutcome(document, step.outcomeId)
    ) {
      problems.push({
        code: "unknown-outcome",
        message: `Ending "${stepName(step)}" is tagged with an outcome that no longer exists`,
        stepId,
      });
    }
  }

  return problems;
}
