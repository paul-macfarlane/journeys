"use client";

import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { buildFlowElements } from "@/components/journeys/canvas-elements";
import {
  useCanvasColorMode,
  WHOLE_MAP_FIT,
} from "@/components/journeys/canvas-shared";
import {
  ChoiceEdge,
  type ChoiceFlowEdge,
} from "@/components/journeys/choice-line";
import { DeleteStepConfirmation } from "@/components/journeys/delete-step-dialog";
import { DirectionControl } from "@/components/journeys/direction-control";
import {
  dialogIsOpen,
  type CanvasArrow,
  type SelectCommand,
} from "@/components/journeys/editor-shared";
import {
  CanvasActionsContext,
  DELETE_KEYS,
  MissingNode,
  StepNode,
  type CanvasActions,
  type CanvasFlowNode,
} from "@/components/journeys/step-node";
import { useCanvasKeyboard } from "@/components/journeys/use-canvas-keyboard";
import { useCanvasViewport } from "@/components/journeys/use-canvas-viewport";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { GraphDocument } from "@/lib/graph/document";
import type { EditCommand } from "@/lib/graph/edit";
import type { GraphLayout } from "@/lib/graph/layout";
import type { ProblemIndex } from "@/lib/graph/validate";

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
 * Journey has now. `stepSchema` carries a `position` field, but it is unused
 * legacy kept only so already-stored documents keep parsing (ticket 17's
 * manual layout is `wontfix`, and removing the field is itself `wontfix`;
 * ticket 72 D4); nothing here reads or writes it.
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
 * key removing it — as the Delete key on a box asks, through the same
 * confirmation as its toolbar, to remove that Step. Nothing here edits the
 * document: each of those is handed back to the editor in the document's own
 * words (a Step, a Choice), and the map redraws from whatever the editor
 * makes of it.
 *
 * And it is a map to be read: hovering or focusing a box peeks at what the
 * Step says without opening it, and the arrow keys walk from box to nearest
 * box so the whole map is reachable without a pointer — Enter opens the box
 * the keyboard is on, and Escape steps back out to the map itself.
 */

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

// Module-level: a fresh object each render would remount every node or edge.
const NODE_TYPES: NodeTypes = { step: StepNode, missing: MissingNode };
const EDGE_TYPES: EdgeTypes = { choice: ChoiceEdge };

export type JourneyCanvasProps = {
  document: GraphDocument;
  /** The document laid out, computed once by the editor and shared. */
  layout: GraphLayout;
  problems: ProblemIndex;
  /**
   * The box selected on the map, and the one arrow the Author has clicked,
   * if any.
   */
  selection: { stepId: string; arrow: CanvasArrow | null };
  view: {
    /**
     * What the last opening of a Step asked the map for. `request` is bumped
     * every time one is opened, the same Step included, so re-opening the one
     * already in the panel is answered too. `view` is what was asked for:
     * `keep` moves nothing, `reveal` brings the box onto the map only when it
     * is off it, and `zoom` makes the Zoom-to-step move whatever the box was
     * doing — a Step found by name, or one just made.
     */
    locate: { request: number; view: "keep" | "reveal" | "zoom" };
    /**
     * Bumped by the editor each time the Author puts the panel away or brings
     * it back, which is the one change of the map's width they asked for, so
     * the whole map is shown in whatever width it ends up with. A panel that
     * comes back for an opened Step does not bump it: the frame narrows, and
     * the opening's own move to the Step is what the map does.
     */
    fitRequest: number;
    /**
     * Whether the panel is beside the map. The map carries the way back to a
     * panel that is away, because the map is all there is to reach for then.
     */
    panelShown: boolean;
    /**
     * The Draft's one undo and redo, carried on the map because the map is
     * where most of what there is to take back is done — a Choice drawn, an
     * arrow moved, a Step deleted. The same history the keyboard reaches from
     * anywhere on the page; these two are the way to it for an Author whose
     * hands are on the mouse.
     */
    canUndo: boolean;
    canRedo: boolean;
  };
  /**
   * "Find step", the editor's, rendered first in the row of controls above
   * the map: the way around the Draft by name belongs beside the way around
   * it by shape.
   */
  findStep: ReactNode;
  /**
   * Every edit the map asks for — "Add step", the box toolbar's moves, a
   * Choice drawn onto a box or onto bare map, an arrow's head moved, the
   * arrows the Delete key was pressed on, which way the map runs — handed
   * back as one command. "Zoom to step" is not one: it calls `fitView`
   * through `useReactFlow` from inside the node itself.
   */
  onEdit: (command: EditCommand) => void;
  /**
   * Everything else the map asks for: a Step opened, an arrow clicked or a
   * click landing anywhere else on the map, the panel shown or put away
   * (Escape, with the map itself holding the keyboard), undo and redo.
   */
  onSelect: (command: SelectCommand) => void;
};

