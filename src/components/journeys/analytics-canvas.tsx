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
  arrowPoints,
  EDGE_LABEL_HEIGHT,
  handleOffset,
  midwayAlong,
  NODE_BOX_CLASS,
  smoothPath,
  sourceSide,
  targetSide,
  useCanvasColorMode,
} from "@/components/journeys/canvas-shared";
import { choiceLabel, counted } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { formatShare, type VersionAnalytics } from "@/lib/analytics";
import type { Point } from "@/lib/graph/crossings";
import type { GraphDocument, LayoutDirection } from "@/lib/graph/document";
import { EDGE_LABEL_MAX_WIDTH, layoutGraph } from "@/lib/graph/layout";
import { cn } from "@/lib/utils";

import "@xyflow/react/dist/style.css";

/**
 * A Published Version as a map with the numbers on it: one box per Step,
 * one arrow per Choice, laid out by the same `layoutGraph` as the editor's
 * Canvas and drawn with the same geometry (`canvas-shared.ts`), so the shape
 * an Author reads the numbers off is exactly the shape they built.
 *
 * Every arrow carries its Choice's take-rate — the share of visits to its
 * Step that went this way — and how many times it was walked, and is drawn
 * thicker the more it is taken, so where Participants go is visible before
 * a single number is read. Every Ending carries how many Runs ended on it;
 * every other box carries how many Runs stopped on it and went no further.
 *
 * Read-only: nothing here opens, drags, connects, or selects. It pans, zooms,
 * and fits to view like the editor's map, and that is all it does.
 */

type AnalyticsNodeData = {
  title: string;
  isStart: boolean;
  isEnding: boolean;
  outcomeLabel: string | null;
  /** "3 runs" on an Ending, "1 abandoned" anywhere else. */
  figure: string;
  sourceAnchors: string[];
  direction: LayoutDirection;
};

type AnalyticsFlowNode = Node<AnalyticsNodeData, "step">;

type AnalyticsEdgeData = {
  points: Point[];
  direction: LayoutDirection;
  label: string;
  share: number | null;
  traversals: number;
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
  const points = arrowPoints(
    data?.direction ?? "TB",
    source === target,
    data?.points,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
  );
  const middle = midwayAlong(points);
  const share = data?.share ?? null;
  const figure = `${formatShare(share)} · ${counted(data?.traversals ?? 0, "time")}`;

  return (
    <g>
      <BaseEdge
        path={smoothPath(points)}
        markerEnd={markerEnd}
        style={{ strokeWidth: strokeWidth(share) }}
      />
      <foreignObject
        x={middle.x - EDGE_LABEL_MAX_WIDTH / 2}
        y={middle.y - CHIP_HEIGHT / 2}
        width={EDGE_LABEL_MAX_WIDTH}
        height={CHIP_HEIGHT}
        className="pointer-events-none overflow-visible"
      >
        <div className="flex h-full w-full items-center justify-center">
          <span
            data-edge-label=""
            className="flex max-w-full flex-col items-center rounded bg-background px-1.5 py-0.5 text-xs ring-1 ring-foreground/10"
          >
            <span className="max-w-full truncate">{data?.label}</span>
            <span className="font-medium tabular-nums" data-edge-figure="">
              {figure}
            </span>
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

      {/* A group named by the Step, holding its badges and its figure, so
          the box reads to assistive technology as "Waved through, Ending,
          3 runs" — and to a spec as the same thing. */}
      <div
        role="group"
        aria-label={data.title}
        className={cn(
          NODE_BOX_CLASS,
          data.isStart ? "ring-2 ring-primary" : "ring-2 ring-foreground/15",
        )}
      >
        <p className="truncate text-sm font-medium">{data.title}</p>

        <div className="flex items-center gap-1 overflow-hidden">
          {data.isStart ? <Badge>Start</Badge> : null}
          {data.isEnding ? <Badge>Ending</Badge> : null}
          {data.isEnding ? (
            <span className="truncate text-xs text-muted-foreground">
              {data.outcomeLabel ?? "No outcome"}
            </span>
          ) : null}
        </div>

        <p
          data-step-figure=""
          className="truncate text-xs font-medium tabular-nums"
        >
          {data.figure}
        </p>
      </div>

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
}: {
  document: GraphDocument;
  analytics: VersionAnalytics;
  direction: LayoutDirection;
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
        figure: figureFor(node.isEnding, analytics.steps[node.stepId]),
        sourceAnchors: node.sourceAnchors,
        direction: layout.direction,
      },
    }));

    const flowEdges: AnalyticsFlowEdge[] = layout.edges.map((edge) => {
      const label = choiceLabel(edge.label);
      const stat = analytics.choices[edge.choiceId];
      const share = stat?.share ?? null;
      const traversals = stat?.traversals ?? 0;

      // What a spec reads off an arrow.
      const domAttributes: EdgeMarks = {
        "data-choice-id": edge.choiceId,
        "data-share": share === null ? "" : String(share),
        "data-traversals": String(traversals),
      };

      return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.choiceId,
        target: edge.target,
        targetHandle: "in",
        type: "choice",
        selectable: false,
        focusable: false,
        ariaLabel: `${label}: ${titleById.get(edge.source) ?? ""} → ${titleById.get(edge.target) ?? ""}, ${formatShare(share)}, ${counted(traversals, "time")}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          points: edge.points,
          direction: layout.direction,
          label,
          share,
          traversals,
        },
        domAttributes,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [analytics, direction, document]);

  // Turning the map a quarter puts every box somewhere else, so wherever the
  // Member had panned and zoomed to is about a map that no longer exists:
  // the whole of the new one is shown instead, as the editor's map does.
  const { fitView } = useReactFlow();
  const lastDirection = useRef(direction);
  useEffect(() => {
    if (lastDirection.current === direction) return;
    lastDirection.current = direction;
    void fitView({ duration: 200 });
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
      fitView
      // As the editor's map: low enough that a real-sized Journey fits.
      minZoom={0.05}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function AnalyticsCanvas({
  document,
  analytics,
  direction,
}: {
  document: GraphDocument;
  analytics: VersionAnalytics;
  /** Which way to draw it: the reader's choice, the version's by default. */
  direction: LayoutDirection;
}) {
  return (
    <section
      aria-label="Analytics map"
      className="relative h-[70vh] min-h-[36rem] overflow-hidden rounded-xl ring-1 ring-foreground/10"
    >
      <ReactFlowProvider>
        <AnalyticsFlow
          document={document}
          analytics={analytics}
          direction={direction}
        />
      </ReactFlowProvider>
    </section>
  );
}
