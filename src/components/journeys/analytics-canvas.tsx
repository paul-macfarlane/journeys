"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";

import {
  handleOffset,
  NODE_BOX_CLASS,
  sourceSide,
  targetSide,
  useCanvasColorMode,
  WHOLE_MAP_FIT,
  WHOLE_MAP_MAX_ZOOM,
} from "@/components/journeys/canvas-shared";
import { DirectionControl } from "@/components/journeys/direction-control";
import { choiceLabel, counted } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { formatShare, type VersionAnalytics } from "@/lib/analytics";
import {
  ANALYTICS_DIRECTION_STORAGE_KEY,
  usePreference,
  writePreference,
} from "@/lib/browser-preferences";
import type { Point } from "@/lib/graph/crossings";
import {
  layoutDirectionSchema,
  type GraphDocument,
  type LayoutDirection,
} from "@/lib/graph/document";
import { arrowPoints, labelPoint, smoothPath } from "@/lib/graph/geometry";
import {
  EDGE_LABEL_HEIGHT,
  EDGE_LABEL_MAX_WIDTH,
  layoutGraph,
} from "@/lib/graph/layout";
import { mapMoveDuration } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";

import "@xyflow/react/dist/style.css";

/**
 * A Published Version as a map with the numbers on it: one box per Step,
 * one arrow per Choice, laid out by the same `layoutGraph` as the editor's
 * Canvas and drawn with the same geometry (`@/lib/graph/geometry`), so the
 * shape an Author reads the numbers off is exactly the shape they built.
 *
 * Every arrow carries its Choice's take-rate — the share of visits to its
 * Step that went this way — and how many times it was walked, and is drawn
 * thicker the more it is taken, so where Participants go is visible before
 * a single number is read. Every Ending carries how many Runs ended on it;
 * every other box carries how many Runs stopped on it and went no further.
 *
 * Read-only: nothing here opens, drags, connects, or edits. It pans, zooms,
 * and fits to view like the editor's map, and that is all it does — except
 * turn, and, on a Published Version's own view (`VersionMap`, ticket 94),
 * select: there the map carries no numbers at all — no figure on a box, only
 * the Choice on an arrow, every arrow the same weight — and each box is a
 * button that picks the Step the view's panel shows. Which way it runs is the reader's to choose, from the same control
 * the editor's map has in the same place, the row across the top of the
 * frame: a Published Version is immutable, so turning the map is a way of
 * reading it and not an edit, and the browser keeps the choice for every
 * version and every Journey it reads — as it keeps whether the editor's
 * panel is put away — with the version's own direction until it has chosen.
 */

type AnalyticsNodeData = {
  title: string;
  isStart: boolean;
  isEnding: boolean;
  outcomeLabel: string | null;
  /** "3 runs" on an Ending, "1 abandoned" anywhere else; null with no counts. */
  figure: string | null;
  sourceAnchors: string[];
  direction: LayoutDirection;
  stepId: string;
  /** True only when the map selects (the version view). */
  selectable: boolean;
  selected: boolean;
};

type AnalyticsFlowNode = Node<AnalyticsNodeData, "step">;

type AnalyticsEdgeData = {
  points: Point[];
  /** Where the layout made room for the label; a loop hangs its own halfway along its route. */
  labelAt: Point;
  direction: LayoutDirection;
  label: string;
  /** Null on a map with no counts: the arrow carries its Choice alone. */
  figures: { share: number | null; traversals: number } | null;
};

type AnalyticsFlowEdge = Edge<AnalyticsEdgeData, "choice">;

/**
 * The attributes a spec reads off an arrow. React Flow's `domAttributes`
 * has no index signature for `data-*`, so one is intersected in rather
 * than cast — as the editor's Canvas does.
 */
type EdgeMarks = NonNullable<Edge["domAttributes"]> &
  Record<`data-${string}`, string>;

/** The label chip is two lines: the Choice, and its numbers beneath. */
const CHIP_HEIGHT = EDGE_LABEL_HEIGHT * 2;

