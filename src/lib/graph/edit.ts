import type { Choice, GraphDocument, Step } from "@/lib/graph/document";
import { hasOutcome, hasStep, isEnding, stepName } from "@/lib/graph/document";

// The panel names Steps with the same rule validation does; re-exported so
// the editor's components have one module to import edit-time helpers from.
export { stepName };

/**
 * Pure operations an Author's edit panel calls to change a Draft. Every
 * function returns a new document and never mutates the one it is given.
 * Deliberately no `server-only` — the editor calls these directly on the
 * client before the result is autosaved, and the tests call them the same
 * way. New ids come from `crypto.randomUUID()`.
 *
 * A mutation that names a Step, Choice, or Outcome that does not exist is a
 * no-op: it returns the document unchanged rather than throwing, so the
 * editor never has to guard a stale selection before calling one of these.
 */

/** A new, empty Step: one blank paragraph, no Choices, not an Ending's tag. */
export function addStep(
  document: GraphDocument,
  title = "Untitled step",
): { document: GraphDocument; stepId: string } {
  const stepId = crypto.randomUUID();
  const step: Step = {
    id: stepId,
    title,
    content: { type: "doc", content: [{ type: "paragraph" }] },
    choices: [],
    prompt: null,
    outcomeId: null,
    position: null,
  };

  return {
    document: { ...document, steps: { ...document.steps, [stepId]: step } },
    stepId,
  };
}

/** The suffix a copy's title carries, and the schema's own limit on a title. */
const COPY_SUFFIX = " copy";
const MAX_TITLE_LENGTH = 200;

/**
 * The original's title with `COPY_SUFFIX` appended, trimming the original's
 * end so the whole stays within `stepSchema`'s 200-character limit.
 */
function suffixedTitle(title: string): string {
  const maxOriginalLength = MAX_TITLE_LENGTH - COPY_SUFFIX.length;
  const trimmed =
    title.length > maxOriginalLength
      ? title.slice(0, maxOriginalLength)
      : title;
  return `${trimmed}${COPY_SUFFIX}`;
}

/**
 * Copies a Step: its content, Prompt, and Outcome tag carry over and its
 * title gains `COPY_SUFFIX`, but it starts with no Choices — an Author builds
 * outward from the copy the way they would from any new Step, rather than
 * inheriting where the original led. `position` is left `null`, like every
 * other new Step; the map lays the copy out wherever dagre puts an
 * unconnected Step. An unknown `stepId` returns the document unchanged with
 * `stepId: ""`, the `addChoiceToNewStep` convention.
 */
export function duplicateStep(
  document: GraphDocument,
  stepId: string,
): { document: GraphDocument; stepId: string } {
  if (!hasStep(document, stepId)) {
    return { document, stepId: "" };
  }

  const original = document.steps[stepId];
  const newStepId = crypto.randomUUID();
  const step: Step = {
    id: newStepId,
    title: suffixedTitle(original.title),
    content: structuredClone(original.content),
    choices: [],
    prompt: original.prompt,
    outcomeId: original.outcomeId,
    position: null,
  };

  return {
    document: {
      ...document,
      steps: { ...document.steps, [newStepId]: step },
    },
    stepId: newStepId,
  };
}

/** Patches a Step's title, content, or outcome tag. */
export function updateStep(
  document: GraphDocument,
  stepId: string,
  patch: Partial<Pick<Step, "title" | "content" | "outcomeId">>,
): GraphDocument {
  if (!hasStep(document, stepId)) {
    return document;
  }

  const step = document.steps[stepId];
  return {
    ...document,
    steps: { ...document.steps, [stepId]: { ...step, ...patch } },
  };
}

/** Points `startStepId` at another existing Step. */
export function setStart(
  document: GraphDocument,
  stepId: string,
): GraphDocument {
  if (!hasStep(document, stepId)) {
    return document;
  }

  return { ...document, startStepId: stepId };
}

/**
 * Every Choice, on any Step other than `stepId` itself, whose target is
 * `stepId` — the Choices that would dangle if `stepId` were deleted, in
 * document order.
 */
