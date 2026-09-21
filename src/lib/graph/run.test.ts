import { describe, expect, it } from "vitest";

import type { GraphDocument, Step } from "@/lib/graph/document";
import {
  currentStepId,
  MAX_PATH_LENGTH,
  navigateTo,
  parsePathIndex,
  startRun,
  type RunState,
} from "@/lib/graph/run";

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
          {
            id: "c4",
            label: "Give up now",
            targetStepId: "shared",
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
          {
            id: "c5",
            label: "Give up here",
            targetStepId: "shared",
            condition: null,
            effect: null,
          },
        ],
      }),
      a2: step({ id: "a2", title: "A2", outcomeId: "outcome-a2" }),
      b: step({ id: "b", title: "B", outcomeId: "outcome-b" }),
      // Reachable from both `start` and `a`: the diamond that tells the
      // latest-offering-Step rule apart from an earliest-first scan.
      shared: step({ id: "shared", title: "Shared", outcomeId: "outcome-b" }),
    },
    outcomes: {
      "outcome-a2": { id: "outcome-a2", label: "Reached A2" },
      "outcome-b": { id: "outcome-b", label: "Reached B" },
    },
    layoutDirection: "TB",
  };
}

/**
 * A document with a 2-cycle, which a Published Version is allowed to hold
 * since ticket 18: the Start and the queue Step each offer the other.
 *
 *   loop-start --"Wait your turn"--> queue --"Ask again"--> loop-start
 *   queue --"Show your papers"--> waved-through (Ending, outcome-waved)
 */
function loopDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "loop-start",
    allowBack: true,
    steps: {
      "loop-start": step({
        id: "loop-start",
        title: "Border post",
        choices: [
          {
            id: "lc1",
            label: "Wait your turn",
            targetStepId: "queue",
            condition: null,
            effect: null,
          },
        ],
      }),
      queue: step({
        id: "queue",
        title: "Still waiting",
        choices: [
          {
            id: "lc2",
            label: "Ask again",
            targetStepId: "loop-start",
            condition: null,
            effect: null,
          },
          {
            id: "lc3",
            label: "Show your papers",
            targetStepId: "waved-through",
            condition: null,
            effect: null,
          },
        ],
      }),
      "waved-through": step({
        id: "waved-through",
        title: "Waved through",
        outcomeId: "outcome-waved",
      }),
    },
    outcomes: {
      "outcome-waved": { id: "outcome-waved", label: "Waved through" },
    },
    layoutDirection: "TB",
  };
}

/**
 * The smallest loop a Published Version may hold: one Step whose Choice
 * points back at itself.
 *
 *   waiting-room --"Wait a little longer"--> waiting-room
 *   waiting-room --"Give up"--> gave-up (Ending, outcome-gave-up)
 */
function selfChoiceDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "waiting-room",
    allowBack: true,
    steps: {
      "waiting-room": step({
        id: "waiting-room",
        title: "Waiting room",
        choices: [
          {
            id: "sc1",
            label: "Wait a little longer",
            targetStepId: "waiting-room",
            condition: null,
            effect: null,
          },
          {
            id: "sc2",
            label: "Give up",
            targetStepId: "gave-up",
            condition: null,
            effect: null,
          },
        ],
      }),
      "gave-up": step({
        id: "gave-up",
        title: "Gave up",
        outcomeId: "outcome-gave-up",
      }),
    },
    outcomes: {
      "outcome-gave-up": { id: "outcome-gave-up", label: "Gave up waiting" },
    },
    layoutDirection: "TB",
  };
}

