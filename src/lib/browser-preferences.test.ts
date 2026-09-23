import { describe, expect, it } from "vitest";

import { readPreference, writePreference } from "@/lib/browser-preferences";

/** The part of `Storage` a preference touches, over a plain map. */
function storageOver(map: Map<string, string>): Storage {
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

/** A browser that refuses storage — a private window, storage blocked. */
const refusing: Storage = {
  getItem: () => {
    throw new Error("storage blocked");
  },
  setItem: () => {
    throw new Error("storage blocked");
  },
  removeItem: () => {
    throw new Error("storage blocked");
  },
  clear: () => {
    throw new Error("storage blocked");
  },
  key: () => null,
  length: 0,
};

describe("readPreference", () => {
  it("returns what the browser stored under the key", () => {
    const storage = storageOver(new Map([["journeys:x", "LR"]]));
    expect(readPreference("journeys:x", storage)).toBe("LR");
  });

  it("returns null for a key nothing was stored under", () => {
    expect(readPreference("journeys:x", storageOver(new Map()))).toBeNull();
  });

  it("returns null, rather than throwing, from a browser that refuses storage", () => {
    expect(readPreference("journeys:x", refusing)).toBeNull();
  });

  it("returns null with no storage at all, as on the server", () => {
    expect(readPreference("journeys:x", undefined)).toBeNull();
  });
});

describe("writePreference", () => {
  it("stores the value under the key", () => {
    const map = new Map<string, string>();
    writePreference("journeys:x", "hidden", storageOver(map));
    expect(map.get("journeys:x")).toBe("hidden");
  });

  it("does nothing, rather than throwing, in a browser that refuses storage", () => {
    expect(() =>
      writePreference("journeys:x", "hidden", refusing),
    ).not.toThrow();
  });

  it("does nothing with no storage at all", () => {
    expect(() =>
      writePreference("journeys:x", "hidden", undefined),
    ).not.toThrow();
  });
});
