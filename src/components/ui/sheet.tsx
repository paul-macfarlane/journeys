"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet: Base UI's dialog, as `dialog.tsx` wraps it, drawn from the
 * bottom edge instead of the middle of the screen. Sized to its content up
 * to 85% of the viewport's height by default — `className` sets another cap —
 * so a strip of the page stays in sight above it. A header row that never
 * scrolls holds the grab handle, which says what the sheet is, and the Close
 * button, which is how it goes away along with Escape and a tap on the page
 * behind; what is taller than the sheet scrolls in the body under it.
 */

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
  className,
  bodyClassName,
  backdropClassName,
  children,
  ...props
}: SheetPrimitive.Popup.Props & {
  /** The scrolling body's own classes: its padding, for one. */
  bodyClassName?: string;
  /**
   * How the page behind the sheet is drawn: dimmed and blurred unless a
   * sheet that means the page to stay readable says otherwise.
   */
  backdropClassName?: string;
}) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className={cn(
          "fixed inset-0 isolate z-50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          backdropClassName ??
            "bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        )}
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        <div
          data-slot="sheet-header"
          className="relative flex h-10 shrink-0 justify-center"
        >
          <div
            aria-hidden="true"
            data-slot="sheet-handle"
            className="mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/40"
          />
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </div>
        <div
          data-slot="sheet-body"
          className={cn(
            "min-h-0 overflow-y-auto overscroll-contain",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle };
