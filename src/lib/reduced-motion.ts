/**
 * How long a map's own pan-and-zoom move takes, unless a reader has asked
 * for less motion, when it takes none: Zoom to step, the fit after the map
 * turns a quarter or the panel slides, and a Step brought onto the map.
 * React Flow animates those in script, where the stylesheet's reduced-
 * motion rule cannot reach, so a reader who has asked for less motion is
 * asked here instead, at the moment of the move, and gets the view at once
 * (ticket 78's walk). Browser-only: read in event handlers and effects,
 * never during a server render.
 */
const MAP_MOVE_MS = 200;

export function mapMoveDuration(): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : MAP_MOVE_MS;
}