export function choicesTargeting(
  document: GraphDocument,
  stepId: string,
): Array<{ stepId: string; stepTitle: string; choice: Choice }> {
  const targeting: Array<{
    stepId: string;
    stepTitle: string;
    choice: Choice;
  }> = [];

  for (const [otherStepId, step] of Object.entries(document.steps)) {
    if (otherStepId === stepId) {
      continue;
    }
    for (const choice of step.choices) {
      if (choice.targetStepId === stepId) {
        targeting.push({
          stepId: otherStepId,
          stepTitle: stepName(step),
          choice,
        });
      }
    }
  }

  return targeting;
}

/**
 * Removes a Step. Every Choice that pointed at it is left exactly where it
 * is, dangling, so `validateForPublish` reports it rather than this silently
 * rewriting another Step's Choices. The Start cannot be removed this way,
 * because a Draft would otherwise have nothing to walk out from.
 */
export function deleteStep(
  document: GraphDocument,
  stepId: string,
):
  | {
      ok: true;
      document: GraphDocument;
      brokenChoices: ReturnType<typeof choicesTargeting>;
    }
  | { ok: false; error: string } {
  if (!hasStep(document, stepId)) {
    return { ok: true, document, brokenChoices: [] };
  }
  if (document.startStepId === stepId) {
    return { ok: false, error: "Make another step the start first" };
  }

  const brokenChoices = choicesTargeting(document, stepId);
  const steps = { ...document.steps };
  delete steps[stepId];

  return { ok: true, document: { ...document, steps }, brokenChoices };
}

/** Appends a new Choice to a Step. */
export function addChoice(
  document: GraphDocument,
  stepId: string,
  input: { label: string; targetStepId: string },
): { document: GraphDocument; choiceId: string } {
  if (!hasStep(document, stepId)) {
    return { document, choiceId: "" };
  }

  const choiceId = crypto.randomUUID();
  const step = document.steps[stepId];
  const choice: Choice = {
    id: choiceId,
    label: input.label,
    targetStepId: input.targetStepId,
    condition: null,
    effect: null,
  };

  return {
    document: {
      ...document,
      steps: {
        ...document.steps,
        [stepId]: { ...step, choices: [...step.choices, choice] },
      },
    },
    choiceId,
  };
}

/**
 * The same-motion case: creates a new Step and, in the same edit, adds a
 * Choice on `stepId` that targets it.
 */
export function addChoiceToNewStep(
  document: GraphDocument,
  stepId: string,
  input: { label: string; title?: string },
): { document: GraphDocument; choiceId: string; stepId: string } {
  if (!hasStep(document, stepId)) {
    return { document, choiceId: "", stepId };
  }

  const created = addStep(document, input.title);
  const withChoice = addChoice(created.document, stepId, {
    label: input.label,
    targetStepId: created.stepId,
  });

  return {
    document: withChoice.document,
    choiceId: withChoice.choiceId,
    stepId: created.stepId,
  };
}

/** Patches a Choice's label or target. */
export function updateChoice(
  document: GraphDocument,
  stepId: string,
  choiceId: string,
  patch: Partial<Pick<Choice, "label" | "targetStepId">>,
): GraphDocument {
  if (!hasStep(document, stepId)) {
    return document;
  }

  const step = document.steps[stepId];
  const index = step.choices.findIndex((choice) => choice.id === choiceId);
  if (index === -1) {
    return document;
  }

  const choices = [...step.choices];
  choices[index] = { ...choices[index], ...patch };

  return {
    ...document,
    steps: { ...document.steps, [stepId]: { ...step, choices } },
  };
}

/** Swaps a Choice with its neighbour in the given direction; a no-op at the ends. */
export function moveChoice(
  document: GraphDocument,
  stepId: string,
  choiceId: string,
  direction: "up" | "down",
): GraphDocument {
  if (!hasStep(document, stepId)) {
    return document;
  }

  const step = document.steps[stepId];
  const index = step.choices.findIndex((choice) => choice.id === choiceId);
  if (index === -1) {
    return document;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= step.choices.length) {
    return document;
  }

  const choices = [...step.choices];
  [choices[index], choices[targetIndex]] = [
    choices[targetIndex],
    choices[index],
  ];

  return {
    ...document,
    steps: { ...document.steps, [stepId]: { ...step, choices } },
  };
}

