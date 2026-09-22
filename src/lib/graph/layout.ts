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
 * One node per Step, one placeholder per distinct dangling Choice target,
 * and one edge per Choice, positioned with dagre. Never mutates `document`.
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
    ranksep: 96,
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

  const positioned = nodes.map((node) => {
    const { x: centerX, y: centerY } = graph.node(node.id);
    return {
      ...node,
      x: centerX - node.width / 2,
      y: centerY - node.height / 2,
    };
  });

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
      const { points } = graph.edge({
        v: edge.source,
        w: edge.target,
        name: edge.id,
      });
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
