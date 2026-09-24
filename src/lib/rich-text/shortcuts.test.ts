import { describe, expect, it } from "vitest";

import { formatShortcut } from "./shortcuts";

/**
 * The toolbar's tooltips read Tiptap's own key names, so the hint an Author
 * sees is the binding the editor actually answers to.
 */
describe("formatShortcut", () => {
  it("renders Mod as ⌘ on Apple platforms and Ctrl elsewhere", () => {
    expect(formatShortcut("Mod-b", true)).toBe("⌘B");
    expect(formatShortcut("Mod-b", false)).toBe("Ctrl+B");
  });

  it("renders Alt as ⌥ on Apple platforms and Alt elsewhere", () => {
    expect(formatShortcut("Mod-Alt-1", true)).toBe("⌘⌥1");
    expect(formatShortcut("Mod-Alt-1", false)).toBe("Ctrl+Alt+1");
  });

  it("renders Shift as ⇧ on Apple platforms and Shift elsewhere", () => {
    expect(formatShortcut("Mod-Shift-8", true)).toBe("⌘⇧8");
    expect(formatShortcut("Mod-Shift-8", false)).toBe("Ctrl+Shift+8");
  });

  it("reads Shift with a letter, as strikethrough and quote bind it", () => {
    expect(formatShortcut("Mod-Shift-s", true)).toBe("⌘⇧S");
    expect(formatShortcut("Mod-Shift-b", false)).toBe("Ctrl+Shift+B");
  });

  it("upper-cases the letter key", () => {
    expect(formatShortcut("Mod-k", true)).toBe("⌘K");
    expect(formatShortcut("Mod-k", false)).toBe("Ctrl+K");
  });
});
