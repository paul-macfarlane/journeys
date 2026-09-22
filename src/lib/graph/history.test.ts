import { describe, expect, it } from "vitest";

import { createDraftDocument, type GraphDocument } from "@/lib/graph/document";
import { updateStep } from "@/lib/graph/edit";
import {
  canRedo,
  canUndo,
  COALESCE_WINDOW_MS,
  emptyHistory,
  HISTORY_LIMIT,
  recordEdit,
  redo,
  undo,
  type History,
  type HistoryEntry,
  type HistorySnapshot,
} from "@/lib/graph/history";

/**
 * Seam A for ticket 23: the Draft editor's one undo and redo, exercised as
 * the pure thing it is — a history, a snapshot of what stood before an edit,
 * and a clock the caller passes in. Nothing here reads the real clock: every
 * case says in milliseconds how far apart two edits were, which is the whole
 * of what coalescing turns on.
 */

/** A Draft whose Start carries `title`, so two snapshots are told apart. */
function documentTitled(title: string): GraphDocument {
  const document = createDraftDocument();
  return updateStep(document, document.startStepId, { title });
}

function snapshot(title: string, selectedStepId = "start"): HistorySnapshot {
  return { document: documentTitled(title), selectedStepId };
}

/** The title an entry puts back, which is how one entry is told from another. */
function startTitle(entry: HistoryEntry): string {
  const { document } = entry.snapshot;
  return document.steps[document.startStepId].title;
}

const titleField = "title:start";

describe("emptyHistory", () => {
  it("has nothing to undo and nothing to redo", () => {
    expect(emptyHistory()).toEqual({ undo: [], redo: [] });
  });
});

describe("recordEdit", () => {
  it("records the state before the edit, with its field and its time", () => {
    const before = snapshot("Before");

    const history = recordEdit(emptyHistory(), before, {
      field: titleField,
      at: 1000,
    });

    expect(history.undo).toEqual([
      { snapshot: before, field: titleField, at: 1000 },
    ]);
  });

  it("coalesces same-field edits inside the window into the first snapshot", () => {
    const first = snapshot("Before");
    const second = snapshot("B");

    let history = recordEdit(emptyHistory(), first, {
      field: titleField,
      at: 1000,
    });
    history = recordEdit(history, second, { field: titleField, at: 1900 });

    // One entry, and it still holds what stood before the typing began: an
    // undo of typing puts the whole field back, not the last keystroke.
    expect(history.undo).toHaveLength(1);
    expect(history.undo[0].snapshot).toBe(first);
    expect(history.undo[0].at).toBe(1900);
  });

  it("runs the window from the last edit rather than from the first", () => {
    const first = snapshot("Before");

    let history = recordEdit(emptyHistory(), first, {
      field: titleField,
      at: 1000,
    });
    history = recordEdit(history, snapshot("B"), {
      field: titleField,
      at: 1900,
    });
    history = recordEdit(history, snapshot("Bo"), {
      field: titleField,
      at: 2800,
    });

    // 1800 ms of typing, never a gap wider than the window: still one entry.
    expect(history.undo).toHaveLength(1);
    expect(history.undo[0].snapshot).toBe(first);
    expect(history.undo[0].at).toBe(2800);
  });

  it("pushes a same-field edit that comes after the window", () => {
    const first = snapshot("Before");
    const later = snapshot("Before the second thought");

    let history = recordEdit(emptyHistory(), first, {
      field: titleField,
      at: 1000,
    });
    history = recordEdit(history, later, {
      field: titleField,
      at: 1000 + COALESCE_WINDOW_MS + 1,
    });

    expect(history.undo.map((entry) => entry.snapshot)).toEqual([first, later]);
  });

  it("never coalesces edits on different fields", () => {
    const first = snapshot("Before");
    const second = snapshot("Second");

    let history = recordEdit(emptyHistory(), first, {
      field: titleField,
      at: 1000,
    });
    history = recordEdit(history, second, {
      field: "choice-label:choice-a",
      at: 1010,
    });

    expect(history.undo.map((entry) => entry.snapshot)).toEqual([
      first,
      second,
    ]);
  });

  it("never coalesces an edit that belongs to no field", () => {
    const first = snapshot("Before");
    const second = snapshot("Second");
    const third = snapshot("Third");

    // A drawn Choice, a delete, a direction switch: each its own undo, even
    // back to back, because none of them is typing into a field.
    let history = recordEdit(emptyHistory(), first, { field: null, at: 1000 });
    history = recordEdit(history, second, { field: null, at: 1010 });
    history = recordEdit(history, third, { field: null, at: 1020 });

    expect(history.undo.map((entry) => entry.snapshot)).toEqual([
      first,
      second,
      third,
    ]);
  });

  it("drops the oldest entry once the limit is reached", () => {
    let history = emptyHistory();
    for (let index = 0; index <= HISTORY_LIMIT; index += 1) {
      history = recordEdit(history, snapshot(`Edit ${index}`), {
        field: null,
        at: 1000 + index,
      });
    }

    // 101 edits recorded, 100 kept: the first one made is the one gone.
    expect(history.undo).toHaveLength(HISTORY_LIMIT);
    expect(history.undo.map(startTitle).at(0)).toBe("Edit 1");
    expect(history.undo.map(startTitle).at(-1)).toBe(`Edit ${HISTORY_LIMIT}`);
  });

  it("empties the redo stack", () => {
    const stale: History = {
      undo: [],
      redo: [{ snapshot: snapshot("Redone"), field: null, at: 500 }],
    };

    const history = recordEdit(stale, snapshot("Before"), {
      field: null,
      at: 1000,
    });

    expect(history.redo).toEqual([]);
  });

  it("leaves the history it is given exactly as it was", () => {
    const first = recordEdit(emptyHistory(), snapshot("Before"), {
      field: titleField,
      at: 1000,
    });
    const undoBefore = first.undo;

    const coalesced = recordEdit(first, snapshot("B"), {
      field: titleField,
      at: 1100,
    });
    const pushed = recordEdit(first, snapshot("Second"), {
      field: null,
      at: 1100,
    });

    // Both a coalesce and a push hand back new arrays: this is state the
    // editor sets, and a mutated array is a render React never makes.
    expect(first.undo).toBe(undoBefore);
    expect(first.undo).toHaveLength(1);
    expect(first.undo[0].at).toBe(1000);
    expect(coalesced.undo).not.toBe(first.undo);
    expect(pushed.undo).not.toBe(first.undo);
  });
});

