/**
 * The one autosave loop the Author's editing surfaces share: the Draft
 * editor's model (ticket 46 lifted it here for the metadata forms), with no
 * React or DOM in it so it can be tested with a clock.
 *
 * An edit is written once typing pauses for `SAVE_DEBOUNCE_MS`; a flush —
 * focus leaving the surface — writes it now; leaving the page writes it on
 * the way out. One write runs at a time with at most one waiting behind
 * it: an edit during a write is picked up as whatever the value has become
 * rather than queued per keystroke. Last write wins, as it does everywhere
 * in the app.
 */

/** Long enough that a sentence is one save, short enough to feel immediate. */
export const SAVE_DEBOUNCE_MS = 600;

export type SaveStatus = "saved" | "saving" | "unsaved";

/** What each state reads as, on every surface that shows one. */
export const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
};

/**
 * What a write came back with. `saved`: the server stored it, and when it
 * hands back what it stored (server-owned state, or the value as stored)
 * that becomes the baseline instead of the value sent. `refused`: nothing
 * was stored, with the reason and, for a Draft, the Step it is about.
 */
export type WriteResult<T> =
  | { kind: "saved"; saved?: T }
  | { kind: "refused"; error: string; stepId?: string };

export type WriteRefusal<T> = Extract<WriteResult<T>, { kind: "refused" }>;

export type Autosave<T> = {
  /** The value has changed: shown as unsaved, written once typing pauses. */
  change(value: T): void;
  /** Writes whatever is unsaved now, waiting out a write already running. */
  flush(): Promise<void>;
  /**
   * The server's values arriving on a refresh. With nothing unsaved they are
   * adopted as the value and the baseline both. With an edit in hand they
   * become the baseline and `keep` says what the value becomes over them —
   * by default the edit stays exactly as it is, so the next write carries
   * it, as last write wins.
   */
  adopt(incoming: T, keep?: (incoming: T, current: T, lastSaved: T) => T): void;
  /** Whether anything typed has not reached the server. */
  isDirty(): boolean;
  /** What the loop holds and what it last wrote: seams for the tests. */
  current(): T;
  lastSaved(): T;
  /**
   * The surface going away: the timer's write made now, through the same
   * loop, so a write already running is asked to go round once more.
   */
  dispose(): void;
  /**
   * The page going away: a best-effort write of what is unsaved, and whether
   * the browser should ask before it lets the page go. Neither the attempt
   * nor the answer is anything this can wait for. The write goes through
   * the same single-flight path as every other: a write already running is
   * asked to go round once more rather than joined by a second beside it.
   */
  unload(): boolean;
};

export function createAutosave<T>({
  initial,
  equals,
  write,
  onStatus,
  onSaved,
  onRefused,
  debounceMs = SAVE_DEBOUNCE_MS,
}: {
  initial: T;
  /** Whether two values would be stored the same. */
  equals: (a: T, b: T) => boolean;
  /**
   * The write itself. `baseline` is the last saved value, the one the edit
   * was made against. A write that throws counts as refused, the server
   * not reached.
   */
  write: (value: T, baseline: T) => Promise<WriteResult<T>>;
  onStatus: (status: SaveStatus) => void;
  /** A write landed with nothing left to write: the caller's refresh. */
  onSaved: () => void;
  /** A write was refused: the caller shows why, the edit stays unsaved. */
  onRefused?: (result: WriteRefusal<T>) => void;
  /** The tests' clock; every surface uses `SAVE_DEBOUNCE_MS`. */
  debounceMs?: number;
}): Autosave<T> {
  let current = initial;
  let lastSaved = initial;
  let saving = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleSave() {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void save();
    }, debounceMs);
  }

  function isDirty() {
    return !equals(current, lastSaved);
  }

  async function save() {
    if (saving) {
      queued = true;
      return;
    }
    saving = true;

    try {
      for (;;) {
        const pending = current;
        if (equals(pending, lastSaved)) {
          onStatus("saved");
          return;
        }

        onStatus("saving");
        const result = await write(pending, lastSaved).catch(
          (): WriteResult<T> => ({
            kind: "refused",
            error: "the server could not be reached",
          }),
        );

        if (result.kind === "refused") {
          // Editing continues and the next edit retries; nothing typed is
          // thrown away because a write failed.
          onRefused?.(result);
          onStatus("unsaved");
          queued = false;
          return;
        }

        lastSaved = result.saved !== undefined ? result.saved : pending;

        if (!equals(current, pending)) {
          // Something arrived during the write: an edit, or another
          // Member's value adopted over it. A flush asked for it to be
          // written now; otherwise the edit's own timer is about to ask —
          // and an adoption has no timer, so one is set for it.
          if (queued) {
            queued = false;
            continue;
          }
          onStatus("unsaved");
          if (timer === null) scheduleSave();
          return;
        }
        queued = false;

        onStatus("saved");
        // Only with nothing left to write: a refresh landing mid-edit would
        // only be answered by another one.
        onSaved();
        return;
      }
    } finally {
      saving = false;
    }
  }

  return {
    change(value) {
      current = value;
      onStatus("unsaved");
      scheduleSave();
    },

    async flush() {
      clearTimer();
      while (saving) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await save();
    },

    adopt(incoming, keep) {
      if (!isDirty()) {
        current = incoming;
        lastSaved = incoming;
        return;
      }
      const before = lastSaved;
      lastSaved = incoming;
      if (keep) current = keep(incoming, current, before);
    },

    isDirty,
    current: () => current,
    lastSaved: () => lastSaved,

    dispose() {
      clearTimer();
      if (isDirty()) void save();
    },

    unload() {
      if (!isDirty()) return false;
      if (saving) {
        // The write running now goes round once more for what is newer.
        queued = true;
        return true;
      }
      clearTimer();
      void save();
      return true;
    },
  };
}
