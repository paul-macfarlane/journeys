import { describe, expect, it } from "vitest";

import {
  addChoice,
  addChoiceToNewStep,
  addOutcome,
  addStep,
  choicesTargeting,
  createOutcomeForEnding,
  deleteStep,
  duplicateStep,
  endingCountsByOutcome,
  moveChoice,
  removeChoice,
  removeOutcome,
  renameOutcome,
  retargetChoiceToNewStep,
  setEndingOutcome,
  setLayoutDirection,
  setStart,
  setStepPrompt,
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
    layoutDirection: "TB",
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

describe("setLayoutDirection", () => {
  it("changes the Journey's layout direction", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = setLayoutDirection(document, "LR");

    expect(document).toEqual(before);
    expect(next.layoutDirection).toBe("LR");
  });

  it("returns the same document when the direction is already set", () => {
    const document = buildDocument();

    const next = setLayoutDirection(document, "TB");

    expect(next).toBe(document);
  });

  it("leaves every other field untouched", () => {
    const document = buildDocument();

    const next = setLayoutDirection(document, "LR");

    expect({ ...next, layoutDirection: document.layoutDirection }).toEqual(
      document,
    );
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
      layoutDirection: "TB",
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

describe("duplicateStep", () => {
  it("copies a Step's content, prompt, and outcomeId with no Choices, and leaves the document unchanged", () => {
    const original: Step = {
      id: "prompted",
      title: "Prompted",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        ],
      },
      choices: [choice("choice-a", "Go", "prompted")],
      prompt: { type: "free_text", label: "Name?", required: true },
      outcomeId: "outcome-good",
      position: null,
    };
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "prompted",
      allowBack: true,
      steps: byId([original]),
      outcomes: byId([outcome("outcome-good", "Good")]),
      layoutDirection: "TB",
    };
    const before = snapshot(document);

    const { document: next, stepId } = duplicateStep(document, "prompted");

    expect(document).toEqual(before);
    expect(next.steps[stepId]).toEqual({
      id: stepId,
      title: "Prompted copy",
      content: original.content,
      choices: [],
      prompt: original.prompt,
      outcomeId: "outcome-good",
      position: null,
    });
  });

  it("does not share the copy's content object identity with the original's", () => {
    const document = buildDocument();

    const { document: next, stepId } = duplicateStep(document, "ending-a");

    expect(next.steps[stepId].content).toEqual(
      document.steps["ending-a"].content,
    );
    expect(next.steps[stepId].content).not.toBe(
      document.steps["ending-a"].content,
    );
  });

  it("does not share the copy's Prompt object identity with the original's", () => {
    const prompted: Step = {
      ...step("prompted", [], { title: "Prompted" }),
      prompt: { type: "free_text", label: "Name?", required: true },
    };
    const document: GraphDocument = {
      ...buildDocument(),
      steps: byId([prompted]),
      startStepId: "prompted",
    };

    const { document: next, stepId } = duplicateStep(document, "prompted");

    expect(next.steps[stepId].prompt).toEqual(prompted.prompt);
    expect(next.steps[stepId].prompt).not.toBe(prompted.prompt);
  });

  it("names the copy of a Step with a blank title from its id", () => {
    const document = buildDocument();
    const untitled = updateStep(document, "ending-a", { title: "   " });

    const { document: next, stepId } = duplicateStep(untitled, "ending-a");

    expect(next.steps[stepId].title).toBe("ending-a copy");
  });

  it("trims the title so the whole stays within the schema's 200 characters", () => {
    const document = buildDocument();
    const withLongTitle = updateStep(document, "ending-a", {
      title: "x".repeat(200),
    });

    const { document: next, stepId } = duplicateStep(withLongTitle, "ending-a");

    expect(next.steps[stepId].title).toBe(`${"x".repeat(195)} copy`);
    expect(next.steps[stepId].title).toHaveLength(200);
  });

  it("leaves the document unchanged for an unknown Step", () => {
    const document = buildDocument();

    const result = duplicateStep(document, "missing");

    expect(result).toEqual({ document, stepId: "" });
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

  it("removes an Outcome a Step still carries once that Step has Choices, and clears the tag", () => {
    const document = buildDocument();
    const tagged = Object.values(document.steps).find(
      (candidate) => candidate.outcomeId === "outcome-good",
    );
    if (!tagged) throw new Error("fixture has no Ending tagged outcome-good");
    // The Ending grows a Choice, so it is an Ending no longer; its tag is a
    // leftover the panel cannot reach.
    const { document: grown } = addChoiceToNewStep(document, tagged.id, {
      label: "Go on",
    });

    const result = removeOutcome(grown, "outcome-good");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.hasOwn(result.document.outcomes, "outcome-good")).toBe(
        false,
      );
      expect(result.document.steps[tagged.id].outcomeId).toBeNull();
    }
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

/** Start -> two Choices -> two untagged Endings, with one Outcome defined. */
function untaggedEndingsDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: byId([
      step("start", [
        choice("choice-a", "Go to A", "ending-a"),
        choice("choice-b", "Go to B", "ending-b"),
      ]),
      step("ending-a", [], { title: "Ending A" }),
      step("ending-b", [], { title: "Ending B" }),
    ]),
    outcomes: byId([outcome("outcome-care", "Reached care")]),
    layoutDirection: "TB",
  };
}

/** The same shape with both Endings sharing one of the two Outcomes. */
function sharedOutcomeDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: byId([
      step("start", [
        choice("choice-a", "Go to A", "ending-a"),
        choice("choice-b", "Go to B", "ending-b"),
      ]),
      step("ending-a", [], { title: "Ending A", outcomeId: "outcome-care" }),
      step("ending-b", [], { title: "Ending B", outcomeId: "outcome-care" }),
    ]),
    outcomes: byId([
      outcome("outcome-care", "Reached care"),
      outcome("outcome-away", "Turned away"),
    ]),
    layoutDirection: "TB",
  };
}

describe("setEndingOutcome", () => {
  it("tags an Ending with an Outcome the Journey defines", () => {
    const document = untaggedEndingsDocument();
    const before = snapshot(document);

    const next = setEndingOutcome(document, "ending-a", "outcome-care");

    expect(document).toEqual(before);
    expect(next.steps["ending-a"].outcomeId).toBe("outcome-care");
    expect(next.outcomes).toEqual({
      "outcome-care": { id: "outcome-care", label: "Reached care" },
    });
    // Everything the tag is not about, left exactly as it was.
    expect(next.steps["start"]).toEqual(before.steps["start"]);
    expect(next.steps["ending-b"]).toEqual(before.steps["ending-b"]);
    expect(next.startStepId).toBe("start");
    expect(next.allowBack).toBe(true);
    expect(next.layoutDirection).toBe("TB");
    expect(next.schemaVersion).toBe(1);
  });

  it("removes the Outcome it dropped once no Ending carries it", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = setEndingOutcome(document, "ending-a", "outcome-bad");

    expect(document).toEqual(before);
    expect(next.steps["ending-a"].outcomeId).toBe("outcome-bad");
    expect(next.outcomes).toEqual({
      "outcome-bad": { id: "outcome-bad", label: "Bad" },
    });
  });

  it("keeps the Outcome it dropped while another Ending still carries it", () => {
    const document = sharedOutcomeDocument();
    const before = snapshot(document);

    const next = setEndingOutcome(document, "ending-a", "outcome-away");

    expect(document).toEqual(before);
    expect(next.steps["ending-a"].outcomeId).toBe("outcome-away");
    expect(next.steps["ending-b"].outcomeId).toBe("outcome-care");
    expect(next.outcomes).toEqual({
      "outcome-care": { id: "outcome-care", label: "Reached care" },
      "outcome-away": { id: "outcome-away", label: "Turned away" },
    });
  });

  it("clears the tag and removes the Outcome the last Ending dropped", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const next = setEndingOutcome(document, "ending-a", null);

    expect(document).toEqual(before);
    expect(next.steps["ending-a"].outcomeId).toBeNull();
    expect(next.outcomes).toEqual({
      "outcome-bad": { id: "outcome-bad", label: "Bad" },
    });
    expect(next.steps["start"]).toEqual(before.steps["start"]);
  });

  it("clears the tag and keeps an Outcome another Ending shares", () => {
    const document = sharedOutcomeDocument();

    const next = setEndingOutcome(document, "ending-a", null);

    expect(next.steps["ending-a"].outcomeId).toBeNull();
    expect(next.steps["ending-b"].outcomeId).toBe("outcome-care");
    expect(next.outcomes).toEqual({
      "outcome-care": { id: "outcome-care", label: "Reached care" },
      "outcome-away": { id: "outcome-away", label: "Turned away" },
    });
  });

  it("leaves the document unchanged for an unknown Step", () => {
    const document = untaggedEndingsDocument();

    expect(setEndingOutcome(document, "missing", "outcome-care")).toBe(
      document,
    );
  });

  it("leaves the document unchanged for a Step that is not an Ending", () => {
    const document = untaggedEndingsDocument();

    expect(setEndingOutcome(document, "start", "outcome-care")).toBe(document);
  });

  it("leaves the document unchanged for an Outcome it does not define", () => {
    const document = untaggedEndingsDocument();

    expect(setEndingOutcome(document, "ending-a", "outcome-missing")).toBe(
      document,
    );
  });

  it("returns the same document when the Ending already carries it", () => {
    const document = buildDocument();

    expect(setEndingOutcome(document, "ending-a", "outcome-good")).toBe(
      document,
    );
  });

  it("returns the same document when an untagged Ending is cleared", () => {
    const document = untaggedEndingsDocument();

    expect(setEndingOutcome(document, "ending-a", null)).toBe(document);
  });
});

