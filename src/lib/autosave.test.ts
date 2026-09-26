import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAutosave,
  keepEditedFields,
  rebaseWrittenFields,
  SAVE_DEBOUNCE_MS,
  staleText,
  STATUS_TEXT,
  type SaveStatus,
  type WriteResult,
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
  const baselines: Metadata[] = [];
  const resolvers: ((result: WriteResult<Metadata>) => void)[] = [];
  const write = (value: Metadata, baseline: Metadata) =>
    new Promise<WriteResult<Metadata>>((resolve) => {
      calls.push(value);
      baselines.push(baseline);
      resolvers.push(resolve);
    });
  return {
    write,
    calls,
    baselines,
    /**
     * Settle the oldest write still waiting: accepted, refused, or with the
     * result spelled out.
     */
    settle: async (result: boolean | WriteResult<Metadata> = true) => {
      resolvers.shift()?.(
        result === true
          ? { kind: "saved" }
          : result === false
            ? { kind: "refused", error: "refused" }
            : result,
      );
      await flushMicrotasks();
    },
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

function setup(
  options: {
    write?: (
      value: Metadata,
      baseline: Metadata,
    ) => Promise<WriteResult<Metadata>>;
  } = {},
) {
  const statuses: SaveStatus[] = [];
  const saved = vi.fn();
  const refused = vi.fn();
  const stale = vi.fn();
  const writer = deferredWrite();
  const autosave = createAutosave<Metadata>({
    initial: { title: "Border", description: "" },
    equals,
    write: options.write ?? writer.write,
    onStatus: (status) => statuses.push(status),
    onSaved: saved,
    onRefused: refused,
    onStale: stale,
  });
  return { autosave, statuses, saved, refused, stale, writer };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosave", () => {
  it("names the four states as the Draft editor does, and names the surface a stale save was refused on", () => {
    expect(STATUS_TEXT).toEqual({
      saved: "Saved",
      saving: "Saving…",
      unsaved: "Unsaved changes",
      stale:
        "Someone else changed this since you opened it. Reload to see their changes.",
    });
    expect(staleText("draft")).toBe(
      "Someone else changed this draft since you opened it. Reload to see their changes.",
    );
    expect(staleText("project")).toBe(
      "Someone else changed this project since you opened it. Reload to see their changes.",
    );
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

  it("a write that throws counts as one the server could not be reached for", async () => {
    const { autosave, statuses, refused } = setup({
      write: () => Promise.reject(new Error("offline")),
    });
    autosave.change({ title: "One", description: "" });
    await autosave.flush();
    expect(statuses.at(-1)).toBe("unsaved");
    expect(autosave.isDirty()).toBe(true);
    expect(refused).toHaveBeenCalledWith({
      kind: "refused",
      error: "the server could not be reached",
    });
  });

  it("a refusal reaches onRefused with its error and the Step it names", async () => {
    const { autosave, statuses, saved, refused, writer } = setup();

    autosave.change({ title: "One", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await writer.settle({
      kind: "refused",
      error: "A Choice points at a Step that does not exist",
      stepId: "step-2",
    });

    expect(refused).toHaveBeenCalledTimes(1);
    expect(refused).toHaveBeenCalledWith({
      kind: "refused",
      error: "A Choice points at a Step that does not exist",
      stepId: "step-2",
    });
    expect(statuses.at(-1)).toBe("unsaved");
    expect(autosave.isDirty()).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it("a saved value handed back by the write replaces the last saved value", async () => {
    const { autosave, refused, writer } = setup();

    autosave.change({ title: "  Spaced  ", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await writer.settle({
      kind: "saved",
      saved: { title: "Spaced", description: "" },
    });

    expect(autosave.lastSaved()).toEqual({ title: "Spaced", description: "" });
    expect(refused).not.toHaveBeenCalled();
  });

  it("each write is handed the last saved value as its baseline", async () => {
    const { autosave, writer } = setup();

    autosave.change({ title: "One", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.baselines).toEqual([{ title: "Border", description: "" }]);
    await writer.settle({
      kind: "saved",
      saved: { title: "One (stored)", description: "" },
    });

    autosave.change({ title: "Two", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.baselines).toEqual([
      { title: "Border", description: "" },
      { title: "One (stored)", description: "" },
    ]);
    await writer.settle();

    // A refused write leaves the baseline where it was.
    autosave.change({ title: "Three", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await writer.settle(false);
    autosave.change({ title: "Four", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.baselines.at(-1)).toEqual({ title: "Two", description: "" });
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
      (incoming, current, lastSaved) => ({
        value: { ...incoming, description: current.description },
        baseline: { ...incoming, description: lastSaved.description },
      }),
    );
    // The baseline under the edited field is still the one it was edited
    // against; the untouched field takes the incoming value in both.
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
      (incoming, current, lastSaved) => ({
        value: { ...incoming, description: current.description },
        baseline: { ...incoming, description: lastSaved.description },
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

  it("unload during a write never writes beside it: the running write goes round once more with the newest value", async () => {
    const { autosave, statuses, saved, writer } = setup();

    autosave.change({ title: "One", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(writer.calls).toHaveLength(1);

    autosave.change({ title: "Two", description: "" });
    expect(autosave.unload()).toBe(true);
    await flushMicrotasks();
    expect(writer.calls).toHaveLength(1);

    await writer.settle();
    expect(writer.calls).toEqual([
      { title: "One", description: "" },
      { title: "Two", description: "" },
    ]);

    await writer.settle();
    expect(statuses.at(-1)).toBe("saved");
    expect(saved).toHaveBeenCalledTimes(1);
    // The edit's own timer, cleared by nothing, finds nothing left to write.
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await flushMicrotasks();
    expect(writer.calls).toHaveLength(2);
  });

  it("unload fires a best-effort write and asks the browser to prompt only while dirty", () => {
    const { autosave, writer } = setup();

    expect(autosave.unload()).toBe(false);
    expect(writer.calls).toEqual([]);

    autosave.change({ title: "Leaving", description: "" });
    expect(autosave.unload()).toBe(true);
    expect(writer.calls).toEqual([{ title: "Leaving", description: "" }]);
  });

  it("a saved write with no edit during it takes the stored value as the current one too", async () => {
    const { autosave, writer } = setup();

    autosave.change({ title: "  Spaced  ", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await writer.settle({
      kind: "saved",
      saved: { title: "Spaced", description: "" },
    });

    expect(autosave.current()).toEqual({ title: "Spaced", description: "" });
    expect(autosave.isDirty()).toBe(false);
  });

  it("a Draft's saved version is carried by the value as well as the baseline", async () => {
    type Held = { document: string; version: number };
    const writes: [Held, Held][] = [];
    const autosave = createAutosave<Held>({
      initial: { document: "one", version: 4 },
      equals: (a, b) => a.document === b.document,
      write: async (value, baseline) => {
        writes.push([value, baseline]);
        return {
          kind: "saved",
          saved: { document: value.document, version: baseline.version + 1 },
        };
      },
      onStatus: () => {},
      onSaved: () => {},
    });

    autosave.change({ document: "two", version: 4 });
    await autosave.flush();
    expect(autosave.current()).toEqual({ document: "two", version: 5 });
    expect(autosave.lastSaved()).toEqual({ document: "two", version: 5 });

    // The next write is guarded by the version the last one stored.
    autosave.change({ ...autosave.current(), document: "three" });
    await autosave.flush();
    expect(writes[1][1].version).toBe(5);
  });

  it("a stale write is terminal: the edit stays on screen and nothing is written again", async () => {
    const { autosave, statuses, saved, refused, stale, writer } = setup();

    autosave.change({ title: "Mine", description: "" });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    await writer.settle({ kind: "stale" });

    expect(statuses.at(-1)).toBe("stale");
    expect(stale).toHaveBeenCalledTimes(1);
    expect(refused).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(autosave.current()).toEqual({ title: "Mine", description: "" });
    expect(autosave.isDirty()).toBe(true);

    // Editing goes on, and is kept, but nothing schedules a write and the
    // status stays where it is.
    const reported = statuses.length;
    autosave.change({ title: "Mine, still", description: "" });
    expect(autosave.current()).toEqual({
      title: "Mine, still",
      description: "",
    });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 3);
    await autosave.flush();
    autosave.dispose();
    await flushMicrotasks();
    expect(writer.calls).toHaveLength(1);
    expect(statuses).toHaveLength(reported);

    // Another refresh arriving changes nothing the Member holds.
    autosave.adopt({ title: "Theirs", description: "" });
    expect(autosave.current()).toEqual({
      title: "Mine, still",
      description: "",
    });

    // Leaving writes nothing, but the browser still asks first.
    expect(autosave.unload()).toBe(true);
    await flushMicrotasks();
    expect(writer.calls).toHaveLength(1);
  });

  it("an edit queued behind a write that comes back stale is not written", async () => {
    const { autosave, statuses, writer } = setup();

    autosave.change({ title: "One", description: "" });
    const flushed = autosave.flush();
    await flushMicrotasks();
    autosave.change({ title: "Two", description: "" });
    expect(autosave.unload()).toBe(true);

    await writer.settle({ kind: "stale" });
    await flushed;
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(writer.calls).toEqual([{ title: "One", description: "" }]);
    expect(statuses.at(-1)).toBe("stale");
  });
});

/**
 * Design point 3 of ticket 73: `adopt` must not move the baseline under an
 * edit. The server here is a fake of the settings write (the database is the
 * boundary): it compares each field the write changes with the baseline the
 * write sends, and refuses the whole write when any of them has moved.
 */
describe("adopting another Member's change mid-edit", () => {
  function fakeSettingsRow(initial: Metadata) {
    const row = { ...initial };
    const write = async (
      value: Metadata,
      baseline: Metadata,
    ): Promise<WriteResult<Metadata>> => {
      const changed = (Object.keys(value) as (keyof Metadata)[]).filter(
        (key) => value[key] !== baseline[key],
      );
      if (changed.some((key) => row[key] !== baseline[key])) {
        return { kind: "stale" };
      }
      for (const key of changed) row[key] = value[key];
      return { kind: "saved", saved: { ...row } };
    };
    return { row, write };
  }

  function loopOver(row: ReturnType<typeof fakeSettingsRow>) {
    const statuses: SaveStatus[] = [];
    const autosave = createAutosave<Metadata>({
      initial: { ...row.row },
      equals,
      write: row.write,
      onStatus: (status) => statuses.push(status),
      onSaved: () => {},
    });
    return { autosave, statuses };
  }

  it("keepEditedFields merges value and baseline per field", () => {
    expect(
      keepEditedFields(
        { title: "Theirs", description: "Also theirs" },
        { title: "Mine", description: "" },
        { title: "Border", description: "" },
      ),
    ).toEqual({
      value: { title: "Mine", description: "Also theirs" },
      baseline: { title: "Border", description: "Also theirs" },
    });
  });

  it("a change to the same field the Member is editing makes their write stale", async () => {
    const server = fakeSettingsRow({ title: "Border", description: "" });
    const { autosave, statuses } = loopOver(server);

    autosave.change({ title: "Mine", description: "" });
    // Another Member renamed it; the refresh carries their title.
    server.row.title = "Theirs";
    autosave.adopt({ ...server.row }, keepEditedFields);
    await autosave.flush();

    expect(statuses.at(-1)).toBe("stale");
    expect(server.row.title).toBe("Theirs");
    expect(autosave.current().title).toBe("Mine");
  });

  it("a change to a different field is adopted, and the Member's write is saved", async () => {
    const server = fakeSettingsRow({ title: "Border", description: "" });
    const { autosave, statuses } = loopOver(server);

    autosave.change({ title: "Mine", description: "" });
    server.row.description = "Theirs";
    autosave.adopt({ ...server.row }, keepEditedFields);
    await autosave.flush();

    expect(statuses.at(-1)).toBe("saved");
    expect(server.row).toEqual({ title: "Mine", description: "Theirs" });
    expect(autosave.current()).toEqual({
      title: "Mine",
      description: "Theirs",
    });
  });
});

/**
 * A refresh landing while a write is in flight: another Member's change to a
 * field this Member has not touched is adopted as that field's baseline, and
 * the write landing afterwards must not put the old baseline back under it
 * (ticket 73 AC3: a Member editing alone never sees the stale message).
 */
describe("a write landing after an adoption", () => {
  it("keeps the adopted value as the baseline of a field the write did not change", async () => {
    const writer = deferredWrite();
    const autosave = createAutosave<Metadata>({
      initial: { title: "Border", description: "" },
      equals,
      write: writer.write,
      onStatus: () => {},
      onSaved: () => {},
      rebase: rebaseWrittenFields,
    });

    // The title write is in flight…
    autosave.change({ title: "Mine", description: "" });
    const flushing = autosave.flush();
    await flushMicrotasks();
    expect(writer.calls).toEqual([{ title: "Mine", description: "" }]);

    // …when the refresh brings another Member's description.
    autosave.adopt(
      { title: "Border", description: "Theirs" },
      keepEditedFields,
    );

    // The write lands, handing back the record it stored.
    await writer.settle({
      kind: "saved",
      saved: { title: "Mine", description: "" },
    });
    await flushing;

    expect(autosave.lastSaved()).toEqual({
      title: "Mine",
      description: "Theirs",
    });

    // The next write is guarded by the adopted description, so a guard on
    // the description (had it changed) compares with what the row holds.
    autosave.change({ title: "Mine again", description: "Theirs" });
    const next = autosave.flush();
    await flushMicrotasks();
    expect(writer.calls.at(-1)).toEqual({
      title: "Mine again",
      description: "Theirs",
    });
    expect(writer.baselines.at(-1)).toEqual({
      title: "Mine",
      description: "Theirs",
    });
    await writer.settle();
    await next;
  });
});
