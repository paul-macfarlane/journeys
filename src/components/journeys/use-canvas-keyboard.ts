"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import type { ArrowDirection } from "@/components/journeys/canvas-shared";
import {
  dialogIsOpen,
  type SelectCommand,
} from "@/components/journeys/editor-shared";
import type { CanvasFlowNode } from "@/components/journeys/step-node";

/**
 * The editor's map at the keyboard (`journey-canvas.tsx`): the arrow keys
 * walking from box to nearest box, Escape stepping out of the boxes onto the
 * map itself, and the check the map's own Delete key makes before it takes
 * the arrow in hand. The keys on a box itself are `boxKeyDown`'s
 * (`step-node.tsx`), which hands the first two here.
 */

/**
 * How much a box's offset to the side counts against the distance to it when
 * an arrow key asks for the nearest one: enough that the box straight ahead
 * wins over a closer one away to the side, which is what "that way" means.
 */
const ACROSS_WEIGHT = 2;

export function useCanvasKeyboard({
  nodes,
  canvasRef,
  bringOntoMap,
  onSelect,
}: {
  /** The boxes as drawn, which the arrow keys walk across. */
  nodes: CanvasFlowNode[];
  /** The Canvas itself, which is what Escape hands the keyboard back to. */
  canvasRef: RefObject<HTMLElement | null>;
  /** From `useCanvasViewport`: a box walked onto off the map comes onto it. */
  bringOntoMap: (nodeId: string) => void;
  onSelect: (command: SelectCommand) => void;
}): {
  moveFocus: (fromNodeId: string, direction: ArrowDirection) => void;
  escape: () => void;
  beforeDelete: () => Promise<boolean>;
} {
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
    onSelect({ kind: "arrow", arrow: null });
    canvasRef.current?.focus();
  }, [canvasRef, onSelect]);

  // The Delete key with an arrow in hand, pressed while a dialog is open —
  // on the delete confirmation's own buttons, say — is the dialog's press,
  // not the map's: React Flow listens on the document and would otherwise
  // take the arrow from behind it.
  const beforeDelete = useCallback(async () => !dialogIsOpen(), []);

  return { moveFocus, escape, beforeDelete };
}