describe("createOutcomeForEnding", () => {
  it("defines the Outcome and tags the Ending in one edit", () => {
    const document = untaggedEndingsDocument();
    const before = snapshot(document);

    const { document: next, outcomeId } = createOutcomeForEnding(
      document,
      "ending-a",
      "Turned away",
    );

    expect(document).toEqual(before);
    expect(next.outcomes[outcomeId]).toEqual({
      id: outcomeId,
      label: "Turned away",
    });
    expect(next.steps["ending-a"].outcomeId).toBe(outcomeId);
    // The Outcome the Journey already had, untouched.
    expect(next.outcomes["outcome-care"]).toEqual({
      id: "outcome-care",
      label: "Reached care",
    });
    expect(next.steps["start"]).toEqual(before.steps["start"]);
    expect(next.steps["ending-b"]).toEqual(before.steps["ending-b"]);
  });

  it("removes the Outcome the Ending dropped once no Ending carries it", () => {
    const document = buildDocument();
    const before = snapshot(document);

    const { document: next, outcomeId } = createOutcomeForEnding(
      document,
      "ending-a",
      "Reached care",
    );

    expect(document).toEqual(before);
    expect(next.steps["ending-a"].outcomeId).toBe(outcomeId);
    expect(next.outcomes).toEqual({
      "outcome-bad": { id: "outcome-bad", label: "Bad" },
      [outcomeId]: { id: outcomeId, label: "Reached care" },
    });
  });

  it("keeps the Outcome the Ending dropped while another Ending carries it", () => {
    const document = sharedOutcomeDocument();

    const { document: next, outcomeId } = createOutcomeForEnding(
      document,
      "ending-a",
      "Sent home",
    );

    expect(next.steps["ending-a"].outcomeId).toBe(outcomeId);
    expect(next.steps["ending-b"].outcomeId).toBe("outcome-care");
    expect(next.outcomes).toEqual({
      "outcome-care": { id: "outcome-care", label: "Reached care" },
      "outcome-away": { id: "outcome-away", label: "Turned away" },
      [outcomeId]: { id: outcomeId, label: "Sent home" },
    });
  });

  it("creates nothing for an unknown Step", () => {
    const document = untaggedEndingsDocument();

    expect(createOutcomeForEnding(document, "missing", "Turned away")).toEqual({
      document,
      outcomeId: "",
    });
  });

  it("creates nothing for a Step that is not an Ending", () => {
    const document = untaggedEndingsDocument();

    const result = createOutcomeForEnding(document, "start", "Turned away");

    expect(result.document).toBe(document);
    expect(result.outcomeId).toBe("");
  });
});

