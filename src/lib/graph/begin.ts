import type { GraphDocument } from "@/lib/graph/document";
import { navigateTo, startRun, type RunState } from "@/lib/graph/run";

/**
 * The first move of a Run, as one reducer step: a Run is created when a
 * Participant takes their first Choice (ticket 27), never when the Start Step
 * is merely opened — a Run created on page load would count every prefetch
 * and crawler as a start. So there is no state to begin *from*; this starts
 * the Run and takes the Choice in the same breath, and the row that is
 * written already holds two entries.
 *
 * Pure and database-free like the rest of `src/lib/graph`: the runner's
 * action calls it on the server, and its tests run against a hand-written
 * document.
 */

export type BeginResult =
  | { kind: "begun"; state: RunState }
  | { kind: "refused"; reason: "unknown-choice" };

/**
 * A fresh Run that has just taken the Choice leading to `targetStepId`. Only
 * a Choice the Start Step actually offers begins a Run: any other id — a
 * Step reachable only further in, a Step that does not exist, or anything at
 * all when the Start is itself an Ending — is refused and nothing is begun.
 * A Choice leading back to the Start is a stay, as the reducer already
 * treats it: the Run begins with the Start alone.
 */
export function beginRun(
  document: GraphDocument,
  targetStepId: string,
  now: Date,
): BeginResult {
  const started = startRun(document, now);
  const startStep = document.steps[document.startStepId];

  const offered = startStep.choices.some(
    (choice) => choice.targetStepId === targetStepId,
  );
  if (!offered) return { kind: "refused", reason: "unknown-choice" };

  const moved = navigateTo(document, started, targetStepId, now);
  switch (moved.kind) {
    case "moved":
      return { kind: "begun", state: moved.state };
    case "stay":
      return { kind: "begun", state: started };
    case "refused":
      // Unreachable for an offered Choice on a one-entry path (the cap is far
      // off and the target exists), but the reducer's word is final.
      return { kind: "refused", reason: "unknown-choice" };
  }
}