/** An arrow never taken is a thin line; one every visit takes is this thick. */
const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 5;

function strokeWidth(share: number | null): number {
  return (
    MIN_STROKE_WIDTH + (MAX_STROKE_WIDTH - MIN_STROKE_WIDTH) * (share ?? 0)
  );
}

function AnalyticsEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps<AnalyticsFlowEdge>) {
  const isLoop = source === target;
  const points = arrowPoints(
    data?.direction ?? "TB",
    isLoop,
    data?.points,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
  );
  const middle = labelPoint(isLoop, data?.labelAt, points);
  const figures = data?.figures ?? null;
  const chipHeight = figures === null ? EDGE_LABEL_HEIGHT : CHIP_HEIGHT;

  return (
    <g>
      <BaseEdge
        path={smoothPath(points)}
        markerEnd={markerEnd}
        // With no counts every arrow is drawn the same, at React Flow's own
        // weight: a thin line would read as "never taken".
        style={
          figures === null
            ? undefined
            : { strokeWidth: strokeWidth(figures.share) }
        }
      />
      <foreignObject
        x={middle.x - EDGE_LABEL_MAX_WIDTH / 2}
        y={middle.y - chipHeight / 2}
        width={EDGE_LABEL_MAX_WIDTH}
        height={chipHeight}
        className="pointer-events-none overflow-visible"
      >
        <div className="flex h-full w-full items-center justify-center">
          <span
            data-edge-label=""
            className="flex max-w-full flex-col items-center rounded bg-background px-1.5 py-0.5 text-xs ring-1 ring-foreground/10"
          >
            <span className="max-w-full truncate">{data?.label}</span>
            {figures !== null ? (
              <span className="font-medium tabular-nums" data-edge-figure="">
                {`${formatShare(figures.share)} · ${counted(figures.traversals, "time")}`}
              </span>
            ) : null}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

/**
 * A Published Version passed publish validation, so every Choice of it
 * leads to a Step that exists: the layout never holds the editor's
 * "missing step" placeholder here, and there is one kind of box.
 */
function AnalyticsNode({ data }: NodeProps<AnalyticsFlowNode>) {
  return (
    <>
      <Handle
        id="in"
        type="target"
        position={targetSide(data.direction)}
        isConnectable={false}
      />

      {data.selectable ? (
        // On the version view the box is a toggle button named by its Step,
        // pressed while its Step is the one the panel shows: a tab stop, so
        // the map is walked from the keyboard as well as by pointer. Its
        // click — a pointer's, or Enter's and Space's — reaches the map's
        // `onNodeClick`, which selects; React Flow lets a box take pointer
        // events at all only while the map has that handler.
        <button
          type="button"
          aria-label={data.title}
          aria-pressed={data.selected}
          className={cn(
            NODE_BOX_CLASS,
            "nopan cursor-pointer outline-offset-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring",
            data.selected
              ? "bg-muted ring-[3px] ring-foreground"
              : data.isStart
                ? "ring-2 ring-primary"
                : "ring-2 ring-foreground/15",
          )}
        >
          <AnalyticsNodeBody data={data} />
        </button>
      ) : (
        // A group named by the Step, holding its badges and its figure, so
        // the box reads to assistive technology as "Waved through, Ending,
        // 3 runs" — and to a spec as the same thing.
        <div
          role="group"
          aria-label={data.title}
          className={cn(
            NODE_BOX_CLASS,
            data.isStart ? "ring-2 ring-primary" : "ring-2 ring-foreground/15",
          )}
        >
          <AnalyticsNodeBody data={data} />
        </div>
      )}

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
    </>
  );
}

/** What a box says: its title, its badges, and — with counts — its figure. */
function AnalyticsNodeBody({ data }: { data: AnalyticsNodeData }) {
  return (
    <>
      <span className="block truncate text-sm font-medium">{data.title}</span>

      <span className="flex items-center gap-1 overflow-hidden">
        {data.isStart ? <Badge>Start</Badge> : null}
        {data.isEnding ? <Badge>Ending</Badge> : null}
        {data.isEnding ? (
          <span className="truncate text-xs text-muted-foreground">
            {data.outcomeLabel ?? "No outcome"}
          </span>
        ) : null}
      </span>

      {data.figure !== null ? (
        <span
          data-step-figure=""
          className="block truncate text-xs font-medium tabular-nums"
        >
          {data.figure}
        </span>
      ) : null}
    </>
  );
}

// Module-level: a fresh object each render would remount every node or edge.
const NODE_TYPES: NodeTypes = { step: AnalyticsNode };
const EDGE_TYPES: EdgeTypes = { choice: AnalyticsEdge };

/**
 * A box's figure. The two kinds of count never both apply: a Run ends on an
 * Ending and stops short anywhere else, so each box carries the one that
 * can be non-zero for it.
 */
function figureFor(
  isEnding: boolean,
  stat: { ended: number; abandoned: number } | undefined,
): string {
  return isEnding
    ? counted(stat?.ended ?? 0, "run")
    : `${stat?.abandoned ?? 0} abandoned`;
}

function AnalyticsFlow({
  document,
  analytics,
  direction,
  selectedStepId,
  onSelectStep,
}: {
  document: GraphDocument;
  analytics: VersionAnalytics | null;
  direction: LayoutDirection;
  selectedStepId: string | null;
  onSelectStep: ((stepId: string) => void) | null;
}) {
  const { nodes, edges } = useMemo(() => {
    // Laid out the way this browser reads it, not the way the version was
    // published: the direction is the one thing about the document the map
    // does not take from the document. Nothing is written back — a Published
    // Version is immutable, and this is a copy laid out and let go of.
    const layout = layoutGraph({ ...document, layoutDirection: direction });
    const titleById = new Map(
      layout.nodes.map((node) => [node.id, node.title]),
    );

    const flowNodes: AnalyticsFlowNode[] = layout.nodes.map((node) => ({
      id: node.id,
      type: "step",
      position: { x: node.x, y: node.y },
      width: node.width,
      height: node.height,
      selectable: false,
      connectable: false,
      draggable: false,
      data: {
        title: node.title,
        isStart: node.isStart,
        isEnding: node.isEnding,
        outcomeLabel:
          node.outcomeId !== null
            ? (document.outcomes[node.outcomeId]?.label ?? null)
            : null,
        figure:
          analytics === null
            ? null
            : figureFor(node.isEnding, analytics.steps[node.stepId]),
        sourceAnchors: node.sourceAnchors,
        direction: layout.direction,
        stepId: node.stepId,
        selectable: onSelectStep !== null,
        selected: node.stepId === selectedStepId,
      },
    }));

    const flowEdges: AnalyticsFlowEdge[] = layout.edges.map((edge) => {
      const label = choiceLabel(edge.label);
      const stat = analytics?.choices[edge.choiceId];
      const figures =
        analytics === null
          ? null
          : { share: stat?.share ?? null, traversals: stat?.traversals ?? 0 };
      const route = `${label}: ${titleById.get(edge.source) ?? ""} → ${titleById.get(edge.target) ?? ""}`;

      // What a spec reads off an arrow.
      const domAttributes: EdgeMarks = { "data-choice-id": edge.choiceId };
      if (figures !== null) {
        domAttributes["data-share"] =
          figures.share === null ? "" : String(figures.share);
        domAttributes["data-traversals"] = String(figures.traversals);
      }

      return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.choiceId,
        target: edge.target,
        targetHandle: "in",
        type: "choice",
        selectable: false,
        focusable: false,
        ariaLabel:
          figures === null
            ? route
            : `${route}, ${formatShare(figures.share)}, ${counted(figures.traversals, "time")}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          points: edge.points,
          labelAt: edge.labelAt,
          direction: layout.direction,
          label,
          figures,
        },
        domAttributes,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [analytics, direction, document, onSelectStep, selectedStepId]);

  // Turning the map a quarter puts every box somewhere else, so wherever the
  // Member had panned and zoomed to is about a map that no longer exists:
  // the whole of the new one is shown instead, as the editor's map does.
  const { fitView } = useReactFlow();
  const lastDirection = useRef(direction);
  useEffect(() => {
    if (lastDirection.current === direction) return;
    lastDirection.current = direction;
    void fitView({ maxZoom: WHOLE_MAP_MAX_ZOOM, duration: mapMoveDuration() });
  }, [direction, fitView]);

  const colorMode = useCanvasColorMode();

  return (
    <ReactFlow<AnalyticsFlowNode, AnalyticsFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      colorMode={colorMode}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      onNodeClick={
        onSelectStep === null
          ? undefined
          : (_event, node) => onSelectStep(node.data.stepId)
      }
      fitView
      fitViewOptions={WHOLE_MAP_FIT}
      // As the editor's map: low enough that a real-sized Journey fits.
      minZoom={0.05}
    >
      <Background />
      <Controls showInteractive={false} fitViewOptions={WHOLE_MAP_FIT} />
    </ReactFlow>
  );
}

export function AnalyticsCanvas({
  document,
  analytics,
  label = "Analytics map",
  selectedStepId = null,
  onSelectStep = null,
}: {
  document: GraphDocument;
  /** The Runs' numbers to draw on it; null for a map with none (`VersionMap`). */
  analytics: VersionAnalytics | null;
  /** The frame's accessible name. */
  label?: string;
  /** With `onSelectStep`: the Step whose box is marked selected. */
  selectedStepId?: string | null;
  /** When given, every box is a button that selects its Step. */
  onSelectStep?: ((stepId: string) => void) | null;
}) {
  // Which way this browser has turned the map, if it has. Until it has
  // chosen — and, on the render the server sent, until the page is the
  // browser's — the map runs the way the version was published.
  const stored = layoutDirectionSchema.safeParse(
    usePreference(ANALYTICS_DIRECTION_STORAGE_KEY),
  );
  const direction = stored.success ? stored.data : document.layoutDirection;

  return (
    <section
      aria-label={label}
      // The editor's frame, and its reason: most of the viewport on a tall
      // screen, never less than a map's worth. The row of controls takes
      // its share and the map's height is what is left.
      className="flex h-[70vh] min-h-[36rem] flex-col rounded-xl ring-1 ring-foreground/10"
    >
      {/* Where the editor's map keeps its controls: a row of its own above
          the map, in normal flow, so it stays put however the map is
          panned or zoomed. `role="group"` as there, for the same reason —
          these are ordinary tab stops, not a toolbar's roving one. */}
      <div
        role="group"
        aria-label="Map controls"
        className="flex flex-wrap items-center gap-2 border-b border-foreground/10 px-3 py-2"
      >
        <DirectionControl
          direction={direction}
          onSetLayoutDirection={(next) =>
            writePreference(ANALYTICS_DIRECTION_STORAGE_KEY, next)
          }
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-xl">
        <ReactFlowProvider>
          <AnalyticsFlow
            document={document}
            analytics={analytics}
            direction={direction}
            selectedStepId={selectedStepId}
            onSelectStep={onSelectStep}
          />
        </ReactFlowProvider>
      </div>
    </section>
  );
}

/**
 * A Published Version's map on its own view (ticket 94): the Analytics map
 * with no numbers on it, whose boxes select the Step the view's panel shows.
 */
export function VersionMap({
  document,
  selectedStepId,
  onSelectStep,
}: {
  document: GraphDocument;
  selectedStepId: string;
  onSelectStep: (stepId: string) => void;
}) {
  return (
    <AnalyticsCanvas
      document={document}
      analytics={null}
      label="Version map"
      selectedStepId={selectedStepId}
      onSelectStep={onSelectStep}
    />
  );
}
