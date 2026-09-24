import { useEffect, useState } from "react";

import { createAutosave, type Autosave, type SaveStatus } from "@/lib/autosave";

type Handlers<T> = {
  write: (value: T) => Promise<boolean>;
  onSettled: () => void;
};

/**
 * The autosave loop (`src/lib/autosave.ts`) as a surface uses it: one loop
 * for the life of the component, its status as state for the line beside
 * the fields, the timer's write made on unmount, and the browser asked
 * before the page goes while an edit is unsaved. The metadata forms
 * (`useAutosavedForm`) and the rich-text Project description are the
 * callers; the Draft editor keeps its own copy of the same loop.
 *
 * `write` and `onSettled` are read fresh on every call rather than closed
 * over: they carry the caller's router and props, which change per render,
 * while the loop is created once.
 */
export function useAutosave<T>({
  initial,
  equals,
  write,
  onSettled,
}: {
  /** What the server holds when the surface mounts. */
  initial: T;
  /** Whether two values would be stored the same. */
  equals: (a: T, b: T) => boolean;
  /** The write itself; resolves to whether the server accepted it. */
  write: (value: T) => Promise<boolean>;
  /** A write landed with nothing left to write: typically a router refresh. */
  onSettled: () => void;
}): { status: SaveStatus; autosave: Autosave<T> } {
  const [status, setStatus] = useState<SaveStatus>("saved");

  // Created once, for the life of the surface: the loop holds the timer and
  // the value in flight, neither of which a render may replace. Its
  // handlers are the caller's latest, handed over after each render.
  const [{ autosave, setHandlers }] = useState(() =>
    startAutosave(initial, equals, setStatus, { write, onSettled }),
  );
  useEffect(() => {
    setHandlers({ write, onSettled });
  }, [setHandlers, write, onSettled]);

  // Unmounting with an edit still in the debounce window — the Author
  // opened another tab — is the timer's write made now, through the same
  // loop, and the refresh at the end is what hands the next mount of the
  // surface the values as saved.
  useEffect(() => () => autosave.dispose(), [autosave]);

  // Leaving the page with an edit still in the window: the write is
  // attempted, and the browser asks before the page goes, because neither
  // the attempt nor the answer is something this can wait for.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (autosave.unload()) event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [autosave]);

  return { status, autosave };
}

/**
 * The loop, with a handle for replacing what it calls. Nothing here runs
 * during a render: the loop calls `write` from its timer and from a flush,
 * and `onSettled` after a write has landed.
 */
function startAutosave<T>(
  initial: T,
  equals: (a: T, b: T) => boolean,
  onStatus: (status: SaveStatus) => void,
  first: Handlers<T>,
): { autosave: Autosave<T>; setHandlers: (next: Handlers<T>) => void } {
  let handlers = first;
  return {
    autosave: createAutosave<T>({
      initial,
      equals,
      write: (value) => handlers.write(value),
      onStatus,
      onSettled: () => handlers.onSettled(),
    }),
    setHandlers: (next) => {
      handlers = next;
    },
  };
}
