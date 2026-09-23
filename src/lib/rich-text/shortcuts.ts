/**
 * Turns a Tiptap key name (`Mod-b`, `Mod-Alt-1`, `Mod-Shift-8`) into the
 * hint a toolbar tooltip shows: `⌘B` on Apple platforms, `Ctrl+B` elsewhere.
 * Pure — the caller decides the platform once on the client, so the server
 * render and a test read the same thing.
 */

const APPLE_MODIFIERS: Record<string, string> = {
  Mod: "⌘",
  Alt: "⌥",
  Shift: "⇧",
};

const OTHER_MODIFIERS: Record<string, string> = {
  Mod: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
};

export function formatShortcut(binding: string, isApple: boolean): string {
  const modifiers = isApple ? APPLE_MODIFIERS : OTHER_MODIFIERS;
  const parts = binding
    .split("-")
    .map((part) => modifiers[part] ?? part.toUpperCase());
  return parts.join(isApple ? "" : "+");
}

/**
 * Whether the browser is on an Apple platform, where the Command key stands
 * in for Control. Client-only: the caller reads it once after mount.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
