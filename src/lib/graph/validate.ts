import type { GraphDocument, Step } from "@/lib/graph/document";
import { isEnding } from "@/lib/graph/document";

/**
 * Publish-time validation. Structural validation (`graphDocumentSchema`) runs
 * at every write; these are the rules a Draft may break while an Author is
 * still working, and must not break at the moment it becomes a Published
 * Version that participants walk.
 *
 * Pure and deterministic: the same document always produces the same list,
 * grouped by rule and, within a rule, in Step order, so a canvas can render it
 * without sorting.
 */

export type PublishProblemCode =
  | "missing-start"
  | "dangling-choice-target"
  | "unreachable-step"
  | "ending-without-outcome"
  | "unknown-outcome"
  | "cycle";

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

/** What an Author calls the Step, falling back to its id when untitled. */
function nameOf(step: Step): string {
  return step.title.trim().length > 0 ? step.title : step.id;
}

/** Every Step a participant could arrive at, walking out from the Start. */
function reachableFrom(document: GraphDocument, startStepId: string) {
  const reached = new Set<string>();
  const pending = [startStepId];

  while (pending.length > 0) {
    const stepId = pending.pop();
    if (stepId === undefined || reached.has(stepId)) {
      continue;
    }
    const step = document.steps[stepId];
    if (step === undefined) {
      continue;
    }
    reached.add(stepId);
    for (const choice of step.choices) {
      pending.push(choice.targetStepId);
    }
  }

  return reached;
}

export function validateForPublish(document: GraphDocument): PublishProblem[] {
  const problems: PublishProblem[] = [];
  const entries = Object.entries(document.steps);

  // `startStepId` is a single pointer, so "more than one Start" cannot be
  // written down; "exactly one Start" is therefore just "the pointer names a
  // Step that exists".
  const startExists = document.steps[document.startStepId] !== undefined;
  if (!startExists) {
    // No `stepId`: the pointer names nothing, so there is no Step to select.
    problems.push({
      code: "missing-start",
      message: "This journey has no start step",
    });
  }

  for (const [stepId, step] of entries) {
    for (const choice of step.choices) {
      if (document.steps[choice.targetStepId] === undefined) {
        problems.push({
          code: "dangling-choice-target",
          message: `Step "${nameOf(step)}" has a choice pointing at a step that no longer exists`,
          stepId,
          choiceId: choice.id,
        });
      }
    }
  }

  // With no Start there is nothing to walk out from, and calling every Step
  // unreachable would bury the one problem worth fixing.
  if (startExists) {
    const reached = reachableFrom(document, document.startStepId);
    for (const [stepId, step] of entries) {
      if (!reached.has(stepId)) {
        problems.push({
          code: "unreachable-step",
          message: `Step "${nameOf(step)}" cannot be reached from the start`,
          stepId,
        });
      }
    }
  }

  for (const [stepId, step] of entries) {
    // Only an Ending carries an Outcome; an outcome id left on a Step that
    // still has Choices is ignored rather than reported.
    if (!isEnding(step)) {
      continue;
    }
    if (step.outcomeId === null) {
      problems.push({
        code: "ending-without-outcome",
        message: `Ending "${nameOf(step)}" has no outcome`,
        stepId,
      });
      continue;
    }
    if (document.outcomes[step.outcomeId] === undefined) {
      problems.push({
        code: "unknown-outcome",
        message: `Ending "${nameOf(step)}" is tagged with an outcome that no longer exists`,
        stepId,
      });
    }
  }

  // A Choice closes a cycle when its target can walk back to the Step the
  // Choice is on — a Choice onto its own Step included. A Choice whose target
  // does not exist is dangling, not a loop.
  for (const [stepId, step] of entries) {
    for (const choice of step.choices) {
      if (document.steps[choice.targetStepId] === undefined) {
        continue;
      }
      if (reachableFrom(document, choice.targetStepId).has(stepId)) {
        problems.push({
          code: "cycle",
          message: `Step "${nameOf(step)}" has a choice that can lead back to "${nameOf(step)}", so a participant could walk in circles`,
          stepId,
          choiceId: choice.id,
        });
      }
    }
  }

  return problems;
}