describe("setStepPrompt", () => {
  const base = buildDocument();

  it("attaches a free-text Prompt to a Step", () => {
    const before = structuredClone(base);
    const next = setStepPrompt(base, "start", {
      label: "How do you feel?",
      required: true,
    });

    expect(next.steps.start.prompt).toEqual({
      type: "free_text",
      label: "How do you feel?",
      required: true,
    });
    expect(base).toEqual(before);
  });

  it("keeps the label as typed, spaces and all, while it is not blank", () => {
    const next = setStepPrompt(base, "start", {
      label: " How do you feel? ",
      required: false,
    });
    expect(next.steps.start.prompt?.label).toBe(" How do you feel? ");
  });

  it("removes the Prompt when the label is blank", () => {
    const prompted = setStepPrompt(base, "start", {
      label: "How do you feel?",
      required: true,
    });
    expect(
      setStepPrompt(prompted, "start", { label: "", required: true }).steps
        .start.prompt,
    ).toBeNull();
    expect(
      setStepPrompt(prompted, "start", { label: "  \n", required: true }).steps
        .start.prompt,
    ).toBeNull();
  });

  it("returns the document unchanged for an unknown Step", () => {
    expect(
      setStepPrompt(base, "missing", { label: "x", required: false }),
    ).toBe(base);
  });
});
