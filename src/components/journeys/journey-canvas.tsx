"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeToolbar,
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
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { DeleteStepDialog } from "@/components/journeys/delete-step-dialog";
import {
  choiceLabel,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contentPreview } from "@/lib/graph/content";
import type { Point } from "@/lib/graph/crossings";
import type { GraphDocument, Step } from "@/lib/graph/document";
import {
  NODE_WIDTH,
  problemsByAddress,
  type GraphLayout,
} from "@/lib/graph/layout";
import type { PublishProblem } from "@/lib/graph/validate";
import { cn } from "@/lib/utils";

import "@xyflow/react/dist/style.css";

/**
 * The Draft as a map: one node per Step, one arrow per Choice, the Start and
 * the Endings set apart, and every publish problem marked on the exact node or
 * edge it is about.
 *
 * Layout is recomputed by `layoutGraph` from the document on every change and
 * never stored — once, by the editor, which hands the same layout to the map
 * and to the "Find step" field above it. No Author drags a node, so there is
 * no hand-placed position to
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
 *
 * The map is also where the Journey is built: the open box carries a toolbar
 * for the moves that shape it — adding the next step, duplicating it, making
 * it the start, and deleting it — and one that only moves the view, zooming
 * to it. A Choice is made by dragging from a box onto another, an arrow's
 * head is dragged to move where its Choice leads, and a clicked arrow is the
 * Choice in hand — opened in the panel, and removed by the Delete key.
 * Nothing here edits the document: each of those is handed back to the
 * editor in the document's own words (a Step, a Choice), and the map redraws
 * from whatever the editor makes of it.
 *
 * And it is a map to be read: hovering or focusing a box peeks at what the
 * Step says without opening it, and the arrow keys walk from box to nearest
 * box so the whole map is reachable without a pointer — Enter opens the box
 * the keyboard is on, and Escape steps back out to the map itself.
 */

/**
 * The attributes a spec reads off a node's button: which kind of box it is,
 * which Step, how many problems, which Outcome. React's `HTMLAttributes` has
 * no index signature for `data-*`, so one is intersected in rather than cast.
 */
type NodeMarks = HTMLAttributes<HTMLButtonElement> &
  Record<`data-${string}`, string>;

/**
 * The same for an arrow: which Choice it draws, how many problems it carries,
 * how strongly it is drawn. React Flow's own `domAttributes` type has no
 * index signature for `data-*` either, so one is intersected in here too.
 */
type EdgeMarks = NonNullable<Edge["domAttributes"]> &
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

/**
 * What the box toolbar does, handed to the nodes through context rather than
 * through each node's `data`: these are the editor's own functions, and a
 * node whose data changed identity on every render of the editor would be a
 * node React Flow re-measured on every render of the editor.
 */
type CanvasActions = {
  onAddNextStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  onSetStart: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  /**
   * The map's own keyboard, kept here rather than in each box: the nearest
   * box in a direction is a question about every box, which is something the
   * canvas knows and a box does not.
   */
  onMoveFocus: (fromNodeId: string, direction: Direction) => void;
  /** Out of the boxes and back to the map itself. */
  onEscape: () => void;
};

/** Which way an arrow key asks to go. */
type Direction = "up" | "down" | "left" | "right";

const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * The keyboard on a box, the same for a Step's and for a placeholder's: an
 * arrow key moves to the nearest box that way, and Escape leaves the boxes for
 * the map. Enter and Space are the button's own — they click it, and a click
 * is what opens a Step in the panel.
 */
function boxKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  nodeId: string,
  actions: CanvasActions,
): void {
  const direction = ARROW_DIRECTIONS[event.key];
  if (direction !== undefined) {
    // Otherwise the browser scrolls the page and React Flow pans the map out
    // from under the box the Author is walking across.
    event.preventDefault();
    actions.onMoveFocus(nodeId, direction);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    actions.onEscape();
  }
}

const CanvasActionsContext = createContext<CanvasActions | null>(null);

