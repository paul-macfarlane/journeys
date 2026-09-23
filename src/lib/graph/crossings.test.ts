import { describe, expect, it } from "vitest";

import {
  countCrossingPairs,
  polylinesCross,
  type Polyline,
} from "@/lib/graph/crossings";

const line = (...coordinates: number[]): Polyline => {
  const points: Polyline = [];
  for (let index = 0; index + 1 < coordinates.length; index += 2) {
    points.push({ x: coordinates[index], y: coordinates[index + 1] });
  }
  return points;
};

describe("polylinesCross", () => {
  it("counts an X as a crossing", () => {
    expect(polylinesCross(line(0, 0, 100, 100), line(0, 100, 100, 0))).toBe(
      true,
    );
  });

  it("does not count two parallel arrows", () => {
    expect(polylinesCross(line(0, 0, 0, 100), line(20, 0, 20, 100))).toBe(
      false,
    );
  });

  it("does not count two arrows that share an end", () => {
    // A V: both arrows leave the same point.
    expect(polylinesCross(line(50, 0, 0, 100), line(50, 0, 100, 100))).toBe(
      false,
    );
  });

  it("does not count two arrows converging on the same box", () => {
    // Both end within the margin of the same anchor, crossing just above it.
    expect(polylinesCross(line(0, 0, 52, 100), line(100, 0, 48, 100), 6)).toBe(
      false,
    );
  });

  it("counts a bend crossing a straight arrow away from either end", () => {
    const bent = line(0, 0, 0, 50, 100, 50, 100, 100);
    const straight = line(50, 0, 50, 100);
    expect(polylinesCross(bent, straight)).toBe(true);
  });

  it("does not count an arrow that ends on another", () => {
    // T: the second arrow's end lies on the first, so it is a touch.
    expect(polylinesCross(line(0, 50, 100, 50), line(50, 0, 50, 50))).toBe(
      false,
    );
  });
});

describe("countCrossingPairs", () => {
  it("counts a pair once however many times its paths cross", () => {
    const wave = line(0, 0, 25, 100, 50, 0, 75, 100, 100, 0);
    const flat = line(0, 50, 100, 50);
    expect(countCrossingPairs([wave, flat])).toBe(1);
  });

  it("counts every crossing pair among three arrows", () => {
    const a = line(0, 0, 100, 100);
    const b = line(0, 100, 100, 0);
    const c = line(0, 50, 100, 50);
    expect(countCrossingPairs([a, b, c])).toBe(3);
  });

  it("is zero for no arrows and for one arrow", () => {
    expect(countCrossingPairs([])).toBe(0);
    expect(countCrossingPairs([line(0, 0, 100, 100)])).toBe(0);
  });
});
