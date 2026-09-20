import { describe, expect, it } from "vitest";

import type { Content } from "@/lib/graph/content";
import type {
  Choice,
  GraphDocument,
  Outcome,
  Step,
} from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";
import { validateForPublish } from "@/lib/graph/validate";

const emptyContent: Content = { type: "doc", content: [{ type: "paragraph" }] };

function choice(id: string, targetStepId: string): Choice {
  return { id, label: "Go on", targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  choices: Choice[],
  options: { title?: string; outcomeId?: string } = {},
): Step {
  return {
    id,
    title: options.title ?? id,
    content: emptyContent,
    choices,
    prompt: null,
    outcomeId: options.outcomeId ?? null,
    position: null,
  };
}

function graph(
  steps: Step[],
  options: { startStepId?: string; outcomes?: Outcome[] } = {},
): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: options.startStepId ?? steps[0].id,
    allowBack: true,
    steps: Object.fromEntries(steps.map((one) => [one.id, one])),
    outcomes: Object.fromEntries(
      (options.outcomes ?? []).map((outcome) => [outcome.id, outcome]),
    ),
  };
}

const reachedCare: Outcome = { id: "outcome-ashore", label: "Reached shore" };

describe("validateForPublish", () => {
  it("finds nothing wrong with the large journey fixture", () => {
    expect(validateForPublish(largeJourney)).toEqual([]);
  });

  it("finds nothing wrong with a small, complete journey", () => {
    const document = graph(
      [
        step("step-start", [choice("choice-1", "step-end")]),
        step("step-end", [], { outcomeId: reachedCare.id }),
      ],
      { outcomes: [reachedCare] },
    );

    expect(validateForPublish(document)).toEqual([]);
  });

  it("reports a Start that names no Step", () => {
    const document = graph(
      [
        step("step-start", [choice("choice-1", "step-end")]),
        step("step-end", [], { outcomeId: reachedCare.id }),
      ],
      { startStepId: "step-vanished", outcomes: [reachedCare] },
    );

    const problems = validateForPublish(document);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("missing-start");
    // The pointer names nothing, so there is no Step id to hand the canvas.
    expect(problems[0].stepId).toBeUndefined();
  });

  it("does not call every Step unreachable when the Start is missing", () => {
    const document = graph(
      [
        step("step-start", [choice("choice-1", "step-end")]),
        step("step-end", [], { outcomeId: reachedCare.id }),
      ],
      { startStepId: "step-vanished", outcomes: [reachedCare] },
    );

    expect(
      validateForPublish(document).filter(
        (problem) => problem.code === "unreachable-step",
      ),
    ).toEqual([]);
  });

  it("reports a Choice pointing at a Step that no longer exists", () => {
    const document = graph(
      [
        step("step-start", [choice("choice-1", "step-gone")], {
          title: "Lighthouse",
        }),
      ],
      { outcomes: [reachedCare] },
    );

    const problems = validateForPublish(document);

    expect(problems).toContainEqual({
      code: "dangling-choice-target",
      message:
        'Step "Lighthouse" has a choice pointing at a step that no longer exists',
      stepId: "step-start",
      choiceId: "choice-1",
    });
  });

  it("does not call a dangling Choice a cycle", () => {
    const document = graph([
      step("step-start", [choice("choice-1", "step-gone")]),
    ]);

    expect(
      validateForPublish(document).filter(
        (problem) => problem.code === "cycle",
      ),
    ).toEqual([]);
  });

  it("reports a Step that cannot be reached from the Start", () => {
    const document = graph(
      [
        step("step-start", [choice("choice-1", "step-end")]),
        step("step-end", [], { outcomeId: reachedCare.id }),
        step("step-orphan", [], {
          title: "The orphan",
          outcomeId: reachedCare.id,
        }),
      ],
      { outcomes: [reachedCare] },
    );

    const problems = validateForPublish(document);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("unreachable-step");
    expect(problems[0].stepId).toBe("step-orphan");
  });

  it("reports an Ending with no Outcome", () => {
    const document = graph([
      step("step-start", [choice("choice-1", "step-end")]),
      step("step-end", [], { title: "The last light" }),
    ]);

    const problems = validateForPublish(document);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("ending-without-outcome");
    expect(problems[0].stepId).toBe("step-end");
  });

  it("reports an Ending tagged with an Outcome that does not exist", () => {
    const document = graph([
      step("step-start", [choice("choice-1", "step-end")]),
      step("step-end", [], { outcomeId: "outcome-renamed-away" }),
    ]);

    const problems = validateForPublish(document);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("unknown-outcome");
    expect(problems[0].stepId).toBe("step-end");
  });

  it("ignores an outcome id on a Step that is not an Ending", () => {
    const document = graph(
      [
        step("step-start", [choice("choice-1", "step-end")], {
          outcomeId: "outcome-renamed-away",
        }),
        step("step-end", [], { outcomeId: reachedCare.id }),
      ],
      { outcomes: [reachedCare] },
    );

    expect(validateForPublish(document)).toEqual([]);
  });

  it("reports both Choices that close a two-step loop", () => {
    const document = graph([
      step("step-start", [choice("choice-1", "step-back")]),
      step("step-back", [choice("choice-2", "step-start")]),
    ]);

    const cycles = validateForPublish(document).filter(
      (problem) => problem.code === "cycle",
    );

    expect(cycles.map((problem) => [problem.stepId, problem.choiceId])).toEqual(
      [
        ["step-start", "choice-1"],
        ["step-back", "choice-2"],
      ],
    );
  });

  it("reports a Choice that points at its own Step", () => {
    const document = graph([
      step("step-start", [
        choice("choice-on", "step-end"),
        choice("choice-round", "step-start"),
      ]),
      step("step-end", [], { outcomeId: reachedCare.id }),
    ]);

    const cycles = validateForPublish(document).filter(
      (problem) => problem.code === "cycle",
    );

    expect(cycles).toHaveLength(1);
    expect(cycles[0].stepId).toBe("step-start");
    expect(cycles[0].choiceId).toBe("choice-round");
  });

  it("reports the Choices inside a longer loop but not the one leading into it", () => {
    const document = graph([
      step("step-start", [choice("choice-1", "step-two")]),
      step("step-two", [choice("choice-2", "step-three")]),
      step("step-three", [
        choice("choice-3", "step-end"),
        choice("choice-back", "step-two"),
      ]),
      step("step-end", [], { outcomeId: reachedCare.id }),
    ]);

    const cycles = validateForPublish(document).filter(
      (problem) => problem.code === "cycle",
    );

    expect(cycles.map((problem) => [problem.stepId, problem.choiceId])).toEqual(
      [
        ["step-two", "choice-2"],
        ["step-three", "choice-back"],
      ],
    );
  });

  it("does not call branches that merge back together a loop", () => {
    const document = graph(
      [
        step("step-start", [
          choice("choice-left", "step-left"),
          choice("choice-right", "step-right"),
        ]),
        step("step-left", [choice("choice-l", "step-join")]),
        step("step-right", [choice("choice-r", "step-join")]),
        step("step-join", [], { outcomeId: reachedCare.id }),
      ],
      { outcomes: [reachedCare] },
    );

    expect(validateForPublish(document)).toEqual([]);
  });

  it("carries the ids the canvas needs on every problem", () => {
    const document = graph([
      step("step-start", [
        choice("choice-1", "step-gone"),
        choice("choice-2", "step-end"),
      ]),
      step("step-end", []),
    ]);

    const problems = validateForPublish(document);

    expect(problems.map((problem) => problem.code)).toEqual([
      "dangling-choice-target",
      "ending-without-outcome",
    ]);
    expect(problems[0]).toMatchObject({
      stepId: "step-start",
      choiceId: "choice-1",
    });
    expect(problems[1].stepId).toBe("step-end");
    expect(problems[1].choiceId).toBeUndefined();
  });

  it("reports problems grouped by rule and then in Step order, so the list is stable", () => {
    const document = graph([
      step("step-start", [
        choice("choice-a", "step-two"),
        choice("choice-b", "step-gone"),
      ]),
      step("step-two", [choice("choice-c", "step-also-gone")]),
    ]);

    const problems = validateForPublish(document);

    expect(problems.map((problem) => problem.choiceId)).toEqual([
      "choice-b",
      "choice-c",
    ]);
  });

  it("gives every problem a message an Author can read", () => {
    const document = graph([
      step("step-start", [choice("choice-1", "step-end")]),
      step("step-end", [], { title: "The last light" }),
    ]);

    expect(validateForPublish(document)[0].message).toContain("The last light");
  });
});
