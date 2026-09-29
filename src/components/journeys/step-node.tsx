"use client";

import {
  Handle,
  NodeToolbar,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Ellipsis } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";

import {
  ARROW_DIRECTIONS,
  handleOffset,
  NODE_BOX_CLASS,
  sourceSide,
  targetSide,
  type ArrowDirection,
} from "@/components/journeys/canvas-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LayoutDirection } from "@/lib/graph/document";
import { mapMoveDuration } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";

/**
 * The boxes on the editor's map (`journey-canvas.tsx`): a Step's box, with
 * its peek, its toolbar of moves, and its handles, and the placeholder drawn
 * where a Choice leads to a Step that is gone. What either box does is handed
 * to it through `CanvasActionsContext`, which the canvas provides.
 */

/**
 * The attributes a spec reads off a node's button: which kind of box it is,
 * which Step, how many problems. React's `HTMLAttributes` has no index
 * signature for `data-*`, so one is intersected in rather than cast.
 */
export type NodeMarks = HTMLAttributes<HTMLButtonElement> &
  Record<`data-${string}`, string>;

/**
 * What the box toolbar does, handed to the nodes through context rather than
 * through each node's `data`: these are the editor's own functions, and a
 * node whose data changed identity on every render of the editor would be a
 * node React Flow re-measured on every render of the editor.
 */
export type CanvasActions = {
  onAddNextStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  onSetStart: (stepId: string) => void;
  /**
   * The delete confirmation asked for, from the toolbar's button or from
   * Delete or Backspace on the box: the canvas holds the one dialog, so a key
   * and the button open the same instance and the dialog is never inside a
   * node the delete then removes.
   */
  onRequestDeleteStep: (stepId: string) => void;
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

/** Delete and Backspace both. React Flow ignores either inside an input. */
export const DELETE_KEYS = ["Delete", "Backspace"];

/**
 * The keyboard on a box, the same for a Step's and for a placeholder's: an
 * arrow key moves to the nearest box that way, Escape leaves the boxes for
 * the map, and Delete or Backspace asks to delete the Step the box is —
 * `deletes` names it, or is null on a box that has none to delete: the
 * Start, which cannot go while it is the Start, and a placeholder, which is
 * not a Step at all. Enter and Space are the button's own — they click it,
 * and a click is what opens a Step in the panel.
 */
function boxKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  nodeId: string,
  actions: CanvasActions,
  deletes: string | null,
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
    return;
  }

  if (DELETE_KEYS.includes(event.key)) {
    // The key is about the box it was pressed on and nothing else. The map's
    // own delete, which takes whichever arrow is in hand, listens on the
    // document, so the press is stopped here before it gets there — on a box
    // with nothing to delete as much as on one with a Step, so the key never
    // does something other than what the box it landed on says.
    event.preventDefault();
    event.stopPropagation();
    if (deletes !== null) actions.onRequestDeleteStep(deletes);
  }
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

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

export type StepFlowNode = Node<StepNodeData, "step">;
export type MissingFlowNode = Node<MissingNodeData, "missing">;
export type CanvasFlowNode = StepFlowNode | MissingFlowNode;

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

export function StepNode({ id, data }: NodeProps<StepFlowNode>) {
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
                  duration: mapMoveDuration(),
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
                not offered a delete that would only refuse. The
                confirmation is the canvas's, the same one the Delete key
                on the box opens. */}
            {data.isStart ? null : (
              <Button
                variant="destructive"
                size="sm"
                // What a dialog's own trigger would say of itself.
                aria-haspopup="dialog"
                onClick={() => actions.onRequestDeleteStep(data.opens)}
              >
                Delete step
              </Button>
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
        // The box selected on the map, said as well as drawn heavier.
        aria-current={data.isSelected ? "true" : undefined}
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
        onKeyDown={(event) =>
          boxKeyDown(event, id, actions, data.isStart ? null : data.opens)
        }
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

export function MissingNode({ id, data }: NodeProps<MissingFlowNode>) {
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
        // A placeholder is a box like any other to walk across, and one
        // with no Step to delete.
        onKeyDown={(event) => boxKeyDown(event, id, actions, null)}
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
