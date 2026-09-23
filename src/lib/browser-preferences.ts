import { useSyncExternalStore } from "react";

/**
 * What one browser remembers about how its reader looks at a Journey:
 * nothing about the Journey itself, which every Member sees, but how this
 * screen was last looking at it — the Step panel put away, the Analytics
 * map turned. Kept in `localStorage`, so it lasts across pages and reloads
 * in this browser and nowhere else, and never written into a document.
 *
 * Every read and write is guarded: a browser that refuses storage — a
 * private window, site data blocked, a full quota — is one where a choice
 * lasts as long as the page, which is no reason to refuse the click that
 * made it. Chrome refuses by throwing from `window.localStorage` itself, so
 * the storage is reached through a function, inside the guard; the function
 * is a parameter so the guards can be exercised without a browser, and
 * callers leave it to default to the window's.
 */

/** Whether the editor's Step panel is put away: `"hidden"` or `"shown"`. */
export const PANEL_STORAGE_KEY = "journeys:step-panel";

/**
 * Which way the Analytics map is drawn, `"TB"` or `"LR"`, when this browser
 * has turned it; unset, the map follows the Published Version's own
 * direction.
 */
export const ANALYTICS_DIRECTION_STORAGE_KEY = "journeys:analytics-direction";

type GetStorage = () => Storage | undefined;

const windowStorage: GetStorage = () =>
  typeof window === "undefined" ? undefined : window.localStorage;

/**
 * What a refusing browser was asked to store, kept for the life of the page
 * so the choice still stands here. Read ahead of storage: what is here was
 * written after whatever storage last managed to hold.
 */
const unsaved = new Map<string, string>();

/** What is stored under `key`, or null: unset, no storage, or storage refused. */
export function readPreference(
  key: string,
  getStorage: GetStorage = windowStorage,
): string | null {
  const held = unsaved.get(key);
  if (held !== undefined) return held;
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Stores `value` under `key` — for the page alone when the browser refuses
 * — and tells every `usePreference` on the page: the browser's own
 * `storage` event is sent to every other tab and never to the one that
 * wrote.
 */
export function writePreference(
  key: string,
  value: string,
  getStorage: GetStorage = windowStorage,
): void {
  try {
    const storage = getStorage();
    if (storage === undefined) throw new Error("no storage");
    storage.setItem(key, value);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, value);
  }
  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const nothingStored = () => null;

/**
 * What the browser has stored under `key`, kept current: null through the
 * server render and the hydrating one, because the server cannot know it
 * and a first render that assumed it would not be the render the server
 * sent; then whatever is stored, and whatever is stored next — by this
 * page's `writePreference` or by another tab's.
 */
export function usePreference(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readPreference(key),
    nothingStored,
  );
}
