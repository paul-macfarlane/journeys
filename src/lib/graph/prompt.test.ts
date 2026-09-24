import { describe, expect, it } from "vitest";

import type { Step } from "@/lib/graph/document";
import {
  isDeciding,
  MAX_RESPONSE_LENGTH,
  readResponse,
  refusalNotice,
} from "@/lib/graph/prompt";

/**
 * Seam A for ticket 12's runner rule: what a Participant's form field means
 * for the Step it was posted from — an answer to save, nothing to save, or a
 * refusal — read the same way by the first-Choice action, the step action,
 * and Preview.
 */

/** `choiceCount` Choices, so a test can name a Step with fewer than two — the
 * boundary `isDeciding` cares about. */
function stepWith(prompt: Step["prompt"], choiceCount = 1): Step {
  return {
    id: "queue",
    title: "Still waiting",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    choices: Array.from({ length: choiceCount }, (_, index) => ({
      id: `c${index}`,
      label: `Choice ${index}`,
      targetStepId: "end",
      condition: null,
      effect: null,
    })),
    prompt,
    outcomeId: null,
    position: null,
  };
}

const optional = stepWith({
  type: "free_text",
  label: "How do you feel?",
  required: false,
  decides: false,
});
const required = stepWith({
  type: "free_text",
  label: "How do you feel?",
  required: true,
  decides: false,
});
/** `decides: true` but only one Choice — not really deciding (ticket 43 F3). */
const decidingOneChoice = stepWith(
  { type: "free_text", label: "Which way?", required: false, decides: true },
  1,
);
/** `decides: true` with two Choices — genuinely deciding. */
const decidingTwoChoices = stepWith(
  { type: "free_text", label: "Which way?", required: false, decides: true },
  2,
);
const unprompted = stepWith(null, 0);

describe("readResponse", () => {
  it("is skipped on a Step with no Prompt, whatever was posted", () => {
    expect(readResponse(unprompted, "I typed anyway")).toEqual({
      kind: "skipped",
    });
    expect(readResponse(unprompted, undefined)).toEqual({ kind: "skipped" });
  });

  it("is an answer with its ends trimmed and its inner lines kept", () => {
    expect(readResponse(optional, "  first line\nsecond line \n")).toEqual({
      kind: "answered",
      text: "first line\nsecond line",
    });
  });

  it("is skipped for a blank or absent answer to an optional Prompt", () => {
    expect(readResponse(optional, "")).toEqual({ kind: "skipped" });
    expect(readResponse(optional, "   \n ")).toEqual({ kind: "skipped" });
    expect(readResponse(optional, null)).toEqual({ kind: "skipped" });
    expect(readResponse(optional, undefined)).toEqual({ kind: "skipped" });
  });

  it("is missing for a blank or absent answer to a required Prompt", () => {
    expect(readResponse(required, "")).toEqual({ kind: "missing" });
    expect(readResponse(required, " \n")).toEqual({ kind: "missing" });
    expect(readResponse(required, undefined)).toEqual({ kind: "missing" });
  });

  it("is missing for a blank answer to a deciding Prompt with two or more Choices, even when required is stored false", () => {
    expect(readResponse(decidingTwoChoices, "")).toEqual({ kind: "missing" });
    expect(readResponse(decidingTwoChoices, "   \n ")).toEqual({
      kind: "missing",
    });
    expect(readResponse(decidingTwoChoices, undefined)).toEqual({
      kind: "missing",
    });
  });

  it("is skipped for a blank answer to a Step with `decides: true` but fewer than two Choices — an Ending or a single-Choice Step, where it is not really deciding", () => {
    expect(readResponse(decidingOneChoice, "")).toEqual({ kind: "skipped" });
    expect(readResponse(decidingOneChoice, "   \n ")).toEqual({
      kind: "skipped",
    });
    expect(readResponse(decidingOneChoice, undefined)).toEqual({
      kind: "skipped",
    });
  });

  it("treats anything that is not a string as absent", () => {
    // A `File` or a repeated field: not text a Participant typed.
    expect(readResponse(required, ["a", "b"])).toEqual({ kind: "missing" });
    expect(readResponse(optional, 42)).toEqual({ kind: "skipped" });
  });

  it("refuses an answer over the cap, measured after trimming", () => {
    const atCap = "x".repeat(MAX_RESPONSE_LENGTH);
    expect(readResponse(optional, `  ${atCap}  `)).toEqual({
      kind: "answered",
      text: atCap,
    });
    expect(readResponse(optional, `${atCap}y`)).toEqual({ kind: "too-long" });
    expect(readResponse(required, `${atCap}y`)).toEqual({ kind: "too-long" });
  });
});

describe("refusalNotice", () => {
  it("names the notice for each refusal and nothing otherwise", () => {
    expect(refusalNotice({ kind: "missing" })).toBe("response-required");
    expect(refusalNotice({ kind: "too-long" })).toBe("response-too-long");
    expect(refusalNotice({ kind: "skipped" })).toBeNull();
    expect(refusalNotice({ kind: "answered", text: "x" })).toBeNull();
  });
});

describe("isDeciding", () => {
  it("is true only when the Prompt decides and the Step has two or more Choices", () => {
    expect(isDeciding(decidingTwoChoices)).toBe(true);
    expect(isDeciding(decidingOneChoice)).toBe(false);
    expect(isDeciding(required)).toBe(false);
    expect(isDeciding(unprompted)).toBe(false);
  });

  it("is false on an Ending (zero Choices) even when the Prompt decides", () => {
    const ending: Step = { ...decidingTwoChoices, choices: [] };
    expect(isDeciding(ending)).toBe(false);
  });
});
