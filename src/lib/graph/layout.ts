import type { Point } from "@/lib/graph/crossings";
import type { GraphDocument, LayoutDirection } from "@/lib/graph/document";
import { buildDagreLayout, targetNodeId } from "@/lib/graph/layout-dagre";
import { spreadLabels } from "@/lib/graph/layout-labels";
import { routeEdges } from "@/lib/graph/layout-routing";

/**
 * Pure graph-to-canvas layout: turns a `GraphDocument` into positioned nodes
 * and edges the canvas can hand straight to React Flow. Deliberately no
 * `server-only` and no React import — the canvas component and this module's
 * own tests both call it directly on the client, with no server round trip.
 *
 * `stepSchema` carries a `position` field, but it is unused legacy kept only
 * so already-stored documents keep parsing (ticket 17's manual layout is
 * `wontfix`, and removing the field is itself `wontfix`; ticket 72 D4).
 * `layoutGraph` recomputes layout with dagre every time the document
 * changes, and the map always shows the current shape of the Journey rather
 * than wherever a node happened to be left. It never mutates the document it
 * is given, and the same document always lays out the same way.
 *
 * `layoutGraph` is the orchestrator over three stages, each its own module:
 * the dagre input and the Choice-order post-pass (`layout-dagre.ts`), edge
 * routing (`layout-routing.ts`), and label placement (`layout-labels.ts`).
 * Constants shared across those modules live in `layout-constants.ts` and are
 * re-exported here, so `@/lib/graph/layout` still carries every constant it
 * always has.
 */

export {
  EDGE_LABEL_HEIGHT,
  EDGE_LABEL_MAX_WIDTH,
  LR_RANK_SEPARATION,
  NODE_HEIGHT,
  NODE_WIDTH,
  TB_RANK_SEPARATION,
} from "@/lib/graph/layout-constants";

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

/**
 * One node per Step, one placeholder per distinct dangling Choice target,
 * and one edge per Choice, positioned with dagre and put in Choice order
 * across the map (`buildDagreLayout`), then routed (`routeEdges`) and
 * spread apart where two labels landed too close (`spreadLabels`). Never
 * mutates `document`.
 */
export function layoutGraph(document: GraphDocument): GraphLayout {
  const {
    nodes: positioned,
    edges,
    graph,
    overflowEdgeIds,
    shiftById,
    crossBeforeById,
  } = buildDagreLayout(document);

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

  const routedEdges = routeEdges(
    edges,
    graph,
    overflowEdgeIds,
    shiftById,
    crossBeforeById,
    document.layoutDirection,
  );
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
