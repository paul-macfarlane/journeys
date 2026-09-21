"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type ColorMode,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type HTMLAttributes,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraphDocument } from "@/lib/graph/document";
import { layoutGraph, problemsByAddress } from "@/lib/graph/layout";
import type { PublishProblem } from "@/lib/graph/validate";
import { cn } from "@/lib/utils";

import "@xyflow/react/dist/style.css";

/**
 * The Draft as a map: one node per Step, one arrow per Choice, the Start and
 * the Endings set apart, and every publish problem marked on the exact node or
 * edge it is about.
 *
 * Layout is recomputed by `layoutGraph` from the document on every change and
 * never stored. No Author drags a node, so there is no hand-placed position to
 * preserve, and a stored one would go stale the moment a Choice was added:
 * what the map is for is showing the shape the Journey has now. `stepSchema`
 * keeps a `position` field for a later decision; nothing here reads or writes
 * it.
 *
 * Arrows are drawn along the route dagre computed for them rather than
 * stepped between handles, and a box's source anchors are spread in the order
 * of the boxes they lead to, so dagre's crossing minimization is what the
 * Author sees. Whichever Step the panel has open, the arrows into and out of
 * it are drawn at full strength and the rest are dimmed, and its box is
 * brought onto the map when it is off it.
 *
 * The problems this draws come from `validateForPublish` run in the browser on
 * the document the editor is holding, not from the "Validate" button's server
 * round trip, so a mark clears the moment the fix is typed.
 */

/**
 * The attributes a spec reads off a node's button: which kind of box it is,
 * which Step, how many problems, which Outcome. React's `HTMLAttributes` has
 * no index signature for `data-*`, so one is intersected in rather than cast.
 */
type NodeMarks = HTMLAttributes<HTMLButtonElement> &
  Record<`data-${string}`, string>;

/**
 * Endings are colored by their Outcome so a glance at the map groups them the
 * way analysis will. Eight hues, walked by the Outcome's position in the
 * document, so the same Outcome is always the same color; the ninth Outcome
 * starts over rather than inventing a color nobody chose.
 */
const OUTCOME_COLORS = [
  "oklch(0.68 0.15 250)",
  "oklch(0.68 0.15 150)",
  "oklch(0.72 0.15 70)",
  "oklch(0.63 0.19 25)",
  "oklch(0.66 0.16 325)",
  "oklch(0.7 0.13 195)",
  "oklch(0.62 0.17 290)",
  "oklch(0.72 0.15 115)",
];

function outcomeColor(outcomeIndex: number | null): string | null {
  if (outcomeIndex === null) return null;
  return OUTCOME_COLORS[outcomeIndex % OUTCOME_COLORS.length];
}

/** A Choice with no label yet still has to be readable on the map. */
function choiceLabel(label: string): string {
  return label.trim().length > 0 ? label : "Untitled choice";
}

type StepNodeData = {
  title: string;
  isStart: boolean;
  isEnding: boolean;
  outcomeLabel: string | null;
  outcomeColor: string | null;
  problems: string[];
  isSelected: boolean;
  /** The Step this node opens in the panel when it is clicked. */
  opens: string;
  /**
   * One source anchor per Choice, ordered by the x position of the box each
   * Choice leads to (`layoutGraph`'s `sourceAnchors`), so arrows leave the
   * bottom of the box in the direction they travel and cross each other
   * less. Two Choices to the same Step still leave from different points and
   * are drawn as two arrows.
   */
  sourceAnchors: string[];
  marks: NodeMarks;
};

type MissingNodeData = {
  marks: NodeMarks;
  isSelected: boolean;
  /** The Step whose Choice points at nothing — what there is to go and fix. */
  opens: string | null;
};

type StepFlowNode = Node<StepNodeData, "step">;
type MissingFlowNode = Node<MissingNodeData, "missing">;
type CanvasFlowNode = StepFlowNode | MissingFlowNode;

/**
 * How strongly an arrow is drawn, given which Step the panel has open:
 * `attached` for the arrows into and out of it, `dimmed` for every other one.
 * `selected` is reserved for an arrow the Author has clicked, which a later
 * deliverable draws heavier; nothing produces it yet.
 */
type Emphasis = "selected" | "attached" | "dimmed";

type ChoiceEdgeData = {
  /**
   * dagre's routed points for this Choice, in flow coordinates. The first and
   * last are dagre's own box-border endpoints, which React Flow supersedes
   * with the anchor positions it hands the edge; only the interior is route.
   */
  points: Array<{ x: number; y: number }>;
  emphasis: Emphasis;
};

type ChoiceFlowEdge = Edge<ChoiceEdgeData, "choice">;