function useCanvasActions(): CanvasActions {
  const actions = useContext(CanvasActionsContext);
  if (actions === null) {
    throw new Error("A canvas node was rendered outside the canvas");
  }
  return actions;
}

type StepNodeData = {
  title: string;
  isStart: boolean;
  isEnding: boolean;
  /** The Draft and this box's Step, for the toolbar's delete confirmation. */
  document: GraphDocument;
  step: Step;
  outcomeLabel: string | null;
  outcomeColor: string | null;
  problems: string[];
  /**
   * The opening of the Step's content as plain text, read once where the
   * nodes are built rather than on every hover.
   */
  preview: string;
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

/** One Choice, named the way the document names it. */
export type CanvasArrow = { stepId: string; choiceId: string };

/** Delete and Backspace both. React Flow ignores either inside an input. */
const DELETE_KEYS = ["Delete", "Backspace"];

type StepFlowNode = Node<StepNodeData, "step">;
type MissingFlowNode = Node<MissingNodeData, "missing">;
type CanvasFlowNode = StepFlowNode | MissingFlowNode;

/**
 * How strongly an arrow is drawn: `selected` for the one arrow the Author
 * has clicked, drawn heavier than any other; otherwise `attached` for the
 * arrows into and out of the Step the panel has open, and `dimmed` for the
 * rest.
 */
type Emphasis = "selected" | "attached" | "dimmed";

/** What a clicked arrow is drawn with, over whatever else it would be. */
const SELECTED_STROKE_WIDTH = 3;

type ChoiceEdgeData = {
  /**
   * dagre's routed points for this Choice, in flow coordinates. The first and
   * last are dagre's own box-border endpoints, which React Flow supersedes
   * with the anchor positions it hands the edge; only the interior is route.
   */
  points: Point[];
  emphasis: Emphasis;
};

type ChoiceFlowEdge = Edge<ChoiceEdgeData, "choice">;

/** How much of an arrow is left when it is not the selected Step's. */
const DIMMED_OPACITY = 0.22;

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

/** How far below a box a loop drops, and how far above its top it returns. */
const LOOP_CLEARANCE = 24;

/** How far past the box's right edge a loop runs. */
const LOOP_SIDE_CLEARANCE = 32;

/**
 * A Choice that leads back to its own Step, routed beside its box: down out of
 * the anchor, out past the box's right edge, up over its top, and back down
 * into the handle every arrow ends at.
 *
 * Hand-built rather than dagre's: dagre keeps a loop in its box's own rank and
 * runs it straight through the box, which reads as an arrow crossing the Step
 * rather than returning to it.
 */
function selfLoopRoute(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): Point[] {
  // Every arrow ends at the handle in the middle of the box's top edge, so
  // the box's right edge is half a box across from where this one ends.
  const right = targetX + NODE_WIDTH / 2 + LOOP_SIDE_CLEARANCE;

  return [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: sourceY + LOOP_CLEARANCE },
    { x: right, y: sourceY + LOOP_CLEARANCE },
    { x: right, y: targetY - LOOP_CLEARANCE },
    { x: targetX, y: targetY - LOOP_CLEARANCE },
    { x: targetX, y: targetY },
  ];
}

/**
 * One Choice's arrow, drawn along dagre's route: out of the anchor React Flow
 * put the Choice on, through the interior of the route dagre laid, into the
 * top of the box it leads to. A loop is the one arrow dagre does not route
 * usefully, so it is routed here instead. The opacity is on a group so the
 * arrowhead and the label dim with the line.
 */
function ChoiceEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps<ChoiceFlowEdge>) {
  const points: Point[] =
    source === target
      ? selfLoopRoute(sourceX, sourceY, targetX, targetY)
      : [
          { x: sourceX, y: sourceY },
          ...(data?.points ?? []).slice(1, -1),
          { x: targetX, y: targetY },
        ];
  const middle = midwayAlong(points);

  return (
    // Marked so a spec can read the opacity the arrow is actually drawn at,
    // not only the emphasis the map says it has.
    <g
      data-emphasis-group=""
      opacity={data?.emphasis === "dimmed" ? DIMMED_OPACITY : 1}
    >
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

/** What a peek reads when the Step has nothing written on it yet. */
const NOTHING_WRITTEN = "No content yet";

/** The peek, styled like the legend: the map's other piece of quiet reading. */
const PEEK_CLASS =
  "nopan nodrag pointer-events-none max-w-72 rounded-lg bg-background px-2.5 py-1.5 text-xs whitespace-pre-line ring-1 ring-foreground/10";

function StepNode({ id, data }: NodeProps<StepFlowNode>) {
  const marked = data.problems.length > 0;
  const actions = useCanvasActions();
  // "Zoom to step" needs no editor plumbing — this node renders inside the
  // `ReactFlow` tree, so the hook it calls `fitView` through is its own.
  const { fitView } = useReactFlow();

  // A peek is shown to whoever is on the box, by pointer or by keyboard, and
  // the two are held apart so that a pointer wandering off a focused box does
  // not take the keyboard's peek with it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const peekId = useId();
  const peek = [
    ...data.problems,
    data.preview.length > 0 ? data.preview : NOTHING_WRITTEN,
  ].join("\n");

  return (
    <>
      {/* What the Step says, without opening it: everything wrong with it
          first, a message to a line, and then the opening of its content.
          A second toolbar rather than something inside the box, because a
          portal neither scales with the zoom nor is clipped by the box; and
          inert to the pointer, so it is never what a click or a drag lands
          on. */}
      <NodeToolbar
        isVisible={hovered || focused}
        position={Position.Bottom}
        id={peekId}
        role="tooltip"
        className={PEEK_CLASS}
      >
        {peek}
      </NodeToolbar>

      {/* The moves that change the Journey's shape around this Step, and one
          that only moves the view, on the box itself: the same the panel's
          foot carries, where the Author is already looking. `nopan`/`nodrag`
          keep a click on a button from dragging the map out from under it. */}
      {/* `role="group"`, not `role="toolbar"`: a toolbar promises roving
          tabindex, and these are ordinary tab stops, the same as the panel's
          "Leads here from". */}
      <NodeToolbar
        isVisible={data.isSelected}
        position={Position.Top}
        role="group"
        aria-label={`${data.title} actions`}
        // A portal's children still bubble through the React tree, so a
        // click on a button here would reach the node's own handler and
        // re-open this Step over whichever one the button just opened.
        onClick={(event) => event.stopPropagation()}
        className="nopan nodrag flex flex-wrap items-center gap-1 rounded-lg bg-background px-1.5 py-1 ring-1 ring-foreground/10"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => actions.onAddNextStep(data.opens)}
        >
          Add next step
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => actions.onDuplicateStep(data.opens)}
        >
          Duplicate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void fitView({
              nodes: [{ id: data.opens }],
              maxZoom: 1.5,
              duration: 200,
            })
          }
        >
          Zoom to step
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={data.isStart}
          onClick={() => actions.onSetStart(data.opens)}
        >
          Make this the start
        </Button>
        <DeleteStepDialog
          document={data.document}
          step={data.step}
          isStart={data.isStart}
          onDeleteStep={actions.onDeleteStep}
        />
      </NodeToolbar>

      {/* Where every arrow into this Step lands: one point at the top, which
          every edge names as its `targetHandle`. */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        isConnectableStart={false}
      />

      {/* And where a drag can let go of one: the whole box. React Flow gives
          a handle `pointer-events` only while a connection is in progress
          (its `connectionindicator` rule), and this one can never start one,
          so at rest it is inert and a click goes straight to the button
          under it. It is never an arrow's endpoint — `targetHandle: "top"`
          is — so it stays invisible. */}
      <Handle
        id="drop"
        type="target"
        position={Position.Top}
        isConnectableStart={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          transform: "none",
          border: "none",
          borderRadius: "0.75rem",
          background: "transparent",
        }}
      />

      <button
        type="button"
        {...data.marks}
        aria-label={data.title}
        // The peek is this box's description: the problems on it and the
        // opening of what it says, read out wherever the Author is.
        aria-describedby={peekId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => boxKeyDown(event, id, actions)}
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
          {/* The count; the messages are in the peek below the box, where a
              hover or a focus shows them and assistive technology reads them
              out as the box's description. */}
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

      {/* The one control on the box: drag from here onto another box to make
          a Choice. Set apart from the Choice anchors — bigger, colored, and
          out at the corner where none of them is ever spread to — because
          those are where arrows leave from, not something to take hold of. */}
      <Handle
        id="connect"
        type="source"
        position={Position.Bottom}
        title="Drag onto another step to add a choice"
        style={{
          left: "auto",
          right: 12,
          width: 14,
          height: 14,
          borderRadius: 9999,
          background: "var(--primary)",
          border: "2px solid var(--background)",
          transform: "translate(50%, 50%)",
        }}
      />
    </>
  );
}

