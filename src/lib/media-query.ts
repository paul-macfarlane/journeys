import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the page answers `query` right now, kept current as the window is
 * resized or turned. False through the server render and the hydrating
 * one, because the server cannot know the width and a first render that
 * assumed one would not be the render the server sent; the browser's own
 * answer follows straight after hydration. `useSyncExternalStore` rather
 * than state set from an effect, as `usePreference` does, which the React
 * compiler's lint refuses.
 */
export function useMediaQuery(query: string): boolean {
  // Stable for as long as the query is, so React subscribes once rather
  // than on every render.
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
