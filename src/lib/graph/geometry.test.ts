import { describe, expect, it } from "vitest";

import {
  arrowPoints,
  labelPoint,
  midwayAlong,
  selfLoopRoute,
  smoothPath,
} from "@/lib/graph/geometry";

/**
 * The pure geometry the two maps (`journey-canvas.tsx`,
 * `analytics-canvas.tsx`) draw with, tested at the module's own boundary
 * rather than through either component. Every expected value below is a
 * worked literal — hand-computed once from the numbers each case picks, not
 * a second copy of the function's own formula.
 */

describe("smoothPath", () => {
  it("draws a straight two-point polyline as a single M ... L segment", () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ]),
    ).toBe("M 0,0 L 10,20");
  });

  it("draws a bend between three points as a quadratic curve through the segment midpoint", () => {
    // Control point (10,0), next point (20,0): the Q command's own endpoint
    // is their midpoint, (15,0).
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).toBe("M 0,0 Q 10,0 15,0 L 20,0");
  });
});

describe("midwayAlong", () => {
  it("lands by arc length rather than by index, on a two-segment polyline of unequal lengths", () => {
    // First segment (0,0) -> (3,0) is length 3; second (3,0) -> (3,1) is
    // length 1. Total length 4, so the midpoint sits 2 in from the start —
    // two thirds of the way along the first segment, at (2,0) — not at the
    // polyline's middle point (3,0), which an index-based midpoint would
    // have picked.
    expect(
      midwayAlong([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ]),
    ).toEqual({ x: 2, y: 0 });
  });

  it("lands in the second segment when the first is shorter than half the total length", () => {
    // First segment (0,0) -> (1,0) is length 1; second (1,0) -> (1,3) is
    // length 3. Total length 4, so the midpoint sits 2 in from the start:
    // 1 to clear the first segment, 1 more (a third of the second) into it.
    expect(
      midwayAlong([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 3 },
      ]),
    ).toEqual({ x: 1, y: 1 });
  });
});

describe("selfLoopRoute", () => {
  it("routes top to bottom out past the box's right edge and back down into the target's top handle", () => {
    // NODE_WIDTH is 220 (half 110) and the loop's own clearances are 24 and
    // 16, worked by hand against the source and target picked here.
    const points = selfLoopRoute("TB", { x: 100, y: 200 }, { x: 100, y: 100 });
    expect(points).toEqual([
      { x: 100, y: 200 },
      { x: 100, y: 224 },
      { x: 226, y: 224 },
      { x: 226, y: 76 },
      { x: 100, y: 76 },
      { x: 100, y: 100 },
    ]);
    // Leaves the anchor downward and re-enters the target from above it.
    expect(points[1].y).toBeGreaterThan(points[0].y);
    expect(points[4].y).toBeLessThan(points[5].y);
  });

  it("routes left to right out past the box's bottom edge and back across into the target's left handle", () => {
    // NODE_HEIGHT is 72 (half 36) and the loop's own clearances are 24 and
    // 16, worked by hand against the source and target picked here.
    const points = selfLoopRoute("LR", { x: 100, y: 100 }, { x: 50, y: 100 });
    expect(points).toEqual([
      { x: 100, y: 100 },
      { x: 124, y: 100 },
      { x: 124, y: 152 },
      { x: 26, y: 152 },
      { x: 26, y: 100 },
      { x: 50, y: 100 },
    ]);
    // Leaves the anchor rightward and re-enters the target from its left.
    expect(points[1].x).toBeGreaterThan(points[0].x);
    expect(points[4].x).toBeLessThan(points[5].x);
  });
});

describe("arrowPoints", () => {
  it("keeps the given source and target, dropping dagre's own endpoints from the routed interior", () => {
    // The routed array's own first and last points ((0,0) and (10,10)) are
    // discarded in favour of the source/target passed in; only the interior
    // point (5,5) survives.
    expect(
      arrowPoints(
        "TB",
        false,
        [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
          { x: 10, y: 10 },
        ],
        { x: 1, y: 1 },
        { x: 9, y: 9 },
      ),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 5 },
      { x: 9, y: 9 },
    ]);
  });

  it("is a straight source-to-target line when there is no routed interior", () => {
    expect(
      arrowPoints("TB", false, undefined, { x: 1, y: 1 }, { x: 9, y: 9 }),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 9, y: 9 },
    ]);
  });

  it("hands a loop to selfLoopRoute instead, ignoring any routed points given", () => {
    const source = { x: 100, y: 200 };
    const target = { x: 100, y: 100 };
    expect(
      arrowPoints(
        "TB",
        true,
        [
          { x: 0, y: 0 },
          { x: 999, y: 999 },
        ],
        source,
        target,
      ),
    ).toEqual([
      { x: 100, y: 200 },
      { x: 100, y: 224 },
      { x: 226, y: 224 },
      { x: 226, y: 76 },
      { x: 100, y: 76 },
      { x: 100, y: 100 },
    ]);
  });
});

describe("labelPoint", () => {
  it("uses the layout's own labelAt when there is one and the arrow is not a loop", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(labelPoint(false, { x: 5, y: 5 }, points)).toEqual({ x: 5, y: 5 });
  });

  it("falls back to the midway point for a loop, even when labelAt is given", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(labelPoint(true, { x: 999, y: 999 }, points)).toEqual({
      x: 2,
      y: 0,
    });
  });

  it("falls back to the midway point on a vertical (TB-style) route when the layout gave no labelAt", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 8 },
    ];
    expect(labelPoint(false, undefined, points)).toEqual({ x: 0, y: 4 });
  });

  it("falls back to the midway point on a horizontal (LR-style) route when the layout gave no labelAt", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ];
    expect(labelPoint(false, undefined, points)).toEqual({ x: 4, y: 0 });
  });
});
