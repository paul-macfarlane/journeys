/**
 * Counts the pairs of arrows on the canvas that cross one another. Pure
 * geometry over sampled polylines, so the e2e specs can sample the rendered
 * `<path>` of every arrow in the browser and count in the test, and the same
 * count can be taken of an older build for comparison. Deliberately no React
 * and no `server-only`.
 *
 * A "crossing" is two distinct arrows whose paths properly intersect somewhere
 * away from either arrow's ends: arrows that leave the same box from
 * neighbouring anchors, or that converge on the same box's top anchor, meet
 * at their ends by design and are not counted. A pair counts once however
 * many times its two paths intersect.
 */

export type Point = { x: number; y: number };

/** A path sampled into straight segments, in path order. */
export type Polyline = Point[];

/** How close to an end (in path units) an intersection is ignored. */
export const END_MARGIN = 6;

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function boxOf(polyline: Polyline): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polyline) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function boxesTouch(a: Box, b: Box): boolean {
  return (
    a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Where segment `p1→p2` properly crosses segment `q1→q2`, or `null` when they
 * are parallel, collinear, or only touch at a shared point. Strict inequality
 * on both parameters: a segment that ends exactly on the other is a touch,
 * not a crossing.
 */
function segmentCrossing(
  p1: Point,
  p2: Point,
  q1: Point,
  q2: Point,
): Point | null {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = q2.x - q1.x;
  const sy = q2.y - q1.y;
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) {
    return null;
  }
  const qpx = q1.x - p1.x;
  const qpy = q1.y - p1.y;
  const t = (qpx * sy - qpy * sx) / denominator;
  const u = (qpx * ry - qpy * rx) / denominator;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) {
    return null;
  }
  return { x: p1.x + t * rx, y: p1.y + t * ry };
}

function nearAnEnd(point: Point, polyline: Polyline, margin: number): boolean {
  return (
    distance(point, polyline[0]) < margin ||
    distance(point, polyline[polyline.length - 1]) < margin
  );
}

/** Whether two sampled arrows cross away from their ends. */
export function polylinesCross(
  a: Polyline,
  b: Polyline,
  endMargin = END_MARGIN,
): boolean {
  if (a.length < 2 || b.length < 2 || !boxesTouch(boxOf(a), boxOf(b))) {
    return false;
  }
  for (let i = 0; i + 1 < a.length; i += 1) {
    for (let j = 0; j + 1 < b.length; j += 1) {
      const crossing = segmentCrossing(a[i], a[i + 1], b[j], b[j + 1]);
      if (
        crossing !== null &&
        !nearAnEnd(crossing, a, endMargin) &&
        !nearAnEnd(crossing, b, endMargin)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** How many pairs of the given arrows cross one another. */
export function countCrossingPairs(
  polylines: Polyline[],
  endMargin = END_MARGIN,
): number {
  let pairs = 0;
  for (let i = 0; i < polylines.length; i += 1) {
    for (let j = i + 1; j < polylines.length; j += 1) {
      if (polylinesCross(polylines[i], polylines[j], endMargin)) {
        pairs += 1;
      }
    }
  }
  return pairs;
}
