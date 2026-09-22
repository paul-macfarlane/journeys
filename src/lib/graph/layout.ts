import dagre from "@dagrejs/dagre";

import type { Point } from "@/lib/graph/crossings";
import type {
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
 * (`graph.setEdge(source, target, {}, edge.id)`), so parallel Choices
 * between the same two Steps and self-loop Choices each get their own
 * routed path instead of collapsing onto one. Each `CanvasEdge` carries the
 * routed `points` dagre produced for that Choice, read back with
 * `graph.edge({ v, w, name })`, in the same coordinate space as the node
 * positions. Each Step `CanvasNode` carries `sourceAnchors`: its Choice ids
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

/**
 * The gap between one rank of boxes and the next. Top to bottom a label sits
 * in the gap sideways-on, so its width is no concern of the gap's; left to
 * right the label lies along the arrow, so the gap has to be wider than the
 * label is, with room to spare on either side of it.
 */
export const TB_RANK_SEPARATION = 96;
export const LR_RANK_SEPARATION = EDGE_LABEL_MAX_WIDTH + 48;

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

/**
 * dagre only reliably routes up to two parallel edges between the same
 * ordered `(source, target)` pair (see the module doc comment).
 */
const MAX_DAGRE_EDGES_PER_PAIR = 2;

/**
 * How far sideways each overflow Choice's route is nudged from the sibling's
 * it borrows: wide enough that the two arrows read as two at fit-to-view,
 * narrow enough that the nudged one stays beside its boxes rather than
 * wandering across the map.
 */
const OVERFLOW_ARROW_OFFSET = 28;

/** A stable, collision-safe key for a `(source, target)` pair. */
function pairKey(source: string, target: string): string {
  return JSON.stringify([source, target]);
}

/**
 * Nudges the interior of a routed path sideways so a Choice that shares its
 * dagre pair with an already-routed sibling still draws its own visible
 * path. Endpoints are left untouched so the arrow still starts and ends at
 * the box edges dagre computed for the sibling; with only two points (no
 * interior point to nudge), a synthetic midpoint is inserted instead so the
 * path still bends away from the shared one.
 */
function offsetInteriorPoints(points: Point[], offset: number): Point[] {
  if (points.length <= 2) {
    const [start, end] = points;
    return [
      start,
      { x: (start.x + end.x) / 2 + offset, y: (start.y + end.y) / 2 },
      end,
    ];
  }
  return points.map((point, index) =>
    index === 0 || index === points.length - 1
      ? point
      : { x: point.x + offset, y: point.y },
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
      const targetId = hasStep(document, choiceEntry.targetStepId)
        ? choiceEntry.targetStepId
        : missingNodeId(choiceEntry.targetStepId);
      const list = parentsOf.get(targetId) ?? [];
      list.push(stepId);
      parentsOf.set(targetId, list);
    }
  }

  /** Which Step placed each box, and which of its Choices the box is. */
  const placement = new Map<string, { placer: string; choiceIndex: number }>();
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
      const choiceIndexOf = (node: CanvasNode) =>
        placement.get(node.id)?.choiceIndex ?? 0;
      group
        .toSorted((a, b) => choiceIndexOf(a) - choiceIndexOf(b))
        .forEach((node, index) => keys.set(node.id, wanted[index]));
    }

    boxes
      .map((node, index) => ({ node, index, key: keys.get(node.id) ?? 0 }))
      .sort((a, b) => a.key - b.key || a.index - b.index)
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
        const targetId = hasStep(document, choiceEntry.targetStepId)
          ? choiceEntry.targetStepId
          : missingNodeId(choiceEntry.targetStepId);
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
 */
function followMovedBoxes(
  points: Point[],
  sourceShift: number,
  targetShift: number,
  direction: LayoutDirection,
): Point[] {
  if (sourceShift === 0 && targetShift === 0) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const along = (point: Point) => (direction === "LR" ? point.x : point.y);
  const span = along(last) - along(first);

  return points.map((point) => {
    const progress =
      span === 0
        ? 0.5
        : Math.min(1, Math.max(0, (along(point) - along(first)) / span));
    const shift = sourceShift + (targetShift - sourceShift) * progress;
    return direction === "LR"
      ? { x: point.x, y: point.y + shift }
      : { x: point.x + shift, y: point.y };
  });
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
  const edges: Array<Omit<CanvasEdge, "points">> = [];

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
      graph.setEdge(edge.source, edge.target, {}, edge.id);
    } else {
      overflowEdgeIds.add(edge.id);
    }
  }

  dagre.layout(graph);

  const { nodes: positioned, shiftById } = orderTargetsByChoice(
    document,
    nodes.map((node) => {
      const { x: centerX, y: centerY } = graph.node(node.id);
      return {
        ...node,
        x: centerX - node.width / 2,
        y: centerY - node.height / 2,
      };
    }),
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
  const routedEdges = edges.map((edge) => {
    const key = pairKey(edge.source, edge.target);
    if (!overflowEdgeIds.has(edge.id)) {
      const points = followMovedBoxes(
        graph.edge({ v: edge.source, w: edge.target, name: edge.id }).points,
        shiftById.get(edge.source) ?? 0,
        shiftById.get(edge.target) ?? 0,
        document.layoutDirection,
      );
      lastRoutedPointsByPair.set(key, points);
      return { ...edge, points };
    }
    const siblingPoints = lastRoutedPointsByPair.get(key) ?? [];
    const overflowIndex = overflowCountByPair.get(key) ?? 0;
    overflowCountByPair.set(key, overflowIndex + 1);
    const offset =
      OVERFLOW_ARROW_OFFSET *
      (overflowIndex + 1) *
      (overflowIndex % 2 === 0 ? 1 : -1);
    return { ...edge, points: offsetInteriorPoints(siblingPoints, offset) };
  });

  const withAnchors = positioned.map((node) => {
    if (node.kind !== "step") {
      return node;
    }
    const choices = document.steps[node.stepId].choices;
    const sourceAnchors = choices
      .map((choiceEntry, index) => {
        const targetId = hasStep(document, choiceEntry.targetStepId)
          ? choiceEntry.targetStepId
          : missingNodeId(choiceEntry.targetStepId);
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
    edges: routedEdges,
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
