import dagre from "@dagrejs/dagre";

import type { Point } from "@/lib/graph/crossings";
import type {
  Choice,
  GraphDocument,
  LayoutDirection,
  Step,
} from "@/lib/graph/document";
import { hasStep, isEnding, stepName } from "@/lib/graph/document";
import type { PublishProblem } from "@/lib/graph/validate";

/**
 * Pure graph-to-canvas layout: turns a `GraphDocument` into positioned nodes
 * and edges the canvas can hand straight to React Flow. Deliberately no
 * `server-only` and no React import — the canvas component and this module's
 * own tests both call it directly on the client, with no server round trip.
 *
 * `stepSchema` reserves a `position` field, but the canvas never reads or
 * writes it: no manual position is ever stored, so `layoutGraph` recomputes
 * layout with dagre every time the document changes, and the map always
 * shows the current shape of the Journey rather than wherever a node
 * happened to be left. It never mutates the document it is given, and the
 * same document always lays out the same way.
 *
 * dagre runs as a multigraph: every Choice gets its own named dagre edge
 * (`graph.setEdge(source, target, label box, edge.id)`), so parallel Choices
 * between the same two Steps and self-loop Choices each get their own
 * routed path instead of collapsing onto one. Each `CanvasEdge` carries the
 * routed `points` dagre produced for that Choice, read back with
 * `graph.edge({ v, w, name })`, in the same coordinate space as the node
 * positions, and `labelAt`, the centre of the label box dagre made room for
 * on that route. Each Step `CanvasNode` carries `sourceAnchors`: its Choice ids
 * ordered by the centre of the box each Choice leads to along the cross axis
 * — x in `"TB"`, y in `"LR"` — so the canvas can spread the anchors along the
 * side of the box that faces the direction the arrows actually travel,
 * cutting down on crossing arrows.
 *
 * dagre's own multigraph order phase throws ("Not possible to find
 * intersection inside of the rectangle") when three or more parallel edges
 * share the same source and target inside a larger graph — reproduced on
 * the seeded case-3 document, where `step-14` has three Choices to
 * `step-22`; two parallel dagre edges between the same pair are fine. Only
 * the first two Choices between any ordered pair (including a self-loop's
 * own Step as both ends) become real dagre edges; a third or later Choice
 * to the same target never reaches dagre at all — it reuses the last
 * registered sibling's routed points with an interior offset, so it still
 * gets its own visibly distinct `points` array without tripping the bug.
 */

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 72;

/**
 * How wide a Choice's label is drawn on its arrow before it is cut short with
 * an ellipsis, in flow units. Sized to case-3's own Choices: its longest runs
 * to ninety characters, which no gap between boxes should have to hold, and
 * this width shows the opening five or six words of one — enough to tell the
 * Choices apart on the map, with the full text in the arrow's accessible name
 * and its title, and in the panel's row.
 */
export const EDGE_LABEL_MAX_WIDTH = 160;

/** How tall the label on an arrow is drawn, in flow units. */
export const EDGE_LABEL_HEIGHT = 24;

/**
 * The clearance between a rank of boxes and the labels hung between it and
 * the next. Every arrow's label is given to dagre as a box of its own
 * (`EDGE_LABEL_MAX_WIDTH` by `EDGE_LABEL_HEIGHT`), which dagre keeps in a
 * rank of its own halfway between the two ranks of boxes with half this
 * separation on either side of it — so the gap between two ranks of boxes is
 * this plus whichever side of the label lies along the arrow: its height top
 * to bottom, its width left to right. Two labels between the same two ranks
 * are kept apart along the cross axis the way any two boxes in a rank are,
 * which is what stops two Choices from one Step reading as one.
 */
export const TB_RANK_SEPARATION = 72;
export const LR_RANK_SEPARATION = 48;

/**
 * One box on the canvas: either a Step, or a placeholder standing in for a
 * Choice's target that no longer exists (`kind: "missing"`), so a broken
 * edge still has something to be drawn to.
 */
export type CanvasNode = {
  id: string;
  kind: "step" | "missing";
  stepId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isStart: boolean;
  isEnding: boolean;
  outcomeId: string | null;
  /**
   * For a `step` node, its Choice ids ordered by the centre of the box each
   * Choice targets along the cross axis — x in `"TB"`, y in `"LR"` — the Step
   * itself, or the `missing:` placeholder when the target Step no longer
   * exists — ties broken by Choice order. A self-loop Choice sorts by the
   * node's own centre on that axis. Always `[]` for a `missing` node.
   */
  sourceAnchors: string[];
};

