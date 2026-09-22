import { describe, expect, it } from "vitest";

import type { Step } from "@/lib/graph/document";
import {
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

function stepWith(prompt: Step["prompt"]): Step {
  return {
    id: "queue",
    title: "Still waiting",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    choices: [
      {
        id: "c",
        label: "Wait",
        targetStepId: "end",
        condition: null,
        effect: null,
      },
    ],
    prompt,
    outcomeId: null,
    position: null,
  };
}

const optional = stepWith({
  type: "free_text",
  label: "How do you feel?",
  required: false,
});
const required = stepWith({
  type: "free_text",
  label: "How do you feel?",
  required: true,
});
const unprompted = stepWith(null);

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
