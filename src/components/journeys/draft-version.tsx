"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * The Draft version the Member holds (ticket 73), which a publish and a
 * restore on the Journey page are guarded by: the open Draft editor's, which
 * knows the moment its own save lands, else the page's.
 *
 * Read on demand rather than rendered, and only once the editor has written
 * what it has. Clicking Publish straight after an edit blurs the editor,
 * which starts that edit's save at the version the editor holds; a publish
 * sent with the same version would reach the server after the save and be
 * refused as stale, to a Member editing alone. So a publish or restore first
 * waits for the editor's flush — the save running, and anything still
 * unsaved — and then reads the version it left behind. An editor that has
 * just unmounted (the Author opened the Versions tab) may still have its
 * unmount save in flight, so it is waited for too.
 */

/** What the open Draft editor hands the page: its flush, and its version. */
export type DraftHandle = {
  /** Writes whatever is unsaved, waiting out a save already running. */
  flush: () => Promise<void>;
  /** The version the editor last stored or adopted. */
  version: () => number;
};

type DraftVersionValue = {
  /** Registers the open editor; the returned function marks it closed. */
  register: (handle: DraftHandle) => () => void;
  /** The version to send, once the editor's pending save has landed. */
  settledVersion: () => Promise<number>;
};

const DraftVersionContext = createContext<DraftVersionValue | null>(null);

/**
 * Holds the page's Draft version and the open editor's handle for
 * everything beneath it. Rendered by `PublishScope`.
 */
export function DraftVersionScope({
  draftVersion,
  children,
}: {
  /** The Draft version the page read. */
  draftVersion: number;
  children: ReactNode;
}) {
  const pageVersion = useRef(draftVersion);
  useEffect(() => {
    pageVersion.current = draftVersion;
  }, [draftVersion]);

  // The last editor to register, and whether it is still open. A closed
  // one is kept for its unmount save, which may not have landed yet.
  const editor = useRef<{ handle: DraftHandle; open: boolean } | null>(null);

  const register = useCallback((handle: DraftHandle) => {
    const entry = { handle, open: true };
    editor.current = entry;
    return () => {
      entry.open = false;
    };
  }, []);

  const settledVersion = useCallback(async () => {
    const entry = editor.current;
    if (entry === null) return pageVersion.current;
    await entry.handle.flush();
    const held = entry.handle.version();
    // While open, the editor's version is the Member's, even when older
    // than the page's: an edit in hand was made against it. Once closed,
    // whichever is newer — its own last save, or the page's refresh since.
    return entry.open ? held : Math.max(held, pageVersion.current);
  }, []);

  const value = useMemo(
    () => ({ register, settledVersion }),
    [register, settledVersion],
  );

  return (
    <DraftVersionContext.Provider value={value}>
      {children}
    </DraftVersionContext.Provider>
  );
}

const registerNothing = () => () => {};

/**
 * How the Draft editor registers its flush and version with the Journey
 * page's publish and restore controls. Outside a scope nothing listens.
 */
export function useRegisterDraft(): (handle: DraftHandle) => () => void {
  return useContext(DraftVersionContext)?.register ?? registerNothing;
}

/**
 * The Draft version a publish or a restore is sent with, read once the open
 * editor (or the one just closed) has written what it has.
 */
export function useSettledDraftVersion(): () => Promise<number> {
  const scope = useContext(DraftVersionContext);
  if (scope === null) {
    throw new Error(
      "useSettledDraftVersion must be rendered inside DraftVersionScope",
    );
  }
  return scope.settledVersion;
}
