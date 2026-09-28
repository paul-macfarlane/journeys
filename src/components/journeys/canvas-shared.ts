import { Position, type ColorMode } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import type { LayoutDirection } from "@/lib/graph/document";

/**
 * What the two maps of a Journey (`journey-canvas.tsx`, `analytics-canvas.tsx`)
 * draw with, besides the pure geometry in `@/lib/graph/geometry`: a
 * client-only color mode for React Flow, which side of a box every handle
 * and loop uses, the arrow keys as `ArrowDirection`s, and the whole-map fit
 * both maps share.
 */

/** Which way an arrow key asks to go. */
export type ArrowDirection = "up" | "down" | "left" | "right";

/**
 * The arrow keys, by the direction each asks for: what the keyboard walks
 * across the boxes with on the editor's map, and moves between the two
 * answers of the direction control with on both maps.
 */
export const ARROW_DIRECTIONS: Record<string, ArrowDirection | undefined> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Where a Choice's arrow leaves the node: spread evenly along the side of the
 * box the arrows travel towards — along its bottom running top to bottom,
 * down its right running left to right.
 */
export function handleOffset(index: number, count: number): string {
  return `${((index + 1) / (count + 1)) * 100}%`;
}

/** The side every arrow leaves a box from, which way round the map is drawn. */
export function sourceSide(direction: LayoutDirection): Position {
  return direction === "LR" ? Position.Right : Position.Bottom;
}

/** And the side, opposite it, that every arrow arrives at. */
export function targetSide(direction: LayoutDirection): Position {
  return direction === "LR" ? Position.Left : Position.Top;
}

/**
 * The look of a box, whichever map it is on: the card that fills the node,
 * its content stacked and clipped. The editor's boxes are buttons and add
 * the pointer and focus ring on top of this; the Analytics map's are not.
 */
export const NODE_BOX_CLASS =
  "relative flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-xl bg-background px-3 py-2 text-left ring-inset";

/**
 * "Has this render happened in the browser?" — false through the server
 * render and the hydrating one, true afterwards. The store never changes, so
 * there is nothing to subscribe to; React re-renders once after hydration
 * because the client snapshot differs from the server's.
 */
const subscribeToNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

/**
 * Which color mode React Flow draws the map in. next-themes reads the
 * browser's stored choice, which the server render cannot know, so until
 * the page is the browser's the answer is the one the server gave: "light",
 * as a definite mode rather than "system".
 *
 * Not "system", because of what React Flow makes of it while hydrating. Its
 * own hook answers "system" by asking `matchMedia` on the spot, which the
 * server cannot and the hydrating render can: with the OS dark the two
 * renders disagree about the class on the map, and React leaves the server's
 * attribute standing on a hydration mismatch rather than patching it. Every
 * later render then computes the same class as the hydrating one did and so
 * changes nothing, and the map stays stamped `light` for the life of the
 * page — which is how the dark theme's controls came up white, in React
 * Flow's light colours, on a full load with the OS dark (ticket 35); the
 * order contest `globals.css` describes is the other half of that ticket,
 * and gave the greys of React Flow's dark colours instead. A definite mode
 * gives the two renders the same answer, and the change to the real theme
 * afterwards is an ordinary update the DOM follows.
 *
 * The colours are the tokens' the whole time (`globals.css`), so the moment
 * before hydration is not a light map on a dark page; this class only
 * governs what React Flow's own dark rules still cover.
 */
export function useCanvasColorMode(): ColorMode {
  const { resolvedTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribeToNothing, isClient, isServer);
  return hydrated && resolvedTheme === "dark" ? "dark" : "light";
}

/**
 * The closest a whole-map fit comes in (ticket 79): a one-Step map fitted
 * without a ceiling is drawn with its box filling the frame and its title at
 * poster size. Every "show me all of it" move on both maps — the first
 * render, a turn of the direction, the panel put away or brought back, the
 * Controls' fit button — stops here. The moves that go to one box
 * ("Zoom to step", bringing a box onto the map) keep their own ceilings.
 */
export const WHOLE_MAP_MAX_ZOOM = 1.25;

/** `fitViewOptions` for a whole-map fit, one object for every render. */
export const WHOLE_MAP_FIT = { maxZoom: WHOLE_MAP_MAX_ZOOM } as const;
