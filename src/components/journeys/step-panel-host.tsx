"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { PHONE_QUERY } from "@/components/journeys/use-panel-visibility";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/media-query";

/**
 * Where the Step panel is put (ticket 53): one `StepPanel`, two containers.
 * On a phone — narrower than `sm` — the panel is a bottom sheet over the
 * map, opened by opening a Step and closed by `onClose`, which there is the
 * editor's `dismissSheet`: the unmount save runs as it does for the column.
 * At `sm` and wider nothing changes: the panel's own column, beside the map
 * from `lg` and stacked under it below that.
 *
 * The sheet covers no more than 55% of the screen and leaves the page behind
 * it clear — tinted, not blurred — because the strip of map above it is how
 * the Author keeps their place: opening it scrolls the map's frame up under
 * the sticky navbar, and the part of the frame the sheet then covers is
 * reported through `onCover` (0 whenever there is no sheet), so the map
 * centres the opened Step's box in what is left in sight.
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
  mapFrame,
  onCover,
  children,
}: {
  open: boolean;
  /** The sheet closed: Close, Escape, or a tap on the page behind it. */
  onClose: () => void;
  /** The column, which a stacked panel is scrolled to. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** The open Step's name, as the sheet announces it. */
  title: string;
  /** The map's frame, which an opened sheet brings on screen above it. */
  mapFrame: () => HTMLElement | null;
  /** Pixels of the map's frame hidden under the sheet. */
  onCover: (pixels: number) => void;
  children: ReactNode;
}) {
  // False through the server render and hydration, so both draw the column;
  // a phone swaps to the sheet straight after.
  const phone = useMediaQuery(PHONE_QUERY);
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);

  // The sheet coming up: the map's frame scrolled to the top of the screen,
  // under the sticky navbar (`scroll-padding-top` in `globals.css`), before
  // the dialog locks the page's scroll; then, for as long as the sheet is
  // up, how much of the frame it covers, measured again whenever the
  // sheet's height changes. The sheet sits on the foot of the viewport, so
  // its top is the viewport's height less its own, which a slide still in
  // progress does not change.
  useLayoutEffect(() => {
    if (!phone || !open || popup === null) return;
    const frame = mapFrame();
    if (frame === null) return;

    frame.scrollIntoView({ block: "start" });
    const observer = new ResizeObserver(() => {
      const sheetTop =
        document.documentElement.clientHeight - popup.offsetHeight;
      const { top, bottom } = frame.getBoundingClientRect();
      onCover(
        Math.round(Math.min(Math.max(bottom - sheetTop, 0), bottom - top)),
      );
    });
    observer.observe(popup);
    return () => {
      observer.disconnect();
      onCover(0);
    };
  }, [mapFrame, onCover, open, phone, popup]);

  if (phone) {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent
          ref={setPopup}
          data-step-sheet=""
          className="max-h-[55dvh]"
          bodyClassName="px-2 pb-4"
          backdropClassName="bg-black/5"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {children}
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
