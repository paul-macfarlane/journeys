"use client";

import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

import type { Point } from "@/lib/graph/crossings";
import type { LayoutDirection } from "@/lib/graph/document";
import { arrowPoints, labelPoint, smoothPath } from "@/lib/graph/geometry";
import { EDGE_LABEL_HEIGHT, EDGE_LABEL_MAX_WIDTH } from "@/lib/graph/layout";

/**
 * One Choice's arrow on the editor's map (`journey-canvas.tsx`), and what it
 * is drawn with. `ChoiceEdge` keeps React Flow's word for it, because that is
 * the name React Flow registers it under; in the document it is a Choice.
 */

/**
 * The same for an arrow: which Choice it draws, how many problems it carries,
 * how strongly it is drawn. React Flow's own `domAttributes` type has no
 * index signature for `data-*` either, so one is intersected in here too.
 */
export type EdgeMarks = NonNullable<Edge["domAttributes"]> &
  Record<`data-${string}`, string>;

/**
 * How strongly an arrow is drawn: `selected` for the one arrow the Author
 * has clicked, drawn heavier than any other; otherwise `attached` for the
 * arrows into and out of the Step the panel has open, and `dimmed` for the
 * rest.
 */
export type Emphasis = "selected" | "attached" | "dimmed";

/** What a clicked arrow is drawn with, over whatever else it would be. */
export const SELECTED_STROKE_WIDTH = 3;

type ChoiceEdgeData = {
  /**
   * dagre's routed points for this Choice, in flow coordinates. The first and
   * last are dagre's own box-border endpoints, which React Flow supersedes
   * with the anchor positions it hands the edge; only the interior is route.
   */
  points: Point[];
  /**
   * Where the layout made room for the label: on the route, halfway between
   * the ranks, clear of every other label between them. A loop is routed
   * here rather than by the layout, so its label hangs halfway along that.
   */
  labelAt: Point;
  emphasis: Emphasis;
  /** Which way the map runs, which is which way a loop is routed around. */
  direction: LayoutDirection;
};

export type ChoiceFlowEdge = Edge<ChoiceEdgeData, "choice">;

/** How much of an arrow is left when it is not the selected Step's. */
const DIMMED_OPACITY = 0.22;

/**
 * One Choice's arrow, drawn along dagre's route: out of the anchor React Flow
 * put the Choice on, through the interior of the route dagre laid, into the
 * side of the box it leads to that faces back the way it came. A loop is the
 * one arrow dagre does not route usefully, so it is routed here instead. The
 * opacity is on a group so the arrowhead and the label dim with the line.
 *
 * The label sits halfway along the arrow, cut short with an ellipsis past
 * `EDGE_LABEL_MAX_WIDTH` so a long Choice fits the gap between its boxes
 * rather than running over them; the whole text is in the DOM under the
 * ellipsis, is the arrow's `<title>`, and is in its accessible name (React
 * Flow's `aria-label` on the wrapper) — and the panel's row has it in full.
 * A `<foreignObject>` rather than React Flow's own `<text>` label because
 * SVG text has no ellipsis, and it stays inside the group so it dims and
 * scales with the arrow.
 */
export function ChoiceEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps<ChoiceFlowEdge>) {
  const isLoop = source === target;
  const points = arrowPoints(
    data?.direction ?? "TB",
    isLoop,
    data?.points,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
  );
  const middle = labelPoint(isLoop, data?.labelAt, points);

  return (
    // Marked so a spec can read the opacity the arrow is actually drawn at,
    // not only the emphasis the map says it has.
    <g
      data-emphasis-group=""
      opacity={data?.emphasis === "dimmed" ? DIMMED_OPACITY : 1}
    >
      {typeof label === "string" ? <title>{label}</title> : null}
      <BaseEdge path={smoothPath(points)} style={style} markerEnd={markerEnd} />
      {typeof label === "string" ? (
        <foreignObject
          x={middle.x - EDGE_LABEL_MAX_WIDTH / 2}
          y={middle.y - EDGE_LABEL_HEIGHT / 2}
          width={EDGE_LABEL_MAX_WIDTH}
          height={EDGE_LABEL_HEIGHT}
          // Only the chip takes the pointer, as React Flow's own label does:
          // a click on it bubbles to the arrow and selects it, and the rest
          // of the box is nothing, so it never covers a box or another arrow.
          className="pointer-events-none overflow-visible"
        >
          <div className="flex h-full w-full items-center justify-center">
            <span
              data-edge-label=""
              className="pointer-events-auto max-w-full cursor-pointer truncate rounded bg-background px-1 text-xs"
            >
              {label}
            </span>
          </div>
        </foreignObject>
      ) : null}
    </g>
  );
}
