"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { Ellipsis } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { DeleteStepDialog } from "@/components/journeys/delete-step-dialog";
import { DirectionControl } from "@/components/journeys/direction-control";
import {
  ARROW_DIRECTIONS,
  arrowPoints,
  EDGE_LABEL_HEIGHT,
  handleOffset,
  midwayAlong,
  NODE_BOX_CLASS,
  smoothPath,
  sourceSide,
  targetSide,
  useCanvasColorMode,
  type ArrowDirection,
} from "@/components/journeys/canvas-shared";
import {
  choiceLabel,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contentPreview } from "@/lib/graph/content";
import type { Point } from "@/lib/graph/crossings";
import type {
  GraphDocument,
  LayoutDirection,
  Step,
} from "@/lib/graph/document";
import {
  EDGE_LABEL_MAX_WIDTH,
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
 * no hand-placed position to preserve, and a stored one would go stale the
 * moment a Choice was added: what the map is for is showing the shape the
 * Journey has now. `stepSchema` keeps a `position` field for a later
 * decision; nothing here reads or writes it.
 *
 * Which way the map runs is the Draft's, not this component's: `layout`
 * arrives laid out top to bottom or left to right, and the control beside
 * "Add step" hands a new direction back to the editor the way every other
 * edit is handed back, so the direction is stored on the Journey and every
 * Member sees the same map. Everything on a box follows it — arrows leave the
 * side facing the way they travel (the bottom running top to bottom, the
 * right running left to right) and arrive at the opposite side of the box
 * they lead to — and a change of direction fits the whole map again, because
 * the map the Author was reading has just been redrawn.
 *
 * Arrows are drawn along the route dagre computed for them rather than
 * stepped between handles, and a box's source anchors are spread in the order
 * of the boxes they lead to, so dagre's crossing minimization is what the
 * Author sees. Whichever Step the panel has open, the arrows into and out of
 * it are drawn at full strength and the rest are dimmed, and its box is
 * brought onto the map when it is off it.
 *
 * The problems this draws come from `validateForPublish` run in the browser on
 * the document the editor is holding, not from the stored Draft that Publish
 * checks, so a mark clears the moment the fix is typed.
 *
 * The view is the Author's, and it moves only when they ask: the first
 * render, a change of direction, the panel put away or brought back, and the
 * zoom to a Step they opened or just made. Nothing else — a Step added, a
 * Step deleted, a Choice drawn, a mark appearing — takes the map off where
 * they left it.
 *
 * The map is also where the Journey is built: the box the Author clicks
 * carries a toolbar, one small button that opens onto the moves that shape
 * the Journey around that Step — adding the next step, duplicating it, making
 * it the start, and deleting it — and one that only moves the view, zooming
 * to it. A Choice is made by dragging from a box onto another — or onto bare
 * map, which makes the Step it leads to in the same motion — the head of the
 * arrow in hand is dragged to move where its Choice leads, and a clicked
 * arrow is the Choice in hand: its Step opened in the panel with that Choice's
 * row marked, nothing scrolled, the keyboard left on the map, and the Delete
 * key removing it. Nothing here edits the document: each of those is handed
 * back to the editor in the document's own words (a Step, a Choice), and the
 * map redraws from whatever the editor makes of it.
 *
 * And it is a map to be read: hovering or focusing a box peeks at what the
 * Step says without opening it, and the arrow keys walk from box to nearest
 * box so the whole map is reachable without a pointer — Enter opens the box
 * the keyboard is on, and Escape steps back out to the map itself.
 */

/**
 * The attributes a spec reads off a node's button: which kind of box it is,
 * which Step, how many problems. React's `HTMLAttributes` has no index
 * signature for `data-*`, so one is intersected in rather than cast.
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
   * "Step actions" on a box, which opens onto the moves above and closes
   * again — and Escape inside the group, which only ever closes it.
   */
  onToggleToolbar: (stepId: string) => void;
  onCollapseToolbar: () => void;
  /**
   * The map's own keyboard, kept here rather than in each box: the nearest
   * box in a direction is a question about every box, which is something the
   * canvas knows and a box does not.
   */
  onMoveFocus: (fromNodeId: string, direction: ArrowDirection) => void;
  /** Out of the boxes and back to the map itself. */
  onEscape: () => void;
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
  problems: string[];
  /**
   * The opening of the Step's content as plain text, read once where the
   * nodes are built rather than on every hover.
   */
  preview: string;
  isSelected: boolean;
  /**
   * What this box is showing of the moves it carries: nothing at all until
   * the Author clicks the box, then the one "Step actions" button, and then
   * the moves themselves once that button is pressed.
   */
  toolbar: "hidden" | "compact" | "expanded";
  /** The Step this node opens in the panel when it is clicked. */
  opens: string;
  /**
   * One source anchor per Choice, ordered by the position of the box each
   * Choice leads to across the direction the map runs (`layoutGraph`'s
   * `sourceAnchors`), so arrows leave the side of the box they travel towards
   * in the order they travel in and cross each other less. Two Choices to the
   * same Step still leave from different points and are drawn as two arrows.
   */
  sourceAnchors: string[];
  /** Which way the map runs, which is which side every handle is on. */
  direction: LayoutDirection;
  marks: NodeMarks;
};