function CanvasFlow({
  document,
  layout,
  problems,
  selection,
  view,
  canvasRef,
  onEdit,
  onSelect,
}: JourneyCanvasProps & {
  /** The Canvas itself, which is what Escape hands the keyboard back to. */
  canvasRef: RefObject<HTMLElement | null>;
}) {
  const { stepId: selectedStepId, arrow: selectedArrow } = selection;
  const { locate } = view;

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

  const { nodes, edges, arrows } = useMemo(
    () =>
      buildFlowElements({
        document,
        layout,
        problems,
        selectedArrow,
        selectedStepId,
        shownToolbar,
      }),
    [document, layout, problems, selectedArrow, selectedStepId, shownToolbar],
  );

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

  const { bringOntoMap } = useCanvasViewport({
    nodes,
    selectedStepId,
    locate,
    direction: layout.direction,
    fitRequest: view.fitRequest,
  });
  const { moveFocus, escape, beforeDelete } = useCanvasKeyboard({
    nodes,
    canvasRef,
    bringOntoMap,
    onSelect,
  });

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

  /**
   * The one delete confirmation on the map, and the Step it is asking about.
   * `open` is kept apart from the Step so the dialog can close over the Step
   * it named, and go on naming it while the closing plays: after a confirm
   * that Step is already gone from the document.
   */
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    stepId: string;
    open: boolean;
  } | null>(null);

  const requestDeleteStep = useCallback((stepId: string) => {
    // A key pressed with a dialog already open is that dialog's: the box's
    // own handler cannot hear one from behind a modal, but a second dialog
    // over the first is never the answer to anything.
    if (dialogIsOpen()) return;
    setDeleteConfirmation({ stepId, open: true });
  }, []);

  const closeDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation((current) =>
      current === null ? null : { ...current, open: false },
    );
  }, []);

  const deleteStep = useCallback(
    (stepId: string) => onEdit({ kind: "delete-step", stepId }),
    [onEdit],
  );

  const actions = useMemo<CanvasActions>(
    () => ({
      onAddNextStep: (stepId) => onEdit({ kind: "add-next-step", stepId }),
      onDuplicateStep: (stepId) => onEdit({ kind: "duplicate-step", stepId }),
      onSetStart: (stepId) => onEdit({ kind: "set-start", stepId }),
      onRequestDeleteStep: requestDeleteStep,
      onToggleToolbar: toggleToolbar,
      onCollapseToolbar: collapseToolbar,
      onMoveFocus: moveFocus,
      onEscape: escape,
    }),
    [
      onEdit,
      requestDeleteStep,
      toggleToolbar,
      collapseToolbar,
      moveFocus,
      escape,
    ],
  );

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
        onBeforeDelete={beforeDelete}
        fitView
        fitViewOptions={WHOLE_MAP_FIT}
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
          onEdit({
            kind: "connect-choice",
            stepId: source,
            targetStepId: target,
          });
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

          onEdit({ kind: "add-next-step", stepId: fromNode.id });
        }}
        // The head of an arrow dropped on another box. A drop on nothing
        // never gets here, which is what leaves the Choice as it was.
        onReconnect={(oldEdge, connection) => {
          const arrow = arrows.get(oldEdge.id);
          if (arrow === undefined || !stepIds.has(connection.target)) return;
          onEdit({
            kind: "retarget-choice",
            stepId: arrow.stepId,
            choiceId: arrow.choiceId,
            targetStepId: connection.target,
          });
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
          onSelect({
            kind: "step",
            stepId: arrow.stepId,
            options: { markChoiceId: arrow.choiceId, scrollToPanel: true },
          });
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
            onSelect({ kind: "arrow", arrow: selected });
          } else if (clearedCurrent) {
            onSelect({ kind: "arrow", arrow: null });
          }

          if (removed.length > 0)
            onEdit({ kind: "remove-choices", choices: removed });
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
            onSelect({
              kind: "step",
              stepId: node.data.opens,
              options: { scrollToPanel: true },
            });
            return;
          }
          if (node.data.opens !== null) {
            onSelect({
              kind: "step",
              stepId: node.data.opens,
              options: { scrollToPanel: true },
            });
          }
        }}
        // A click on bare map is done with the moves, not with the box: they
        // fold back to the one button, where the next click on that box
        // starts from.
        onPaneClick={collapseToolbar}
      >
        <Background />
        <Controls showInteractive={false} fitViewOptions={WHOLE_MAP_FIT} />
      </ReactFlow>

      {/* The delete confirmation, one for the whole map: opened by the
          toolbar's button or by Delete or Backspace on a box, and never
          rendered inside the node it is about. Cancelled, Base UI hands the
          keyboard back to whatever held it — the box the key was pressed on,
          or the button. */}
      <AlertDialog
        open={deleteConfirmation?.open ?? false}
        onOpenChange={(open) => {
          if (!open) closeDeleteConfirmation();
        }}
        // Once the closing has played there is nothing left to name, and
        // nothing left to keep recomputing on every edit.
        onOpenChangeComplete={(open) => {
          if (!open) setDeleteConfirmation(null);
        }}
      >
        {deleteConfirmation !== null ? (
          <DeleteStepConfirmation
            document={document}
            stepId={deleteConfirmation.stepId}
            onDeleteStep={deleteStep}
            onClose={closeDeleteConfirmation}
          />
        ) : null}
      </AlertDialog>
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
        props.onSelect({ kind: "hide-panel" });
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

        <Button
          variant="outline"
          size="sm"
          onClick={() => props.onEdit({ kind: "add-step" })}
        >
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
          disabled={!props.view.canUndo}
          aria-keyshortcuts="Meta+Z Control+Z"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onSelect({ kind: "undo" })}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!props.view.canRedo}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onSelect({ kind: "redo" })}
        >
          Redo
        </Button>

        <DirectionControl
          direction={props.layout.direction}
          onSetLayoutDirection={(direction) =>
            props.onEdit({ kind: "set-layout-direction", direction })
          }
        />

        {/* The way back to a panel that is away, at the end of the row that
            the panel sits against — and nothing at all while it is there. */}
        {props.view.panelShown ? null : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onSelect({ kind: "show-panel" })}
          >
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
