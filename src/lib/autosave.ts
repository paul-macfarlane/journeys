/**
 * The one autosave loop the Author's editing surfaces share: the Draft
 * editor's model (ticket 46 lifted it here for the metadata forms), with no
 * React or DOM in it so it can be tested with a clock.
 *
 * An edit is written once typing pauses for `SAVE_DEBOUNCE_MS`; a flush —
 * focus leaving the surface — writes it now; leaving the page writes it on
 * the way out. One write runs at a time with at most one waiting behind
 * it: an edit during a write is picked up as whatever the value has become
 * rather than queued per keystroke.
 *
 * A write is made against the value it was edited from (`baseline`), and the
 * server refuses it as stale when another Member has changed that value
 * since (ticket 73). Stale is terminal: nothing is written again, the edit
 * stays on screen, and the Member reloads to see the other change. Nothing
 * is merged and nothing is retried.
 */

/** Long enough that a sentence is one save, short enough to feel immediate. */
export const SAVE_DEBOUNCE_MS = 600;

export type SaveStatus = "saved" | "saving" | "unsaved" | "stale";

/** What each state reads as, on every surface that shows one. */
export const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  stale: staleText(),
};

/** What a stale save was refused on, as the sentence names it. */
export type StaleNoun = "draft" | "project" | "journey";

/**
 * The sentence a Member reads when their save was refused because another
 * Member changed the same thing first, naming what was changed.
 */
export function staleText(noun?: StaleNoun): string {
  const what = noun === undefined ? "this" : `this ${noun}`;
  return `Someone else changed ${what} since you opened it. Reload to see their changes.`;
}

/**
 * What a write came back with. `saved`: the server stored it, and when it
 * hands back what it stored (server-owned state, or the value as stored)
 * that becomes the baseline instead of the value sent. `refused`: nothing
 * was stored, with the reason and, for a Draft, the Step it is about.
 * `stale`: nothing was stored because another Member changed what the
 * write was made against; terminal.
 */
export type WriteResult<T> =
  | { kind: "saved"; saved?: T }
  | { kind: "refused"; error: string; stepId?: string }
  | { kind: "stale" };

export type WriteRefusal<T> = Extract<WriteResult<T>, { kind: "refused" }>;

export type Autosave<T> = {
  /** The value has changed: shown as unsaved, written once typing pauses. */
  change(value: T): void;
  /** Writes whatever is unsaved now, waiting out a write already running. */
  flush(): Promise<void>;
  /**
   * The server's values arriving on a refresh. With nothing unsaved they are
   * adopted as the value and the baseline both. With an edit in hand, `keep`
   * says what the value and the baseline become (`keepEditedFields` for a
   * record of fields): the baseline must not move under an edit, or the
   * edit's write would pass a guard it should fail. Without `keep` nothing
   * is adopted while an edit is in hand. Once stale, nothing is adopted.
   */
  adopt(
    incoming: T,
    keep?: (incoming: T, current: T, lastSaved: T) => { value: T; baseline: T },
  ): void;
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
  onStale,
  rebase = (saved) => saved,
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
  /** A write was refused as stale: the loop has stopped for good. */
  onStale?: () => void;
  /**
   * The baseline once a write has landed: `saved` (what was stored, or the
   * value sent), `sentBaseline` (the baseline sent with the write), and
   * `currentBaseline` (the baseline at landing, which an `adopt` during the
   * write may have moved). By default what was stored replaces the whole
   * baseline; a record of fields keeps each adopted field the write did not
   * change (`rebaseWrittenFields`).
   */
  rebase?: (saved: T, sentBaseline: T, currentBaseline: T) => T;
  /** The tests' clock; every surface uses `SAVE_DEBOUNCE_MS`. */
  debounceMs?: number;
}): Autosave<T> {
  let current = initial;
  let lastSaved = initial;
  let saving = false;
  let queued = false;
  let stale = false;
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
    if (stale) return;
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
        const sentBaseline = lastSaved;
        const result = await write(pending, sentBaseline).catch(
          (): WriteResult<T> => ({
            kind: "refused",
            error: "the server could not be reached",
          }),
        );

        if (result.kind === "stale") {
          // Terminal: another Member changed what this edit was made
          // against. The edit stays where it is and nothing writes again.
          stale = true;
          queued = false;
          clearTimer();
          onStatus("stale");
          onStale?.();
          return;
        }

        if (result.kind === "refused") {
          // Editing continues and the next edit retries; nothing typed is
          // thrown away because a write failed.
          onRefused?.(result);
          onStatus("unsaved");
          queued = false;
          return;
        }

        lastSaved = rebase(
          result.saved !== undefined ? result.saved : pending,
          sentBaseline,
          lastSaved,
        );

        if (equals(current, pending)) {
          // Nothing arrived during the write: what was stored is what the
          // loop holds now, server-owned parts (a Draft's version) and all.
          current = lastSaved;
        } else {
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
      // Once stale, the edit is kept on screen but nothing will write it.
      if (stale) return;
      onStatus("unsaved");
      scheduleSave();
    },

    async flush() {
      if (stale) return;
      clearTimer();
      while (saving) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await save();
    },

    adopt(incoming, keep) {
      if (stale) return;
      if (!isDirty()) {
        current = incoming;
        lastSaved = incoming;
        return;
      }
      if (!keep) return;
      const kept = keep(incoming, current, lastSaved);
      current = kept.value;
      lastSaved = kept.baseline;
    },

    isDirty,
    current: () => current,
    lastSaved: () => lastSaved,

    dispose() {
      clearTimer();
      if (!stale && isDirty()) void save();
    },

    unload() {
      // Stale: nothing can be written, so the browser asks before the edit
      // on screen goes with the page.
      if (stale) return true;
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

/**
 * `adopt`'s `keep` for a record of fields (ticket 73, design point 3): a
 * field the Member has not touched takes the incoming value as both its
 * value and its baseline; a field they have edited keeps their edit and the
 * baseline it was edited against, so its write is refused as stale when
 * another Member changed that same field.
 *
 * Fields are compared with `===`, so every field is assumed primitive.
 */
export function keepEditedFields<T extends Record<string, unknown>>(
  incoming: T,
  edited: T,
  lastSaved: T,
): { value: T; baseline: T } {
  const value = { ...incoming };
  const baseline = { ...incoming };
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    if (edited[key] !== lastSaved[key]) {
      value[key] = edited[key];
      baseline[key] = lastSaved[key];
    }
  }
  return { value, baseline };
}

/**
 * `createAutosave`'s `rebase` for a record of fields (ticket 73): once a
 * write lands, a field the write changed (`saved` differs from the baseline
 * sent with it) takes what was stored, and every other field keeps the
 * baseline it has now — which an `adopt` during the write may have moved to
 * another Member's value. Without this, the write landing would put the old
 * baseline back under an adopted field, and a later write of that field
 * would be guarded by a value the row no longer holds: stale, for a Member
 * who never touched it. Compares with `===`, as `keepEditedFields` does.
 */
export function rebaseWrittenFields<T extends Record<string, unknown>>(
  saved: T,
  sentBaseline: T,
  currentBaseline: T,
): T {
  const next = { ...currentBaseline };
  for (const key of Object.keys(saved) as (keyof T)[]) {
    if (saved[key] !== sentBaseline[key]) next[key] = saved[key];
  }
  return next;
}