/** Removes a Choice from a Step. */
export function removeChoice(
  document: GraphDocument,
  stepId: string,
  choiceId: string,
): GraphDocument {
  if (!hasStep(document, stepId)) {
    return document;
  }

  const step = document.steps[stepId];
  const choices = step.choices.filter((choice) => choice.id !== choiceId);
  if (choices.length === step.choices.length) {
    return document;
  }

  return {
    ...document,
    steps: { ...document.steps, [stepId]: { ...step, choices } },
  };
}

/**
 * The same-motion case for an existing Choice: creates a new Step and
 * retargets the Choice to it. Unknown Step or Choice creates nothing and
 * returns the input Step id unchanged.
 */
export function retargetChoiceToNewStep(
  document: GraphDocument,
  stepId: string,
  choiceId: string,
  title?: string,
): { document: GraphDocument; stepId: string } {
  if (!hasStep(document, stepId)) {
    return { document, stepId };
  }

  const step = document.steps[stepId];
  const hasChoice = step.choices.some((choice) => choice.id === choiceId);
  if (!hasChoice) {
    return { document, stepId };
  }

  const created = addStep(document, title);
  const updated = updateChoice(created.document, stepId, choiceId, {
    targetStepId: created.stepId,
  });

  return { document: updated, stepId: created.stepId };
}

/** Defines a new Outcome. */
export function addOutcome(
  document: GraphDocument,
  label: string,
): { document: GraphDocument; outcomeId: string } {
  const outcomeId = crypto.randomUUID();

  return {
    document: {
      ...document,
      outcomes: { ...document.outcomes, [outcomeId]: { id: outcomeId, label } },
    },
    outcomeId,
  };
}

/** Renames an Outcome. The id, and every Step's tag, are untouched. */
export function renameOutcome(
  document: GraphDocument,
  outcomeId: string,
  label: string,
): GraphDocument {
  if (!hasOutcome(document, outcomeId)) {
    return document;
  }

  const outcome = document.outcomes[outcomeId];
  return {
    ...document,
    outcomes: { ...document.outcomes, [outcomeId]: { ...outcome, label } },
  };
}

/**
 * Removes an Outcome, refused while any Ending still carries its id, since
 * removing it out from under a tagged Ending would silently turn a
 * publishable one into one `validateForPublish` cannot place. A Step that
 * was tagged while it was an Ending and has since gained Choices is not
 * holding the Outcome — the panel offers no way to clear that tag — so it
 * neither refuses the removal nor keeps the id afterwards.
 */
export function removeOutcome(
  document: GraphDocument,
  outcomeId: string,
): { ok: true; document: GraphDocument } | { ok: false; error: string } {
  if (!hasOutcome(document, outcomeId)) {
    return { ok: true, document };
  }

  const inUse = Object.values(document.steps).some(
    (step) => isEnding(step) && step.outcomeId === outcomeId,
  );
  if (inUse) {
    return { ok: false, error: "Endings still use this outcome" };
  }

  const outcomes = { ...document.outcomes };
  delete outcomes[outcomeId];

  const steps = { ...document.steps };
  for (const [stepId, step] of Object.entries(steps)) {
    if (step.outcomeId === outcomeId) {
      steps[stepId] = { ...step, outcomeId: null };
    }
  }

  return { ok: true, document: { ...document, steps, outcomes } };
}

/** One count per defined Outcome — zero when none — of the Endings tagged with it. */
export function endingCountsByOutcome(
  document: GraphDocument,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const outcomeId of Object.keys(document.outcomes)) {
    counts[outcomeId] = 0;
  }

  for (const step of Object.values(document.steps)) {
    if (
      isEnding(step) &&
      step.outcomeId !== null &&
      Object.hasOwn(counts, step.outcomeId)
    ) {
      counts[step.outcomeId] += 1;
    }
  }

  return counts;
}
