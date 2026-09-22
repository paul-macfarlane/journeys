import { describe, expect, it } from "vitest";

import { moveInOrder } from "@/lib/journey-order";

/**
 * Seam A for ticket 28: the pure rule behind "Move up" / "Move down". The
 * data layer reads a Project's Journeys in order, asks this for the new
 * order, and writes back whatever moved.
 */
describe("moveInOrder", () => {
  const ids = ["a", "b", "c"];

  it("swaps a Journey with the one above it", () => {
    expect(moveInOrder(ids, "c", "up")).toEqual(["a", "c", "b"]);
  });

  it("swaps a Journey with the one below it", () => {
    expect(moveInOrder(ids, "a", "down")).toEqual(["b", "a", "c"]);
  });

  it("refuses to move the first Journey up", () => {
    expect(moveInOrder(ids, "a", "up")).toBeNull();
  });

  it("refuses to move the last Journey down", () => {
    expect(moveInOrder(ids, "c", "down")).toBeNull();
  });

  it("refuses a Journey that is not in the list", () => {
    expect(moveInOrder(ids, "zzz", "up")).toBeNull();
  });

  it("leaves the list it was given untouched", () => {
    const input = ["a", "b", "c"];
    moveInOrder(input, "b", "up");
    expect(input).toEqual(["a", "b", "c"]);
  });
});
