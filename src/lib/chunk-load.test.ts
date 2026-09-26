import { describe, expect, it, vi } from "vitest";

import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-load";

/**
 * Ticket 74: a tab opened before a deploy throws a chunk-load failure on
 * its first client-side navigation after the old build's assets are gone.
 * `isChunkLoadError` recognizes that failure across the bundler/runtime
 * combinations Next can produce; `reloadOnceForChunkError` reloads once,
 * marking a short window in `sessionStorage` so a second failure right
 * after the reload does not loop, while a later deploy can reload again.
 */
describe("isChunkLoadError", () => {
  it.each([
    [
      "a webpack ChunkLoadError by name",
      Object.assign(new Error("boom"), { name: "ChunkLoadError" }),
    ],
    ["a webpack chunk failure message", new Error("Loading chunk 4 failed.")],
    ["a Failed to load chunk message", new Error("Failed to load chunk 12")],
    ["a CSS chunk failure message", new Error("Loading CSS chunk 3 failed.")],
    [
      "a Turbopack/ESM dynamic import failure",
      new Error("Failed to fetch dynamically imported module: /x.js"),
    ],
  ])("returns true for %s", (_label, error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([
    ["an ordinary Error", new Error("something else broke")],
    ["a non-Error value", "just a string"],
    ["undefined", undefined],
    ["null", null],
    ["a plain object", { message: "Loading chunk 1 failed." }],
  ])("returns false for %s", (_label, error) => {
    expect(isChunkLoadError(error)).toBe(false);
  });
});

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as Storage;
}

describe("reloadOnceForChunkError", () => {
  it("reloads when no marker exists", () => {
    const storage = fakeStorage();
    const reload = vi.fn();

    const reloaded = reloadOnceForChunkError({
      storage: () => storage,
      reload,
      now: () => 1_000,
    });

    expect(reloaded).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload again inside the window", () => {
    const storage = fakeStorage();
    const reload = vi.fn();
    const deps = { storage: () => storage, reload, now: () => 1_000 };

    reloadOnceForChunkError(deps);
    reload.mockClear();

    const reloaded = reloadOnceForChunkError({ ...deps, now: () => 5_000 });

    expect(reloaded).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads again once the window has passed", () => {
    const storage = fakeStorage();
    const reload = vi.fn();
    const deps = { storage: () => storage, reload, now: () => 1_000 };

    reloadOnceForChunkError(deps);
    reload.mockClear();

    const reloaded = reloadOnceForChunkError({ ...deps, now: () => 20_000 });

    expect(reloaded).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload when the storage getter throws", () => {
    const reload = vi.fn();

    const reloaded = reloadOnceForChunkError({
      storage: () => {
        throw new Error("storage disabled");
      },
      reload,
      now: () => 1_000,
    });

    expect(reloaded).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when setItem throws", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    } as unknown as Storage;

    const reloaded = reloadOnceForChunkError({
      storage: () => storage,
      reload,
      now: () => 1_000,
    });

    expect(reloaded).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when getItem throws", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    } as unknown as Storage;

    const reloaded = reloadOnceForChunkError({
      storage: () => storage,
      reload,
      now: () => 1_000,
    });

    expect(reloaded).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
