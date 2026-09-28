import { useSyncExternalStore } from "react";

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
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
