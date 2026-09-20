import { describe, expect, it } from "vitest";

import type { Content } from "@/lib/graph/content";
import type {
  Choice,
  GraphDocument,
  Outcome,
  Step,
} from "@/lib/graph/document";
import { graphDocumentSchema, isEnding } from "@/lib/graph/document";
import case3Fixture from "@/lib/graph/fixtures/case-3.json";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";
import { validateForPublish } from "@/lib/graph/validate";

import outcomesMapping from "../../../scripts/seed-case-3/outcomes.json";

/**
 * The second success case is not hand-authored: it is the real case-3 Journey
 * the seed script writes, read back from the fixture it emits. Parsed through
 * the schema rather than trusted.
 */
const case3: GraphDocument = graphDocumentSchema.parse(case3Fixture);

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

  it("finds nothing wrong with the seeded case-3 journey", () => {
    expect(validateForPublish(case3)).toEqual([]);
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

/**
 * A regression lock on the committed fixture: what the seed script produced
 * from the legacy site as it was crawled on 2026-09-20 — 36 Steps entered at
 * "Preface", 50 Choices, and 6 Endings, each tagged with the Outcome
 * `scripts/seed-case-3/outcomes.json` gives it. These assertions read the
 * committed fixture, so they only change when someone reruns the seed with
 * `--write-fixture`; the check against the live site is `e2e/seed-case-3.spec.ts`.
 */
describe("the seeded case-3 journey", () => {
  const steps = Object.values(case3.steps);

  it("holds every Step the legacy case has, entered at the Preface", () => {
    expect(steps).toHaveLength(36);
    expect(case3.startStepId).toBe("step-7");
    expect(case3.steps[case3.startStepId].title).toBe("Preface");
  });

  it("holds every Choice the legacy case offers", () => {
    const choices = steps.flatMap((step) => step.choices);

    expect(choices).toHaveLength(50);
    // Three Choices on one Step that all lead to the same Step stay three.
    expect(case3.steps["step-14"].choices).toHaveLength(3);
    for (const choice of case3.steps["step-14"].choices) {
      expect(choice.targetStepId).toBe("step-22");
    }
  });

  it("ends exactly where the legacy case ends", () => {
    const endings = steps.filter((step) => isEnding(step));

    expect(endings.map((step) => step.id)).toEqual([
      "step-10",
      "step-20",
      "step-29",
      "step-30",
      "step-35",
      "step-36",
    ]);
  });

  it("tags each Ending with the Outcome the mapping gives it", () => {
    for (const ending of outcomesMapping.endings) {
      const step = case3.steps[`step-${ending.step}`];
      expect(isEnding(step)).toBe(true);
      expect(step.outcomeId).toBe(ending.outcomeId);
    }

    expect(Object.keys(case3.outcomes)).toEqual(
      outcomesMapping.outcomes.map((outcome) => outcome.id),
    );
  });

  it("credits every image and hotlinks it over http(s)", () => {
    const images = steps.flatMap((step) =>
      step.content.content.filter((block) => block.type === "image"),
    );

    expect(images).toHaveLength(5);
    for (const image of images) {
      expect(image.attrs.credit.trim().length).toBeGreaterThan(0);
      expect(image.attrs.src).toMatch(/^https?:\/\//);
    }
  });
});
