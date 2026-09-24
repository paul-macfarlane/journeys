"use client";

import { useRef, type KeyboardEvent } from "react";

import { ARROW_DIRECTIONS } from "@/components/journeys/canvas-shared";
import { Button } from "@/components/ui/button";
import type { LayoutDirection } from "@/lib/graph/document";

/** The two ways the map can be drawn, in the order the control offers them. */
const LAYOUT_DIRECTIONS: { direction: LayoutDirection; label: string }[] = [
  { direction: "TB", label: "Top to bottom" },
  { direction: "LR", label: "Left to right" },
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
 * One tab stop, as a radio group is: the checked direction is the tab stop and
 * the other is skipped, and an arrow key moves onto the other and chooses it,
 * which is what arrow keys do in a radio group.
 *
 * The checked one is painted from its `aria-checked`, in the primary pair, so
 * the answer reads at a glance in either theme; the unchecked one is the
 * quiet secondary button. The outline button is not used here because its
 * dark theme paints its own background over anything a checked state adds.
 */
export function DirectionControl({
  direction,
  onSetLayoutDirection,
}: {
  direction: LayoutDirection;
  onSetLayoutDirection: (direction: LayoutDirection) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (ARROW_DIRECTIONS[event.key] === undefined) return;
    // Otherwise the browser scrolls the page and React Flow pans the map.
    event.preventDefault();

    const other = LAYOUT_DIRECTIONS.find(
      (entry) => entry.direction !== direction,
    );
    if (other === undefined) return;

    onSetLayoutDirection(other.direction);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-direction="${other.direction}"]`,
      )
      ?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Layout direction"
      className="flex items-center gap-1"
    >
      {LAYOUT_DIRECTIONS.map((entry) => {
        const checked = entry.direction === direction;
        return (
          <Button
            key={entry.direction}
            variant="secondary"
            size="sm"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-direction={entry.direction}
            onClick={() => onSetLayoutDirection(entry.direction)}
            onKeyDown={handleKeyDown}
            className="aria-checked:bg-primary aria-checked:text-primary-foreground aria-checked:hover:bg-primary/80"
          >
            {entry.label}
          </Button>
        );
      })}
    </div>
  );
}
