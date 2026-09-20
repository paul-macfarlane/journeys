import { describe, expect, it } from "vitest";

import {
  addChoice,
  addChoiceToNewStep,
  addOutcome,
  addStep,
  choicesTargeting,
  deleteStep,
  endingCountsByOutcome,
  moveChoice,
  removeChoice,
  removeOutcome,
  renameOutcome,
  retargetChoiceToNewStep,
  setStart,
  stepName,
  updateChoice,
  updateStep,
} from "@/lib/graph/edit";
import type {
  Choice,
  GraphDocument,
  Outcome,
  Step,
} from "@/lib/graph/document";
import type { Content } from "@/lib/graph/content";
import { validateForPublish } from "@/lib/graph/validate";

/**
 * Seam A for ticket 08: every pure edit operation, exercised through the one
 * public interface the editor calls. Every case checks that the input
 * document is left exactly as it was — a deep-equal snapshot taken before the
 * call — because the module's whole contract is "returns a new document,
 * never touches the one it is given".
 */

const emptyContent: Content = { type: "doc", content: [{ type: "paragraph" }] };

function choice(id: string, label: string, targetStepId: string): Choice {
  return { id, label, targetStepId, condition: null, effect: null };
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

function outcome(id: string, label: string): Outcome {
  return { id, label };
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/** Start -> two Choices -> two Endings, each tagged with its own Outcome. */
function buildDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: byId([
      step("start", [
        choice("choice-a", "Go to A", "ending-a"),
        choice("choice-b", "Go to B", "ending-b"),
      ]),
      step("ending-a", [], { title: "Ending A", outcomeId: "outcome-good" }),
      step("ending-b", [], { title: "Ending B", outcomeId: "outcome-bad" }),
    ]),
    outcomes: byId([
      outcome("outcome-good", "Good"),
      outcome("outcome-bad", "Bad"),
    ]),
  };
}

function snapshot(document: GraphDocument): GraphDocument {
  return structuredClone(document);
}

describe("stepName", () => {
  it("returns the title when it has content", () => {
    expect(stepName(step("s1", [], { title: "  Hello  " }))).toBe("  Hello  ");
  });

  it("falls back to the id when the title is blank", () => {
    expect(stepName(step("s1", [], { title: "   " }))).toBe("s1");
  });
});

describe("addStep", () => {
  it("adds a Step with the default title, empty content, and no Choices", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const { document: next, stepId } = addStep(document);

    expect(document).toEqual(before);
    expect(next.steps[stepId]).toEqual({
      id: stepId,
      title: "Untitled step",
      content: emptyContent,
      choices: [],
      prompt: null,
      outcomeId: null,
      position: null,
    });
  });

  it("adds a Step with the given title", () => {
    const document = buildDocument();

    const { document: next, stepId } = addStep(document, "New step");

    expect(next.steps[stepId].title).toBe("New step");
  });
});

describe("updateStep", () => {
  it("patches a Step's title, content, and outcomeId", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = updateStep(document, "ending-a", {
      title: "Renamed ending",
      outcomeId: "outcome-bad",
    });

    expect(document).toEqual(before);
    expect(next.steps["ending-a"]).toMatchObject({
      title: "Renamed ending",
      outcomeId: "outcome-bad",
    });
  });

  it('leaves the document unchanged for a Step id of "toString"', () => {
    const document = buildDocument();

    const next = updateStep(document, "toString", { title: "Nope" });

    expect(next).toBe(document);
  });
});

describe("setStart", () => {
  it("points startStepId at another existing Step", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = setStart(document, "ending-a");

    expect(document).toEqual(before);
    expect(next.startStepId).toBe("ending-a");
  });

  it("leaves the document unchanged for an unknown Step", () => {
    const document = buildDocument();

    const next = setStart(document, "missing");

    expect(next).toBe(document);
  });
});

describe("choicesTargeting", () => {
  it("finds every Choice on another Step aimed at the given Step", () => {
    const document = buildDocument();

    expect(choicesTargeting(document, "ending-a")).toEqual([
      {
        stepId: "start",
        stepTitle: "start",
        choice: choice("choice-a", "Go to A", "ending-a"),
      },
    ]);
  });

  it("excludes a Choice that targets its own Step", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: byId([step("start", [choice("choice-loop", "Loop", "start")])]),
      outcomes: {},
    };

    expect(choicesTargeting(document, "start")).toEqual([]);
  });
});

