import { describe, expect, it } from "vitest";

import type { GraphDocument, Step } from "@/lib/graph/document";
import { currentStepId, navigateTo, startRun } from "@/lib/graph/run";

/**
 * Seam A for ticket 06: the pure path reducer that turns a Participant's
 * navigation into a Run's next state. The document is hand-written rather
 * than seeded, small enough to read in one sitting: a Start with two
 * Choices, one branch running two Steps deep.
 *
 *   start --"Go to A"--> a --"Go deeper"--> a2 (Ending, outcome-a2)
 *   start --"Go to B"--> b (Ending, outcome-b)
 */

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
          {
            id: "c1",
            label: "Go to A",
            targetStepId: "a",
            condition: null,
            effect: null,
          },
          {
            id: "c2",
            label: "Go to B",
            targetStepId: "b",
            condition: null,
            effect: null,
          },
        ],
      }),
      a: step({
        id: "a",
        title: "A",
        choices: [
          {
            id: "c3",
            label: "Go deeper",
            targetStepId: "a2",
            condition: null,
            effect: null,
          },
        ],
      }),
      a2: step({ id: "a2", title: "A2", outcomeId: "outcome-a2" }),
      b: step({ id: "b", title: "B", outcomeId: "outcome-b" }),
    },
    outcomes: {
      "outcome-a2": { id: "outcome-a2", label: "Reached A2" },
      "outcome-b": { id: "outcome-b", label: "Reached B" },
    },
  };
}

/** A document whose Start has no Choices — an Ending from the first Step. */
function singleEndingDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "only",
    allowBack: true,
    steps: {
      only: step({ id: "only", title: "Only", outcomeId: "outcome-only" }),
    },
    outcomes: {
      "outcome-only": { id: "outcome-only", label: "Reached the only Step" },
    },
  };
}

const now = new Date("2026-09-20T12:00:00.000Z");
const later = new Date("2026-09-20T12:05:00.000Z");

describe("startRun", () => {
  it("starts at the Start Step, not ended", () => {
    const state = startRun(branchingDocument(), now);
    expect(state).toEqual({
      path: ["start"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    });
  });

  it("ends at once when the Start is itself an Ending", () => {
    const state = startRun(singleEndingDocument(), now);
    expect(state).toEqual({
      path: ["only"],
      backtrackCount: 0,
      endedAt: now,
      outcomeId: "outcome-only",
    });
  });
});

describe("navigateTo", () => {
  it("appends the chosen Step", () => {
    const document = branchingDocument();
    const state = startRun(document, now);
    const result = navigateTo(document, state, "a", later);
    expect(result).toEqual({
      kind: "moved",
      state: {
        path: ["start", "a"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("sets endedAt and outcomeId on reaching an Ending", () => {
    const document = branchingDocument();
    const state = {
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    const result = navigateTo(document, state, "a2", later);
    expect(result).toEqual({
      kind: "moved",
      state: {
        path: ["start", "a", "a2"],
        backtrackCount: 0,
        endedAt: later,
        outcomeId: "outcome-a2",
      },
    });
  });

  it("stays when navigating to the current Step", () => {
    const document = branchingDocument();
    const state = {
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    expect(navigateTo(document, state, "a", later)).toEqual({ kind: "stay" });
  });

  it("truncates, increments, and clears the Ending when backing to an earlier Step", () => {
    const document = branchingDocument();
    const ended = {
      path: ["start", "a", "a2"],
      backtrackCount: 0,
      endedAt: later,
      outcomeId: "outcome-a2",
    };
    const result = navigateTo(document, ended, "start", later);
    expect(result).toEqual({
      kind: "moved",
      state: {
        path: ["start"],
        backtrackCount: 1,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("truncates, increments, and appends when choosing from an earlier path Step", () => {
    // The Participant reached "a" via a cached page after having already
    // moved on to "a2" server-side (path still records "a2" as visited).
    const document = branchingDocument();
    const state = {
      path: ["start", "a", "a2"],
      backtrackCount: 0,
      endedAt: later,
      outcomeId: "outcome-a2",
    };
    const result = navigateTo(document, state, "b", later);
    expect(result).toEqual({
      kind: "moved",
      state: {
        path: ["start", "b"],
        backtrackCount: 1,
        endedAt: later,
        outcomeId: "outcome-b",
      },
    });
  });

  it("refuses a Step id that is not part of the document, naming the current Step", () => {
    const document = branchingDocument();
    const state = {
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    expect(navigateTo(document, state, "nowhere", later)).toEqual({
      kind: "refused",
      currentStepId: "a",
    });
  });

  it("refuses a real Step that no Step in the path offers, naming the current Step", () => {
    const document = branchingDocument();
    // "start" is a real Step, but the only path Step, "a", offers only "a2".
    const state = {
      path: ["a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    expect(navigateTo(document, state, "start", later)).toEqual({
      kind: "refused",
      currentStepId: "a",
    });
  });

  it("leaves the state unchanged on a refusal", () => {
    const document = branchingDocument();
    const state = {
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    const result = navigateTo(document, state, "nowhere", later);
    expect(result.kind).toBe("refused");
    expect(currentStepId(state)).toBe("a");
    expect(state).toEqual({
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    });
  });

  it("never mutates the document or the state it is given", () => {
    const document = branchingDocument();
    const documentBefore = structuredClone(document);
    const state = {
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    const stateBefore = structuredClone(state);

    navigateTo(document, state, "a2", later);

    expect(document).toEqual(documentBefore);
    expect(state).toEqual(stateBefore);
  });
});
