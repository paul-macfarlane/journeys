import { Position, type ColorMode } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import type { Point } from "@/lib/graph/crossings";
import type { LayoutDirection } from "@/lib/graph/document";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/graph/layout";

/**
 * What the two maps of a Journey draw with: the editor's Canvas
 * (`journey-canvas.tsx`) and the Analytics tab's read-only map
 * (`analytics-canvas.tsx`). Both are laid out by `layoutGraph`, and both
 * draw an arrow along dagre's route, hang a label halfway along it, route a
 * loop round its own box, and put every anchor on the side the map runs
 * towards — so the shape an Author reads numbers off is exactly the shape
 * they built. The geometry lives here once so the two can never drift.
 */

/**
 * The polyline through `points`, smoothed: a quadratic curve through the
 * midpoint of each pair of consecutive segments, so a routed corner becomes a
 * bend rather than a spike. Both ends are exactly the points given, and two
 * points are a straight line.
 */
export function smoothPath(points: Point[]): string {
  const last = points[points.length - 1];
  let path = `M ${points[0].x},${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    path += ` Q ${control.x},${control.y} ${(control.x + next.x) / 2},${(control.y + next.y) / 2}`;
  }

  return `${path} L ${last.x},${last.y}`;
}

/** Halfway along the polyline, which is where the Choice's label sits. */
export function midwayAlong(points: Point[]): Point {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }

  let remaining = total / 2;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length >= remaining) {
      const along = length === 0 ? 0 : remaining / length;
      return {
        x: from.x + (to.x - from.x) * along,
        y: from.y + (to.y - from.y) * along,
      };
    }
    remaining -= length;
  }

  return points[points.length - 1];
}

/**
 * How far out of the anchor a loop runs before it turns, and how far short of
 * the handle it comes back down (or across) to.
 */
const LOOP_CLEARANCE = 24;

/**
 * How far past the side of the box a loop runs on its way round: past the
 * right edge running top to bottom, past the bottom edge running left to
 * right. Kept under the 32 of dagre's `nodesep` in `src/lib/graph/layout.ts`,
 * so a loop never runs over the box beside it when the layout has packed the
 * two at minimum separation.
 */
const LOOP_SIDE_CLEARANCE = 16;

/**
 * A Choice that leads back to its own Step, routed beside its box rather than
 * through it. Running top to bottom: down out of the anchor, out past the
 * box's right edge, up over its top, and back down into the handle every arrow
 * ends at. Running left to right it is the same route turned a quarter: out of
 * the anchor to the right, down under the box's bottom edge, back across past
 * its left edge, and in to the handle.
 *
 * Hand-built rather than dagre's: dagre keeps a loop in its box's own rank and
 * runs it straight through the box, which reads as an arrow crossing the Step
 * rather than returning to it.
 */
export function selfLoopRoute(
  direction: LayoutDirection,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): Point[] {
  if (direction === "LR") {
    // Running left to right an arrow ends at the handle in the middle of the
    // box's left edge, so the box's bottom edge is half a box below where this
    // one ends.
    const bottom = targetY + NODE_HEIGHT / 2 + LOOP_SIDE_CLEARANCE;

    return [
      { x: sourceX, y: sourceY },
      { x: sourceX + LOOP_CLEARANCE, y: sourceY },
      { x: sourceX + LOOP_CLEARANCE, y: bottom },
      { x: targetX - LOOP_CLEARANCE, y: bottom },
      { x: targetX - LOOP_CLEARANCE, y: targetY },
      { x: targetX, y: targetY },
    ];
  }

  // Running top to bottom an arrow ends at the handle in the middle of the
  // box's top edge, so the box's right edge is half a box across from where
  // this one ends.
  const right = targetX + NODE_WIDTH / 2 + LOOP_SIDE_CLEARANCE;

  return [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: sourceY + LOOP_CLEARANCE },
    { x: right, y: sourceY + LOOP_CLEARANCE },
    { x: right, y: targetY - LOOP_CLEARANCE },
    { x: targetX, y: targetY - LOOP_CLEARANCE },
    { x: targetX, y: targetY },
  ];
}

/**
 * The points an arrow is drawn through: React Flow's anchor positions at
 * either end, dagre's interior route between them — or the hand-built loop
 * when the arrow returns to its own box.
 */
export function arrowPoints(
  direction: LayoutDirection,
  isLoop: boolean,
  routed: Point[] | undefined,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): Point[] {
  return isLoop
    ? selfLoopRoute(direction, sourceX, sourceY, targetX, targetY)
    : [
        { x: sourceX, y: sourceY },
        ...(routed ?? []).slice(1, -1),
        { x: targetX, y: targetY },
      ];
}

/** How tall the label on an arrow is drawn, in flow units. */
export const EDGE_LABEL_HEIGHT = 24;

/**
 * Where a Choice's arrow leaves the node: spread evenly along the side of the
 * box the arrows travel towards — along its bottom running top to bottom,
 * down its right running left to right.
 */
export function handleOffset(index: number, count: number): string {
  return `${((index + 1) / (count + 1)) * 100}%`;
}

/** The side every arrow leaves a box from, which way round the map is drawn. */
export function sourceSide(direction: LayoutDirection): Position {
  return direction === "LR" ? Position.Right : Position.Bottom;
}

/** And the side, opposite it, that every arrow arrives at. */
export function targetSide(direction: LayoutDirection): Position {
  return direction === "LR" ? Position.Left : Position.Top;
}

/**
 * The look of a box, whichever map it is on: the card that fills the node,
 * its content stacked and clipped. The editor's boxes are buttons and add
 * the pointer and focus ring on top of this; the Analytics map's are not.
 */
export const NODE_BOX_CLASS =
  "relative flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-xl bg-background px-3 py-2 text-left ring-inset";

/**
 * "Has this render happened in the browser?" — false through the server
 * render and the hydrating one, true afterwards. The store never changes, so
 * there is nothing to subscribe to; React re-renders once after hydration
 * because the client snapshot differs from the server's.
 */
const subscribeToNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

/**
 * Which color mode React Flow draws the map in. next-themes reads the
 * browser's stored choice, which the server render cannot know: asking
 * before hydration is done would put a different color mode on the first
 * client render than the server sent. Until then the map follows the system,
 * exactly as the server assumed.
 */
export function useCanvasColorMode(): ColorMode {
  const { resolvedTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribeToNothing, isClient, isServer);
  return hydrated && (resolvedTheme === "dark" || resolvedTheme === "light")
    ? resolvedTheme
    : "system";
}
