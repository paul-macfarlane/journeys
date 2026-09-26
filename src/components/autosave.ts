import { useCallback, useEffect, useState } from "react";

import {
  createAutosave,
  type Autosave,
  type SaveStatus,
  type WriteRefusal,
  type WriteResult,
} from "@/lib/autosave";

type Handlers<T> = {
  write: (value: T, baseline: T) => Promise<WriteResult<T>>;
  onSaved: () => void;
  onRefused?: (result: WriteRefusal<T>) => void;
  onStale?: () => void;
};

/**
 * Set once a Member has chosen Reload: from then on no loop on the page asks
 * the browser to hold the page for an unsaved edit, because the Member has
 * already been told nothing more can be saved (ticket 73). Module state
 * rather than per loop, since one page can hold several — the Project
 * Settings tab has three.
 */
let reloading = false;

/**
 * Reloads the page for a Member whose save was refused as stale, without
 * the browser asking whether to leave: every loop's `beforeunload` guard
 * stands down first. The one way out of the stale state.
 */
export function reloadPage(): void {
  reloading = true;
  window.location.reload();
}

/**
 * The autosave loop (`src/lib/autosave.ts`) as a surface uses it: one loop
 * for the life of the component, its status as state for the line beside
 * the fields, the timer's write made on unmount, and the browser asked
 * before the page goes while an edit is unsaved. The Draft editor, the
 * metadata forms (`useAutosavedForm`), and the rich-text Project
 * description are the callers.
 *
 * `write`, `onSaved`, `onRefused`, and `onStale` are read fresh on every
 * call rather than closed over: they carry the caller's router and props,
 * which change per render, while the loop is created once. `equals` and
 * `rebase` are read once, with the loop.
 */
export function useAutosave<T>({
  initial,
  equals,
  rebase,
  write,
  onSaved,
  onRefused,
  onStale,
}: {
  /** What the server holds when the surface mounts. */
  initial: T;
  /** Whether two values would be stored the same. */
  equals: (a: T, b: T) => boolean;
  /** The baseline once a write lands; see `createAutosave`. */
  rebase?: (saved: T, sentBaseline: T, currentBaseline: T) => T;
  /** The write itself, against the last saved value; see `createAutosave`. */
  write: (value: T, baseline: T) => Promise<WriteResult<T>>;
  /** A write landed with nothing left to write: typically a router refresh. */
  onSaved: () => void;
  /** A write was refused: where the surface shows why. */
  onRefused?: (result: WriteRefusal<T>) => void;
  /** A write was refused as stale; `status` says so too. */
  onStale?: () => void;
}): {
  status: SaveStatus;
  autosave: Autosave<T>;
  /**
   * Reloads the page without the browser asking: this loop's `beforeunload`
   * guard (and every other loop's) stands down first. What a stale
   * surface's Reload button calls.
   */
  reload: () => void;
} {
  const [status, setStatus] = useState<SaveStatus>("saved");

  // Created once, for the life of the surface: the loop holds the timer and
  // the value in flight, neither of which a render may replace. Its
  // handlers are the caller's latest, handed over after each render.
  const [{ autosave, setHandlers }] = useState(() =>
    startAutosave(initial, equals, rebase, setStatus, {
      write,
      onSaved,
      onRefused,
      onStale,
    }),
  );
  useEffect(() => {
    setHandlers({ write, onSaved, onRefused, onStale });
  }, [setHandlers, write, onSaved, onRefused, onStale]);

  // Unmounting with an edit still in the debounce window — the Author
  // opened another tab — is the timer's write made now, through the same
  // loop, and the refresh at the end is what hands the next mount of the
  // surface the values as saved.
  useEffect(() => () => autosave.dispose(), [autosave]);

  // Leaving the page with an edit still in the window: the write is
  // attempted, and the browser asks before the page goes, because neither
  // the attempt nor the answer is something this can wait for.
  // A stale loop writes nothing here but still asks, so an accidental
  // navigation does not take the refused edit with it; only Reload is let
  // through without asking.
  const [handleBeforeUnload] = useState(() => (event: BeforeUnloadEvent) => {
    if (reloading) return;
    if (autosave.unload()) event.preventDefault();
  });
  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  const reload = useCallback(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    reloadPage();
  }, [handleBeforeUnload]);

  return { status, autosave, reload };
}

/**
 * The loop, with a handle for replacing what it calls. Nothing here runs
 * during a render: the loop calls `write` from its timer and from a flush,
 * and `onSaved`, `onRefused`, or `onStale` after a write has settled. A ref
 * would be the usual home for the latest handlers, but the React
 * compiler's lint reads a ref handed to a `useState` initializer as a ref
 * read during render; this closure is the same thing said in a way it can
 * follow.
 */
function startAutosave<T>(
  initial: T,
  equals: (a: T, b: T) => boolean,
  rebase: ((saved: T, sentBaseline: T, currentBaseline: T) => T) | undefined,
  onStatus: (status: SaveStatus) => void,
  first: Handlers<T>,
): { autosave: Autosave<T>; setHandlers: (next: Handlers<T>) => void } {
  let handlers = first;
  return {
    autosave: createAutosave<T>({
      initial,
      equals,
      rebase,
      write: (value, baseline) => handlers.write(value, baseline),
      onStatus,
      onSaved: () => handlers.onSaved(),
      onRefused: (result) => handlers.onRefused?.(result),
      onStale: () => handlers.onStale?.(),
    }),
    setHandlers: (next) => {
      handlers = next;
    },
  };
}
