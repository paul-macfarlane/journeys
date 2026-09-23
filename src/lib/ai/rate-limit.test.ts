import { describe, expect, it } from "vitest";

import { decisionAllowed } from "@/lib/ai/rate-limit";

/**
 * Seam A for ticket 43's rate limit: one decision per key per window. A
 * refused decision is not an error — the action reads it as "no answer" and
 * shows the Choices — so all this helper has to say is yes or no.
 */
describe("decisionAllowed", () => {
  it("allows a key's first decision", () => {
    const last = new Map<string, number>();

    expect(decisionAllowed(last, "run-1", 10_000, 1000)).toBe(true);
  });

  it("refuses a second decision for the same key inside the window", () => {
    const last = new Map<string, number>();
    decisionAllowed(last, "run-1", 10_000, 1000);

    expect(decisionAllowed(last, "run-1", 10_999, 1000)).toBe(false);
  });

  it("allows the same key again once the window has passed", () => {
    const last = new Map<string, number>();
    decisionAllowed(last, "run-1", 10_000, 1000);

    expect(decisionAllowed(last, "run-1", 11_000, 1000)).toBe(true);
  });

  it("does not let a refused decision restart the window", () => {
    const last = new Map<string, number>();
    decisionAllowed(last, "run-1", 10_000, 1000);
    decisionAllowed(last, "run-1", 10_600, 1000);

    expect(decisionAllowed(last, "run-1", 11_000, 1000)).toBe(true);
  });

  it("keeps each key's window to itself", () => {
    const last = new Map<string, number>();
    decisionAllowed(last, "run-1", 10_000, 1000);

    expect(decisionAllowed(last, "run-2", 10_000, 1000)).toBe(true);
  });
});
