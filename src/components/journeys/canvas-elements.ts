import { MarkerType } from "@xyflow/react";

import type {
  ChoiceFlowEdge,
  EdgeMarks,
  Emphasis,
} from "@/components/journeys/choice-line";
import { SELECTED_STROKE_WIDTH } from "@/components/journeys/choice-line";
import {
  choiceLabel,
  type CanvasArrow,
} from "@/components/journeys/editor-shared";
import type {
  CanvasFlowNode,
  MissingFlowNode,
  NodeMarks,
  StepFlowNode,
} from "@/components/journeys/step-node";
import { contentPreview } from "@/lib/graph/content";
import type { GraphDocument } from "@/lib/graph/document";
import type { GraphLayout } from "@/lib/graph/layout";
import type { ProblemIndex } from "@/lib/graph/validate";

/**
 * The editor's map as React Flow draws it: one node per box the layout laid
 * out, one edge per Choice, each carrying the marks a spec and a screen reader
 * read off it, and a lookup from each edge back to the Choice it draws — what
 * a click, a drag of its head, or a delete has to be turned back into. Pure:
 * the canvas builds these once per change of what they are built from.
 */
export function buildFlowElements({
  document,
  layout,
  problems,
  selectedArrow,
  selectedStepId,
  shownToolbar,
}: {
  document: GraphDocument;
  layout: GraphLayout;
  problems: ProblemIndex;
  selectedArrow: CanvasArrow | null;
  selectedStepId: string;
  /** The box showing its moves, and whether folded out; null for none. */
  shownToolbar: { stepId: string; expanded: boolean } | null;
}): {
  nodes: CanvasFlowNode[];
  edges: ChoiceFlowEdge[];
  arrows: Map<string, CanvasArrow>;
} {
  const titleById = new Map(layout.nodes.map((node) => [node.id, node.title]));

  // A placeholder has no Step of its own to open, so clicking it opens the
  // first Step whose Choice is left pointing at nothing. Every Step that
  // dangles to the same target shares the placeholder and carries its own
  // mark, so the others are a click on their own node away.
  const opensByMissingId = new Map<string, string>();
  for (const edge of layout.edges) {
    if (!opensByMissingId.has(edge.target)) {
      opensByMissingId.set(edge.target, edge.stepId);
    }
  }

  const flowNodes: CanvasFlowNode[] = layout.nodes.map((node) => {
    const stepProblems = problems
      .problemsForStep(node.stepId)
      .map((problem) => problem.message);
    const isSelected = node.stepId === selectedStepId;
    const common = {
      id: node.id,
      position: { x: node.x, y: node.y },
      width: node.width,
      height: node.height,
      // Arrows are React Flow's to select; boxes are not. A selected node
      // would also be one the Delete key took with it, and the panel's
      // selection is not a thing the Delete key is about.
      selected: false,
      selectable: false,
      // A placeholder stands for a Step that is gone: there is nothing to
      // draw an arrow to it, and nothing to draw one from.
      connectable: node.kind === "step",
    };

    if (node.kind === "missing") {
      // React Flow would call it a "node"; `CONTEXT.md` does not.
      const marks: NodeMarks = {
        "aria-roledescription": "missing step",
        "data-kind": "missing",
        "data-step-id": node.stepId,
        "data-problems": "0",
      };
      return {
        ...common,
        type: "missing",
        data: {
          marks,
          isSelected,
          opens: opensByMissingId.get(node.id) ?? null,
          direction: layout.direction,
        },
      } satisfies MissingFlowNode;
    }

    const marks: NodeMarks = {
      "aria-roledescription": "step",
      "data-kind": node.isStart ? "start" : node.isEnding ? "ending" : "step",
      "data-step-id": node.stepId,
      "data-problems": String(stepProblems.length),
    };

    const step = document.steps[node.stepId];

    return {
      ...common,
      type: "step",
      data: {
        title: node.title,
        isStart: node.isStart,
        isEnding: node.isEnding,
        preview: contentPreview(step.content),
        sourceAnchors: node.sourceAnchors,
        direction: layout.direction,
        outcomeLabel:
          node.outcomeId !== null
            ? (document.outcomes[node.outcomeId]?.label ?? null)
            : null,
        problems: stepProblems,
        isSelected,
        toolbar:
          shownToolbar?.stepId !== node.stepId
            ? "hidden"
            : shownToolbar.expanded
              ? "expanded"
              : "compact",
        opens: node.stepId,
        marks,
      },
    } satisfies StepFlowNode;
  });

  // Which Choice each arrow draws, by the id React Flow knows it as: what
  // a click, a drag of its head, or a delete has to be turned back into.
  const arrows = new Map<string, CanvasArrow>();

  const flowEdges: ChoiceFlowEdge[] = layout.edges.map((edge) => {
    const label = choiceLabel(edge.label);
    const problemCount = problems.problemsForChoice(
      edge.stepId,
      edge.choiceId,
    ).length;
    const marked = problemCount > 0;
    const isSelected =
      selectedArrow !== null &&
      selectedArrow.stepId === edge.stepId &&
      selectedArrow.choiceId === edge.choiceId;
    // The arrow in hand wins. Otherwise the panel always has a Step open,
    // so every arrow is one of the two: this Step's, or dimmed behind it.
    // A placeholder is opened through the Step whose Choice dangles, which
    // is this arrow's source.
    const emphasis: Emphasis = isSelected
      ? "selected"
      : edge.source === selectedStepId || edge.target === selectedStepId
        ? "attached"
        : "dimmed";
    const marks = marked
      ? { stroke: "var(--destructive)", strokeWidth: 2 }
      : undefined;

    arrows.set(edge.id, { stepId: edge.stepId, choiceId: edge.choiceId });

    // What a spec reads off an arrow, and what a screen reader calls it.
    //
    // Out of the tab order (ticket 88): React Flow draws its arrows before
    // its boxes, so as tab stops they came ahead of every Step. The tab order
    // across the map is the boxes alone; an arrow still takes focus from a
    // click or a script, and its Choice is reached from the Step panel.
    // React Flow spreads these after its own `tabIndex`, so this one wins.
    const domAttributes: EdgeMarks = {
      tabIndex: -1,
      "aria-roledescription": "choice",
      "data-choice-id": edge.choiceId,
      "data-problems": String(problemCount),
      "data-emphasis": emphasis,
    };

    return {
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.choiceId,
      target: edge.target,
      // Named rather than left to React Flow's first target handle: the
      // box has a second, invisible one covering it for drops to land on.
      targetHandle: "in",
      // The head of the arrow the Author has in hand can be picked up and
      // dropped on another box; where a Choice leaves from is the Step it
      // is written on, which is not something to drag. Only the selected
      // arrow grows a head, and it is drawn over the rest: every arrow
      // into a box ends on the same handle, so the heads stack, and a head
      // dragged out of a stack has to be the Choice the Author chose.
      reconnectable: isSelected ? ("target" as const) : false,
      zIndex: isSelected ? 1 : 0,
      type: "choice",
      selected: isSelected,
      label,
      ariaLabel: `${label}: ${titleById.get(edge.source) ?? ""} → ${titleById.get(edge.target) ?? ""}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        points: edge.points,
        labelAt: edge.labelAt,
        emphasis,
        direction: layout.direction,
      },
      domAttributes,
      style: isSelected
        ? { ...marks, strokeWidth: SELECTED_STROKE_WIDTH }
        : marks,
    };
  });

  return { nodes: flowNodes, edges: flowEdges, arrows };
}
