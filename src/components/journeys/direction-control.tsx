"use client";

import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/segmented-control";
import type { LayoutDirection } from "@/lib/graph/document";

/** The two ways the map can be drawn, in the order the control offers them. */
const LAYOUT_DIRECTIONS: readonly SegmentOption<LayoutDirection>[] = [
  { value: "TB", label: "Top to bottom" },
  { value: "LR", label: "Left to right" },
];

/**
 * Which way a map runs: a radio group, because the two are one choice with
 * one answer. The same control on both maps of a Journey, with a different
 * answer behind it: on the editor's Canvas the answer is the Draft's —
 * switching it is an edit like any other, stored on the Journey and seen by
 * every Member of the project — and on the Analytics map it is this
 * browser's, a way of reading a Published Version that nothing about the
 * version is changed by.
 *
 * The shared segmented control (ticket 51) with every arrow key taken: on
 * the canvas nothing else wants them, and left to the browser they would
 * scroll the page and pan the map.
 */
export function DirectionControl({
  direction,
  onSetLayoutDirection,
}: {
  direction: LayoutDirection;
  onSetLayoutDirection: (direction: LayoutDirection) => void;
}) {
  return (
    <SegmentedControl
      label="Layout direction"
      value={direction}
      onValueChange={onSetLayoutDirection}
      options={LAYOUT_DIRECTIONS}
      arrowKeys="all"
    />
  );
}
