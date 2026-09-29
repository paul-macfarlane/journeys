import { describe, expect, it } from "vitest";

import { parseVersionNumber } from "./version-number";

/**
 * Ticket 94: a Published Version's view is addressed by its number, as
 * `…/versions/<n>`. Anything that is not a Version number a row could carry
 * reads as no Version at all, so the page 404s rather than asking the
 * database about it.
 */
describe("parseVersionNumber", () => {
  it("reads a positive whole number", () => {
    expect(parseVersionNumber("1")).toBe(1);
    expect(parseVersionNumber("42")).toBe(42);
  });

  it.each(["0", "-1", "1.5", "1e3", " 1", "01", "abc", "", "2147483648"])(
    "answers null for %j",
    (segment) => {
      expect(parseVersionNumber(segment)).toBe(null);
    },
  );
});
