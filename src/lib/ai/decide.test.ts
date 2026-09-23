import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DECISION_THRESHOLD,
  buildDecision,
  decideChoice,
  gatewayJudge,
  type Decision,
  type Judge,
} from "@/lib/ai/decide";
import type { Step } from "@/lib/graph/document";

/**
 * Seam A for ticket 43's decision: `decideChoice` against a stub `Judge`,
 * never the gateway. `gatewayJudge` gets its own seam below, at the one
 * system boundary it owns — `experimental_evaluate` — so the timeout and
 * retry setting a Participant's wait depends on are proved without a real
 * network call.
 */

const mockEvaluate = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ experimental_evaluate: mockEvaluate }));

function stepWith(
  choices: Array<{ id: string; label: string }>,
  outcomeId: string | null = null,
): Step {
  return {
    id: "queue",
    title: "Still waiting",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "The line inches forward." }],
        },
      ],
    },
    choices: choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      targetStepId: `target-${choice.id}`,
      condition: null,
      effect: null,
    })),
    prompt: {
      type: "free_text",
      label: "What do you do?",
      required: true,
      decides: true,
    },
    outcomeId,
    position: null,
  };
}

const step = stepWith([
  { id: "choice-wait", label: "Wait your turn" },
  { id: "choice-leave", label: "Walk away" },
]);

function stubJudge(
  answer: { choiceId: string; probability: number } | null,
): Judge {
  return async () => answer;
}

function throwingJudge(): Judge {
  return async () => {
    throw new Error("gateway is down");
  };
}

describe("decideChoice", () => {
  it("is confident at or above the threshold", async () => {
    const judge = stubJudge({
      choiceId: "choice-wait",
      probability: DECISION_THRESHOLD,
    });

    const decision = await decideChoice(step, "I'll wait", judge);

    expect(decision).toEqual<Decision>({
      kind: "confident",
      choiceId: "choice-wait",
      probability: DECISION_THRESHOLD,
    });
  });

  it("is weak below the threshold, still naming the judge's pick", async () => {
    const judge = stubJudge({ choiceId: "choice-leave", probability: 0.2 });

    const decision = await decideChoice(step, "maybe I'll leave", judge);

    expect(decision).toEqual<Decision>({
      kind: "weak",
      choiceId: "choice-leave",
      probability: 0.2,
    });
  });

  it("is none when the judge returns null", async () => {
    const decision = await decideChoice(step, "unclear", stubJudge(null));

    expect(decision).toEqual<Decision>({ kind: "none" });
  });

  it("is none when the judge throws, and never rejects itself", async () => {
    await expect(
      decideChoice(step, "anything", throwingJudge()),
    ).resolves.toEqual({ kind: "none" } satisfies Decision);
  });

  it("is none when the judge names a Choice the Step does not have", async () => {
    const judge = stubJudge({
      choiceId: "not-a-real-choice",
      probability: 0.9,
    });

    const decision = await decideChoice(step, "anything", judge);

    expect(decision).toEqual<Decision>({ kind: "none" });
  });
});

describe("buildDecision", () => {
  it("carries the Step's title, content, Prompt label, Choices, and the Response, and nothing else", () => {
    const input = buildDecision(step, "I'll wait here");

    expect(input.state).toEqual({
      stepTitle: "Still waiting",
      stepContent: "The line inches forward.",
      promptLabel: "What do you do?",
      choices: [
        { id: "choice-wait", label: "Wait your turn" },
        { id: "choice-leave", label: "Walk away" },
      ],
      response: "I'll wait here",
    });
  });

  it("never carries a target step id, an outcome, or any other Step", () => {
    const withOutcome = stepWith(
      [{ id: "choice-a", label: "Go" }],
      "reached-care",
    );
    const input = buildDecision(withOutcome, "go");

    const serialized = JSON.stringify(input);
    expect(serialized).not.toMatch(/targetStepId/);
    expect(serialized).not.toMatch(/target-choice-a/);
    expect(serialized).not.toMatch(/reached-care/);
    expect(serialized).not.toMatch(/outcomeId/);
  });

  it("names the question as a choice over the Choice ids", () => {
    const input = buildDecision(step, "wait");

    expect(input.question.type).toBe("choice");
    expect(input.question.criteria).toEqual({
      "choice-wait": "Wait your turn",
      "choice-leave": "Walk away",
    });
  });
});

describe("gatewayJudge", () => {
  beforeEach(() => {
    mockEvaluate.mockReset();
  });

  it("asks jev on the gateway with no retry and a bounded timeout, tagged for usage reporting", async () => {
    mockEvaluate.mockResolvedValue({
      answers: {
        decision: {
          type: "choice",
          choice: "c1",
          probabilities: { c1: 0.8 },
        },
      },
    });

    const result = await gatewayJudge(buildDecision(step, "I'll wait"));

    expect(result).toEqual({ choiceId: "c1", probability: 0.8 });
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "typesafe-ai/jev",
        maxRetries: 0,
        abortSignal: expect.any(AbortSignal),
        providerOptions: { gateway: { tags: ["feature:decide"] } },
      }),
    );
    const call = mockEvaluate.mock.calls[0][0] as {
      abortSignal: AbortSignal;
    };
    expect(call.abortSignal.aborted).toBe(false);
  });

  it("is null when the answer carries no probabilities", async () => {
    mockEvaluate.mockResolvedValue({
      answers: { decision: { type: "choice", choice: "c1" } },
    });

    expect(await gatewayJudge(buildDecision(step, "I'll wait"))).toBeNull();
  });

  it("is null when the choice is empty", async () => {
    mockEvaluate.mockResolvedValue({
      answers: {
        decision: { type: "choice", choice: "", probabilities: {} },
      },
    });

    expect(await gatewayJudge(buildDecision(step, "I'll wait"))).toBeNull();
  });

  it("is null when the answer is not a choice", async () => {
    mockEvaluate.mockResolvedValue({
      answers: { decision: { type: "text", text: "unrelated" } },
    });

    expect(await gatewayJudge(buildDecision(step, "I'll wait"))).toBeNull();
  });
});
