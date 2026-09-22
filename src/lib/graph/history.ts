import type { GraphDocument } from "@/lib/graph/document";

/**
 * The Draft editor's one undo and redo, as a value rather than as a piece of
 * the editor: the whole of what an Author can take back lives here, and the
 * editor only says when an edit happened and hands the state that stood
 * before it.
 *
 * Why the whole document per entry rather than a description of each edit: a
 * Draft is one immutable value (see
 * `docs/adr/0001-graph-as-one-json-document.md`) and every edit makes a new
 * one, so the state before an edit is a reference already in hand. An undo is
 * then the same thing as any other edit — a document set and autosaved — and
 * there is no second account of what an edit did to disagree with the first.
 *
 * Typing is the one thing that would otherwise fill the stack a keystroke at
 * a time, so consecutive edits to the same field close enough together are
 * one entry: an Author undoing a title they just wrote gets the title they
 * had, not the letter before last. Which field an edit belongs to is the
 * caller's to say, because only it knows whether two edits are the same field
 * — a Step's title, a Choice's label, an Outcome's label, a Step's rich text.
 *
 * Nothing here reads the clock: the time of an edit comes in with it, so the
 * window is something tests state rather than wait out.
 */

/** Everything an undo puts back: the document, and the Step that was open. */
export type HistorySnapshot = {
  document: GraphDocument;
  selectedStepId: string;
};

/**
 * One entry on a stack: what stood before an edit, which field that edit was
 * typed into — `null` for an edit that is not typing, and for the entries
 * undo and redo push, so typing never joins one of those — and when it
 * happened, which for a coalesced entry is the last keystroke it swallowed.
 */
export type HistoryEntry = {
  snapshot: HistorySnapshot;
  field: string | null;
  at: number;
};

export type History = {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
};

/**
 * Far enough back that an Author can undo an afternoon's work, near enough
 * that a Draft's worth of documents is never held forever. Past it the oldest
 * entry goes: the far end of the stack is the part nobody reaches for.
 */
export const HISTORY_LIMIT = 100;

/**
 * How long a pause turns typing into a new entry. A second is about the gap
 * between one thought and the next: keystrokes inside it are one edit to
 * undo, and a return to the same field after it is its own.
 */
export const COALESCE_WINDOW_MS = 1000;

export function emptyHistory(): History {
  return { undo: [], redo: [] };
}

/**
 * An edit made: `before` is the state that stood in front of it, `field` is
 * the field it was typed into or `null`, and `at` is when. The redo stack is
 * emptied either way — redo is what an undo left standing, and a new edit is
 * the Author moving on from it.
 *
 * Both stacks are new arrays whenever anything changes, because this is state
 * the editor sets: a mutated array is a render React has no reason to make.
 */
export function recordEdit(
  history: History,
  before: HistorySnapshot,
  { field, at }: { field: string | null; at: number },
): History {
  const top = history.undo.at(-1);

  // Still typing into the same field: the entry keeps the state it already
  // holds — what stood before the first keystroke — and takes the new time,
  // so the window runs from the last keystroke rather than the first.
  if (
    field !== null &&
    top !== undefined &&
    top.field === field &&
    at - top.at <= COALESCE_WINDOW_MS
  ) {
    return {
      undo: [...history.undo.slice(0, -1), { ...top, at }],
      redo: [],
    };
  }

  const entries = [...history.undo, { snapshot: before, field, at }];
  return {
    undo:
      entries.length > HISTORY_LIMIT
        ? entries.slice(entries.length - HISTORY_LIMIT)
        : entries,
    redo: [],
  };
}

/** A move made: the history it leaves behind, and the state to put back. */
export type HistoryMove = {
  history: History;
  snapshot: HistorySnapshot;
};

export function canUndo(history: History): boolean {
  return history.undo.length > 0;
}

export function canRedo(history: History): boolean {
  return history.redo.length > 0;
}

/**
 * Undo: the top of the undo stack is what to put back, and `current` — the
 * state it is being taken back from — goes on the redo stack so the Author
 * can change their mind. `null` when there is nothing left to undo.
 *
 * The entry pushed carries no field, so typing straight after an undo is its
 * own entry rather than something that joins the edit just undone.
 */
export function undo(
  history: History,
  current: HistorySnapshot,
  { at }: { at: number },
): HistoryMove | null {
  const entry = history.undo.at(-1);
  if (entry === undefined) return null;

  return {
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, { snapshot: current, field: null, at }],
    },
    snapshot: entry.snapshot,
  };
}

/** Redo: the mirror of `undo`, which is what makes the two a round trip. */
export function redo(
  history: History,
  current: HistorySnapshot,
  { at }: { at: number },
): HistoryMove | null {
  const entry = history.redo.at(-1);
  if (entry === undefined) return null;

  return {
    history: {
      undo: [...history.undo, { snapshot: current, field: null, at }],
      redo: history.redo.slice(0, -1),
    },
    snapshot: entry.snapshot,
  };
}