/** One arrow on the canvas, drawn from a Choice. */
export type CanvasEdge = {
  id: string;
  stepId: string;
  choiceId: string;
  source: string;
  target: string;
  label: string;
  /**
   * dagre's routed points for this Choice, in the same coordinate space as
   * the node positions. Always at least two points.
   */
  points: Point[];
  /**
   * The centre of the label's box, where dagre made room for it on the
   * route: halfway between the two ranks, and clear of every other label
   * between them. A loop's is dagre's too, but the canvas routes a loop
   * itself and hangs its label halfway along its own route.
   */
  labelAt: Point;
};

/**
 * Everything one document lays out to: the boxes, the arrows between them,
 * and which way round they were laid out.
 */
export type GraphLayout = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /**
   * The document's own `layoutDirection`, carried through so the canvas draws
   * every handle and every loop from the layout it was handed rather than
   * reading the document a second time and risking a different answer.
   */
  direction: LayoutDirection;
};

function missingNodeId(targetStepId: string): string {
  return `missing:${targetStepId}`;
}

/** The node a Choice's arrow ends at: its Step, or the placeholder for one that is gone. */
function targetNodeId(document: GraphDocument, choice: Choice): string {
  return hasStep(document, choice.targetStepId)
    ? choice.targetStepId
    : missingNodeId(choice.targetStepId);
}

/**
 * dagre only reliably routes up to two parallel edges between the same
 * ordered `(source, target)` pair (see the module doc comment).
 */
const MAX_DAGRE_EDGES_PER_PAIR = 2;

/** A stable, collision-safe key for a `(source, target)` pair. */
function pairKey(source: string, target: string): string {
  return JSON.stringify([source, target]);
}

/**
 * Nudges the interior of a routed path sideways — across the way the map
 * runs, so the nudged arrow sits beside the sibling's rather than further
 * along it — so a Choice that shares its dagre pair with an already-routed
 * sibling still draws its own visible path. Endpoints are left untouched so
 * the arrow still starts and ends at the box edges dagre computed for the
 * sibling; with only two points (no interior point to nudge), a synthetic
 * midpoint is inserted instead so the path still bends away from the shared
 * one.
 */
function offsetInteriorPoints(
  points: Point[],
  offset: number,
  direction: LayoutDirection,
): Point[] {
  const nudge = (point: Point): Point =>
    direction === "LR"
      ? { x: point.x, y: point.y + offset }
      : { x: point.x + offset, y: point.y };
  if (points.length <= 2) {
    const [start, end] = points;
    return [
      start,
      nudge({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }),
      end,
    ];
  }
  return points.map((point, index) =>
    index === 0 || index === points.length - 1 ? point : nudge(point),
  );
}

function stepNode(document: GraphDocument, step: Step): CanvasNode {
  return {
    id: step.id,
    kind: "step",
    stepId: step.id,
    title: stepName(step),
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    isStart: step.id === document.startStepId,
    isEnding: isEnding(step),
    outcomeId: step.outcomeId,
    sourceAnchors: [],
  };
}

function missingNode(targetStepId: string): CanvasNode {
  return {
    id: missingNodeId(targetStepId),
    kind: "missing",
    stepId: targetStepId,
    title: "Missing step",
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    isStart: false,
    isEnding: false,
    outcomeId: null,
    sourceAnchors: [],
  };
}

/**
 * The post-pass over dagre's positions that makes the map read the same way
 * round as the panel: the boxes a Step's Choices lead to sit in Choice order
 * along the cross axis — the first Choice's target leftmost top to bottom,
 * topmost left to right. dagre's ordering phase minimizes crossings and
 * promises nothing about which sibling lands where, so the ranks are walked
 * in order, top down, and each rank is ordered again the way dagre's own
 * sweep orders one — every box under the middle of the boxes above that
 * lead to it, so a branch swapped with its neighbour carries everything
 * below it across rather than crossing it, and a box nothing above reaches
 * staying where dagre put it — with one rule dagre has not got on top: the
 * boxes one Step placed have their places dealt out among themselves again
 * in Choice order. The rank's boxes are then given that rank's own slots
 * back in the resulting order: only the slots dagre chose are reused, so
 * nothing overlaps that did not before. One sweep down costs some of the
 * crossings dagre's sweeps back and forth had saved — on the seeded case-3
 * about twice as many — which is the price of a map that reads the same way
 * round as the panel.
 *
 * The Step that places a box is the first, in reading order, whose Choice
 * leads down the map to it — reading order being rank by rank, the Start
 * before anything else in its rank, then across the rank the way it is read.
 * A target reached by several Steps keeps the place the earliest gave it. A
 * Choice back up the map, or to its own Step, places nothing: dagre's own
 * placement of the box it leads to stands. The Start goes first in its rank
 * because its branch is the one an Author reads first, and another root
 * beside it should not place its targets ahead of it.
 *
 * The routed `points` of an arrow are dagre's, from before the deal, so
 * `followMovedBoxes` slides each route across to wherever its boxes now are.
 *
 * Boxes are all one size, so every box in a rank shares the same coordinate
 * on the rank axis, which is what "share a rank" is read from.
 */