describe("undo and redo", () => {
  it("has nothing to undo or redo on a fresh history", () => {
    const history = emptyHistory();

    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(undo(history, snapshot("Now"), { at: 2000 })).toBeNull();
    expect(redo(history, snapshot("Now"), { at: 2000 })).toBeNull();
  });

  it("puts back what stood before the edit and offers it back again", () => {
    const before = snapshot("Before", "step-one");
    const current = snapshot("After", "step-two");

    const recorded = recordEdit(emptyHistory(), before, {
      field: null,
      at: 1000,
    });
    const undone = undo(recorded, current, { at: 2000 });

    expect(undone).not.toBeNull();
    expect(undone?.snapshot).toBe(before);
    expect(undone?.history.undo).toEqual([]);
    expect(canRedo(undone!.history)).toBe(true);
  });

  it("round-trips the document and the open Step through undo and redo", () => {
    const before = snapshot("Before", "step-one");
    const current = snapshot("After", "step-two");

    const recorded = recordEdit(emptyHistory(), before, {
      field: null,
      at: 1000,
    });
    const undone = undo(recorded, current, { at: 2000 })!;
    const redone = redo(undone.history, undone.snapshot, { at: 2100 })!;

    // Back where the Author was before they pressed undo: the same document
    // and the same Step open, and an undo waiting again.
    expect(redone.snapshot.document).toBe(current.document);
    expect(redone.snapshot.selectedStepId).toBe("step-two");
    expect(canUndo(redone.history)).toBe(true);
    expect(canRedo(redone.history)).toBe(false);
  });

  it("empties the redo stack when a new edit is made after an undo", () => {
    const recorded = recordEdit(emptyHistory(), snapshot("Before"), {
      field: null,
      at: 1000,
    });
    const undone = undo(recorded, snapshot("After"), { at: 2000 })!;

    const afterNewEdit = recordEdit(undone.history, snapshot("Instead"), {
      field: titleField,
      at: 2100,
    });

    expect(canRedo(afterNewEdit)).toBe(false);
  });

  it("never lets typing join the entry an undo pushed", () => {
    const recorded = recordEdit(emptyHistory(), snapshot("Before"), {
      field: titleField,
      at: 1000,
    });
    const undone = undo(recorded, snapshot("After"), { at: 2000 })!;

    // Typing straight after an undo, into the field the undone edit was
    // typed into: its own entry, so one more undo takes it back.
    const typed = recordEdit(undone.history, snapshot("Typed"), {
      field: titleField,
      at: 2100,
    });

    expect(typed.undo).toHaveLength(1);
    expect(startTitle(typed.undo[0])).toBe("Typed");
  });

  it("leaves the history it is given exactly as it was", () => {
    const recorded = recordEdit(emptyHistory(), snapshot("Before"), {
      field: null,
      at: 1000,
    });
    const undoBefore = recorded.undo;

    const undone = undo(recorded, snapshot("After"), { at: 2000 })!;

    expect(recorded.undo).toBe(undoBefore);
    expect(recorded.undo).toHaveLength(1);
    expect(recorded.redo).toEqual([]);
    expect(undone.history.undo).not.toBe(recorded.undo);
    expect(undone.history.redo).not.toBe(recorded.redo);
  });
});
