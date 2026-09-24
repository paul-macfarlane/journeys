"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One segment: its answer, the name a reader hears, and an optional icon. */
export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  /**
   * When given, the segment shows the icon alone and carries the label as
   * its accessible name; without one, the label is written out.
   */
  icon?: ReactNode;
}

/**
 * Which arrow keys move along the row. `horizontal` (the default) takes Left
 * and Right, leaving Up and Down to whatever holds the control — inside a
 * menu they walk its items. `all` takes the vertical pair too, the way a
 * radio group does when nothing around it wants them.
 */
export type SegmentArrowKeys = "horizontal" | "all";

const HORIZONTAL_STEPS: Record<string, 1 | -1 | undefined> = {
  ArrowRight: 1,
  ArrowLeft: -1,
};

const VERTICAL_STEPS: Record<string, 1 | -1 | undefined> = {
  ArrowDown: 1,
  ArrowUp: -1,
};

/**
 * The segment an arrow key moves to from `current`, wrapping at both ends,
 * or `null` when the key is not one this control takes or `current` is not
 * a segment. Pure, so the movement is testable apart from the DOM.
 */
export function nextSegmentValue<V extends string>(
  values: readonly V[],
  current: string,
  key: string,
  arrowKeys: SegmentArrowKeys = "horizontal",
): V | null {
  const step =
    HORIZONTAL_STEPS[key] ??
    (arrowKeys === "all" ? VERTICAL_STEPS[key] : undefined);
  if (step === undefined) return null;

  const index = values.indexOf(current as V);
  if (index === -1) return null;

  return values[(index + step + values.length) % values.length] ?? null;
}

/**
 * One choice with one answer, laid out as a row of segments: a radio group
 * whose radios are buttons, so it reads as the choice it is and paints the
 * checked answer at a glance in either theme (ticket 48's direction control,
 * ticket 51's theme row).
 *
 * One tab stop, as a radio group is: the checked segment is the tab stop and
 * the others are skipped, and an arrow key moves onto the next one and
 * chooses it. The checked segment is painted from its `aria-checked`, in the
 * primary pair; the unchecked ones are quiet secondary buttons that sit flush
 * in the group's own pill. The outline button is not used because its dark
 * theme paints its own background over anything a checked state adds.
 */
export function SegmentedControl<V extends string>({
  label,
  value,
  onValueChange,
  options,
  arrowKeys = "horizontal",
  size = "sm",
  className,
  segmentClassName,
}: {
  /** The group's accessible name. */
  label: string;
  value: V;
  onValueChange: (value: V) => void;
  options: readonly SegmentOption<V>[];
  arrowKeys?: SegmentArrowKeys;
  size?: "sm" | "icon-sm";
  className?: string;
  segmentClassName?: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  // A radio group always has one tab stop: the checked segment, or the first
  // when nothing is checked, so the control never drops out of the tab order.
  const anyChecked = options.some((option) => option.value === value);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const next = nextSegmentValue(
      options.map((option) => option.value),
      value,
      event.key,
      arrowKeys,
    );
    if (next === null) return;

    // Otherwise the browser scrolls the page, and whatever holds the control
    // (a menu, a map) would read the same key as its own.
    event.preventDefault();
    event.stopPropagation();

    onValueChange(next);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-segment="${CSS.escape(next)}"]`)
      ?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5",
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const tabStop = checked || (!anyChecked && index === 0);
        return (
          <Button
            key={option.value}
            variant="secondary"
            size={size}
            role="radio"
            aria-checked={checked}
            aria-label={option.icon === undefined ? undefined : option.label}
            tabIndex={tabStop ? 0 : -1}
            data-segment={option.value}
            onClick={() => onValueChange(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "aria-checked:bg-primary aria-checked:text-primary-foreground aria-checked:hover:bg-primary/80",
              segmentClassName,
            )}
          >
            {option.icon === undefined ? (
              option.label
            ) : (
              <span aria-hidden className="contents">
                {option.icon}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
