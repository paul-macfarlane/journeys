// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutosave } from "@/components/autosave";
import {
  SAVE_DEBOUNCE_MS,
  type Autosave,
  type WriteRefusal,
  type WriteResult,
} from "@/lib/autosave";

/**
 * `useAutosave` as a surface holds it (72 W6): one loop for the life of the
 * component, whatever its handlers' identities do from render to render,
 * and the unsaved edit written when the surface goes away.
 */

type Handlers = {
  write: (value: string, baseline: string) => Promise<WriteResult<string>>;
  onSaved: () => void;
  onRefused?: (result: WriteRefusal<string>) => void;
};

let held: Autosave<string> | null = null;

function expose(autosave: Autosave<string>) {
  held = autosave;
}

function Surface(handlers: Handlers) {
  const { autosave } = useAutosave<string>({
    initial: "Border",
    equals: (a, b) => a === b,
    ...handlers,
  });
  useEffect(() => {
    expose(autosave);
  }, [autosave]);
  return null;
}

let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  held = null;
  vi.useRealTimers();
});

function loop(): Autosave<string> {
  if (held === null) throw new Error("Surface has not rendered");
  return held;
}

describe("useAutosave", () => {
  it("a re-render with new handler identities keeps the loop and writes nothing; unmount writes the unsaved edit", async () => {
    const firstWrite = vi.fn(async () => ({ kind: "saved" }) as const);
    act(() => {
      root.render(<Surface write={firstWrite} onSaved={() => {}} />);
    });
    const first = loop();

    act(() => {
      first.change("Night");
    });

    // A router or props change hands the surface fresh functions.
    const secondWrite = vi.fn(async () => ({ kind: "saved" }) as const);
    const secondSaved = vi.fn();
    act(() => {
      root.render(<Surface write={secondWrite} onSaved={secondSaved} />);
    });

    expect(loop()).toBe(first);
    expect(firstWrite).not.toHaveBeenCalled();
    expect(secondWrite).not.toHaveBeenCalled();
    expect(first.isDirty()).toBe(true);

    // The timer's write goes to the latest handlers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    });
    expect(firstWrite).not.toHaveBeenCalled();
    expect(secondWrite).toHaveBeenCalledWith("Night", "Border");
    expect(secondSaved).toHaveBeenCalledTimes(1);

    // An edit still in the window when the surface unmounts is written.
    act(() => {
      first.change("Night Court");
    });
    await act(async () => {
      root.unmount();
    });
    expect(secondWrite).toHaveBeenCalledTimes(2);
    expect(secondWrite).toHaveBeenLastCalledWith("Night Court", "Night");
  });

  it("a refusal reaches the surface's latest onRefused", async () => {
    const onRefused = vi.fn();
    const write = vi.fn(
      async () =>
        ({ kind: "refused", error: "no longer exists" }) as WriteResult<string>,
    );
    act(() => {
      root.render(
        <Surface write={write} onSaved={() => {}} onRefused={() => {}} />,
      );
    });
    act(() => {
      root.render(
        <Surface write={write} onSaved={() => {}} onRefused={onRefused} />,
      );
    });

    await act(async () => {
      loop().change("Night");
      await loop().flush();
    });

    expect(onRefused).toHaveBeenCalledWith({
      kind: "refused",
      error: "no longer exists",
    });

    await act(async () => {
      root.unmount();
    });
  });
});