/** `length` entries of the loop, alternating, starting at the Start. */
function loopPath(length: number): string[] {
  return Array.from({ length }, (_, index) =>
    index % 2 === 0 ? "loop-start" : "queue",
  );
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
    layoutDirection: "TB",
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

  it("appends from the current Step when an earlier path Step also offers the target", () => {
    // `shared` is offered by both `start` and `a`. On the path [start, a]
    // the current Step offers it, so this is a plain Choice — not a
    // backtrack to `start` — and the latest offering Step must win.
    const document = branchingDocument();
    const now = new Date("2026-09-21T00:00:00Z");
    const state: RunState = {
      path: ["start", "a"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };

    const result = navigateTo(document, state, "shared", now);

    expect(result).toEqual({
      kind: "moved",
      state: {
        path: ["start", "a", "shared"],
        backtrackCount: 0,
        endedAt: now,
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
      reason: "unknown-step",
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
      reason: "not-offered",
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

/**
 * Ticket 18: a Published Version may hold a cycle, so a Step can sit on the
 * path more than once. The path index the runner carries (`at`) is what tells
 * a browser Back on a loop-closing Step from a Choice to the same Step.
 */
describe("navigateTo around a loop", () => {
  it("appends every visit when the loop is walked forward", () => {
    const document = loopDocument();
    const first = navigateTo(document, startRun(document, now), "queue", later);
    expect(first).toEqual({
      kind: "moved",
      state: {
        path: ["loop-start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });

    const second = navigateTo(
      document,
      (first as { state: RunState }).state,
      "loop-start",
      later,
    );
    const third = navigateTo(
      document,
      (second as { state: RunState }).state,
      "queue",
      later,
    );

    expect(third).toEqual({
      kind: "moved",
      state: {
        path: ["loop-start", "queue", "loop-start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("backtracks by index when Back names the previous entry of a loop-closing Step", () => {
    const document = loopDocument();
    const state: RunState = {
      path: ["loop-start", "queue", "loop-start"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };

    // The queue Step is both the entry behind this one and a Choice of the
    // Step the Participant is on; the index says which of the two this is.
    expect(navigateTo(document, state, "queue", later, 1)).toEqual({
      kind: "moved",
      state: {
        path: ["loop-start", "queue"],
        backtrackCount: 1,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("takes the Choice when the same Step arrives with no index", () => {
    const document = loopDocument();
    const state: RunState = {
      path: ["loop-start", "queue", "loop-start"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };

    expect(navigateTo(document, state, "queue", later)).toEqual({
      kind: "moved",
      state: {
        path: ["loop-start", "queue", "loop-start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("ignores an index that names a different Step", () => {
    const document = loopDocument();
    const state: RunState = {
      path: ["loop-start", "queue", "loop-start"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };

    // Index 0 holds the Start, not the queue Step: the index is discarded and
    // the navigation resolves as the Choice it looks like.
    expect(navigateTo(document, state, "queue", later, 0)).toEqual({
      kind: "moved",
      state: {
        path: ["loop-start", "queue", "loop-start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("treats a Choice onto the Step's own Step as a stay, not a second entry", () => {
    const document = selfChoiceDocument();
    const state = startRun(document, now);

    // The Participant never left the screen, so the path records one visit.
    expect(navigateTo(document, state, "waiting-room", later)).toEqual({
      kind: "stay",
    });
  });

  it("ignores an index outside the path and resolves the navigation itself", () => {
    const document = loopDocument();
    const state: RunState = {
      path: ["loop-start", "queue", "loop-start"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    const asTheChoice = {
      kind: "moved",
      state: {
        path: ["loop-start", "queue", "loop-start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    };

    // Before the first entry and one past the last: neither names anything.
    expect(navigateTo(document, state, "queue", later, -1)).toEqual(
      asTheChoice,
    );
    expect(
      navigateTo(document, state, "queue", later, state.path.length),
    ).toEqual(asTheChoice);
  });

  it("stays when the index names the current entry", () => {
    const document = loopDocument();
    const state: RunState = {
      path: ["loop-start", "queue", "loop-start"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };

    expect(navigateTo(document, state, "loop-start", later, 2)).toEqual({
      kind: "stay",
    });
  });

  it("backtracks to the latest occurrence of a repeated Step", () => {
    const document = loopDocument();
    const state: RunState = {
      path: ["loop-start", "queue", "loop-start", "queue", "waved-through"],
      backtrackCount: 0,
      endedAt: later,
      outcomeId: "outcome-waved",
    };

    expect(navigateTo(document, state, "loop-start", later)).toEqual({
      kind: "moved",
      state: {
        path: ["loop-start", "queue", "loop-start"],
        backtrackCount: 1,
        endedAt: null,
        outcomeId: null,
      },
    });
  });

  it("accepts the entry that fills the path to the cap", () => {
    const document = loopDocument();
    const state: RunState = {
      path: loopPath(MAX_PATH_LENGTH - 1),
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };

    const result = navigateTo(document, state, "queue", later);

    expect(result.kind).toBe("moved");
    expect((result as { state: RunState }).state.path).toHaveLength(
      MAX_PATH_LENGTH,
    );
  });

  it("refuses the entry past the cap and changes nothing", () => {
    const document = loopDocument();
    const state: RunState = {
      path: loopPath(MAX_PATH_LENGTH),
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    };
    const before = structuredClone(state);

    expect(navigateTo(document, state, "loop-start", later)).toEqual({
      kind: "refused",
      currentStepId: "queue",
      reason: "path-full",
    });
    expect(state).toEqual(before);
  });
});

/** The `?at=` parameter arrives from a Participant's browser: distrust it. */
describe("parsePathIndex", () => {
  it("reads a run of digits as an index", () => {
    expect(parsePathIndex("3")).toBe(3);
    expect(parsePathIndex("0")).toBe(0);
  });

  it("refuses anything that is not one", () => {
    expect(parsePathIndex("-1")).toBeNull();
    expect(parsePathIndex("1.5")).toBeNull();
    expect(parsePathIndex("abc")).toBeNull();
    expect(parsePathIndex("")).toBeNull();
    expect(parsePathIndex(undefined)).toBeNull();
    // Next.js hands over an array when the parameter is repeated.
    expect(parsePathIndex(["1", "2"])).toBeNull();
  });
});