describe("deleteStep", () => {
  it("refuses to delete the Start", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const result = deleteStep(document, "start");

    expect(document).toEqual(before);
    expect(result).toEqual({
      ok: false,
      error: "Make another step the start first",
    });
  });

  it("removes the Step, reports each broken Choice, and leaves it dangling", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const result = deleteStep(document, "ending-a");

    expect(document).toEqual(before);
    if (!result.ok) {
      throw new Error("expected deleteStep to succeed");
    }
    expect(result.brokenChoices).toEqual([
      {
        stepId: "start",
        stepTitle: "start",
        choice: choice("choice-a", "Go to A", "ending-a"),
      },
    ]);
    expect(Object.hasOwn(result.document.steps, "ending-a")).toBe(false);
    expect(result.document.steps.start.choices).toContainEqual(
      choice("choice-a", "Go to A", "ending-a"),
    );
  });

  it("leaves validateForPublish reporting one dangling-choice-target per broken Choice", () => {
    const document = buildDocument();

    const result = deleteStep(document, "ending-a");

    if (!result.ok) {
      throw new Error("expected deleteStep to succeed");
    }
    const dangling = validateForPublish(result.document).filter(
      (problem) => problem.code === "dangling-choice-target",
    );

    expect(dangling).toHaveLength(result.brokenChoices.length);
    expect(dangling).toEqual([
      expect.objectContaining({ stepId: "start", choiceId: "choice-a" }),
    ]);
  });

  it("returns ok unchanged for an unknown Step", () => {
    const document = buildDocument();

    const result = deleteStep(document, "missing");

    expect(result).toEqual({ ok: true, document, brokenChoices: [] });
  });
});

describe("addChoice", () => {
  it("appends a Choice with null condition and effect", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const { document: next, choiceId } = addChoice(document, "ending-a", {
      label: "New choice",
      targetStepId: "ending-b",
    });

    expect(document).toEqual(before);
    expect(next.steps["ending-a"].choices).toContainEqual({
      id: choiceId,
      label: "New choice",
      targetStepId: "ending-b",
      condition: null,
      effect: null,
    });
  });

  it("leaves the document unchanged for an unknown Step", () => {
    const document = buildDocument();

    const { document: next } = addChoice(document, "missing", {
      label: "x",
      targetStepId: "ending-a",
    });

    expect(next).toBe(document);
  });
});

describe("addChoiceToNewStep", () => {
  it("creates a Step reachable from the Start and a Choice targeting it", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const {
      document: next,
      choiceId,
      stepId,
    } = addChoiceToNewStep(document, "start", { label: "Branch out" });

    expect(document).toEqual(before);
    expect(next.steps[stepId]).toBeDefined();
    expect(next.steps.start.choices).toContainEqual({
      id: choiceId,
      label: "Branch out",
      targetStepId: stepId,
      condition: null,
      effect: null,
    });
    const unreachable = validateForPublish(next).filter(
      (problem) =>
        problem.code === "unreachable-step" && problem.stepId === stepId,
    );
    expect(unreachable).toEqual([]);
  });
});

describe("updateChoice", () => {
  it("patches a Choice's label and target", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = updateChoice(document, "start", "choice-a", {
      label: "Renamed",
      targetStepId: "ending-b",
    });

    expect(document).toEqual(before);
    expect(next.steps.start.choices[0]).toMatchObject({
      label: "Renamed",
      targetStepId: "ending-b",
    });
  });

  it("leaves the document unchanged for an unknown Choice", () => {
    const document = buildDocument();

    const next = updateChoice(document, "start", "missing", { label: "x" });

    expect(next).toBe(document);
  });
});