function orderTargetsByChoice(
  document: GraphDocument,
  positioned: CanvasNode[],
): { nodes: CanvasNode[]; shiftById: Map<string, number> } {
  const direction = document.layoutDirection;
  const byId = new Map(positioned.map((node) => [node.id, { ...node }]));
  const rankOf = (node: CanvasNode) => (direction === "LR" ? node.x : node.y);
  const crossOf = (node: CanvasNode) => (direction === "LR" ? node.y : node.x);
  const place = (node: CanvasNode, cross: number) => {
    if (direction === "LR") {
      node.y = cross;
    } else {
      node.x = cross;
    }
  };

  const ranks = new Map<number, CanvasNode[]>();
  for (const node of byId.values()) {
    const rank = ranks.get(rankOf(node)) ?? [];
    rank.push(node);
    ranks.set(rankOf(node), rank);
  }

  const parentsOf = new Map<string, string[]>();
  for (const stepId of Object.keys(document.steps)) {
    for (const choiceEntry of document.steps[stepId].choices) {
      const targetId = targetNodeId(document, choiceEntry);
      const list = parentsOf.get(targetId) ?? [];
      list.push(stepId);
      parentsOf.set(targetId, list);
    }
  }

  /** Which Step placed each box, and which of its Choices the box is. */
  const placement = new Map<string, { placer: string; choiceIndex: number }>();
  /** Which of its placer's Choices a box is; a box nothing placed sorts first. */
  const choiceIndexOf = (node: CanvasNode) =>
    placement.get(node.id)?.choiceIndex ?? -1;
  /** How far across each box moved from where dagre put it. */
  const shiftById = new Map<string, number>();

  for (const rank of [...ranks.keys()].sort((a, b) => a - b)) {
    const boxes = ranks.get(rank) ?? [];
    const slots = boxes.map(crossOf).sort((a, b) => a - b);

    // Where each box would like to be: where dagre put it, carried across by
    // however far the Step that placed it has moved.
    const keys = new Map<string, number>();
    for (const node of boxes) {
      const parents = parentsOf.get(node.id) ?? [];
      const above = parents
        .map((id) => byId.get(id))
        .filter((p): p is CanvasNode => p !== undefined && rankOf(p) < rank);
      if (above.length === 0) {
        keys.set(node.id, crossOf(node));
        continue;
      }
      const mean = above.reduce((sum, p) => sum + crossOf(p), 0) / above.length;
      keys.set(node.id, mean);
    }

    // And among the boxes one Step placed, those places dealt out again in
    // the order of its Choices.
    const siblings = new Map<string, CanvasNode[]>();
    for (const node of boxes) {
      const placed = placement.get(node.id);
      if (placed === undefined) continue;
      const group = siblings.get(placed.placer) ?? [];
      group.push(node);
      siblings.set(placed.placer, group);
    }
    for (const group of siblings.values()) {
      const wanted = group
        .map((node) => keys.get(node.id) ?? 0)
        .sort((a, b) => a - b);
      group
        .toSorted((a, b) => choiceIndexOf(a) - choiceIndexOf(b))
        .forEach((node, index) => keys.set(node.id, wanted[index]));
    }

    // Sorted by where each wants to be; boxes wanting the same place — the
    // siblings one Step placed, when that Step is the only one leading to
    // them — fall back to Choice order, and only then to dagre's own order.
    boxes
      .map((node, index) => ({ node, index, key: keys.get(node.id) ?? 0 }))
      .sort(
        (a, b) =>
          a.key - b.key ||
          choiceIndexOf(a.node) - choiceIndexOf(b.node) ||
          a.index - b.index,
      )
      .forEach((entry, index) => {
        const before = crossOf(entry.node);
        place(entry.node, slots[index]);
        shiftById.set(entry.node.id, slots[index] - before);
      });

    // Now that this rank stands where it will, its Steps place the boxes
    // their Choices lead down to, in reading order: the Start first, then
    // across the rank.
    const readers = boxes
      .filter((node) => node.kind === "step")
      .sort(
        (a, b) =>
          Number(b.isStart) - Number(a.isStart) || crossOf(a) - crossOf(b),
      );
    for (const reader of readers) {
      document.steps[reader.stepId].choices.forEach((choiceEntry, index) => {
        const targetId = targetNodeId(document, choiceEntry);
        const target = byId.get(targetId);
        if (
          target === undefined ||
          rankOf(target) <= rank ||
          placement.has(targetId)
        ) {
          return;
        }
        placement.set(targetId, { placer: reader.id, choiceIndex: index });
      });
    }
  }

  for (const [id, shift] of shiftById) {
    if (shift === 0) shiftById.delete(id);
  }
  return {
    nodes: positioned.map((node) => byId.get(node.id) ?? node),
    shiftById,
  };
}

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
function followMovedBoxes(
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
function midpointOf(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** A routed edge with the index of its label among its own points, kept only while routing. */
type RoutedEdge = CanvasEdge & {
  /** Which of `points` is the label's centre; -1 when the label is not on the route. */
  labelIndex: number;
};

/**
 * The least room two labels between the same two ranks are given on the
 * cross axis, centre to centre: the label's own size that way, and a gap.
 * dagre keeps its own labels further apart than this, so only labels the
 * deal or an overflow nudge brought together are moved.
 */
const LABEL_GAP = 8;

/**
 * How far sideways each overflow Choice's route is nudged from the sibling's
 * it borrows: wide enough that the two arrows read as two at fit-to-view,
 * and left to right exactly the room its label needs beside the sibling's,
 * so nothing dagre placed has to move for it; narrow enough that the nudged
 * one stays beside its boxes rather than wandering across the map.
 */
const OVERFLOW_ARROW_OFFSET = EDGE_LABEL_HEIGHT + LABEL_GAP;

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
function spreadLabels(edges: RoutedEdge[], direction: LayoutDirection): void {
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

/**
 * One node per Step, one placeholder per distinct dangling Choice target,
 * and one edge per Choice, positioned with dagre, then put in Choice order
 * across the map by `orderTargetsByChoice`. Never mutates `document`.
 */
export function layoutGraph(document: GraphDocument): GraphLayout {
  const nodes: CanvasNode[] = [];
  const missingTargets: string[] = [];
  const seenMissingTargets = new Set<string>();
  const edges: Array<Omit<CanvasEdge, "points" | "labelAt">> = [];

  const stepIds = Object.keys(document.steps);
  for (const stepId of stepIds) {
    nodes.push(stepNode(document, document.steps[stepId]));
  }

  for (const stepId of stepIds) {
    for (const choice of document.steps[stepId].choices) {
      const targetExists = hasStep(document, choice.targetStepId);
      if (!targetExists && !seenMissingTargets.has(choice.targetStepId)) {
        seenMissingTargets.add(choice.targetStepId);
        missingTargets.push(choice.targetStepId);
      }
      edges.push({
        id: `${stepId}:${choice.id}`,
        stepId,
        choiceId: choice.id,
        source: stepId,
        target: targetExists
          ? choice.targetStepId
          : missingNodeId(choice.targetStepId),
        label: choice.label,
      });
    }
  }

  for (const targetStepId of missingTargets) {
    nodes.push(missingNode(targetStepId));
  }

  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: document.layoutDirection,
    nodesep: 32,
    ranksep:
      document.layoutDirection === "LR"
        ? LR_RANK_SEPARATION
        : TB_RANK_SEPARATION,
    marginx: 16,
    marginy: 16,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }

  const pairCounts = new Map<string, number>();
  const overflowEdgeIds = new Set<string>();
  for (const edge of edges) {
    const key = pairKey(edge.source, edge.target);
    const countSoFar = pairCounts.get(key) ?? 0;
    pairCounts.set(key, countSoFar + 1);
    if (countSoFar < MAX_DAGRE_EDGES_PER_PAIR) {
      // The label's box goes to dagre with the edge, centred on it, so the
      // layout makes room for it rather than the canvas finding some after.
      graph.setEdge(
        edge.source,
        edge.target,
        {
          width: EDGE_LABEL_MAX_WIDTH,
          height: EDGE_LABEL_HEIGHT,
          labelpos: "c",
        },
        edge.id,
      );
    } else {
      overflowEdgeIds.add(edge.id);
    }
  }

  dagre.layout(graph);

  const dagrePositioned = nodes.map((node) => {
    const { x: centerX, y: centerY } = graph.node(node.id);
    return {
      ...node,
      x: centerX - node.width / 2,
      y: centerY - node.height / 2,
    };
  });
  const { nodes: positioned, shiftById } = orderTargetsByChoice(
    document,
    dagrePositioned,
  );
  // Where each box's centre was on the cross axis before the deal, which is
  // what a route's interior points are read against to see which box each
  // one was lined up with.
  const crossBeforeById = new Map<string, number>(
    dagrePositioned.map((node) => [
      node.id,
      document.layoutDirection === "LR"
        ? node.y + node.height / 2
        : node.x + node.width / 2,
    ]),
  );

  // The cross axis `sourceAnchors` orders targets along: x in "TB" (arrows
  // travel top to bottom, spread left to right), y in "LR" (arrows travel
  // left to right, spread top to bottom).
  const crossAxisCenterById = new Map<string, number>(
    positioned.map((node) => [
      node.id,
      document.layoutDirection === "LR"
        ? node.y + node.height / 2
        : node.x + node.width / 2,
    ]),
  );

  const lastRoutedPointsByPair = new Map<string, Point[]>();
  const overflowCountByPair = new Map<string, number>();
  const lastLabelIndexByPair = new Map<string, number>();
  /** How far the labels between one pair of boxes reach along the cross axis. */
  const labelExtentByPair = new Map<string, { min: number; max: number }>();
  const crossOf = (point: Point) =>
    document.layoutDirection === "LR" ? point.y : point.x;
  const routedEdges: RoutedEdge[] = edges.map((edge) => {
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
        document.layoutDirection,
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
    const points = offsetInteriorPoints(
      siblingPoints,
      offset,
      document.layoutDirection,
    );
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
    if (document.layoutDirection === "LR") {
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
  spreadLabels(routedEdges, document.layoutDirection);

  const withAnchors = positioned.map((node) => {
    if (node.kind !== "step") {
      return node;
    }
    const choices = document.steps[node.stepId].choices;
    const sourceAnchors = choices
      .map((choiceEntry, index) => {
        const targetId = targetNodeId(document, choiceEntry);
        return {
          choiceId: choiceEntry.id,
          index,
          targetCrossAxis: crossAxisCenterById.get(targetId) ?? 0,
        };
      })
      .sort(
        (a, b) => a.targetCrossAxis - b.targetCrossAxis || a.index - b.index,
      )
      .map((entry) => entry.choiceId);
    return { ...node, sourceAnchors };
  });

  return {
    nodes: withAnchors,
    edges: routedEdges.map(
      ({ id, stepId, choiceId, source, target, label, points, labelAt }) => ({
        id,
        stepId,
        choiceId,
        source,
        target,
        label,
        points,
        labelAt,
      }),
    ),
    direction: document.layoutDirection,
  };
}

/**
 * Step ids (never placeholders) in map order: top to bottom, then left to
 * right, matching how the canvas arranges boxes on the page.
 */
export function mapOrder(layout: { nodes: CanvasNode[] }): string[] {
  return layout.nodes
    .filter((node) => node.kind === "step")
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((node) => node.id);
}

/**
 * `validateForPublish` output, grouped so the canvas can decorate the exact
 * node or edge each problem is about. A problem that names a Choice is filed
 * under both `steps` (by its `stepId`) and `choices` (by `"<stepId>:<choiceId>"`)
 * so a Step carrying a broken Choice is marked either way; a problem that
 * names only a Step is filed under `steps`; `missing-start` names neither and
 * is not addressed anywhere, since there is no node or edge to mark. Order
 * within each list matches `problems`.
 */
export function problemsByAddress(problems: PublishProblem[]): {
  steps: Map<string, PublishProblem[]>;
  choices: Map<string, PublishProblem[]>;
} {
  const steps = new Map<string, PublishProblem[]>();
  const choices = new Map<string, PublishProblem[]>();

  for (const problem of problems) {
    if (problem.stepId === undefined) {
      continue;
    }
    const stepList = steps.get(problem.stepId) ?? [];
    stepList.push(problem);
    steps.set(problem.stepId, stepList);

    if (problem.choiceId !== undefined) {
      const key = `${problem.stepId}:${problem.choiceId}`;
      const choiceList = choices.get(key) ?? [];
      choiceList.push(problem);
      choices.set(key, choiceList);
    }
  }

  return { steps, choices };
}
