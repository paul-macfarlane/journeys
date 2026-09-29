import { describe, expect, it } from "vitest";

import { failureResult } from "@/lib/action-result";
import type { PublishProblem } from "@/lib/graph/validate";
import { conflict, invalid, notFound, stale } from "@/lib/write-result";

/**
 * Seam A for ticket 82's one refusal-to-sentence mapping. Every expected
 * sentence is written out, so a change to the copy a Member reads shows up
 * here rather than passing by construction.
 */
describe("failureResult", () => {
  it("names what a not-found lost", () => {
    expect(failureResult(notFound(), { missing: "project" })).toEqual({
      ok: false,
      error: "That project no longer exists",
    });
    expect(failureResult(notFound(), { missing: "journey" })).toEqual({
      ok: false,
      error: "That journey no longer exists",
    });
    expect(failureResult(notFound(), { missing: "version" })).toEqual({
      ok: false,
      error: "That version no longer exists",
    });
  });

  it("answers a conflict with the publish race sentence", () => {
    expect(failureResult(conflict(), { missing: "journey" })).toEqual({
      ok: false,
      error:
        "Another member published this journey just now. Reload to see their version, then publish again.",
    });
  });

  it("names what another Member changed on a stale write", () => {
    expect(
      failureResult(stale(), { missing: "journey", stale: "draft" }),
    ).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this draft since you opened it. Reload to see their changes.",
    });
    expect(failureResult(stale(), { missing: "project" })).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this project since you opened it. Reload to see their changes.",
    });
    expect(failureResult(stale(), { missing: "journey" })).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this journey since you opened it. Reload to see their changes.",
    });
  });

  it("answers a stale version write as a stale Draft", () => {
    expect(failureResult(stale(), { missing: "version" })).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this draft since you opened it. Reload to see their changes.",
    });
  });

  it("passes an invalid write's sentence, Step, and problems through", () => {
    const problems: PublishProblem[] = [
      {
        code: "empty-choice-label",
        message: "Give every choice a label",
        stepId: "s1",
        choiceId: "c1",
      },
    ];

    expect(
      failureResult(
        invalid("Fix the story first", { stepId: "s1", problems }),
        {
          missing: "journey",
        },
      ),
    ).toEqual({
      ok: false,
      error: "Fix the story first",
      stepId: "s1",
      problems,
    });
    expect(
      failureResult(invalid("Enter a title"), { missing: "project" }),
    ).toEqual({ ok: false, error: "Enter a title" });
  });
});
