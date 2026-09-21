"use client";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type ColorMode,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraphDocument } from "@/lib/graph/document";
import {
  layoutGraph,
  problemsByAddress,
  NODE_HEIGHT,
  NODE_WIDTH,
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
 * never stored. No Author drags a node, so there is no hand-placed position to
 * preserve, and a stored one would go stale the moment a Choice was added:
 * what the map is for is showing the shape the Journey has now. `stepSchema`
 * keeps a `position` field for a later decision; nothing here reads or writes
 * it.
 *
 * The problems this draws come from `validateForPublish` run in the browser on
 * the document the editor is holding, not from the "Validate" button's server
 * round trip, so a mark clears the moment the fix is typed.
 */

/**
 * React Flow types `domAttributes` as React's `HTMLAttributes`, which has no
 * index signature for `data-*`. Intersecting one in keeps the marks the specs
 * read off a node type-checked rather than cast away.
 */
type NodeMarks = NonNullable<Node["domAttributes"]> &
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
};

type MissingNodeData = {
  isSelected: boolean;
  /** The Step whose Choice points at nothing — what there is to go and fix. */
  opens: string | null;
};

type StepFlowNode = Node<StepNodeData, "step">;
type MissingFlowNode = Node<MissingNodeData, "missing">;
type CanvasFlowNode = StepFlowNode | MissingFlowNode;

/** The count and the messages behind a node's problem badge. */
function ProblemBadge({ problems }: { problems: string[] }) {
  return (
    <span
      aria-label={`${problems.length} problem${problems.length === 1 ? "" : "s"}`}
      title={problems.join("\n")}
      className="inline-flex w-fit shrink-0 items-center rounded-full border border-destructive/50 px-1.5 py-0 text-[10px] font-medium text-destructive"
    >
      {problems.length}
    </span>
  );
}

function StepNode({ data }: NodeProps<StepFlowNode>) {
  const marked = data.problems.length > 0;

  return (
    <>
      {/* Edges are drawn between handles; nothing here is connectable, so
          these are anchors rather than controls. */}
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <div
        className={cn(
          "relative flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-xl bg-background px-3 py-2 ring-inset",
          data.isSelected ? "ring-4" : "ring-2",
          marked
            ? "ring-destructive"
            : data.isStart
              ? "ring-primary"
              : "ring-foreground/15",
        )}
      >
        {/* The Outcome's color, dynamic by nature, so it is an inline style. */}
        {data.isEnding && data.outcomeColor !== null ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundColor: data.outcomeColor }}
          />
        ) : null}

        <p className="truncate text-sm font-medium">{data.title}</p>

        <div className="flex items-center gap-1 overflow-hidden">
          {data.isStart ? <Badge>Start</Badge> : null}
          {data.isEnding ? <Badge>Ending</Badge> : null}
          {marked ? <ProblemBadge problems={data.problems} /> : null}
          {data.isEnding ? (
            <span className="truncate text-xs text-muted-foreground">
              {data.outcomeLabel ?? "No outcome"}
            </span>
          ) : null}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

function MissingNode({ data }: NodeProps<MissingFlowNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-destructive bg-background px-3 py-2",
          data.isSelected ? "ring-4 ring-destructive" : null,
        )}
      >
        <p className="truncate text-sm font-medium text-destructive">
          Missing step
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

// Module-level: a fresh object each render would remount every node.
const NODE_TYPES: NodeTypes = { step: StepNode, missing: MissingNode };

/**
 * "Has this render happened in the browser?" — false through the server
 * render and the hydrating one, true afterwards. The store never changes, so
 * there is nothing to subscribe to; React re-renders once after hydration
 * because the client snapshot differs from the server's.
 */
const subscribeToNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

function LegendEntry({
  swatch,
  children,
}: {
  swatch: string;
  children: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", swatch)} />
      {children}
    </span>
  );
}

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
    // first Step whose Choice is left pointing at nothing — the one place the
    // fix can be made. A real target opens itself.
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
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        selected: isSelected,
        ariaRole: "button" as const,
        ariaLabel: node.title,
        connectable: false,
      };

      if (node.kind === "missing") {
        const marks: NodeMarks = {
          "data-kind": "missing",
          "data-step-id": node.stepId,
          "data-problems": "0",
        };
        return {
          ...common,
          type: "missing",
          domAttributes: marks,
          data: {
            isSelected,
            opens: opensByMissingId.get(node.id) ?? null,
          },
        } satisfies MissingFlowNode;
      }

      const marks: NodeMarks = {
        "data-kind": node.isStart ? "start" : node.isEnding ? "ending" : "step",
        "data-step-id": node.stepId,
        "data-problems": String(stepProblems.length),
      };

      return {
        ...common,
        type: "step",
        domAttributes: marks,
        data: {
          title: node.title,
          isStart: node.isStart,
          isEnding: node.isEnding,
          outcomeLabel:
            node.outcomeId !== null
              ? (document.outcomes[node.outcomeId]?.label ?? null)
              : null,
          outcomeColor: outcomeColor(node.outcomeIndex),
          problems: stepProblems,
          isSelected,
          opens: node.stepId,
        },
      } satisfies StepFlowNode;
    });

    const flowEdges: Edge[] = layout.edges.map((edge) => {
      const label = choiceLabel(edge.label);
      const marked = (addressed.choices.get(edge.id) ?? []).length > 0;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        label,
        ariaLabel: `${label}: ${titleById.get(edge.source) ?? ""} → ${titleById.get(edge.target) ?? ""}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        className: marked ? "canvas-edge-problem" : undefined,
        style: marked
          ? { stroke: "var(--destructive)", strokeWidth: 2 }
          : undefined,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [addressed, document.outcomes, layout, selectedStepId]);

  const { fitView } = useReactFlow();

  // A Step added or removed changes which boxes there are to see, and a new
  // one can land off-screen; anything else (a rename, a mark appearing) leaves
  // the view exactly where the Author put it.
  const nodeIdKey = nodes
    .map((node) => node.id)
    .sort()
    .join(" ");
  const lastNodeIdKey = useRef(nodeIdKey);
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
      colorMode={colorMode}
      nodesDraggable={false}
      nodesConnectable={false}
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
        <div className="flex items-center gap-3 rounded-lg bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-foreground/10">
          <LegendEntry swatch="bg-primary">Start</LegendEntry>
          <LegendEntry swatch="bg-muted-foreground">Ending</LegendEntry>
          <LegendEntry swatch="bg-destructive">Problem</LegendEntry>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function JourneyCanvas(props: JourneyCanvasProps) {
  return (
    <section
      aria-label="Canvas"
      className="h-[36rem] overflow-hidden rounded-xl ring-1 ring-foreground/10"
    >
      <ReactFlowProvider>
        <CanvasFlow {...props} />
      </ReactFlowProvider>
    </section>
  );
}
