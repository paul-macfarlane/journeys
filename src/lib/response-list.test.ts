import { describe, expect, it } from "vitest";

import type { GraphDocument, Step } from "@/lib/graph/document";
import { groupResponsesByStep, type ResponseRow } from "@/lib/response-list";

/**
 * Seam A for ticket 12's Responses tab: the rows a Journey has recorded,
 * arranged per Step the way a Member reads them.
 */

function step(
  id: string,
  title: string,
  prompt: Step["prompt"],
  leadsTo: string[] = [],
): Step {
  return {
    id,
    title,
    content: { type: "doc", content: [{ type: "paragraph" }] },
    choices: leadsTo.map((targetStepId) => ({
      id: `${id}-to-${targetStepId}`,
      label: targetStepId,
      targetStepId,
      condition: null,
      effect: null,
    })),
    prompt,
    outcomeId: null,
    position: null,
  };
}

function prompt(label: string): Step["prompt"] {
  return { type: "free_text", label, required: false };
}

// Keyed out of walk order on purpose — Postgres reorders jsonb keys, so the
// order a document's Steps come back in means nothing.
const document: GraphDocument = {
  schemaVersion: 1,
  startStepId: "start",
  allowBack: true,
  steps: {
    end: step("end", "", prompt("What would you change?")),
    queue: step("queue", "Still waiting", prompt("How do you feel?"), ["end"]),
    start: step("start", "Border post", null, ["queue"]),
  },
  outcomes: {},
  layoutDirection: "TB",
};

function row(stepId: string, text: string, at: number): ResponseRow {
  return { stepId, text, createdAt: new Date(at) };
}

describe("groupResponsesByStep", () => {
  it("lists every Step with a Prompt in walk order from the Start, empty or not", () => {
    expect(groupResponsesByStep(document, [])).toEqual([
      {
        stepId: "queue",
        title: "Still waiting",
        promptLabel: "How do you feel?",
        responses: [],
      },
      {
        stepId: "end",
        title: "end",
        promptLabel: "What would you change?",
        responses: [],
      },
    ]);
  });

  it("files each row under its Step, keeping the rows' own order", () => {
    const grouped = groupResponsesByStep(document, [
      row("end", "Nothing", 3),
      row("queue", "Tired", 1),
      row("queue", "Hopeful", 2),
    ]);

    expect(grouped.map((group) => group.stepId)).toEqual(["queue", "end"]);
    expect(grouped[0].responses).toEqual([
      { text: "Tired", createdAt: new Date(1) },
      { text: "Hopeful", createdAt: new Date(2) },
    ]);
    expect(grouped[1].responses).toEqual([
      { text: "Nothing", createdAt: new Date(3) },
    ]);
  });

  it("puts a prompted Step the Start cannot reach after the ones it can", () => {
    const withIsland: GraphDocument = {
      ...document,
      steps: {
        ...document.steps,
        island: step("island", "Cut off", prompt("Still here?")),
      },
    };
    expect(
      groupResponsesByStep(withIsland, []).map((group) => group.stepId),
    ).toEqual(["queue", "end", "island"]);
  });

  it("keeps rows for a Step that no longer has a Prompt, or no longer exists", () => {
    const grouped = groupResponsesByStep(document, [
      row("gone", "From an older version", 1),
      row("start", "Before the prompt was removed", 2),
    ]);

    // After the prompted Steps, in the order their rows first appear.
    expect(grouped.map((group) => group.stepId)).toEqual([
      "queue",
      "end",
      "gone",
      "start",
    ]);
    expect(grouped[2]).toEqual({
      stepId: "gone",
      title: "gone",
      promptLabel: null,
      responses: [{ text: "From an older version", createdAt: new Date(1) }],
    });
    expect(grouped[3]).toMatchObject({
      title: "Border post",
      promptLabel: null,
    });
  });

  it("never carries a Run or Participant identifier through", () => {
    const grouped = groupResponsesByStep(document, [row("queue", "Tired", 1)]);
    expect(Object.keys(grouped[0].responses[0]).sort()).toEqual([
      "createdAt",
      "text",
    ]);
  });
});
