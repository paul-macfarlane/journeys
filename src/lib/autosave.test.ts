import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAutosave,
  SAVE_DEBOUNCE_MS,
  STATUS_TEXT,
  type SaveStatus,
} from "./autosave";

/**
 * The save loop the metadata forms share (ticket 46), lifted from the Draft
 * editor's: an edit is written once typing pauses, a flush writes it now, a
 * write that fails leaves the edit in place for the next one, and the
 * caller hears about it as "Saved", "Saving…", or "Unsaved changes".
 */

type Metadata = { title: string; description: string };

const equals = (a: Metadata, b: Metadata) =>
  a.title === b.title && a.description === b.description;

/** A write the test resolves by hand, so the loop's states can be watched. */
function deferredWrite() {
  const calls: Metadata[] = [];
  const resolvers: ((ok: boolean) => void)[] = [];
  const write = (value: Metadata) =>
    new Promise<boolean>((resolve) => {
      calls.push(value);
      resolvers.push(resolve);
    });
  return {
    write,
    calls,
    /** Settle the oldest write still waiting. */
    settle: async (ok = true) => {
      resolvers.shift()?.(ok);
      await flushMicrotasks();
    },
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

function setup(
  options: { write?: (value: Metadata) => Promise<boolean> } = {},
) {
  const statuses: SaveStatus[] = [];
  const saved = vi.fn();
  const writer = deferredWrite();
  const autosave = createAutosave<Metadata>({
    initial: { title: "Border", description: "" },
    equals,
    write: options.write ?? writer.write,
    onStatus: (status) => statuses.push(status),
    onSaved: saved,
  });
  return { autosave, statuses, saved, writer };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosave", () => {
  it("names the three states as the Draft editor does", () => {
    expect(STATUS_TEXT).toEqual({
      saved: "Saved",
      saving: "Saving…",
      unsaved: "Unsaved changes",
    });
    expect(SAVE_DEBOUNCE_MS).toBe(600);
  });

  it("writes an edit once typing pauses, then reports saved and settled", async () => {
    const { autosave, statuses, saved, writer } = setup();

    autosave.change({ title: "Night", description: "" });
    expect(statuses).toEqual(["unsaved"]);
    expect(autosave.isDirty()).toBe(true);

    // A second keystroke inside the window restarts it: one write, not two.
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    autosave.change({ title: "Night C", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(writer.calls).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(writer.calls).toEqual([{ title: "Night C", description: "" }]);
    expect(statuses).toEqual(["unsaved", "unsaved", "saving"]);

    await writer.settle();
    expect(statuses.at(-1)).toBe("saved");
    expect(autosave.isDirty()).toBe(false);
    expect(autosave.lastSaved()).toEqual({ title: "Night C", description: "" });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it("flush writes now, waiting out a write already running", async () => {
    const { autosave, statuses, saved, writer } = setup();

    autosave.change({ title: "One", description: "" });
    const flushed = autosave.flush();
    await flushMicrotasks();
    expect(writer.calls).toEqual([{ title: "One", description: "" }]);

    // An edit during the write, flushed too: the second flush waits out the
    // first write rather than starting a second beside it, then writes the
    // newer value.
    autosave.change({ title: "Two", description: "" });
    const flushedAgain = autosave.flush();
    await flushMicrotasks();
    expect(writer.calls).toHaveLength(1);

    await writer.settle();
    expect(writer.calls).toHaveLength(1);
    // The waiting flush polls the running write every 25 ms.
    await vi.advanceTimersByTimeAsync(25);
    expect(writer.calls).toEqual([
      { title: "One", description: "" },
      { title: "Two", description: "" },
    ]);
    // Nothing was reported saved yet: the first write landed with more to write.
    expect(saved).not.toHaveBeenCalled();

    await writer.settle();
    await Promise.all([flushed, flushedAgain]);
    expect(statuses.at(-1)).toBe("saved");
    expect(saved).toHaveBeenCalledTimes(1);
    expect(autosave.isDirty()).toBe(false);
  });

  it("an edit during a write with no flush waits for its own timer", async () => {
    const { autosave, statuses, writer } = setup();

    autosave.change({ title: "One", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.calls).toHaveLength(1);

    autosave.change({ title: "Two", description: "" });
    await writer.settle();
    // The first write landed, but the edit after it is still unsaved.
    expect(statuses.at(-1)).toBe("unsaved");
    expect(autosave.isDirty()).toBe(true);
    expect(writer.calls).toHaveLength(1);

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.calls).toHaveLength(2);
    await writer.settle();
    expect(statuses.at(-1)).toBe("saved");
  });

  it("a write that fails leaves the edit unsaved for the next one, and reports nothing saved", async () => {
    const { autosave, statuses, saved, writer } = setup();

    autosave.change({ title: "One", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await writer.settle(false);
    expect(statuses.at(-1)).toBe("unsaved");
    expect(autosave.isDirty()).toBe(true);
    expect(saved).not.toHaveBeenCalled();

    // Nothing retries on its own; the next edit does.
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 5);
    expect(writer.calls).toHaveLength(1);

    autosave.change({ title: "One more", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.calls).toHaveLength(2);
  });

  it("a write that throws counts as one that failed", async () => {
    const { autosave, statuses } = setup({
      write: () => Promise.reject(new Error("offline")),
    });
    autosave.change({ title: "One", description: "" });
    await autosave.flush();
    expect(statuses.at(-1)).toBe("unsaved");
    expect(autosave.isDirty()).toBe(true);
  });

  it("an edit back to what was saved writes nothing", async () => {
    const { autosave, statuses, writer } = setup();

    autosave.change({ title: "Bord", description: "" });
    autosave.change({ title: "Border", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await flushMicrotasks();
    expect(writer.calls).toEqual([]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("adopts the server's values when clean, and keeps the edit over them when not", () => {
    const { autosave } = setup();

    autosave.adopt({ title: "Renamed elsewhere", description: "" });
    expect(autosave.current()).toEqual({
      title: "Renamed elsewhere",
      description: "",
    });
    expect(autosave.isDirty()).toBe(false);

    autosave.change({ title: "Renamed elsewhere", description: "Mine" });
    autosave.adopt(
      { title: "Renamed again", description: "" },
      (incoming, current) => ({
        ...incoming,
        description: current.description,
      }),
    );
    expect(autosave.lastSaved()).toEqual({
      title: "Renamed again",
      description: "",
    });
    expect(autosave.current()).toEqual({
      title: "Renamed again",
      description: "Mine",
    });
    expect(autosave.isDirty()).toBe(true);
  });

  it("a value adopted during a write is written after it, with the edit kept", async () => {
    const { autosave, statuses, writer } = setup();

    autosave.change({ title: "Border", description: "Mine" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.calls).toHaveLength(1);

    // Another Member's rename arrives on a refresh while the write is out.
    autosave.adopt(
      { title: "Renamed elsewhere", description: "" },
      (incoming, current) => ({
        ...incoming,
        description: current.description,
      }),
    );
    await writer.settle();
    // Not stranded on "saving": the merged record is unsaved, and a timer
    // is set for it since no keystroke will set one.
    expect(statuses.at(-1)).toBe("unsaved");
    expect(autosave.isDirty()).toBe(true);

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.calls[1]).toEqual({
      title: "Renamed elsewhere",
      description: "Mine",
    });
    await writer.settle();
    expect(statuses.at(-1)).toBe("saved");
  });

  it("dispose writes what the timer was about to, once, and drops the timer", async () => {
    const { autosave, writer } = setup();

    autosave.change({ title: "Leaving", description: "" });
    autosave.dispose();
    await flushMicrotasks();
    expect(writer.calls).toEqual([{ title: "Leaving", description: "" }]);

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    await writer.settle();
    expect(writer.calls).toHaveLength(1);
  });

  it("dispose with nothing unsaved writes nothing", () => {
    const { autosave, writer } = setup();
    autosave.dispose();
    expect(writer.calls).toEqual([]);
  });

  it("unload fires a best-effort write and asks the browser to prompt only while dirty", () => {
    const { autosave, writer } = setup();

    expect(autosave.unload()).toBe(false);
    expect(writer.calls).toEqual([]);

    autosave.change({ title: "Leaving", description: "" });
    expect(autosave.unload()).toBe(true);
    expect(writer.calls).toEqual([{ title: "Leaving", description: "" }]);
  });
});
