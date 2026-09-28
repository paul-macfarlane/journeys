import dagre from "@dagrejs/dagre";

import type { Point } from "@/lib/graph/crossings";
import type {
  Choice,
  GraphDocument,
  LayoutDirection,
  Step,
} from "@/lib/graph/document";
import { hasStep, isEnding, stepName, walkSteps } from "@/lib/graph/document";
import type { CanvasEdge, CanvasNode } from "@/lib/graph/layout";
import {
  EDGE_LABEL_HEIGHT,
  EDGE_LABEL_MAX_WIDTH,
  LR_RANK_SEPARATION,
  NODE_HEIGHT,
  NODE_WIDTH,
  TB_RANK_SEPARATION,
} from "@/lib/graph/layout-constants";

/**
 * The dagre input for `layoutGraph`: turning a document's Steps and Choices
 * into dagre's nodes and (multigraph) edges, running dagre, and then the
 * Choice-order post-pass that puts each Step's targets in Choice order
 * across the map (`orderTargetsByChoice`'s own doc comment has the detail).
 * `layout-routing.ts` reads the routed points back off the dagre graph this
 * builds; `layout.ts`'s `layoutGraph` is the only caller of `buildDagreLayout`.
 */

function missingNodeId(targetStepId: string): string {
  return `missing:${targetStepId}`;
}

/** The node a Choice's arrow ends at: its Step, or the placeholder for one that is gone. */
export function targetNodeId(document: GraphDocument, choice: Choice): string {
  return hasStep(document, choice.targetStepId)
    ? choice.targetStepId
    : missingNodeId(choice.targetStepId);
}

/**
 * dagre only reliably routes up to two parallel edges between the same
 * ordered `(source, target)` pair — see `buildDagreLayout`'s doc comment.
 */
const MAX_DAGRE_EDGES_PER_PAIR = 2;

/** A stable, collision-safe key for a `(source, target)` pair. */
export function pairKey(source: string, target: string): string {
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
export function offsetInteriorPoints(
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
 * `followMovedBoxes` (`layout-routing.ts`) slides each route across to
 * wherever its boxes now are.
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
 * A thin wrapper round `new dagre.graphlib.Graph(...)`, so `DagreGraph` can
 * read its instance type off dagre's own generic defaults (`ReturnType`)
 * rather than writing `any` out here.
 */
function newDagreGraph(
  ...args: ConstructorParameters<typeof dagre.graphlib.Graph>
) {
  return new dagre.graphlib.Graph(...args);
}

/** dagre's own graph instance, at whichever generic defaults dagre's own constructor picks. */
export type DagreGraph = ReturnType<typeof newDagreGraph>;

/** Everything `buildDagreLayout` hands back to `layoutGraph`. */
export type DagreLayoutResult = {
  /** Every Step's box and every distinct missing placeholder, positioned and in Choice order. */
  nodes: CanvasNode[];
  /** One entry per Choice, not yet routed. */
  edges: Array<Omit<CanvasEdge, "points" | "labelAt">>;
  /** dagre's own graph, still holding the routed points `layout-routing.ts` reads back. */
  graph: DagreGraph;
  /** Choice ids past the first two between any one `(source, target)` pair, which never reached dagre. */
  overflowEdgeIds: Set<string>;
  /** How far each box moved from where dagre put it, across the cross axis. */
  shiftById: Map<string, number>;
  /** Where each box's centre was on the cross axis before the Choice-order pass moved it. */
  crossBeforeById: Map<string, number>;
};

/**
 * One node per Step, one placeholder per distinct dangling Choice target,
 * and one dagre edge per Choice, laid out with dagre and then put in Choice
 * order across the map by `orderTargetsByChoice`. Never mutates `document`.
 *
 * dagre runs as a multigraph: every Choice gets its own named dagre edge
 * (`graph.setEdge(source, target, label box, edge.id)`), so parallel Choices
 * between the same two Steps and self-loop Choices each get their own
 * routed path instead of collapsing onto one. `layout-routing.ts` reads the
 * routed `points` dagre produced for a Choice back with
 * `graph.edge({ v, w, name })`, in the same coordinate space as the node
 * positions, along with `labelAt`, the centre of the label box dagre made
 * room for on that route.
 *
 * dagre's own multigraph order phase throws ("Not possible to find
 * intersection inside of the rectangle") when three or more parallel edges
 * share the same source and target inside a larger graph — reproduced on
 * the seeded case-3 document, where `step-14` has three Choices to
 * `step-22`; two parallel dagre edges between the same pair are fine. Only
 * the first two Choices between any ordered pair (including a self-loop's
 * own Step as both ends) become real dagre edges and are marked in
 * `overflowEdgeIds`; a third or later Choice to the same target never
 * reaches dagre at all — `layout-routing.ts` reuses the last registered
 * sibling's routed points with an interior offset (`offsetInteriorPoints`),
 * so it still gets its own visibly distinct `points` array without
 * tripping the bug.
 */
export function buildDagreLayout(document: GraphDocument): DagreLayoutResult {
  const nodes: CanvasNode[] = [];
  const missingTargets: string[] = [];
  const seenMissingTargets = new Set<string>();
  const edges: Array<Omit<CanvasEdge, "points" | "labelAt">> = [];

  // dagre's placement depends on the order nodes and edges are added, so
  // they go in walk order rather than `document.steps`'s key order, which
  // jsonb does not keep: the same Draft draws the same map however its
  // keys come back.
  const stepIds = walkSteps(document).order;
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

  const graph = newDagreGraph({ multigraph: true });
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

  return {
    nodes: positioned,
    edges,
    graph,
    overflowEdgeIds,
    shiftById,
    crossBeforeById,
  };
}