type MissingNodeData = {
  marks: NodeMarks;
  isSelected: boolean;
  /** The Step whose Choice points at nothing — what there is to go and fix. */
  opens: string | null;
  /** The same as a Step's: where the arrow that ends here comes in. */
  direction: LayoutDirection;
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
  /** Which way the map runs, which is which way a loop is routed around. */
  direction: LayoutDirection;
};

type ChoiceFlowEdge = Edge<ChoiceEdgeData, "choice">;

/** How much of an arrow is left when it is not the selected Step's. */
const DIMMED_OPACITY = 0.22;

/**
 * One Choice's arrow, drawn along dagre's route: out of the anchor React Flow
 * put the Choice on, through the interior of the route dagre laid, into the
 * side of the box it leads to that faces back the way it came. A loop is the
 * one arrow dagre does not route usefully, so it is routed here instead. The
 * opacity is on a group so the arrowhead and the label dim with the line.
 *
 * The label sits halfway along the arrow, cut short with an ellipsis past
 * `EDGE_LABEL_MAX_WIDTH` so a long Choice fits the gap between its boxes
 * rather than running over them; the whole text is in the DOM under the
 * ellipsis, is the arrow's `<title>`, and is in its accessible name (React
 * Flow's `aria-label` on the wrapper) — and the panel's row has it in full.
 * A `<foreignObject>` rather than React Flow's own `<text>` label because
 * SVG text has no ellipsis, and it stays inside the group so it dims and
 * scales with the arrow.
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
  const points = arrowPoints(
    data?.direction ?? "TB",
    source === target,
    data?.points,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
  );
  const middle = midwayAlong(points);

  return (
    // Marked so a spec can read the opacity the arrow is actually drawn at,
    // not only the emphasis the map says it has.
    <g
      data-emphasis-group=""
      opacity={data?.emphasis === "dimmed" ? DIMMED_OPACITY : 1}
    >
      {typeof label === "string" ? <title>{label}</title> : null}
      <BaseEdge path={smoothPath(points)} style={style} markerEnd={markerEnd} />
      {typeof label === "string" ? (
        <foreignObject
          x={middle.x - EDGE_LABEL_MAX_WIDTH / 2}
          y={middle.y - EDGE_LABEL_HEIGHT / 2}
          width={EDGE_LABEL_MAX_WIDTH}
          height={EDGE_LABEL_HEIGHT}
          // Only the chip takes the pointer, as React Flow's own label does:
          // a click on it bubbles to the arrow and selects it, and the rest
          // of the box is nothing, so it never covers a box or another arrow.
          className="pointer-events-none overflow-visible"
        >
          <div className="flex h-full w-full items-center justify-center">
            <span
              data-edge-label=""
              className="pointer-events-auto max-w-full cursor-pointer truncate rounded bg-background px-1 text-xs"
            >
              {label}
            </span>
          </div>
        </foreignObject>
      ) : null}
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
const NODE_BUTTON_CLASS = `${NODE_BOX_CLASS} cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-ring`;

/** What a peek reads when the Step has nothing written on it yet. */
const NOTHING_WRITTEN = "No content yet";

