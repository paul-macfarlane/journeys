import type { Point } from "@/lib/graph/crossings";
import type { LayoutDirection } from "@/lib/graph/document";
import type { DagreGraph } from "@/lib/graph/layout-dagre";
import { offsetInteriorPoints, pairKey } from "@/lib/graph/layout-dagre";
import { EDGE_LABEL_HEIGHT } from "@/lib/graph/layout-constants";
import { LABEL_GAP, OVERFLOW_ARROW_OFFSET } from "@/lib/graph/layout-labels";

import type { CanvasEdge } from "@/lib/graph/layout";

/**
 * Edge routing: turning dagre's raw routed points — or, for a Choice that
 * overflowed `MAX_DAGRE_EDGES_PER_PAIR`, a sibling's route offset sideways —
 * into each Choice's final `points` and `labelAt`, following every route
 * across when the Choice-order pass (`layout-dagre.ts`) moved the boxes it
 * runs between.
 */

/**
 * Slides a route dagre laid between two boxes across to where those boxes
 * are after `orderTargetsByChoice` moved them: every point is shifted along
 * the cross axis by an amount that runs from the source's move at the
 * source's end of the route to the target's move at the target's end, in
 * proportion to how far along the rank axis the point lies. A route between
 * neighbouring ranks is three points, and its midpoint lands on the new
 * midpoint; a longer route keeps dagre's bends and leans over rank by rank.
 * A route whose boxes did not move is returned as it was.
 *
 * An interior point dagre lined up with one of the two boxes — its centre on
 * the cross axis exactly the box's, which is how dagre draws a route
 * straight into a box — goes with that box instead, by the whole of its
 * move: two Choices whose targets swap places keep their routes going
 * straight into their own targets, where leaning each route over by half
 * the swap would bring both to the same point halfway, one label on top of
 * the other. A point lined up with neither leans as above.
 *
 * What is returned is the move itself, for any point on the route by its
 * index — the label's centre is one of them, and goes where the route goes.
 */
export function followMovedBoxes(
  points: Point[],
  source: { shift: number; cross: number },
  target: { shift: number; cross: number },
  direction: LayoutDirection,
): (point: Point, index: number) => Point {
  if (source.shift === 0 && target.shift === 0) return (point) => point;

  const first = points[0];
  const last = points[points.length - 1];
  const along = (point: Point) => (direction === "LR" ? point.x : point.y);
  const across = (point: Point) => (direction === "LR" ? point.y : point.x);
  const span = along(last) - along(first);
  // Only a route between neighbouring ranks has the one interior point that
  // is its label, and only there does "lined up with the box" mean the route
  // runs straight into it; a longer route's dummies lean rank by rank as
  // before, where a whole shift could carry one into a box dealt beside it.
  const isTheBend = (index: number) => points.length === 3 && index === 1;

  return (point, index) => {
    let shift: number;
    if (isTheBend(index) && Math.abs(across(point) - target.cross) <= 1) {
      shift = target.shift;
    } else if (
      isTheBend(index) &&
      Math.abs(across(point) - source.cross) <= 1
    ) {
      shift = source.shift;
    } else {
      const progress =
        span === 0
          ? 0.5
          : Math.min(1, Math.max(0, (along(point) - along(first)) / span));
      shift = source.shift + (target.shift - source.shift) * progress;
    }
    return direction === "LR"
      ? { x: point.x, y: point.y + shift }
      : { x: point.x + shift, y: point.y };
  };
}