/** How much of an arrow is left when it is not the selected Step's. */
const DIMMED_OPACITY = 0.22;

type Point = { x: number; y: number };

/**
 * The polyline through `points`, smoothed: a quadratic curve through the
 * midpoint of each pair of consecutive segments, so a routed corner becomes a
 * bend rather than a spike. Both ends are exactly the points given, and two
 * points are a straight line.
 */
function smoothPath(points: Point[]): string {
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
function midwayAlong(points: Point[]): Point {
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
 * One Choice's arrow, drawn along dagre's route: out of the anchor React Flow
 * put the Choice on, through the interior of the route dagre laid, into the
 * top of the box it leads to. The opacity is on a group so the arrowhead and
 * the label dim with the line.
 */
function ChoiceEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps<ChoiceFlowEdge>) {
  const points: Point[] = [
    { x: sourceX, y: sourceY },
    ...(data?.points ?? []).slice(1, -1),
    { x: targetX, y: targetY },
  ];
  const middle = midwayAlong(points);

  return (
    <g opacity={data?.emphasis === "dimmed" ? DIMMED_OPACITY : 1}>
      <BaseEdge
        path={smoothPath(points)}
        style={style}
        markerEnd={markerEnd}
        label={label}
        labelX={middle.x}
        labelY={middle.y}
      />
    </g>
  );
}

/**
 * The card of a node is a real button — React Flow's own wrapper takes focus
 * but only ever selects on a key press, and selection here is the panel's —
 * so Enter and Space open the Step the way a click does: the click the button
 * fires bubbles to the wrapper, and `onNodeClick` runs. Its accessible name is
 * the Step's title alone; the badges inside are decoration.
 */
const NODE_BUTTON_CLASS =
  "relative flex h-full w-full cursor-pointer flex-col justify-center gap-1 overflow-hidden rounded-xl bg-background px-3 py-2 text-left ring-inset outline-none focus-visible:ring-4 focus-visible:ring-ring";

/** Where a Choice's arrow leaves the node: spread evenly along its bottom. */
function handleLeft(index: number, count: number): string {
  return `${((index + 1) / (count + 1)) * 100}%`;
}

function StepNode({ data }: NodeProps<StepFlowNode>) {
  const marked = data.problems.length > 0;

  return (
    <>
      {/* Edges are drawn between handles; nothing here is connectable, so
          these are anchors rather than controls. */}
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <button
        type="button"
        {...data.marks}
        aria-label={data.title}
        title={marked ? data.problems.join("\n") : undefined}
        className={cn(
          NODE_BUTTON_CLASS,
          data.isSelected ? "ring-4" : "ring-2",
          marked
            ? "ring-destructive"
            : data.isStart
              ? "ring-primary"
              : "ring-foreground/15",
        )}
      >
        {/* The Outcome's color, dynamic by nature, so it is an inline style.
            The legend shows the same color against the Outcome's name. */}
        {data.isEnding && data.outcomeColor !== null ? (
          <span
            aria-hidden="true"
            data-outcome-bar=""
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundColor: data.outcomeColor }}
          />
        ) : null}

        <p className="truncate text-sm font-medium">{data.title}</p>

        <div className="flex items-center gap-1 overflow-hidden">
          {data.isStart ? <Badge>Start</Badge> : null}
          {data.isEnding ? <Badge>Ending</Badge> : null}
          {/* The count; the messages are the button's `title`, where a hover
              shows them and assistive technology reads them as its description. */}
          {marked ? (
            <Badge tone="destructive">{data.problems.length}</Badge>
          ) : null}
          {data.isEnding ? (
            <span className="truncate text-xs text-muted-foreground">
              {data.outcomeLabel ?? "No outcome"}
            </span>
          ) : null}
        </div>
      </button>

      {data.sourceAnchors.map((choiceId, index) => (
        <Handle
          key={choiceId}
          id={choiceId}
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          style={{ left: handleLeft(index, data.sourceAnchors.length) }}
        />
      ))}
    </>
  );
}

function MissingNode({ data }: NodeProps<MissingFlowNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <button
        type="button"
        {...data.marks}
        aria-label="Missing step"
        className={cn(
          NODE_BUTTON_CLASS,
          "items-center border-2 border-dashed border-destructive",
          data.isSelected ? "ring-4 ring-destructive" : null,
        )}
      >
        <p className="truncate text-sm font-medium text-destructive">
          Missing step
        </p>
      </button>
    </>
  );
}

// Module-level: a fresh object each render would remount every node or edge.
const NODE_TYPES: NodeTypes = { step: StepNode, missing: MissingNode };
const EDGE_TYPES: EdgeTypes = { choice: ChoiceEdge };

