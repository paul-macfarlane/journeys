"use client";

import { getViewportForBounds, useReactFlow, useStore } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";

import { WHOLE_MAP_MAX_ZOOM } from "@/components/journeys/canvas-shared";
import type { CanvasFlowNode } from "@/components/journeys/step-node";
import type { LayoutDirection } from "@/lib/graph/document";
import { mapMoveDuration } from "@/lib/reduced-motion";

/**
 * Everything that moves the editor's map (`journey-canvas.tsx`): bringing a
 * box onto the map, the Zoom-to-step move, the answer to each opening of a
 * Step (`locate`), the whole-map fit after a change of direction or after the
 * Author put the panel away or brought it back (`fitRequest`), and the replay
 * of those moves on each resize the sliding columns hand the map. Rendered
 * inside the `ReactFlow` tree, whose hooks it reads the view through.
 *
 * On a phone the foot of the map's frame can be under the Step sheet
 * (`bottomInset`, ticket 53): the moves to one box treat the band it covers
 * as off the map and centre the box in what is left above it. Everywhere
 * else the inset is 0 and the moves are React Flow's own `fitView`.
 */

/** Sub-pixel rounding, so a box flush against the edge counts as on the map. */
const IN_VIEW_TOLERANCE = 1;

/**
 * How long after the panel was put away or brought back a resize of the map
 * still counts as that toggle's doing. The columns move for 200ms and the map
 * is resized under them several times on the way; a resize arriving later than
 * this is something else — a window dragged wider, a zoom — and the view the
 * Author has set up is left exactly where they set it.
 */
const FIT_AFTER_TOGGLE_MS = 500;

/**
 * How many frames the Zoom-to-step move waits for a box React Flow has not
 * measured yet: a Step made a moment ago is rendered before it is measured,
 * and a `fitView` on a box with no dimensions does nothing. A handful of
 * frames covers the measuring pass with room to spare.
 */
const MEASURE_FRAMES = 30;

/** `fitView`'s own padding, which a move clear of the sheet keeps to. */
const FIT_PADDING = 0.1;

