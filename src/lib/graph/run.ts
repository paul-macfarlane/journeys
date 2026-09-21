import type { GraphDocument } from "@/lib/graph/document";
import { hasStep } from "@/lib/graph/document";

/**
 * The pure path reducer for the participant runner. Deliberately no
 * `server-only` — the runner's routes call it on the server, but it takes no
 * database and its tests run against nothing but a hand-written document.
 * Every function returns new state and never mutates the state or document it
 * is given, the same convention `src/lib/graph/edit.ts` follows for Authors.
 *
 * A Run's `path` is the linear route a Participant has walked from the Start,
 * always a sequence of Step ids in `document.steps`. Because a Published
 * Version's graph has no cycles (`validateForPublish` refuses one), a Step id
 * appears in `path` at most once, which is what makes truncating to it
 * unambiguous.
 */

/** The reducer's own copy of a Run's mutable state — mirrors the `run` row. */
export type RunState = {
  path: string[];
  backtrackCount: number;
  endedAt: Date | null;
  outcomeId: string | null;
};

/** The Step a Participant is on right now: the last Step in the path. */
export function currentStepId(state: RunState): string {
  return state.path[state.path.length - 1];
}

/** The Ending's Outcome id when `stepId` is an Ending, else null. */
function outcomeIdOf(document: GraphDocument, stepId: string): string | null {
  return document.steps[stepId].outcomeId;
}

/**
 * A fresh Run at the Start. When the Start is itself an Ending — a document
 * with no Choices at all — the Run ends at once, on its very first Step.
 */
export function startRun(document: GraphDocument, now: Date): RunState {
  const { startStepId } = document;
  const startStep = document.steps[startStepId];

  return {
    path: [startStepId],
    backtrackCount: 0,
    endedAt: startStep.choices.length === 0 ? now : null,
    outcomeId:
      startStep.choices.length === 0
        ? outcomeIdOf(document, startStepId)
        : null,
  };
}

export type NavigateResult =
  | { kind: "stay" }
  | { kind: "moved"; state: RunState }
  | { kind: "refused"; currentStepId: string };

/** `path` truncated to (and including) the first occurrence of `stepId`. */
function truncateTo(path: string[], stepId: string): string[] {
  const index = path.indexOf(stepId);
  return path.slice(0, index + 1);
}

/** State for landing on `stepId`: an Ending sets both, anything else clears them. */
function landingState(
  document: GraphDocument,
  path: string[],
  backtrackCount: number,
  stepId: string,
  now: Date,
): RunState {
  const step = document.steps[stepId];
  const ended = step.choices.length === 0;

  return {
    path,
    backtrackCount,
    endedAt: ended ? now : null,
    outcomeId: ended ? outcomeIdOf(document, stepId) : null,
  };
}

/**
 * Applies a Participant's navigation to `stepId` — following a Choice link,
 * the in-app Back control, or the browser's own back button reloading an
 * earlier step's URL. The rules, in order:
 *
 * 1. `stepId` is not a Step of this document at all: refused.
 * 2. `stepId` is the current Step: stay (a reload of the same URL).
 * 3. `stepId` is already in the path: a backtrack. The path truncates to it
 *    (inclusive), `backtrackCount` increments, and any Ending is cleared.
 * 4. Otherwise, `stepId` must be a Choice's target from some Step already in
 *    the path — the **latest** such Step, so a Choice taken from a page the
 *    Participant reached via browser back (a Step earlier than the server's
 *    idea of "current") still resolves correctly. If that offering Step is
 *    the current one, the target is simply appended. If it is an earlier
 *    Step, the path truncates to it first (incrementing `backtrackCount`, the
 *    same as rule 3) before the target is appended — the Participant is
 *    choosing from a cached page the server never saw as current. If no Step
 *    in the path offers `stepId` at all, refused.
 *
 * Landing on an Ending (from any of these) sets `endedAt` and `outcomeId`;
 * landing anywhere else clears both. A refusal returns the unmodified
 * `currentStepId` and changes nothing.
 */
export function navigateTo(
  document: GraphDocument,
  state: RunState,
  stepId: string,
  now: Date,
): NavigateResult {
  if (!hasStep(document, stepId)) {
    return { kind: "refused", currentStepId: currentStepId(state) };
  }

  if (stepId === currentStepId(state)) {
    return { kind: "stay" };
  }

  if (state.path.includes(stepId)) {
    const path = truncateTo(state.path, stepId);
    return {
      kind: "moved",
      state: landingState(
        document,
        path,
        state.backtrackCount + 1,
        stepId,
        now,
      ),
    };
  }

  // The latest Step in the path holding a Choice that targets `stepId`.
  let offeringIndex = -1;
  for (let index = state.path.length - 1; index >= 0; index--) {
    const step = document.steps[state.path[index]];
    if (step.choices.some((choice) => choice.targetStepId === stepId)) {
      offeringIndex = index;
      break;
    }
  }

  if (offeringIndex === -1) {
    return { kind: "refused", currentStepId: currentStepId(state) };
  }

  const isCurrent = offeringIndex === state.path.length - 1;
  const truncated = isCurrent
    ? state.path
    : state.path.slice(0, offeringIndex + 1);
  const path = [...truncated, stepId];
  const backtrackCount = isCurrent
    ? state.backtrackCount
    : state.backtrackCount + 1;

  return {
    kind: "moved",
    state: landingState(document, path, backtrackCount, stepId, now),
  };
}
