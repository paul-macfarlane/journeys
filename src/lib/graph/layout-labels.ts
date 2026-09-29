import type { Point } from "@/lib/graph/crossings";
import type { LayoutDirection } from "@/lib/graph/document";
import type { RoutedEdge } from "@/lib/graph/layout-routing";
import {
  EDGE_LABEL_HEIGHT,
  EDGE_LABEL_MAX_WIDTH,
} from "@/lib/graph/layout-constants";

/**
 * Label placement: keeping two Choices' labels apart when the Choice-order
 * pass (`layout-dagre.ts`) has moved their routes together, after dagre's
 * own placement already kept them apart everywhere else.
 */

/**
 * The least room two labels between the same two ranks are given on the
 * cross axis, centre to centre: the label's own size that way, and a gap.
 * dagre keeps its own labels further apart than this, so only labels the
 * deal or an overflow nudge brought together are moved.
 */
export const LABEL_GAP = 8;

/**
 * How far sideways each overflow Choice's route is nudged from the sibling's
 * it borrows: wide enough that the two arrows read as two at fit-to-view,
 * and left to right exactly the room its label needs beside the sibling's,
 * so nothing dagre placed has to move for it; narrow enough that the nudged
 * one stays beside its boxes rather than wandering across the map.
 */
export const OVERFLOW_ARROW_OFFSET = EDGE_LABEL_HEIGHT + LABEL_GAP;

/**
 * Labels in the same rank kept from one another. dagre kept its labels
 * apart, but the Choice-order deal moves routes after dagre has spoken, and
 * a label lined up with its source can then meet one lined up with a target
 * dealt under that source: this is the safety net for what the deal undoes,
 * and nothing more — a label dagre placed and the deal did not disturb is
 * never moved. The labels between one rank of boxes and the next are sorted
 * along the cross axis; a run of them that would overlap is spread evenly
 * about the run's own middle, so each moves by the least, and a run grown
 * into its neighbour is joined with it and spread again. A moved label's
 * route point goes with it so the label stays on its arrow. A loop's label
 * is left alone; the canvas routes a loop itself.
 */
export function spreadLabels(
  edges: RoutedEdge[],
  direction: LayoutDirection,
): void {
  const rankOf = (point: Point) => (direction === "LR" ? point.x : point.y);
  const crossOf = (point: Point) => (direction === "LR" ? point.y : point.x);
  const minimum =
    (direction === "LR" ? EDGE_LABEL_HEIGHT : EDGE_LABEL_MAX_WIDTH) + LABEL_GAP;

  const byRank = new Map<number, RoutedEdge[]>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const rank = Math.round(rankOf(edge.labelAt));
    const group = byRank.get(rank) ?? [];
    group.push(edge);
    byRank.set(rank, group);
  }

  for (const group of byRank.values()) {
    group.sort((a, b) => crossOf(a.labelAt) - crossOf(b.labelAt));
    const wanted = group.map((edge) => crossOf(edge.labelAt));

    // Runs of labels too close to stand where they want, each spread about
    // its own middle; two runs that then touch become one run.
    type Run = { start: number; end: number; centre: number };
    const runs: Run[] = [];
    for (let index = 0; index < wanted.length; index += 1) {
      let run: Run = { start: index, end: index, centre: wanted[index] };
      while (runs.length > 0) {
        const previous = runs[runs.length - 1];
        const previousLast =
          previous.centre + ((previous.end - previous.start) / 2) * minimum;
        const runFirst = run.centre - ((run.end - run.start) / 2) * minimum;
        if (runFirst - previousLast >= minimum) break;
        runs.pop();
        const count = run.end - previous.start + 1;
        const previousCount = previous.end - previous.start + 1;
        const runCount = run.end - run.start + 1;
        run = {
          start: previous.start,
          end: run.end,
          centre:
            (previous.centre * previousCount + run.centre * runCount) / count,
        };
      }
      runs.push(run);
    }

    for (const run of runs) {
      const first = run.centre - ((run.end - run.start) / 2) * minimum;
      for (let index = run.start; index <= run.end; index += 1) {
        const placed = first + (index - run.start) * minimum;
        if (placed === wanted[index]) continue;
        const edge = group[index];
        const labelAt =
          direction === "LR"
            ? { x: edge.labelAt.x, y: placed }
            : { x: placed, y: edge.labelAt.y };
        edge.labelAt = labelAt;
        if (edge.labelIndex >= 0 && edge.labelIndex < edge.points.length) {
          edge.points = edge.points.map((point, at) =>
            at === edge.labelIndex ? labelAt : point,
          );
        }
      }
    }
  }
}