/**
 * "Has this render happened in the browser?" — false through the server
 * render and the hydrating one, true afterwards. The store never changes, so
 * there is nothing to subscribe to; React re-renders once after hydration
 * because the client snapshot differs from the server's.
 */
const subscribeToNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

const LEGEND_ENTRY_CLASS = "flex items-center gap-1.5";
const LEGEND_SWATCH_CLASS = "size-2.5 shrink-0 rounded-full";

/** Sub-pixel rounding, so a box flush against the edge counts as on the map. */
const IN_VIEW_TOLERANCE = 1;

export type JourneyCanvasProps = {
  document: GraphDocument;
  selectedStepId: string;
  problems: PublishProblem[];
  onSelectStep: (stepId: string) => void;
  onAddStep: () => void;
};

function CanvasFlow({
  document,
  selectedStepId,
  problems,
  onSelectStep,
  onAddStep,
}: JourneyCanvasProps) {
  const layout = useMemo(() => layoutGraph(document), [document]);
  const addressed = useMemo(() => problemsByAddress(problems), [problems]);

  const { nodes, edges } = useMemo(() => {
    const titleById = new Map(
      layout.nodes.map((node) => [node.id, node.title]),
    );

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
      const stepProblems = (addressed.steps.get(node.stepId) ?? []).map(
        (problem) => problem.message,
      );
      const isSelected = node.stepId === selectedStepId;
      const common = {
        id: node.id,
        position: { x: node.x, y: node.y },
        width: node.width,
        height: node.height,
        selected: isSelected,
        connectable: false,
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
          },
        } satisfies MissingFlowNode;
      }

      const marks: NodeMarks = {
        "aria-roledescription": "step",
        "data-kind": node.isStart ? "start" : node.isEnding ? "ending" : "step",
        "data-step-id": node.stepId,
        "data-problems": String(stepProblems.length),
        "data-outcome-index":
          node.outcomeIndex === null ? "" : String(node.outcomeIndex),
      };

      return {
        ...common,
        type: "step",
        data: {
          title: node.title,
          isStart: node.isStart,
          isEnding: node.isEnding,
          sourceAnchors: node.sourceAnchors,
          outcomeLabel:
            node.outcomeId !== null
              ? (document.outcomes[node.outcomeId]?.label ?? null)
              : null,
          outcomeColor: outcomeColor(node.outcomeIndex),
          problems: stepProblems,
          isSelected,
          opens: node.stepId,
          marks,
        },
      } satisfies StepFlowNode;
    });

    const flowEdges: ChoiceFlowEdge[] = layout.edges.map((edge) => {
      const label = choiceLabel(edge.label);
      const problemCount = (addressed.choices.get(edge.id) ?? []).length;
      const marked = problemCount > 0;
      // The panel always has a Step open, so every arrow is one of the two:
      // this Step's, or dimmed behind it. A placeholder is opened through the
      // Step whose Choice dangles, which is this arrow's source.
      const emphasis: Emphasis =
        edge.source === selectedStepId || edge.target === selectedStepId
          ? "attached"
          : "dimmed";

      return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.choiceId,
        target: edge.target,
        type: "choice",
        label,
        ariaLabel: `${label}: ${titleById.get(edge.source) ?? ""} → ${titleById.get(edge.target) ?? ""}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { points: edge.points, emphasis },
        // What a spec reads off an arrow, and what a screen reader calls it.
        domAttributes: {
          "aria-roledescription": "choice",
          "data-choice-id": edge.choiceId,
          "data-problems": String(problemCount),
          "data-emphasis": emphasis,
        } as Edge["domAttributes"],
        style: marked
          ? { stroke: "var(--destructive)", strokeWidth: 2 }
          : undefined,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [addressed, document.outcomes, layout, selectedStepId]);

  const outcomeLegend = useMemo(
    () =>
      Object.values(document.outcomes).map((outcome, index) => ({
        id: outcome.id,
        index,
        label: outcome.label,
        color: OUTCOME_COLORS[index % OUTCOME_COLORS.length],
      })),
    [document.outcomes],
  );

  const { fitView, getNodesBounds, getViewport } = useReactFlow();
  // The size of the map itself, which is what "off the map" is measured
  // against; React Flow keeps it up to date as the pane resizes.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);

  const nodeIdKey = nodes
    .map((node) => node.id)
    .sort()
    .join(" ");
  const lastNodeIdKey = useRef(nodeIdKey);

  // Opening a Step from the list, a problem, or a Choice's target can name a
  // box that is off the map; the map goes to it. A box already on the map is
  // left where the Author put it, and so is the rest of the view.
  //
  // Declared before the fit-to-all below so that a render which changed the
  // set of boxes — a Step added, which is also the Step now open — is still
  // that one's: this effect sees the older key and stands aside.
  const locatedStepId = useRef<string | null>(null);
  useEffect(() => {
    const previous = locatedStepId.current;
    locatedStepId.current = selectedStepId;

    // The first render is the initial fit-to-all's, which shows everything.
    if (previous === null || previous === selectedStepId) return;
    if (lastNodeIdKey.current !== nodeIdKey) return;
    if (paneWidth === 0 || paneHeight === 0) return;
    if (!nodes.some((node) => node.id === selectedStepId)) return;

    const bounds = getNodesBounds([selectedStepId]);
    const { x, y, zoom } = getViewport();
    const onMap =
      bounds.x * zoom + x >= -IN_VIEW_TOLERANCE &&
      bounds.y * zoom + y >= -IN_VIEW_TOLERANCE &&
      (bounds.x + bounds.width) * zoom + x <= paneWidth + IN_VIEW_TOLERANCE &&
      (bounds.y + bounds.height) * zoom + y <= paneHeight + IN_VIEW_TOLERANCE;
    if (onMap) return;

    void fitView({
      nodes: [{ id: selectedStepId }],
      maxZoom: 1,
      duration: 200,
    });
  }, [
    fitView,
    getNodesBounds,
    getViewport,
    nodeIdKey,
    nodes,
    paneHeight,
    paneWidth,
    selectedStepId,
  ]);

  // A Step added or removed changes which boxes there are to see, and a new
  // one can land off-screen; anything else (a rename, a mark appearing) leaves
  // the view exactly where the Author put it.
  useEffect(() => {
    if (lastNodeIdKey.current === nodeIdKey) return;
    lastNodeIdKey.current = nodeIdKey;
    void fitView({ duration: 200 });
  }, [fitView, nodeIdKey]);

  // next-themes reads the browser's stored choice, which the server render
  // cannot know: asking before hydration is done would put a different color
  // mode on the first client render than the server sent. Until then the map
  // follows the system, exactly as the server assumed.
  const { resolvedTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribeToNothing, isClient, isServer);
  const colorMode: ColorMode =
    hydrated && (resolvedTheme === "dark" || resolvedTheme === "light")
      ? resolvedTheme
      : "system";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      colorMode={colorMode}
      nodesDraggable={false}
      nodesConnectable={false}
      // The node's own button takes focus; the wrapper would otherwise be a
      // second tab stop that opens nothing.
      nodesFocusable={false}
      // Selection is the panel's, and it follows `selectedStepId`; letting
      // React Flow keep a second one would only ever disagree with it.
      elementsSelectable={false}
      fitView
      minZoom={0.1}
      onNodeClick={(_event, node) => {
        const opens = (node.data as StepNodeData | MissingNodeData).opens;
        if (opens !== null) onSelectStep(opens);
      }}
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />

      <Panel position="top-left">
        <Button variant="outline" size="sm" onClick={onAddStep}>
          Add step
        </Button>
      </Panel>

      <Panel position="top-right">
        {/* role="list" is explicit: the flex layout strips the list marker,
            and some browsers drop the implicit role with it. Every Outcome
            gets an entry, in document order, so the colors on the Endings
            can be read back to what they group. */}
        <ul
          role="list"
          aria-label="Legend"
          className="flex max-w-80 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-foreground/10"
        >
          <li className={LEGEND_ENTRY_CLASS}>
            <span className={cn(LEGEND_SWATCH_CLASS, "bg-primary")} />
            Start
          </li>

          {outcomeLegend.map((outcome) => (
            <li
              key={outcome.id}
              data-outcome-index={outcome.index}
              data-outcome-id={outcome.id}
              className={LEGEND_ENTRY_CLASS}
            >
              <span
                data-outcome-swatch=""
                className={LEGEND_SWATCH_CLASS}
                style={{ backgroundColor: outcome.color }}
              />
              <span className="max-w-32 truncate">{outcome.label}</span>
            </li>
          ))}

          <li className={LEGEND_ENTRY_CLASS}>
            <span className={cn(LEGEND_SWATCH_CLASS, "bg-destructive")} />
            Problem
          </li>
        </ul>
      </Panel>
    </ReactFlow>
  );
}

export function JourneyCanvas(props: JourneyCanvasProps) {
  return (
    <section
      aria-label="Canvas"
      // Most of the viewport on a tall screen, never less than a map's worth:
      // a real-sized Journey is dozens of ranks deep, and every pixel of
      // height is legibility at fit-to-view.
      className="h-[70vh] min-h-[36rem] overflow-hidden rounded-xl ring-1 ring-foreground/10"
    >
      <ReactFlowProvider>
        <CanvasFlow {...props} />
      </ReactFlowProvider>
    </section>
  );
}
