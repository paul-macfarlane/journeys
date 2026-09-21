import dagre from "@dagrejs/dagre";

import type { GraphDocument, Step } from "@/lib/graph/document";
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
  outcomeIndex: number | null;
};

/** One arrow on the canvas, drawn from a Choice. */
export type CanvasEdge = {
  id: string;
  stepId: string;
  choiceId: string;
  source: string;
  target: string;
  label: string;
};

function missingNodeId(targetStepId: string): string {
  return `missing:${targetStepId}`;
}

/**
 * Where an Outcome sits among the document's Outcomes, so Endings can be
 * colored by Outcome deterministically. `null` when the Step carries no
 * Outcome, or one that no longer exists.
 */
function outcomeIndexOf(
  document: GraphDocument,
  outcomeId: string | null,
): number | null {
  if (outcomeId === null) {
    return null;
  }
  const index = Object.keys(document.outcomes).indexOf(outcomeId);
  return index === -1 ? null : index;
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
    outcomeIndex: outcomeIndexOf(document, step.outcomeId),
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
    outcomeIndex: null,
  };
}

/**
 * One node per Step, one placeholder per distinct dangling Choice target,
 * and one edge per Choice, positioned with dagre. Never mutates `document`.
 */
export function layoutGraph(document: GraphDocument): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const nodes: CanvasNode[] = [];
  const missingTargets: string[] = [];
  const seenMissingTargets = new Set<string>();
  const edges: CanvasEdge[] = [];

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

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "TB",
    nodesep: 32,
    ranksep: 72,
    marginx: 16,
    marginy: 16,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
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

  return { nodes: positioned, edges };
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
