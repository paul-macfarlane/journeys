import type { GraphDocument } from "@/lib/graph/document";
import { hasStep } from "@/lib/graph/document";

/**
 * The pure path reducer for the participant runner. Deliberately no
 * `server-only` — the runner's routes call it on the server, but it takes no
 * database and its tests run against nothing but a hand-written document.
 * Every function returns new state and never mutates the state or document it
 * is given, the same convention `src/lib/graph/edit.ts` follows for Authors.
 *
 * A Run's `path` is the route a Participant has walked from the Start, one
 * entry per visit. A Published Version's graph may hold a cycle (ticket 18),
 * so a Step id may appear in `path` more than once, and "current" is simply
 * the last entry — never "the entry that happens to hold this id".
 *
 * Two consequences run through the rules below. A Choice is resolved before a
 * backtrack, so closing a loop by choosing moves forward and appends. And the
 * one genuinely ambiguous navigation — the browser's back button on a
 * loop-closing Step, where the Step behind the Participant is also a Choice of
 * the Step they are on — is disambiguated by the path index the runner carries
 * in `history.state`: an index that names the entry the Participant came back
 * to makes it a backtrack rather than a Choice.
 */

/** The reducer's own copy of a Run's mutable state — mirrors the `run` row. */
export type RunState = {
  path: string[];
  backtrackCount: number;
  endedAt: Date | null;
  outcomeId: string | null;
};

/**
 * How long a single Run's path may grow. A loop can be walked forever, and a
 * path is stored as one row's worth of JSON, so the walk stops somewhere: the
 * move past this many entries is refused and the Participant is told to start
 * over.
 */
export const MAX_PATH_LENGTH = 500;

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

/** Why a navigation was refused; the step page reads these. */
export type RefusalReason = "unknown-step" | "not-offered" | "path-full";

export type NavigateResult =
  | { kind: "stay" }
  | { kind: "moved"; state: RunState }
  | { kind: "refused"; currentStepId: string; reason: RefusalReason };

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

/** Does the Step at `index` of the path offer a Choice leading to `stepId`? */
function offers(
  document: GraphDocument,
  path: string[],
  index: number,
  stepId: string,
): boolean {
  return document.steps[path[index]].choices.some(
    (choice) => choice.targetStepId === stepId,
  );
}

/**
 * Applies a Participant's navigation to `stepId` — following a Choice link,
 * the in-app Back control, or the browser's own back button reloading an
 * earlier step's URL. `at` is the path index the navigation claims to be
 * returning to, when one travelled with it (`?at=` on the step URL, written
 * from `history.state`); null when it did not. The rules, in order:
 *
 * 0. `stepId` is not a Step of this document at all: refused.
 * 1. `at` is an index of the path whose entry is `stepId`: the Participant
 *    named the entry they are on or came back to. An earlier entry is a
 *    backtrack (the path truncates to it, `backtrackCount` increments); the
 *    last entry is a stay. Any other `at` — out of range, a different Step,
 *    not a whole number — is stale or made up, and is ignored from here on.
 * 2. `stepId` is the current Step: stay (a reload of the same URL).
 * 3. `stepId` is a Choice of the current Step: forward, appended — even if it
 *    is already on the path, which is how a loop is walked. Once the path
 *    holds `MAX_PATH_LENGTH` entries there is nowhere to append: refused.
 * 4. `stepId` is already on the path: a backtrack to its **latest**
 *    occurrence. The path truncates to it (inclusive), `backtrackCount`
 *    increments, and any Ending is cleared.
 * 5. `stepId` is a Choice of some earlier Step on the path — the **latest**
 *    such Step, so a Choice taken from a page the Participant reached via
 *    browser back still resolves. The path truncates to that Step first
 *    (incrementing `backtrackCount`, as rule 4 does) before the target is
 *    appended.
 * 6. Otherwise refused.
 *
 * Landing on an Ending (from any of these) sets `endedAt` and `outcomeId`;
 * landing anywhere else clears both. A refusal returns the unmodified
 * `currentStepId` with its reason, and changes nothing.
 */
export function navigateTo(
  document: GraphDocument,
  state: RunState,
  stepId: string,
  now: Date,
  at: number | null = null,
): NavigateResult {
  if (!hasStep(document, stepId)) {
    return {
      kind: "refused",
      currentStepId: currentStepId(state),
      reason: "unknown-step",
    };
  }

  const lastIndex = state.path.length - 1;

  if (
    at !== null &&
    Number.isInteger(at) &&
    at >= 0 &&
    at <= lastIndex &&
    state.path[at] === stepId
  ) {
    if (at === lastIndex) return { kind: "stay" };

    return {
      kind: "moved",
      state: landingState(
        document,
        state.path.slice(0, at + 1),
        state.backtrackCount + 1,
        stepId,
        now,
      ),
    };
  }

  if (stepId === currentStepId(state)) {
    return { kind: "stay" };
  }

  // A Choice of the Step the Participant is on is a forward move, even when
  // it closes a loop back onto a Step the path already holds.
  if (offers(document, state.path, lastIndex, stepId)) {
    if (state.path.length >= MAX_PATH_LENGTH) {
      return {
        kind: "refused",
        currentStepId: currentStepId(state),
        reason: "path-full",
      };
    }

    return {
      kind: "moved",
      state: landingState(
        document,
        [...state.path, stepId],
        state.backtrackCount,
        stepId,
        now,
      ),
    };
  }

  const returningTo = state.path.lastIndexOf(stepId);
  if (returningTo !== -1) {
    return {
      kind: "moved",
      state: landingState(
        document,
        state.path.slice(0, returningTo + 1),
        state.backtrackCount + 1,
        stepId,
        now,
      ),
    };
  }

  // The latest earlier Step in the path holding a Choice that targets
  // `stepId`: the Participant is choosing from a page the server never saw as
  // current, having reached it with the browser's back button.
  let offeringIndex = -1;
  for (let index = lastIndex - 1; index >= 0; index--) {
    if (offers(document, state.path, index, stepId)) {
      offeringIndex = index;
      break;
    }
  }

  if (offeringIndex === -1) {
    return {
      kind: "refused",
      currentStepId: currentStepId(state),
      reason: "not-offered",
    };
  }

  return {
    kind: "moved",
    state: landingState(
      document,
      [...state.path.slice(0, offeringIndex + 1), stepId],
      state.backtrackCount + 1,
      stepId,
      now,
    ),
  };
}
