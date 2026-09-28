"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  PANEL_STORAGE_KEY,
  readPreference,
  writePreference,
} from "@/lib/browser-preferences";

/**
 * Whether the Draft editor's Step panel is beside the map: put away and
 * brought back by the Author (and remembered by the browser), brought back
 * by any opening of a Step (and not remembered), the whole-map fit the
 * Author's own toggles ask the map for, and the scroll to a panel stacked
 * under the map.
 */

/**
 * The widths at which the Step panel is beside the map: Tailwind's `lg`
 * (64rem), the very query the editor's grid below goes to two columns on.
 * Read as that query and not its complement so an engine that cannot read
 * the range syntax answers the same way for both: no side-by-side grid, so
 * a stacked panel, so the scroll.
 */
export const SIDE_BY_SIDE_QUERY = "(width >= 64rem)";

/**
 * The widths at which the Step panel is a bottom sheet over the map rather
 * than a column (ticket 53): phones, narrower than Tailwind's `sm` (40rem).
 */
export const PHONE_QUERY = "(width < 40rem)";

export function usePanelVisibility(): {
  panelShown: boolean;
  /** Counts the Author's own toggles; see `fitRequest` below. */
  fitRequest: number;
  hidePanel: () => void;
  showPanel: () => void;
  /**
   * The panel brought back by an opening; true when it was away, which is
   * an opening whose frame is about to narrow.
   */
  revealPanel: () => boolean;
  /** The panel's column, which a stacked panel is scrolled to. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** An opening from a click on the map asking for the stacked panel. */
  requestPanelScroll: () => void;
} {
  /**
   * Whether the panel is beside the map. Shown on the first render whatever
   * the browser remembers, so the server's render and the hydrating one agree
   * — what it remembers is read a moment later, on mount.
   */
  const [panelShown, setPanelShown] = useState(true);
  const panelShownRef = useRef(true);
  /**
   * Counts the times the Author put the panel away or brought it back, which
   * is the one change of the map's width they asked for. The map fits itself
   * to each width the sliding columns hand it, so the last fit lands on the
   * width it keeps; what is counted here is only that a change has begun. A
   * panel that comes back because a Step was opened is not counted: that
   * opening makes its own move to the Step, and the whole map is not what it
   * asked for.
   */
  const [fitRequest, setFitRequest] = useState(0);

  /**
   * The panel put away or brought back, and whether that moved it: `remember`
   * says whether this is the Author choosing how to read the map — "Hide
   * panel", "Show panel", Escape — which is what the browser keeps; the panel
   * coming back because a Step was opened is the editing gesture doing its
   * job, and leaves the choice the Author made standing for the next page.
   * Nothing is said when the panel is already where it is asked to be:
   * opening a Step asks for it every time.
   */
  const applyPanelShown = useCallback(
    (shown: boolean, { remember }: { remember: boolean }): boolean => {
      if (panelShownRef.current === shown) return false;
      panelShownRef.current = shown;
      setPanelShown(shown);
      if (!remember) return true;

      // Reading the map with the panel out of the way is how one Author is
      // looking at the Journey right now, not something about the Journey:
      // the browser keeps it, never the document, where it would follow
      // every other Member around.
      writePreference(PANEL_STORAGE_KEY, shown ? "shown" : "hidden");
      return true;
    },
    [],
  );

  /**
   * The Author putting the panel away, and asking for it back: the one move
   * of the panel the map fits itself again for, because the width they gave
   * it or took back is the frame they mean to read the whole map in. A panel
   * that comes back for an opened Step is not this: the frame narrows,
   * nothing re-fits, and the opening makes its own move to the Step.
   */
  const setPanelByAuthor = useCallback(
    (shown: boolean) => {
      if (!applyPanelShown(shown, { remember: true })) return;
      setFitRequest((current) => current + 1);
    },
    [applyPanelShown],
  );
  const hidePanel = useCallback(
    () => setPanelByAuthor(false),
    [setPanelByAuthor],
  );
  const showPanel = useCallback(
    () => setPanelByAuthor(true),
    [setPanelByAuthor],
  );
  /** The panel brought back by an opening rather than asked for. */
  const revealPanel = useCallback(
    () => applyPanelShown(true, { remember: false }),
    [applyPanelShown],
  );

  // What this browser last chose, read once the page is the browser's: the
  // server cannot know it, and a first render that assumed it would not be
  // the render the server sent. Nothing is written back — this is what is
  // already stored.
  //
  // A phone starts with the panel away whatever is stored: there the panel
  // is a sheet over the map, and one covering the page before the Author
  // has opened anything is not a panel beside their work but a wall in
  // front of it. Opening a Step brings it up, as it brings the column back.
  useEffect(() => {
    if (
      readPreference(PANEL_STORAGE_KEY) === "hidden" ||
      window.matchMedia(PHONE_QUERY).matches
    ) {
      applyPanelShown(false, { remember: false });
    }
  }, [applyPanelShown]);

  /**
   * The panel's column, and a count of the openings that asked for it to be
   * scrolled to. An opening from a click on the map asks; the effect below
   * answers once the panel is rendered, and only where the panel is stacked
   * under the map.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelScrollRequest, setPanelScrollRequest] = useState(0);
  const requestPanelScroll = useCallback(
    () => setPanelScrollRequest((current) => current + 1),
    [],
  );

  // Where the panel is stacked under the map — the page narrower than the
  // `lg` breakpoint the editor's grid puts the two side by side from — a
  // click on the map is followed by the page scrolling the panel's top into
  // view, under the sticky rows: the map is at least 36rem tall, so the
  // panel starts below the fold and nothing else brings it on. The panel is
  // rendered by the time this runs, brought back for the opening if it was
  // away. Read as a media query, the same one the grid answers to, never as
  // a width. `scroll-padding-top` on the page (`globals.css`) is what keeps
  // the panel's top from landing under the navbar and the tab row.
  useEffect(() => {
    if (panelScrollRequest === 0) return;
    if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
    // A phone's panel is a sheet that comes up over the map: nothing to
    // scroll to.
    if (window.matchMedia(PHONE_QUERY).matches) return;
    panelRef.current?.scrollIntoView({ block: "start" });
  }, [panelScrollRequest]);

  return {
    panelShown,
    fitRequest,
    hidePanel,
    showPanel,
    revealPanel,
    panelRef,
    requestPanelScroll,
  };
}
