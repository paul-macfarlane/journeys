"use client";

import type { ReactNode, RefObject } from "react";

import { PHONE_QUERY } from "@/components/journeys/use-panel-visibility";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/media-query";

/**
 * Where the Step panel is put (ticket 53): one `StepPanel`, two containers.
 * On a phone — narrower than `sm` — the panel is a bottom sheet over the
 * map, opened by opening a Step and closed the way the panel is put away
 * (`onClose` is the editor's `hidePanel`), so the unmount save runs as it
 * does for the column. At `sm` and wider nothing changes: the panel's own
 * column, beside the map from `lg` and stacked under it below that.
 *
 * The sheet's title is for assistive technology alone: the panel's title
 * field is the Step's name on it, and a heading repeating it would be read
 * twice.
 */
export function StepPanelHost({
  open,
  onClose,
  panelRef,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The column, which a stacked panel is scrolled to. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** The open Step's name, as the sheet announces it. */
  title: string;
  children: ReactNode;
}) {
  // False through the server render and hydration, so both draw the column;
  // a phone swaps to the sheet straight after.
  const phone = useMediaQuery(PHONE_QUERY);

  if (phone) {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent data-step-sheet="" className="px-2 pt-0 pb-4">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {/* Clear of the Close button in the corner. */}
          <div className="pt-6">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Nothing of a panel that is away is left behind to be tabbed into or
  // read out: the column closes over it and it is not rendered.
  return (
    <div ref={panelRef} className="min-w-0 overflow-hidden">
      {open ? children : null}
    </div>
  );
}