/** The peek: the map's one piece of quiet reading, styled to stay quiet. */
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
  /** What "Step actions" expands, named so the button can say so. */
  const movesId = useId();
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
          foot carries, where the Author is already looking. Shown only on the
          box the Author has clicked, and as one small button until they ask
          for more — a map of thirty-six boxes is read before it is edited, and
          five buttons over a box is five buttons over whatever is behind it.
          `nopan`/`nodrag` keep a click on a button from dragging the map out
          from under it. */}
      {/* `role="group"`, not `role="toolbar"`: a toolbar promises roving
          tabindex, and these are ordinary tab stops. */}
      <NodeToolbar
        isVisible={data.toolbar !== "hidden"}
        position={Position.Top}
        role="group"
        aria-label={`${data.title} actions`}
        // A portal's children still bubble through the React tree, so a
        // click on a button here would reach the node's own handler and
        // re-open this Step over whichever one the button just opened.
        onClick={(event) => event.stopPropagation()}
        // Escape anywhere in the group folds it back to the one button, and
        // hands the keyboard to that button: whoever pressed it is left where
        // they opened it from rather than on a button that has gone.
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();

          const opener = event.currentTarget.querySelector<HTMLButtonElement>(
            '[aria-label="Step actions"]',
          );
          actions.onCollapseToolbar();
          opener?.focus();
        }}
        className="nopan nodrag flex flex-wrap items-center gap-1 rounded-lg bg-background px-1.5 py-1 ring-1 ring-foreground/10"
      >
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Step actions"
          aria-expanded={data.toolbar === "expanded"}
          // The moves are rendered only while they are folded out, so the id
          // is only named while there is something for it to name.
          aria-controls={data.toolbar === "expanded" ? movesId : undefined}
          onClick={() => actions.onToggleToolbar(data.opens)}
        >
          <Ellipsis aria-hidden="true" />
        </Button>

        {data.toolbar === "expanded" ? (
          <div id={movesId} className="flex flex-wrap items-center gap-1">
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
            {/* The Start cannot be deleted while it is the Start, so it is
                not offered a delete that would only refuse. */}
            {data.isStart ? null : (
              <DeleteStepDialog
                document={data.document}
                step={data.step}
                onDeleteStep={actions.onDeleteStep}
              />
            )}
          </div>
        ) : null}
      </NodeToolbar>

      {/* Where every arrow into this Step lands: one point on the side the
          arrows come from — the top running top to bottom, the left running
          left to right — which every edge names as its `targetHandle`. */}
      <Handle
        id="in"
        type="target"
        position={targetSide(data.direction)}
        isConnectableStart={false}
      />

      {/* And where a drag can let go of one: the whole box. React Flow gives
          a handle `pointer-events` only while a connection is in progress
          (its `connectionindicator` rule), and this one can never start one,
          so at rest it is inert and a click goes straight to the button
          under it. It is never an arrow's endpoint — `targetHandle: "in"`
          is — so it stays invisible, and its own `position` never shows. */}
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
        // opening of what it says, read out wherever the Author is. The peek
        // is rendered exactly while the box is hovered or focused, and a
        // description is read when the box is focused, so the id always
        // resolves at the moment it is used.
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

      {data.sourceAnchors.map((choiceId, index) => {
        const offset = handleOffset(index, data.sourceAnchors.length);
        return (
          <Handle
            key={choiceId}
            id={choiceId}
            type="source"
            position={sourceSide(data.direction)}
            isConnectable={false}
            style={data.direction === "LR" ? { top: offset } : { left: offset }}
          />
        );
      })}

      {/* The one control on the box: drag from here onto another box to make
          a Choice. Set apart from the Choice anchors — bigger, colored, and
          out on the bottom-right corner of the box rather than along the side
          the arrows leave by — because those are where arrows leave from, not
          something to take hold of. The anchors are spread evenly along that
          side, so they crowd towards the corner as a Step gains Choices: the
          dot stands clear of the last of them up to about eight Choices
          running top to bottom and about ten running left to right, and past
          that the two overlap rather than the dot being clear for good. */}
      <Handle
        id="connect"
        type="source"
        position={sourceSide(data.direction)}
        title="Drag onto another step to add a choice"
        style={{
          ...(data.direction === "LR"
            ? { top: "auto", bottom: -4, right: 0 }
            : { left: "auto", right: 12 }),
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
      {/* Named `in` like a Step's, and on the same side of the box, because
          the arrow that ends here names the handle it ends at. Not
          connectable: a Step that is gone is not somewhere another Choice can
          be pointed. */}
      <Handle
        id="in"
        type="target"
        position={targetSide(data.direction)}
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

/** Sub-pixel rounding, so a box flush against the edge counts as on the map. */
const IN_VIEW_TOLERANCE = 1;

/**
 * How much a box's offset to the side counts against the distance to it when
 * an arrow key asks for the nearest one: enough that the box straight ahead
 * wins over a closer one away to the side, which is what "that way" means.
 */
const ACROSS_WEIGHT = 2;

/**
 * How long after the panel was put away or brought back a resize of the map
 * still counts as that toggle's doing. The columns move for 200ms and the map
 * is resized under them several times on the way; a resize arriving later than
 * this is something else — a window dragged wider, a zoom — and the view the
 * Author has set up is left exactly where they set it.
 */
const FIT_AFTER_TOGGLE_MS = 500;

/**
 * How long after a Choice was let go of a click on a box still counts as that
 * drag's own rather than the Author's. A Choice drawn back to its own Step is
 * one press and one release inside the same box, so the browser follows the
 * drag with a click on that box — which would re-open the Step and let go of
 * the very Choice the drag just drew. A press and a release the Author means
 * as a click are never a quarter of a second apart from a drag that has just
 * ended.
 */
const CLICK_AFTER_CONNECT_MS = 250;

/**
 * How many frames the Zoom-to-step move waits for a box React Flow has not
 * measured yet: a Step made a moment ago is rendered before it is measured,
 * and a `fitView` on a box with no dimensions does nothing. A handful of
 * frames covers the measuring pass with room to spare.
 */
const MEASURE_FRAMES = 30;

export type JourneyCanvasProps = {
  document: GraphDocument;
  /** The document laid out, computed once by the editor and shared. */
  layout: GraphLayout;
  selectedStepId: string;
  /**
   * What the last opening of a Step asked the map for. `request` is bumped
   * every time one is opened, the same Step included, so re-opening the one
   * already in the panel is answered too. `view` is what was asked for:
   * `keep` moves nothing, `reveal` brings the box onto the map only when it
   * is off it, and `zoom` makes the Zoom-to-step move whatever the box was
   * doing — a Step found by name, or one just made.
   */
  locate: { request: number; view: "keep" | "reveal" | "zoom" };
  problems: PublishProblem[];
  /** The one arrow the Author has clicked, if any. */
  selectedArrow: CanvasArrow | null;
  /**
   * "Find step", the editor's, rendered first in the row of controls above
   * the map: the way around the Draft by name belongs beside the way around
   * it by shape.
   */
  findStep: ReactNode;
  onSelectStep: SelectStep;
  onAddStep: () => void;
  /**
   * The Draft's one undo and redo, carried on the map because the map is
   * where most of what there is to take back is done — a Choice drawn, an
   * arrow moved, a Step deleted. The same history the keyboard reaches from
   * anywhere on the page; these two are the way to it for an Author whose
   * hands are on the mouse.
   */
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Which way the map is asked to run, from the control beside "Add step". */
  onSetLayoutDirection: (direction: LayoutDirection) => void;
  /**
   * Whether the panel is beside the map. The map carries the way back to a
   * panel that is away, because the map is all there is to reach for then.
   */
  panelShown: boolean;
  /**
   * Bumped by the editor each time the Author puts the panel away or brings
   * it back, which is the one change of the map's width they asked for, so
   * the whole map is shown in whatever width it ends up with. A panel that
   * comes back for an opened Step does not bump it: the frame narrows, and
   * the opening's own move to the Step is what the map does.
   */
  fitRequest: number;
  onShowPanel: () => void;
  /** Escape, with the map itself holding the keyboard. */
  onHidePanel: () => void;
  /**
   * The box toolbar's moves, on whichever box the Author has clicked. "Zoom
   * to step" carries no prop here — it calls `fitView` through `useReactFlow`
   * from inside the node itself.
   */
  onAddNextStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  onSetStart: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  /** A Choice drawn between two boxes, and one whose head was moved. */
  onConnectChoice: (stepId: string, targetStepId: string) => void;
  /**
   * A Choice drawn from a box onto bare map, where there is no Step for it
   * to lead to: the Step and the Choice are made together.
   */
  onConnectToNewStep: (stepId: string) => void;
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
  fitRequest,
  canvasRef,
  onSelectStep,
  onAddNextStep,
  onDuplicateStep,
  onSetStart,
  onDeleteStep,
  onConnectChoice,
  onConnectToNewStep,
  onRetargetChoice,
  onSelectArrow,
  onRemoveChoices,
}: JourneyCanvasProps & {
  /** The Canvas itself, which is what Escape hands the keyboard back to. */
  canvasRef: RefObject<HTMLElement | null>;
}) {
  const addressed = useMemo(() => problemsByAddress(problems), [problems]);

  /**
   * The box showing the moves it carries, and whether it is showing them or
   * only the button that opens them. Nothing until the Author clicks a box:
   * a Step opened from "Find step", a problem, an arrow, or a save the server
   * refused is a Step to read and edit in the panel, not a box to reshape the
   * Journey around.
   *
   * `opening` is which opening of a Step put the moves there — the one the
   * click itself is about to make, which is the next the editor counts. The
   * moves belong to that click, so any opening after it leaves them behind
   * rather than carrying them onto whatever was opened next; which is why
   * this is read back below rather than used as it stands.
   */
  const [toolbar, setToolbar] = useState<{
    stepId: string;
    opening: number;
    expanded: boolean;
  } | null>(null);

  const shownToolbar =
    toolbar !== null &&
    toolbar.opening === locate.request &&
    toolbar.stepId === selectedStepId
      ? toolbar
      : null;

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
          document,
          step,
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
        data: { points: edge.points, emphasis, direction: layout.direction },
        domAttributes,
        style: isSelected
          ? { ...marks, strokeWidth: SELECTED_STROKE_WIDTH }
          : marks,
      };
    });

    return { nodes: flowNodes, edges: flowEdges, arrows };
  }, [
    addressed,
    document,
    layout,
    selectedArrow,
    selectedStepId,
    shownToolbar,
  ]);

  // Every Step is a valid target, its own Step included: a loop is an
  // ordinary path since ticket 18. A placeholder is not a Step.
  const stepIds = useMemo(
    () => new Set(Object.keys(document.steps)),
    [document.steps],
  );

  /**
   * When a Choice was last let go of, for `CLICK_AFTER_CONNECT_MS`. Never,
   * to begin with — and never is not zero: `performance.now()` counts from
   * the moment the page was opened, so zero is "the page had just loaded",
   * which would swallow the first click an Author made on a box.
   */
  const connectedAt = useRef(Number.NEGATIVE_INFINITY);

  const { fitView, getInternalNode, getNodesBounds, getViewport } =
    useReactFlow();
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

  /**
   * The Zoom-to-step move: the box shown on its own, never further out than
   * the map already was — from the whole of case-3 at 0.16 it goes in to 1,
   * and from 1.5 it stays at 1.5 and centres on the box, because a Step the
   * Author asked to be taken to is not a reason to give away the reading they
   * had set up.
   *
   * How far in the map was is handed in rather than read here, because the
   * move is made again on every width the sliding columns pass through: a
   * ceiling read each time would be read off a fit that had just lowered the
   * zoom, and each replay would hold the next one further out than the last.
   *
   * A box made a moment ago has not been measured yet, and `fitView` on a box
   * with no dimensions does nothing at all, so the move waits a frame at a
   * time for React Flow to report the box's size and is made once it has.
   */
  const zoomFrame = useRef<number | null>(null);
  const zoomToStep = useCallback(
    (nodeId: string, maxZoom: number) => {
      if (paneWidth === 0 || paneHeight === 0) return;
      if (zoomFrame.current !== null) {
        cancelAnimationFrame(zoomFrame.current);
        zoomFrame.current = null;
      }

      let framesLeft = MEASURE_FRAMES;
      function attempt(): void {
        zoomFrame.current = null;

        const measured = getInternalNode(nodeId)?.measured;
        if ((measured?.width ?? 0) === 0 || (measured?.height ?? 0) === 0) {
          framesLeft -= 1;
          // A box that never arrives — one removed again while this waited —
          // stops being asked after; nothing moves, which is the right answer
          // for a box that is not there.
          if (framesLeft <= 0) return;
          zoomFrame.current = requestAnimationFrame(attempt);
          return;
        }

        void fitView({ nodes: [{ id: nodeId }], maxZoom, duration: 200 });
      }

      attempt();
    },
    [fitView, getInternalNode, paneHeight, paneWidth],
  );

  // Nothing is left waiting on a frame that would land after the map is gone.
  useEffect(
    () => () => {
      if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    },
    [],
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
    (fromNodeId: string, direction: ArrowDirection) => {
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
      if (!button) return;

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

  const toggleToolbar = useCallback((stepId: string) => {
    setToolbar((current) =>
      current !== null && current.stepId === stepId
        ? { ...current, expanded: !current.expanded }
        : current,
    );
  }, []);

  const collapseToolbar = useCallback(() => {
    setToolbar((current) =>
      current === null ? null : { ...current, expanded: false },
    );
  }, []);

  const actions = useMemo<CanvasActions>(
    () => ({
      onAddNextStep,
      onDuplicateStep,
      onSetStart,
      onDeleteStep,
      onToggleToolbar: toggleToolbar,
      onCollapseToolbar: collapseToolbar,
      onMoveFocus: moveFocus,
      onEscape: escape,
    }),
    [
      onAddNextStep,
      onDuplicateStep,
      onSetStart,
      onDeleteStep,
      toggleToolbar,
      collapseToolbar,
      moveFocus,
      escape,
    ],
  );

  /**
   * What the map was last asked to move for, and when: the whole map, after
   * the panel slid, or the one box a Step was opened or made on. Which frame
   * the move has to land in cannot be known when the request arrives — the
   * columns take 200ms to slide, and React Flow learns each width it passes
   * through from a ResizeObserver that runs after the layout producing it —
   * so what is noted here is the moment, and the move is made again on each
   * resize that follows it.
   *
   * A request for one box carries the zoom the Author was reading at when
   * they asked, so every replay of it is held to the same ceiling.
   */
  const viewRequest = useRef<
    | { at: number; box: null }
    | { at: number; box: string; maxZoom: number }
    | null
  >(null);

  // Every opening of a Step is answered, the Step already in the panel
  // included — the editor bumps `locate.request` each time it opens one — so
  // a second choice of the same Step after the Author has panned away is
  // answered rather than passed over because the panel never changed. What is
  // answered is what the opening asked for: nothing at all for a Step opened
  // in the aftermath of a delete, the box brought onto the map when it is off
  // it, or the Zoom-to-step move for a Step found by name, one just made, or
  // one opened onto a map that is about to lose the whole width again.
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
    if (locate.view === "keep") {
      // An opening that asks for nothing — the Step opened after a delete —
      // must not be answered by a move asked for before it: a request still
      // waiting on a resize is let go of rather than left to be replayed.
      viewRequest.current = null;
      return;
    }
    if (paneWidth === 0 || paneHeight === 0) return;
    if (!nodes.some((node) => node.id === selectedStepId)) return;

    if (locate.view === "reveal") {
      bringOntoMap(selectedStepId);
      return;
    }

    // The ceiling is the reading the Author had when they asked, taken once
    // here and held to by every replay of this request.
    const maxZoom = Math.max(1, getViewport().zoom);
    viewRequest.current = {
      at: performance.now(),
      box: selectedStepId,
      maxZoom,
    };
    zoomToStep(selectedStepId, maxZoom);
  }, [
    bringOntoMap,
    getViewport,
    locate.request,
    locate.view,
    nodes,
    paneHeight,
    paneWidth,
    selectedStepId,
    zoomToStep,
  ]);

  // Turning the map a quarter puts every box somewhere else, so wherever the
  // Author had panned and zoomed to is about a map that no longer exists:
  // the whole of the new one is shown instead, which is what the first render
  // already does on its own.
  const lastDirection = useRef(layout.direction);
  useEffect(() => {
    if (lastDirection.current === layout.direction) return;
    lastDirection.current = layout.direction;
    void fitView({ duration: 200 });
  }, [fitView, layout.direction]);

  // A map that has just been given the whole width by the Author, or had it
  // taken back: the boxes are where they were, but the frame around them is
  // not, so the whole map is shown in the frame it now has. Noted, rather
  // than done, for the reason `viewRequest` gives.
  const lastFitRequest = useRef(fitRequest);
  useEffect(() => {
    if (lastFitRequest.current === fitRequest) return;
    lastFitRequest.current = fitRequest;
    viewRequest.current = { at: performance.now(), box: null };
  }, [fitRequest]);

  // And the move happens on each resize that follows the request: the map is
  // moved every time the sliding columns hand it a new width, and the last of
  // those is the width it keeps — so a whole-map fit lands on the frame the
  // map ends up with, and a zoom to one box ends with that box on the map
  // however far the columns travelled after it was asked for. With reduced
  // motion the columns jump, so there is one resize and one move; on a screen
  // too narrow for the panel to sit beside the map, putting it away resizes
  // nothing and moves nothing. A resize arriving later than the window is
  // something else — a window dragged wider, a zoom — and the view the Author
  // has set up is left exactly where they set it.
  useEffect(() => {
    const request = viewRequest.current;
    if (request === null) return;
    if (performance.now() - request.at > FIT_AFTER_TOGGLE_MS) {
      // Whatever this resize is, it is not the columns answering that
      // request: it is let go of rather than left to answer the next one.
      viewRequest.current = null;
      return;
    }

    if (request.box === null) {
      void fitView({ duration: 200 });
      return;
    }
    zoomToStep(request.box, request.maxZoom);
  }, [fitView, paneHeight, paneWidth, zoomToStep]);

  const colorMode = useCanvasColorMode();

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
        // Low enough that the whole of a real-sized Journey fits the map:
        // case-3 running left to right, with its ranks spread for labels,
        // needs just under a tenth, and a fit held above what the map needs
        // leaves boxes off the edge of it.
        minZoom={0.05}
        isValidConnection={(connection) => stepIds.has(connection.target)}
        // A Choice made where the Author drew it: from the Step the drag
        // left, to the Step it landed on, with its label still to write.
        onConnect={({ source, target }) => {
          if (!stepIds.has(source) || !stepIds.has(target)) return;
          onConnectChoice(source, target);
        }}
        // And a Choice let go of over bare map: there is no Step there to
        // lead to, so the Step is made where the Author said the Journey
        // goes next and the Choice with it.
        //
        // Only a drag that began on a box's connect dot. React Flow calls
        // this for a reconnect as well — an arrow's head dragged off starts
        // its own connection, from the Choice's own anchor — and a head let
        // go of on nothing leaves its Choice exactly as it was.
        //
        // And only a release over the pane: let go over the Controls or
        // clean outside the map, the Author broke the drag off rather than
        // pointing it at empty map, and nothing is made.
        onConnectEnd={(event, connectionState) => {
          // Noted whatever the drag turned out to mean: the click the browser
          // sends after it is the drag's, not a box being opened.
          connectedAt.current = performance.now();

          const { fromHandle, fromNode, toNode } = connectionState;
          if (fromHandle?.id !== "connect") return;
          if (fromNode === null || !stepIds.has(fromNode.id)) return;
          if (toNode !== null) return;
          if (
            (event.target as Element | null)?.closest(".react-flow__pane") ==
            null
          ) {
            return;
          }

          onConnectToNewStep(fromNode.id);
        }}
        // The head of an arrow dropped on another box. A drop on nothing
        // never gets here, which is what leaves the Choice as it was.
        onReconnect={(oldEdge, connection) => {
          const arrow = arrows.get(oldEdge.id);
          if (arrow === undefined || !stepIds.has(connection.target)) return;
          onRetargetChoice(arrow.stepId, arrow.choiceId, connection.target);
        }}
        // Clicking an arrow is taking the Choice in hand — opened in the
        // panel with its row marked; nothing takes the keyboard, and the
        // page the Author is reading the map on does not move.
        onEdgeClick={(_event, edge) => {
          const arrow = arrows.get(edge.id);
          if (arrow === undefined) return;

          // The keyboard is left on the map the Author is working on, always
          // — not only when it is about to be lost, because where it is by
          // the time this runs says nothing about where it is a frame later.
          // React Flow's arrows are focusable, so the click has already taken
          // the keyboard off whatever held it and given it to the arrow's own
          // group, and the group gives it up again as the arrow is redrawn as
          // the selected one, dropping it on the page behind the map. So the
          // map takes it, where Escape, the Delete key, and the arrow keys
          // all are. Nothing is scrolled to do it: the arrow was clicked, so
          // it is already in front of them.
          canvasRef.current?.focus({ preventScroll: true });
          onSelectStep(arrow.stepId, { markChoiceId: arrow.choiceId });
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
        // nothing to open; a box always does. Clicking a box is also what
        // puts the moves on it — folded up, and folded up again on the box
        // whose moves were open when it is clicked a second time. A click
        // that is only the tail of a Choice just drawn is none of that.
        onNodeClick={(_event, node) => {
          if (
            performance.now() - connectedAt.current <
            CLICK_AFTER_CONNECT_MS
          ) {
            return;
          }

          if (node.type === "step") {
            setToolbar({
              stepId: node.data.opens,
              opening: locate.request + 1,
              expanded: false,
            });
            onSelectStep(node.data.opens);
            return;
          }
          if (node.data.opens !== null) onSelectStep(node.data.opens);
        }}
        // A click on bare map is done with the moves, not with the box: they
        // fold back to the one button, where the next click on that box
        // starts from.
        onPaneClick={collapseToolbar}
      >
        <Background />
        <Controls showInteractive={false} />
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
      // Escape on a box lands the keyboard here (`boxKeyDown`); pressed again
      // with the map itself holding it, there is nothing left to step back
      // out of but the panel, so it is put away. Only the map's own Escape:
      // a press inside a box, a dialog, or a field is that thing's to answer.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (event.target !== event.currentTarget) return;
        props.onHidePanel();
      }}
      // Most of the viewport on a tall screen, never less than a map's worth:
      // a real-sized Journey is dozens of ranks deep, and every pixel of
      // height is legibility at fit-to-view. Escape on a box lands the
      // keyboard here, and the focus ring is what shows the Author where it
      // went — the quiet ring at rest, the heavier one while it holds focus.
      // Not `overflow-hidden`: "Find step" opens its list over the map from
      // the row above it, and the map below clips itself.
      className="flex h-[70vh] min-h-[36rem] flex-col rounded-xl ring-1 ring-foreground/10 outline-none focus-visible:ring-4 focus-visible:ring-ring"
    >
      {/* The controls that are always there — the way around the Draft by
          name, "Add step", which way the map runs, and the way back to a
          panel that is away — in a row of their own above the map, in normal
          flow, so nothing on the map (a box's moves, an arrow, a peek) is
          ever drawn over them or under them, and they stay put however the
          map is panned or zoomed. The map's height is what is left. */}
      {/* `role="group"`, not `role="toolbar"`, for the reason the box's
          moves give: a toolbar promises roving tabindex, and these are
          ordinary tab stops. */}
      <div
        role="group"
        aria-label="Map controls"
        className="flex flex-wrap items-center gap-2 border-b border-foreground/10 px-3 py-2"
      >
        <div className="min-w-0 flex-1 basis-56">{props.findStep}</div>

        <Button variant="outline" size="sm" onClick={props.onAddStep}>
          Add step
        </Button>

        {/* Straight after "Add step": the moves, and the way to take the
            last one back. Each names the keys that do the same thing for
            assistive technology, which is what `aria-keyshortcuts` reaches;
            nothing is drawn for it.

            The press is prevented from moving focus, the way the rich text
            toolbar's buttons are: an Author who has just typed into a field
            and reaches for Undo keeps the keyboard where it was, and what
            they undo is the document rather than the field they left. */}
        <Button
          variant="outline"
          size="sm"
          disabled={!props.canUndo}
          aria-keyshortcuts="Meta+Z Control+Z"
          onMouseDown={(event) => event.preventDefault()}
          onClick={props.onUndo}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!props.canRedo}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
          onMouseDown={(event) => event.preventDefault()}
          onClick={props.onRedo}
        >
          Redo
        </Button>

        <DirectionControl
          direction={props.layout.direction}
          onSetLayoutDirection={props.onSetLayoutDirection}
        />

        {/* The way back to a panel that is away, at the end of the row that
            the panel sits against — and nothing at all while it is there. */}
        {props.panelShown ? null : (
          <Button variant="outline" size="sm" onClick={props.onShowPanel}>
            Show panel
          </Button>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-xl">
        <ReactFlowProvider>
          <CanvasFlow {...props} canvasRef={canvasRef} />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