/** The middle of a route's bounding box: where a label goes when dagre gave it no place. */
export function midpointOf(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** A routed edge with the index of its label among its own points, kept only while routing. */
export type RoutedEdge = CanvasEdge & {
  /** Which of `points` is the label's centre; -1 when the label is not on the route. */
  labelIndex: number;
};

/**
 * Turns each Choice's unrouted edge into its routed `points` and `labelAt`:
 * dagre's own route, read back off `graph` and slid across by
 * `followMovedBoxes` to wherever the Choice-order pass put its boxes, or —
 * for a Choice in `overflowEdgeIds`, which never reached dagre — a sibling's
 * route offset sideways by `offsetInteriorPoints`.
 */
export function routeEdges(
  edges: Array<Omit<CanvasEdge, "points" | "labelAt">>,
  graph: DagreGraph,
  overflowEdgeIds: Set<string>,
  shiftById: Map<string, number>,
  crossBeforeById: Map<string, number>,
  direction: LayoutDirection,
): RoutedEdge[] {
  const lastRoutedPointsByPair = new Map<string, Point[]>();
  const overflowCountByPair = new Map<string, number>();
  const lastLabelIndexByPair = new Map<string, number>();
  /** How far the labels between one pair of boxes reach along the cross axis. */
  const labelExtentByPair = new Map<string, { min: number; max: number }>();
  const crossOf = (point: Point) => (direction === "LR" ? point.y : point.x);

  return edges.map((edge) => {
    const key = pairKey(edge.source, edge.target);
    if (!overflowEdgeIds.has(edge.id)) {
      const routed = graph.edge({
        v: edge.source,
        w: edge.target,
        name: edge.id,
      });
      // dagre puts the label's centre on the route, at the dummy it kept
      // the label's rank for, so the label is one of the route's own points
      // and goes wherever that point goes; the route's middle stands in
      // only if dagre gave it no place.
      const dagrePoints: Point[] = routed.points;
      const labelIndex =
        typeof routed.x === "number" && typeof routed.y === "number"
          ? dagrePoints.findIndex(
              (point) =>
                Math.abs(point.x - routed.x) < 0.5 &&
                Math.abs(point.y - routed.y) < 0.5,
            )
          : -1;
      const follow = followMovedBoxes(
        dagrePoints,
        {
          shift: shiftById.get(edge.source) ?? 0,
          cross: crossBeforeById.get(edge.source) ?? 0,
        },
        {
          shift: shiftById.get(edge.target) ?? 0,
          cross: crossBeforeById.get(edge.target) ?? 0,
        },
        direction,
      );
      const points = dagrePoints.map(follow);
      const labelAt =
        labelIndex >= 0
          ? points[labelIndex]
          : follow(midpointOf(dagrePoints), -1);
      lastRoutedPointsByPair.set(key, points);
      lastLabelIndexByPair.set(key, labelIndex);
      const cross = crossOf(labelAt);
      const extent = labelExtentByPair.get(key);
      labelExtentByPair.set(key, {
        min: Math.min(extent?.min ?? cross, cross),
        max: Math.max(extent?.max ?? cross, cross),
      });
      return { ...edge, points, labelAt, labelIndex };
    }
    const siblingPoints = lastRoutedPointsByPair.get(key) ?? [];
    const labelIndex = lastLabelIndexByPair.get(key) ?? -1;
    const overflowIndex = overflowCountByPair.get(key) ?? 0;
    overflowCountByPair.set(key, overflowIndex + 1);
    const offset =
      OVERFLOW_ARROW_OFFSET *
      (overflowIndex + 1) *
      (overflowIndex % 2 === 0 ? 1 : -1);
    const points = offsetInteriorPoints(siblingPoints, offset, direction);
    const onRoute =
      labelIndex >= 0 && labelIndex < points.length
        ? points[labelIndex]
        : midpointOf(points);
    const extent = labelExtentByPair.get(key) ?? {
      min: crossOf(onRoute),
      max: crossOf(onRoute),
    };
    // Nothing dagre placed moves for an overflow label. Left to right the
    // label, and the bend of its arrow with it, goes past the outermost of
    // the pair's labels — below the lower one, then above the upper — by
    // exactly the room a label needs, never between the two. Top to bottom
    // a label is wide, and room that wide would swing the arrow across the
    // map: the label goes just below (then above) the sibling's instead, in
    // the clearance dagre left, off its nudged route by that much and no
    // more, and in a rank of its own so the spread below never moves
    // dagre's labels to make way for it.
    const outward = overflowIndex % 2 === 0 ? 1 : -1;
    if (direction === "LR") {
      const y =
        outward > 0
          ? extent.max + OVERFLOW_ARROW_OFFSET
          : extent.min - OVERFLOW_ARROW_OFFSET;
      labelExtentByPair.set(key, {
        min: Math.min(extent.min, y),
        max: Math.max(extent.max, y),
      });
      const labelAt = { x: onRoute.x, y };
      return {
        ...edge,
        points:
          labelIndex >= 0 && labelIndex < points.length
            ? points.map((point, at) => (at === labelIndex ? labelAt : point))
            : points,
        labelAt,
        labelIndex,
      };
    }
    return {
      ...edge,
      points,
      labelAt: {
        x: onRoute.x,
        y: onRoute.y + (EDGE_LABEL_HEIGHT + LABEL_GAP) * outward,
      },
      labelIndex: -1,
    };
  });
}
