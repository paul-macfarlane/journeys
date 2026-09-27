import { describe, expect, it } from "vitest";

import {
  analyticsForVersion,
  chooseVersionId,
  formatShare,
  type RunPath,
} from "@/lib/analytics";
import type { Choice, GraphDocument, Step } from "@/lib/graph/document";

/**
 * Seam A for ticket 10: every number analytics shows, computed by hand from
 * a few Run paths and checked here. The fixture is `e2e/setup/documents.ts`'s
 * runner Journey — a Start with two Choices, a middle Step with two more,
 * and two Endings, each with an Outcome — because that is the shape Seam B
 * walks, so the two seams read the same numbers.
 */

const VERSION = "version-1";

function choice(id: string, label: string, targetStepId: string): Choice {
  return { id, label, targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  title: string,
  choices: Choice[],
  outcomeId: string | null = null,
): Step {
  return {
    id,
    title,
    content: { type: "doc", content: [] },
    choices,
    prompt: null,
    outcomeId,
    position: null,
  };
}

function document(steps: Step[], outcomes: { id: string; label: string }[]) {
  return {
    schemaVersion: 1,
    startStepId: steps[0].id,
    allowBack: true,
    steps: Object.fromEntries(steps.map((item) => [item.id, item])),
    outcomes: Object.fromEntries(outcomes.map((item) => [item.id, item])),
    layoutDirection: "TB",
  } satisfies GraphDocument;
}

/** The runner Journey: start → queue | turned-back; queue → waved-through | turned-back. */
function runnerDocument(): GraphDocument {
  return document(
    [
      step("start", "Border post", [
        choice("choice-wait", "Wait your turn", "queue"),
        choice("choice-leave", "Walk away", "turned-back"),
      ]),
      step("queue", "Still waiting", [
        choice("choice-papers", "Show your papers", "waved-through"),
        choice("choice-give-up", "Leave the queue", "turned-back"),
      ]),
      step("waved-through", "Waved through", [], "reached-care"),
      step("turned-back", "Turned back", [], "turned-away"),
    ],
    [
      { id: "reached-care", label: "Reached care" },
      { id: "turned-away", label: "Turned away" },
    ],
  );
}

function run(
  path: string[],
  versionId = VERSION,
  completion: { completedAt: Date | null; endingStepId: string | null } = {
    completedAt: null,
    endingStepId: null,
  },
): RunPath {
  return { versionId, path, ...completion };
}

const COMPLETED_AT = new Date("2026-09-26T00:00:00.000Z");

describe("analyticsForVersion", () => {
  it("counts starts, completions, and abandonment from the paths alone", () => {
    const result = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "queue", "waved-through"]),
      run(["start", "turned-back"]),
      run(["start", "queue"]),
    ]);

    expect(result.starts).toBe(3);
    expect(result.completions).toBe(2);
    expect(result.abandoned).toBe(1);
    expect(result.completionRate).toBeCloseTo(2 / 3);
  });

  it("counts every visit to a Step and the Runs that stop on it", () => {
    const { steps } = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "queue", "waved-through"]),
      run(["start", "turned-back"]),
      run(["start", "queue"]),
    ]);

    expect(steps).toEqual({
      start: { stepId: "start", visits: 3, abandoned: 0, ended: 0 },
      queue: { stepId: "queue", visits: 2, abandoned: 1, ended: 0 },
      "waved-through": {
        stepId: "waved-through",
        visits: 1,
        abandoned: 0,
        ended: 1,
      },
      "turned-back": {
        stepId: "turned-back",
        visits: 1,
        abandoned: 0,
        ended: 1,
      },
    });
  });

  it("rates each Choice by its traversals over visits to its Step", () => {
    const { choices } = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "queue", "waved-through"]),
      run(["start", "turned-back"]),
      run(["start", "queue"]),
    ]);

    expect(choices["choice-wait"]).toEqual({
      choiceId: "choice-wait",
      stepId: "start",
      targetStepId: "queue",
      traversals: 2,
      share: 2 / 3,
    });
    expect(choices["choice-leave"]).toMatchObject({
      traversals: 1,
      share: 1 / 3,
    });
    expect(choices["choice-papers"]).toMatchObject({
      traversals: 1,
      share: 1 / 2,
    });
    expect(choices["choice-give-up"]).toMatchObject({
      traversals: 0,
      share: 0,
    });
  });

  it("groups completed Runs by Outcome, with Abandoned last", () => {
    const { outcomes } = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "queue", "waved-through"]),
      run(["start", "turned-back"]),
      run(["start", "queue"]),
    ]);

    expect(outcomes).toEqual([
      {
        key: "outcome:reached-care",
        kind: "outcome",
        label: "Reached care",
        runs: 1,
        share: 1 / 3,
      },
      {
        key: "outcome:turned-away",
        kind: "outcome",
        label: "Turned away",
        runs: 1,
        share: 1 / 3,
      },
      {
        key: "abandoned",
        kind: "abandoned",
        label: "Abandoned",
        runs: 1,
        share: 1 / 3,
      },
    ]);
  });

  it("orders Outcome groups by Runs, most first, then by label", () => {
    const { outcomes } = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "turned-back"]),
      run(["start", "queue", "turned-back"]),
      run(["start", "queue", "waved-through"]),
    ]);

    expect(outcomes.map((group) => [group.label, group.runs])).toEqual([
      ["Turned away", 2],
      ["Reached care", 1],
      ["Abandoned", 0],
    ]);
  });

  it("groups an Ending with no Outcome under its own title", () => {
    const untagged = runnerDocument();
    untagged.steps["turned-back"].outcomeId = null;
    delete untagged.outcomes["turned-away"];

    const { outcomes } = analyticsForVersion(VERSION, untagged, [
      run(["start", "turned-back"]),
      run(["start", "queue", "turned-back"]),
      run(["start", "queue", "waved-through"]),
    ]);

    expect(outcomes).toEqual([
      {
        key: "ending:turned-back",
        kind: "ending",
        label: "Turned back",
        runs: 2,
        share: 2 / 3,
      },
      {
        key: "outcome:reached-care",
        kind: "outcome",
        label: "Reached care",
        runs: 1,
        share: 1 / 3,
      },
      {
        key: "abandoned",
        kind: "abandoned",
        label: "Abandoned",
        runs: 0,
        share: 0,
      },
    ]);
  });

  it("lists every Outcome and untagged Ending even when nothing reached it", () => {
    const untagged = runnerDocument();
    untagged.steps["turned-back"].outcomeId = null;
    delete untagged.outcomes["turned-away"];

    const { outcomes } = analyticsForVersion(VERSION, untagged, [
      run(["start", "queue", "waved-through"]),
    ]);

    expect(outcomes.map((group) => [group.label, group.runs])).toEqual([
      ["Reached care", 1],
      ["Turned back", 0],
      ["Abandoned", 0],
    ]);
  });

  it("reads all zeros and no rates for a version with no Runs", () => {
    const result = analyticsForVersion(VERSION, runnerDocument(), []);

    expect(result).toMatchObject({
      starts: 0,
      completions: 0,
      abandoned: 0,
      completionRate: null,
    });
    expect(result.steps.start).toEqual({
      stepId: "start",
      visits: 0,
      abandoned: 0,
      ended: 0,
    });
    expect(result.choices["choice-wait"]).toMatchObject({
      traversals: 0,
      share: null,
    });
    expect(result.outcomes.map((group) => [group.label, group.runs])).toEqual([
      ["Reached care", 0],
      ["Turned away", 0],
      ["Abandoned", 0],
    ]);
    expect(result.outcomes.every((group) => group.share === null)).toBe(true);
  });

  it("reads zero for a Journey whose Start is an Ending, which records no Run", () => {
    // Ticket 27: a Run is created by the first Choice, and such a Journey
    // offers none — so however many people open it, there is nothing here.
    const endingOnly = document(
      [step("start", "The end", [], "reached-care")],
      [{ id: "reached-care", label: "Reached care" }],
    );

    const result = analyticsForVersion(VERSION, endingOnly, []);

    expect(result).toMatchObject({
      starts: 0,
      completions: 0,
      abandoned: 0,
      completionRate: null,
    });
    expect(result.steps.start).toEqual({
      stepId: "start",
      visits: 0,
      abandoned: 0,
      ended: 0,
    });
    expect(result.choices).toEqual({});
    expect(result.outcomes.map((group) => [group.label, group.runs])).toEqual([
      ["Reached care", 0],
      ["Abandoned", 0],
    ]);
  });

  it("reads every Run as abandoned when none reached an Ending", () => {
    const result = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "queue"]),
      run(["start", "queue"]),
    ]);

    expect(result).toMatchObject({
      starts: 2,
      completions: 0,
      abandoned: 2,
      completionRate: 0,
    });
    expect(result.steps.queue).toMatchObject({ visits: 2, abandoned: 2 });
    expect(result.choices["choice-wait"]).toMatchObject({
      traversals: 2,
      share: 1,
    });
    expect(result.choices["choice-papers"]).toMatchObject({
      traversals: 0,
      share: 0,
    });
    expect(result.outcomes.at(-1)).toEqual({
      key: "abandoned",
      kind: "abandoned",
      label: "Abandoned",
      runs: 2,
      share: 1,
    });
  });

  it("ignores Runs pinned to another version", () => {
    const result = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "queue", "waved-through"]),
      run(["start", "turned-back"], "version-2"),
      run(["start", "queue"], "version-2"),
    ]);

    expect(result).toMatchObject({
      starts: 1,
      completions: 1,
      abandoned: 0,
    });
    expect(result.steps["turned-back"].ended).toBe(0);
    expect(result.choices["choice-leave"]).toMatchObject({
      traversals: 0,
      share: 0,
    });
  });

  it("counts a Choice once per traversal when a loop is walked twice", () => {
    const loop = document(
      [
        step("start", "Border post", [
          choice("choice-wait", "Wait your turn", "queue"),
        ]),
        step("queue", "Still waiting", [
          choice("choice-ask", "Ask again", "start"),
          choice("choice-papers", "Show your papers", "waved-through"),
        ]),
        step("waved-through", "Waved through", [], "reached-care"),
      ],
      [{ id: "reached-care", label: "Reached care" }],
    );

    const result = analyticsForVersion(VERSION, loop, [
      run(["start", "queue", "start", "queue", "waved-through"]),
    ]);

    expect(result.steps.start).toMatchObject({ visits: 2, abandoned: 0 });
    expect(result.steps.queue).toMatchObject({ visits: 2, abandoned: 0 });
    expect(result.choices["choice-wait"]).toMatchObject({
      traversals: 2,
      share: 1,
    });
    expect(result.choices["choice-ask"]).toMatchObject({
      traversals: 1,
      share: 1 / 2,
    });
    expect(result.choices["choice-papers"]).toMatchObject({
      traversals: 1,
      share: 1 / 2,
    });
    expect(result).toMatchObject({ starts: 1, completions: 1 });
  });

  it("gives two Choices to the same Step the same number", () => {
    const parallel = document(
      [
        step("start", "Border post", [
          choice("choice-front", "Front door", "end"),
          choice("choice-side", "Side door", "end"),
        ]),
        step("end", "Inside", []),
      ],
      [],
    );

    const { choices } = analyticsForVersion(VERSION, parallel, [
      run(["start", "end"]),
      run(["start"]),
    ]);

    expect(choices["choice-front"]).toMatchObject({
      traversals: 1,
      share: 1 / 2,
    });
    expect(choices["choice-side"]).toMatchObject({
      traversals: 1,
      share: 1 / 2,
    });
  });

  it("survives a path naming a Step the version does not have", () => {
    const result = analyticsForVersion(VERSION, runnerDocument(), [
      run(["start", "ghost"]),
      run(["ghost"]),
    ]);

    expect(result).toMatchObject({
      starts: 2,
      completions: 0,
      abandoned: 2,
    });
    expect(result.steps.start).toMatchObject({ visits: 1, abandoned: 0 });
    expect(result.choices["choice-wait"]).toMatchObject({
      traversals: 0,
      share: 0,
    });
  });

  // Ticket 75: a Run's Completion survives a backtrack off the Ending it
  // reached, and its Outcome bar follows the latest Ending it reached.
  describe("Completion survives a backtrack (ticket 75)", () => {
    it("counts a Run as a Completion, under its Ending's Outcome, even after it backed off the Ending", () => {
      // The Participant reached waved-through, then backed to queue: the
      // path no longer ends on an Ending, but completedAt/endingStepId do.
      const result = analyticsForVersion(VERSION, runnerDocument(), [
        run(["start", "queue", "waved-through", "queue"], VERSION, {
          completedAt: COMPLETED_AT,
          endingStepId: "waved-through",
        }),
      ]);

      expect(result).toMatchObject({ starts: 1, completions: 1, abandoned: 0 });
      expect(result.steps["waved-through"]).toMatchObject({ ended: 1 });
      expect(
        result.outcomes.find((group) => group.key === "outcome:reached-care"),
      ).toMatchObject({ runs: 1 });
      expect(
        result.outcomes.find((group) => group.key === "abandoned"),
      ).toMatchObject({ runs: 0 });
    });

    it("counts one Completion under the latest Ending only, when a Run reached Ending X, backed off, then reached Ending Y", () => {
      // X is waved-through, Y is turned-back — the reducer replaces
      // endingStepId/outcomeId with the latest, so only Y's bar gets it.
      const result = analyticsForVersion(VERSION, runnerDocument(), [
        run(
          ["start", "queue", "waved-through", "queue", "turned-back"],
          VERSION,
          {
            completedAt: COMPLETED_AT,
            endingStepId: "turned-back",
          },
        ),
      ]);

      expect(result).toMatchObject({ starts: 1, completions: 1 });
      expect(
        result.outcomes.find((group) => group.key === "outcome:turned-away"),
      ).toMatchObject({ runs: 1 });
      expect(
        result.outcomes.find((group) => group.key === "outcome:reached-care"),
      ).toMatchObject({ runs: 0 });
      expect(result.steps["waved-through"]).toMatchObject({ ended: 0 });
      expect(result.steps["turned-back"]).toMatchObject({ ended: 1 });
    });

    it("groups a Run under its own untagged latest Ending, even off the path's last entry", () => {
      const untagged = runnerDocument();
      untagged.steps["turned-back"].outcomeId = null;
      delete untagged.outcomes["turned-away"];

      const result = analyticsForVersion(VERSION, untagged, [
        run(["start", "turned-back", "start"], VERSION, {
          completedAt: COMPLETED_AT,
          endingStepId: "turned-back",
        }),
      ]);

      expect(result).toMatchObject({ starts: 1, completions: 1, abandoned: 0 });
      expect(
        result.outcomes.find((group) => group.key === "ending:turned-back"),
      ).toMatchObject({ runs: 1 });
    });

    it("groups under the Ending the Run rests on over a stale endingStepId the previous code left behind", () => {
      // The new code took the Run to waved-through; the previous code, still
      // serving during the deploy, backed it off and walked it to
      // turned-back without touching ending_step_id.
      const result = analyticsForVersion(VERSION, runnerDocument(), [
        run(["start", "turned-back"], VERSION, {
          completedAt: COMPLETED_AT,
          endingStepId: "waved-through",
        }),
      ]);

      expect(result).toMatchObject({ starts: 1, completions: 1 });
      expect(
        result.outcomes.find((group) => group.key === "outcome:turned-away"),
      ).toMatchObject({ runs: 1 });
      expect(result.steps["waved-through"]).toMatchObject({ ended: 0 });
    });

    it("still counts a legacy Run (no completedAt) that is resting on an Ending", () => {
      // A row written before ticket 75, or by the previous code during the
      // deploy window: completedAt/endingStepId are null, but the path still
      // ends on the Ending, so the old reading holds.
      const result = analyticsForVersion(VERSION, runnerDocument(), [
        run(["start", "queue", "waved-through"], VERSION, {
          completedAt: null,
          endingStepId: null,
        }),
      ]);

      expect(result).toMatchObject({ starts: 1, completions: 1, abandoned: 0 });
      expect(result.steps["waved-through"]).toMatchObject({ ended: 1 });
      expect(
        result.outcomes.find((group) => group.key === "outcome:reached-care"),
      ).toMatchObject({ runs: 1 });
    });
  });
});

describe("chooseVersionId", () => {
  const versions = [
    { id: "v3", isLive: false },
    { id: "v2", isLive: true },
    { id: "v1", isLive: false },
  ];

  it("takes the version the address names", () => {
    expect(chooseVersionId(versions, "v1")).toBe("v1");
    expect(chooseVersionId(versions, ["v3", "v1"])).toBe("v3");
  });

  it("falls back to the live version, then the newest", () => {
    expect(chooseVersionId(versions, undefined)).toBe("v2");
    expect(chooseVersionId(versions, "not-ours")).toBe("v2");
    expect(
      chooseVersionId(
        versions.map((version) => ({ ...version, isLive: false })),
        undefined,
      ),
    ).toBe("v3");
  });

  it("has nothing to choose for a Journey never published", () => {
    expect(chooseVersionId([], "v1")).toBeNull();
  });
});

describe("formatShare", () => {
  it("rounds a share to a whole percent", () => {
    expect(formatShare(2 / 3)).toBe("67%");
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(1)).toBe("100%");
  });

  it("shows a dash when there is nothing to divide by", () => {
    expect(formatShare(null)).toBe("—");
  });
});
