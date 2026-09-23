import { beforeEach, describe, expect, it } from "vitest";

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

/** A browser whose storage refuses every call — a full quota, say. */
const refusingCalls: Storage = {
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

/** A browser that refuses to hand storage over at all, as Chrome does with site data blocked. */
const refusingAccess = (): Storage => {
  throw new DOMException(
    "Access is denied for this document.",
    "SecurityError",
  );
};

/** Every test gets its own key, so nothing held for a refusing browser leaks between them. */
let key: string;
let count = 0;
beforeEach(() => {
  count += 1;
  key = `journeys:test-${count}`;
});

describe("readPreference", () => {
  it("returns what the browser stored under the key", () => {
    const storage = storageOver(new Map([[key, "LR"]]));
    expect(readPreference(key, () => storage)).toBe("LR");
  });

  it("returns null for a key nothing was stored under", () => {
    expect(readPreference(key, () => storageOver(new Map()))).toBeNull();
  });

  it("returns null, rather than throwing, when storage refuses the read", () => {
    expect(readPreference(key, () => refusingCalls)).toBeNull();
  });

  it("returns null, rather than throwing, when the browser refuses access to storage", () => {
    expect(readPreference(key, refusingAccess)).toBeNull();
  });

  it("returns null with no storage at all, as on the server", () => {
    expect(readPreference(key, () => undefined)).toBeNull();
  });
});

describe("writePreference", () => {
  it("stores the value under the key", () => {
    const map = new Map<string, string>();
    writePreference(key, "hidden", () => storageOver(map));
    expect(map.get(key)).toBe("hidden");
    expect(readPreference(key, () => storageOver(map))).toBe("hidden");
  });

  it("keeps the value for the page when storage refuses the write", () => {
    expect(() =>
      writePreference(key, "hidden", () => refusingCalls),
    ).not.toThrow();
    expect(readPreference(key, () => refusingCalls)).toBe("hidden");
  });

  it("keeps the value for the page when the browser refuses access to storage", () => {
    expect(() => writePreference(key, "LR", refusingAccess)).not.toThrow();
    expect(readPreference(key, refusingAccess)).toBe("LR");
  });

  it("keeps the value for the page with no storage at all", () => {
    expect(() => writePreference(key, "hidden", () => undefined)).not.toThrow();
    expect(readPreference(key, () => undefined)).toBe("hidden");
  });

  it("lets a later write that storage takes stand over one it refused", () => {
    const map = new Map<string, string>();
    writePreference(key, "LR", () => refusingCalls);
    writePreference(key, "TB", () => storageOver(map));
    expect(map.get(key)).toBe("TB");
    expect(readPreference(key, () => storageOver(map))).toBe("TB");
  });
});