export function useCanvasViewport({
  nodes,
  selectedStepId,
  locate,
  direction,
  fitRequest,
  bottomInset,
}: {
  /** The boxes as drawn, which a Step has to be among to be moved to. */
  nodes: CanvasFlowNode[];
  /** The box selected on the map, which an opening moves the view to. */
  selectedStepId: string;
  /** See `JourneyCanvasProps["view"]["locate"]`. */
  locate: { request: number; view: "keep" | "reveal" | "zoom" };
  /** Which way the map runs; a change of it fits the whole map again. */
  direction: LayoutDirection;
  /** See `JourneyCanvasProps["view"]["fitRequest"]`. */
  fitRequest: number;
  /** See `JourneyCanvasProps["view"]["bottomInset"]`. */
  bottomInset: number;
}): {
  /** A box left off the map is brought onto it; one already on it stays put. */
  bringOntoMap: (nodeId: string) => void;
} {
  const { fitView, getInternalNode, getNodesBounds, getViewport } =
    useReactFlow();
  // The size of the map itself, which is what "off the map" is measured
  // against; React Flow keeps it up to date as the pane resizes.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const minZoom = useStore((state) => state.minZoom);

  /**
   * One box shown on its own, never closer than `maxZoom`: `fitView` on it.
   * With the foot of the frame under a sheet, the same fit is made in the
   * part of the frame left in sight, so the box's middle lands half the
   * inset above the frame's own — still through `fitView`, because React
   * Flow queues a `fitView` and makes it after the next render: a
   * `setViewport` made in between would be overwritten by an earlier move
   * still in the queue, where a later `fitView` replaces it. The zoom is
   * the one the part in sight allows, and the padding above the box is
   * what is left over in that part split evenly, so the padding below it
   * is the same plus the inset.
   */
  const fitBox = useCallback(
    (nodeId: string, maxZoom: number) => {
      if (bottomInset === 0) {
        void fitView({
          nodes: [{ id: nodeId }],
          maxZoom,
          duration: mapMoveDuration(),
        });
        return;
      }
      const bounds = getNodesBounds([nodeId]);
      const inSight = Math.max(1, paneHeight - bottomInset);
      const { zoom } = getViewportForBounds(
        bounds,
        paneWidth,
        inSight,
        minZoom,
        maxZoom,
        FIT_PADDING,
      );
      const gap = Math.max(0, Math.floor((inSight - bounds.height * zoom) / 2));
      void fitView({
        nodes: [{ id: nodeId }],
        maxZoom,
        duration: mapMoveDuration(),
        padding: {
          top: `${gap}px`,
          bottom: `${gap + bottomInset}px`,
          x: FIT_PADDING,
        },
      });
    },
    [bottomInset, fitView, getNodesBounds, minZoom, paneHeight, paneWidth],
  );

  /**
   * Whether the whole of a box is inside the map's frame right now, less
   * any band of it under a sheet.
   */
  const isOnMap = useCallback(
    (nodeId: string): boolean => {
      const bounds = getNodesBounds([nodeId]);
      const { x, y, zoom } = getViewport();
      return (
        bounds.x * zoom + x >= -IN_VIEW_TOLERANCE &&
        bounds.y * zoom + y >= -IN_VIEW_TOLERANCE &&
        (bounds.x + bounds.width) * zoom + x <= paneWidth + IN_VIEW_TOLERANCE &&
        (bounds.y + bounds.height) * zoom + y <=
          paneHeight - bottomInset + IN_VIEW_TOLERANCE
      );
    },
    [bottomInset, getNodesBounds, getViewport, paneHeight, paneWidth],
  );

  /** A box left off the map is brought onto it; one already on it stays put. */
  const bringOntoMap = useCallback(
    (nodeId: string) => {
      if (paneWidth === 0 || paneHeight === 0) return;
      if (isOnMap(nodeId)) return;
      fitBox(nodeId, 1);
    },
    [fitBox, isOnMap, paneHeight, paneWidth],
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

        fitBox(nodeId, maxZoom);
      }

      attempt();
    },
    [fitBox, getInternalNode, paneHeight, paneWidth],
  );

  // Nothing is left waiting on a frame that would land after the map is gone.
  useEffect(
    () => () => {
      if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    },
    [],
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
  const lastDirection = useRef(direction);
  useEffect(() => {
    if (lastDirection.current === direction) return;
    lastDirection.current = direction;
    void fitView({ maxZoom: WHOLE_MAP_MAX_ZOOM, duration: mapMoveDuration() });
  }, [fitView, direction]);

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
      void fitView({
        maxZoom: WHOLE_MAP_MAX_ZOOM,
        duration: mapMoveDuration(),
      });
      return;
    }
    zoomToStep(request.box, request.maxZoom);
  }, [fitView, paneHeight, paneWidth, zoomToStep]);

  // A phone's sheet comes up a frame or two after the opening that raised
  // it, and is measured after that, so the move that opening made went to
  // the middle of the whole frame — under the sheet. Each new measure of
  // the sheet makes the move again: the Zoom-to-step move while its request
  // is still fresh, and otherwise a box the sheet has grown over brought
  // back into sight. A sheet going down (0) uncovers everything and moves
  // nothing; without a sheet the inset never changes and this never runs.
  const lastInset = useRef(bottomInset);
  useEffect(() => {
    if (lastInset.current === bottomInset) return;
    lastInset.current = bottomInset;
    if (bottomInset === 0) return;

    const request = viewRequest.current;
    if (
      request !== null &&
      request.box !== null &&
      performance.now() - request.at <= FIT_AFTER_TOGGLE_MS
    ) {
      zoomToStep(request.box, request.maxZoom);
      return;
    }
    if (!nodes.some((node) => node.id === selectedStepId)) return;
    bringOntoMap(selectedStepId);
  }, [bottomInset, bringOntoMap, nodes, selectedStepId, zoomToStep]);

  return { bringOntoMap };
}
