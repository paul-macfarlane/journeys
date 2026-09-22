import { describe, expect, it } from "vitest";

import { beginRun } from "@/lib/graph/begin";
import type { GraphDocument, Step } from "@/lib/graph/document";

/**
 * Seam A for ticket 27: a Run is created on the Participant's first Choice,
 * so the reducer needs one move that starts a Run and takes that Choice in
 * the same breath. The document is small enough to read in one sitting:
 *
 *   start --"Go to A"--> a --"Go deeper"--> a2 (Ending, outcome-a2)
 *   start --"Go to B"--> b (Ending, outcome-b)
 *   start --"Stay put"--> start
 */

const NOW = new Date("2026-09-22T10:00:00Z");

const emptyContent = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

function step(overrides: Partial<Step> & Pick<Step, "id">): Step {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    content: emptyContent,
    choices: overrides.choices ?? [],
    prompt: overrides.prompt ?? null,
    outcomeId: overrides.outcomeId ?? null,
    position: overrides.position ?? null,
  };
}

function choice(id: string, label: string, targetStepId: string) {
  return { id, label, targetStepId, condition: null, effect: null };
}

function branchingDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: {
      start: step({
        id: "start",
        title: "Start",
        choices: [
          choice("c1", "Go to A", "a"),
          choice("c2", "Go to B", "b"),
          choice("c3", "Stay put", "start"),
        ],
      }),
      a: step({
        id: "a",
        title: "A",
        choices: [choice("c4", "Go deeper", "a2")],
      }),
      a2: step({ id: "a2", title: "A2", outcomeId: "outcome-a2" }),
      b: step({ id: "b", title: "B", outcomeId: "outcome-b" }),
    },
    outcomes: {
      "outcome-a2": { id: "outcome-a2", label: "Outcome A2" },
      "outcome-b": { id: "outcome-b", label: "Outcome B" },
    },
    layoutDirection: "TB",
  };
}

function endingOnlyDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "only",
    allowBack: true,
    steps: { only: step({ id: "only", title: "The only Step" }) },
    outcomes: {},
    layoutDirection: "TB",
  };
}

describe("beginRun", () => {
  it("begins with the Start and the chosen Step, in that order", () => {
    const result = beginRun(branchingDocument(), "a", NOW);

    expect(result).toEqual({
      kind: "begun",
      state: {
        path: ["start", "a"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("ends at once when the first Choice leads to an Ending", () => {
    const result = beginRun(branchingDocument(), "b", NOW);

    expect(result).toEqual({
      kind: "begun",
      state: {
        path: ["start", "b"],
        backtrackCount: 0,
        endedAt: NOW,
        outcomeId: "outcome-b",
      },
    });
  });

  it("stays on the Start when the Choice leads back to it", () => {
    const result = beginRun(branchingDocument(), "start", NOW);

    expect(result).toEqual({
      kind: "begun",
      state: {
        path: ["start"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("refuses a real Step the Start does not offer", () => {
    // a2 exists and is reachable, but only through A.
    expect(beginRun(branchingDocument(), "a2", NOW)).toEqual({
      kind: "refused",
      reason: "unknown-choice",
    });
  });

  it("refuses an id that names no Step at all", () => {
    expect(beginRun(branchingDocument(), "nowhere", NOW)).toEqual({
      kind: "refused",
      reason: "unknown-choice",
    });
    // A prototype method is not a Step either.
    expect(beginRun(branchingDocument(), "toString", NOW)).toEqual({
      kind: "refused",
      reason: "unknown-choice",
    });
  });

  it("refuses every Choice when the Start is itself an Ending", () => {
    expect(beginRun(endingOnlyDocument(), "only", NOW)).toEqual({
      kind: "refused",
      reason: "unknown-choice",
    });
  });

  it("never mutates the document it is given", () => {
    const document = branchingDocument();
    const before = structuredClone(document);

    beginRun(document, "a", NOW);
    beginRun(document, "a2", NOW);

    expect(document).toEqual(before);
  });
});
