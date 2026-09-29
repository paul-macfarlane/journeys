import { describe, expect, it } from "vitest";

import { isVersionNumber, parseVersionNumber } from "./version-number";

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

/**
 * The same rule for a number that arrives already a number — a Version
 * Preview action's bound argument, which the client controls.
 */
describe("isVersionNumber", () => {
  it.each([1, 42, 2_147_483_647])("accepts %s", (n) => {
    expect(isVersionNumber(n)).toBe(true);
  });

  it.each([0, -1, 1.5, 2_147_483_648, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses %s",
    (n) => {
      expect(isVersionNumber(n)).toBe(false);
    },
  );
});