describe("moveChoice", () => {
  it("swaps a Choice up with its neighbour", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = moveChoice(document, "start", "choice-b", "up");

    expect(document).toEqual(before);
    expect(next.steps.start.choices.map((c) => c.id)).toEqual([
      "choice-b",
      "choice-a",
    ]);
  });

  it("swaps a Choice down with its neighbour", () => {
    const document = buildDocument();

    const next = moveChoice(document, "start", "choice-a", "down");

    expect(next.steps.start.choices.map((c) => c.id)).toEqual([
      "choice-b",
      "choice-a",
    ]);
  });

  it("is a no-op moving the first Choice up", () => {
    const document = buildDocument();

    const next = moveChoice(document, "start", "choice-a", "up");

    expect(next.steps.start.choices.map((c) => c.id)).toEqual([
      "choice-a",
      "choice-b",
    ]);
  });

  it("is a no-op moving the last Choice down", () => {
    const document = buildDocument();

    const next = moveChoice(document, "start", "choice-b", "down");

    expect(next.steps.start.choices.map((c) => c.id)).toEqual([
      "choice-a",
      "choice-b",
    ]);
  });
});

describe("removeChoice", () => {
  it("removes a Choice from a Step", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = removeChoice(document, "start", "choice-a");

    expect(document).toEqual(before);
    expect(next.steps.start.choices.map((c) => c.id)).toEqual(["choice-b"]);
  });

  it("leaves the document unchanged for an unknown Choice", () => {
    const document = buildDocument();

    const next = removeChoice(document, "start", "missing");

    expect(next).toBe(document);
  });
});

describe("retargetChoiceToNewStep", () => {
  it("creates a new Step and retargets the Choice to it", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const { document: next, stepId } = retargetChoiceToNewStep(
      document,
      "start",
      "choice-a",
      "Detour",
    );

    expect(document).toEqual(before);
    expect(next.steps[stepId].title).toBe("Detour");
    expect(
      next.steps.start.choices.find((c) => c.id === "choice-a")?.targetStepId,
    ).toBe(stepId);
  });

  it("leaves the document unchanged for an unknown Choice", () => {
    const document = buildDocument();

    const result = retargetChoiceToNewStep(document, "start", "missing");

    expect(result).toEqual({ document, stepId: "start" });
  });

  it("leaves the document unchanged for an unknown Step", () => {
    const document = buildDocument();

    const result = retargetChoiceToNewStep(document, "missing", "choice-a");

    expect(result).toEqual({ document, stepId: "missing" });
  });
});

describe("addOutcome", () => {
  it("defines a new Outcome with the given label", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const { document: next, outcomeId } = addOutcome(document, "Great");

    expect(document).toEqual(before);
    expect(next.outcomes[outcomeId]).toEqual({ id: outcomeId, label: "Great" });
  });
});

describe("renameOutcome", () => {
  it("keeps the id and the Ending's tag", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = renameOutcome(document, "outcome-good", "Really good");

    expect(document).toEqual(before);
    expect(next.outcomes["outcome-good"]).toEqual({
      id: "outcome-good",
      label: "Really good",
    });
    expect(next.steps["ending-a"].outcomeId).toBe("outcome-good");
  });

  it("leaves the document unchanged for an unknown Outcome", () => {
    const document = buildDocument();

    const next = renameOutcome(document, "missing", "x");

    expect(next).toBe(document);
  });
});

describe("removeOutcome", () => {
  it("refuses removal while an Ending uses it", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const result = removeOutcome(document, "outcome-good");

    expect(document).toEqual(before);
    expect(result).toEqual({
      ok: false,
      error: "Endings still use this outcome",
    });
  });

  it("removes an unused Outcome", () => {
    const document = buildDocument();
    const { document: withExtra, outcomeId } = addOutcome(document, "Unused");

    const result = removeOutcome(withExtra, outcomeId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.hasOwn(result.document.outcomes, outcomeId)).toBe(false);
    }
  });

  it("returns ok unchanged for an unknown Outcome", () => {
    const document = buildDocument();

    const result = removeOutcome(document, "missing");

    expect(result).toEqual({ ok: true, document });
  });
});

describe("endingCountsByOutcome", () => {
  it("counts Endings tagged with each Outcome, including a zero", () => {
    const document = buildDocument();
    const { document: withExtra, outcomeId } = addOutcome(document, "Unused");

    expect(endingCountsByOutcome(withExtra)).toEqual({
      "outcome-good": 1,
      "outcome-bad": 1,
      [outcomeId]: 0,
    });
  });
});