function MissingNode({ id, data }: NodeProps<MissingFlowNode>) {
  const actions = useCanvasActions();

  return (
    <>
      {/* Named `top` like a Step's, because the arrow that ends here names
          the handle it ends at. Not connectable: a Step that is gone is not
          somewhere another Choice can be pointed. */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        isConnectable={false}
      />

      <button
        type="button"
        {...data.marks}
        aria-label="Missing step"
        // A placeholder is a box like any other to walk across.
        onKeyDown={(event) => boxKeyDown(event, id, actions)}
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

/**
 * How much a box's offset to the side counts against the distance to it when
 * an arrow key asks for the nearest one: enough that the box straight ahead
 * wins over a closer one away to the side, which is what "that way" means.
 */
const ACROSS_WEIGHT = 2;

export type JourneyCanvasProps = {
  document: GraphDocument;
  /** The document laid out, computed once by the editor and shared. */
  layout: GraphLayout;
  selectedStepId: string;
  /**
   * What the last opening of a Step asked the map for. `request` is bumped
   * every time one is opened, the same Step included, so re-opening the one
   * already in the panel brings its box back onto the map. `center` is set
   * for a Step found by name, which is shown in the middle of the map rather
   * than left where it stands.
   */
  locate: { request: number; center: boolean };
  problems: PublishProblem[];
  /** The one arrow the Author has clicked, if any. */
  selectedArrow: CanvasArrow | null;
  onSelectStep: SelectStep;
  onAddStep: () => void;
  /**
   * The box toolbar's moves, on whichever Step the panel has open. "Zoom to
   * step" carries no prop here — it calls `fitView` through `useReactFlow`
   * from inside the node itself.
   */
  onAddNextStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  onSetStart: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  /** A Choice drawn between two boxes, and one whose head was moved. */
  onConnectChoice: (stepId: string, targetStepId: string) => void;
  onRetargetChoice: (
    stepId: string,
    choiceId: string,
    targetStepId: string,
  ) => void;
  /** An arrow clicked, or a click landing anywhere else on the map. */
  onSelectArrow: (arrow: CanvasArrow | null) => void;
  /** The Choices behind the arrows the Delete key was pressed on. */
  onRemoveChoices: (arrows: CanvasArrow[]) => void;
};

function CanvasFlow({
  document,
  layout,
  selectedStepId,
  locate,
  problems,
  selectedArrow,
  canvasRef,
  onSelectStep,
  onAddStep,
  onAddNextStep,
  onDuplicateStep,
  onSetStart,
  onDeleteStep,
  onConnectChoice,
  onRetargetChoice,
  onSelectArrow,
  onRemoveChoices,
}: JourneyCanvasProps & {
  /** The Canvas itself, which is what Escape hands the keyboard back to. */
  canvasRef: RefObject<HTMLElement | null>;
}) {
  const addressed = useMemo(() => problemsByAddress(problems), [problems]);

  const { nodes, edges, arrows } = useMemo(() => {
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

      const step = document.steps[node.stepId];

      return {
        ...common,
        type: "step",
        data: {
          title: node.title,
          isStart: node.isStart,
          isEnding: node.isEnding,
          document,
          step,
          preview: contentPreview(step.content),
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

    // Which Choice each arrow draws, by the id React Flow knows it as: what
    // a click, a drag of its head, or a delete has to be turned back into.
    const arrows = new Map<string, CanvasArrow>();

    const flowEdges: ChoiceFlowEdge[] = layout.edges.map((edge) => {
      const label = choiceLabel(edge.label);
      const problemCount = (addressed.choices.get(edge.id) ?? []).length;
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
      const domAttributes: EdgeMarks = {
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
        targetHandle: "top",
        // The head of the arrow can be picked up and dropped on another box;
        // where a Choice leaves from is the Step it is written on, which is
        // not something to drag.
        reconnectable: "target" as const,
        type: "choice",
        selected: isSelected,
        label,
        ariaLabel: `${label}: ${titleById.get(edge.source) ?? ""} → ${titleById.get(edge.target) ?? ""}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { points: edge.points, emphasis },
        domAttributes,
        style: isSelected
          ? { ...marks, strokeWidth: SELECTED_STROKE_WIDTH }
          : marks,
      };
    });

    return { nodes: flowNodes, edges: flowEdges, arrows };
  }, [addressed, document, layout, selectedArrow, selectedStepId]);

  // Every Step is a valid target, its own Step included: a loop is an
  // ordinary path since ticket 18. A placeholder is not a Step.
  const stepIds = useMemo(
    () => new Set(Object.keys(document.steps)),
    [document.steps],
  );

  const { fitView, getNodesBounds, getViewport } = useReactFlow();
  // The size of the map itself, which is what "off the map" is measured
  // against; React Flow keeps it up to date as the pane resizes.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);

  /** Whether the whole of a box is inside the map's frame right now. */
  const isOnMap = useCallback(
    (nodeId: string): boolean => {
      const bounds = getNodesBounds([nodeId]);
      const { x, y, zoom } = getViewport();
      return (
        bounds.x * zoom + x >= -IN_VIEW_TOLERANCE &&
        bounds.y * zoom + y >= -IN_VIEW_TOLERANCE &&
        (bounds.x + bounds.width) * zoom + x <= paneWidth + IN_VIEW_TOLERANCE &&
        (bounds.y + bounds.height) * zoom + y <= paneHeight + IN_VIEW_TOLERANCE
      );
    },
    [getNodesBounds, getViewport, paneHeight, paneWidth],
  );

  /** A box left off the map is brought onto it; one already on it stays put. */
  const bringOntoMap = useCallback(
    (nodeId: string) => {
      if (paneWidth === 0 || paneHeight === 0) return;
      if (isOnMap(nodeId)) return;
      void fitView({ nodes: [{ id: nodeId }], maxZoom: 1, duration: 200 });
    },
    [fitView, isOnMap, paneHeight, paneWidth],
  );

  // The boxes as they stand, for the arrow keys: a lookup that ran off the
  // render's own `nodes` would change identity on every render, and with it
  // every node's `data`, which is what React Flow re-measures boxes on.
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // The nearest box in a direction, and the keyboard moved to it: candidates
  // are the boxes whose middle lies on that side of this one's, scored by how
  // far along the way they are plus twice how far off it, so a box straight
  // ahead beats a nearer one away to the side. Nothing that way leaves the
  // keyboard where it is. Which Step the panel has open is not touched —
  // Enter is what opens one — but a box walked onto off the map is brought
  // onto it, exactly as opening one by name does.
  const moveFocus = useCallback(
    (fromNodeId: string, direction: Direction) => {
      const boxes = nodesRef.current;
      const from = boxes.find((node) => node.id === fromNodeId);
      if (from === undefined) return;

      const middleOf = (node: CanvasFlowNode) => ({
        x: node.position.x + (node.width ?? 0) / 2,
        y: node.position.y + (node.height ?? 0) / 2,
      });
      const origin = middleOf(from);

      let nearest: { id: string; score: number } | null = null;
      for (const node of boxes) {
        if (node.id === fromNodeId) continue;

        const middle = middleOf(node);
        const along =
          direction === "up"
            ? origin.y - middle.y
            : direction === "down"
              ? middle.y - origin.y
              : direction === "left"
                ? origin.x - middle.x
                : middle.x - origin.x;
        if (along <= 0) continue;

        const across =
          direction === "up" || direction === "down"
            ? Math.abs(middle.x - origin.x)
            : Math.abs(middle.y - origin.y);
        const score = along + ACROSS_WEIGHT * across;
        if (nearest === null || score < nearest.score) {
          nearest = { id: node.id, score };
        }
      }
      if (nearest === null) return;

      // React Flow's own name for a box's wrapper; the button inside it is
      // the box, and the thing that takes focus.
      const button = canvasRef.current?.querySelector<HTMLButtonElement>(
        `.react-flow__node[data-id="${nearest.id}"] button`,
      );
      if (button === null || button === undefined) return;

      // Without `preventScroll` the browser scrolls the map's pane to reveal
      // the box it just focused, and React Flow scrolls the pane straight
      // back — a jolt, and one that leaves the map exactly where it was
      // anyway. Bringing the box onto the map is this next line's job.
      button.focus({ preventScroll: true });
      bringOntoMap(nearest.id);
    },
    [bringOntoMap, canvasRef],
  );

  // Escape is a step back out: off the boxes, onto the map itself, with
  // whichever arrow was in hand let go of.
  const escape = useCallback(() => {
    onSelectArrow(null);
    canvasRef.current?.focus();
  }, [canvasRef, onSelectArrow]);

  const actions = useMemo<CanvasActions>(
    () => ({
      onAddNextStep,
      onDuplicateStep,
      onSetStart,
      onDeleteStep,
      onMoveFocus: moveFocus,
      onEscape: escape,
    }),
    [
      onAddNextStep,
      onDuplicateStep,
      onSetStart,
      onDeleteStep,
      moveFocus,
      escape,
    ],
  );

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

  const nodeIdKey = nodes
    .map((node) => node.id)
    .sort()
    .join(" ");
  const lastNodeIdKey = useRef(nodeIdKey);

  // Opening a Step from "Find step", a problem, or a Choice's target can name
  // a box that is off the map; the map goes to it. Every opening counts, the
  // Step already in the panel included — the editor bumps `locate.request`
  // each time it opens one — so a second choice of the same Step after the
  // Author has panned away brings the box back rather than doing nothing. A
  // box already on the map is left where the Author put it, and so is the
  // rest of the view — except for a Step found by name, which the Author has
  // gone looking for and is shown in the middle of the map wherever it was.
  //
  // Declared before the fit-to-all below so that a render which changed the
  // set of boxes — a Step added, which is also the Step now open — is still
  // that one's: this effect sees the older key and stands aside.
  const located = useRef<{ stepId: string; request: number } | null>(null);
  useEffect(() => {
    const previous = located.current;
    located.current = { stepId: selectedStepId, request: locate.request };

    // The first render is the initial fit-to-all's, which shows everything.
    if (previous === null) return;
    // Nothing was asked for: this render is about something else entirely.
    if (
      previous.stepId === selectedStepId &&
      previous.request === locate.request
    ) {
      return;
    }
    if (lastNodeIdKey.current !== nodeIdKey) return;
    if (paneWidth === 0 || paneHeight === 0) return;
    if (!nodes.some((node) => node.id === selectedStepId)) return;

    if (!locate.center && isOnMap(selectedStepId)) return;

    void fitView({
      nodes: [{ id: selectedStepId }],
      maxZoom: 1,
      duration: 200,
    });
  }, [
    fitView,
    isOnMap,
    locate.center,
    locate.request,
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
    <CanvasActionsContext.Provider value={actions}>
      <ReactFlow<CanvasFlowNode, ChoiceFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode={colorMode}
        nodesDraggable={false}
        nodesConnectable
        // Dragging is the whole motion here: a click on a handle would
        // otherwise arm a connection the next click anywhere completes.
        connectOnClick={false}
        edgesReconnectable
        // The node's own button takes focus; the wrapper would otherwise be a
        // second tab stop that opens nothing.
        nodesFocusable={false}
        // Arrows only: which Step is open stays the panel's, and every node
        // above is `selectable: false`.
        elementsSelectable
        deleteKeyCode={DELETE_KEYS}
        fitView
        minZoom={0.1}
        isValidConnection={(connection) => stepIds.has(connection.target)}
        // A Choice made where the Author drew it: from the Step the drag
        // left, to the Step it landed on, with its label still to write.
        onConnect={({ source, target }) => {
          if (!stepIds.has(source) || !stepIds.has(target)) return;
          onConnectChoice(source, target);
        }}
        // The head of an arrow dropped on another box. A drop on nothing
        // never gets here, which is what leaves the Choice as it was.
        onReconnect={(oldEdge, connection) => {
          const arrow = arrows.get(oldEdge.id);
          if (arrow === undefined || !stepIds.has(connection.target)) return;
          onRetargetChoice(arrow.stepId, arrow.choiceId, connection.target);
        }}
        // Clicking an arrow opens the Choice it draws: the Step it is
        // written on, with its label in hand.
        onEdgeClick={(_event, edge) => {
          const arrow = arrows.get(edge.id);
          if (arrow === undefined) return;
          onSelectStep(arrow.stepId, { focusChoiceId: arrow.choiceId });
        }}
        // React Flow's own account of what the Author did to the arrows,
        // turned back into the Choices they draw: a click selects one (and a
        // click on bare map clears it), and Delete removes them, which is
        // exactly what "Remove choice" in the panel does.
        //
        // One click on a second arrow arrives as one batch — the old arrow's
        // `select: false` and the new one's `select: true`, in the order the
        // `edges` array holds them — so the whole batch is read before
        // anything is said: the arrow it selects wins whichever end of the
        // batch it came from, and the selection is only cleared when the
        // batch selected nothing at all.
        onEdgesChange={(changes) => {
          const removed: CanvasArrow[] = [];
          let selected: CanvasArrow | null = null;
          let clearedCurrent = false;

          for (const change of changes) {
            if (change.type !== "select" && change.type !== "remove") continue;
            const arrow = arrows.get(change.id);
            if (arrow === undefined) continue;

            if (change.type === "remove") {
              removed.push(arrow);
              continue;
            }

            if (change.selected) {
              selected = arrow;
            } else if (
              selectedArrow !== null &&
              selectedArrow.stepId === arrow.stepId &&
              selectedArrow.choiceId === arrow.choiceId
            ) {
              clearedCurrent = true;
            }
          }

          if (selected !== null) {
            onSelectArrow(selected);
          } else if (clearedCurrent) {
            onSelectArrow(null);
          }

          if (removed.length > 0) onRemoveChoices(removed);
        }}
        // A placeholder stands for a Step that is gone, so it may have
        // nothing to open; a box always does.
        onNodeClick={(_event, node) => {
          if (node.type === "step") {
            onSelectStep(node.data.opens);
            return;
          }
          if (node.data.opens !== null) onSelectStep(node.data.opens);
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
    </CanvasActionsContext.Provider>
  );
}

export function JourneyCanvas(props: JourneyCanvasProps) {
  // Where Escape on a box hands the keyboard back to, and what the boxes are
  // looked up inside. Focusable only to be given focus — never a tab stop of
  // its own, which would be a stop that does nothing.
  const canvasRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={canvasRef}
      aria-label="Canvas"
      tabIndex={-1}
      // Most of the viewport on a tall screen, never less than a map's worth:
      // a real-sized Journey is dozens of ranks deep, and every pixel of
      // height is legibility at fit-to-view.
      className="h-[70vh] min-h-[36rem] overflow-hidden rounded-xl ring-1 ring-foreground/10 outline-none"
    >
      <ReactFlowProvider>
        <CanvasFlow {...props} canvasRef={canvasRef} />
      </ReactFlowProvider>
    </section>
  );
}
