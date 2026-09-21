"use client";

import { useEffect } from "react";

/**
 * Keeps the browser's own history in step with the Run's path.
 *
 * Two jobs, both of them about the server seeing what the Participant sees.
 *
 * A runner step page records the move its URL asks for while it renders, so a
 * back navigation has to be a real request. Browsers would rather it weren't:
 * the back/forward cache restores the previous page from memory, firing no
 * request at all, and it does so regardless of `Cache-Control` (Next.js owns
 * that header for App Router pages anyway, so it cannot be set to `no-store`
 * from `next.config.ts`). A restored page announces itself — `pageshow` with
 * `persisted`, or a fresh document whose navigation type is `back_forward` —
 * and going back to the server from there is the only way to record the
 * backtrack the moment the Participant takes it.
 *
 * Since ticket 18 a Published Version may hold a loop, and then the URL alone
 * no longer says what a back navigation means: on a loop-closing Step the Step
 * behind the Participant is also a Choice of the Step they are on, and the
 * path reducer resolves a Choice first. So every step page stores its path
 * index in `history.state`, and a restored page goes back to the server at
 * `?at=<that index>` — an entry of the path, not a Choice. With no usable
 * index stored (an entry from before this shipped) it falls back to the plain
 * reload, which is still right for every Journey without a loop.
 *
 * On an ordinary render it writes the index instead, and rewrites the URL to
 * the bare step path: `?at` and `?notice` have been read by the server and
 * have no business staying in the address bar or in the history entry a later
 * Back would return to. Next.js App Router patches `replaceState`, so its own
 * state is merged rather than thrown away. Nothing here uses `next/link` or
 * the router: these are whole-document navigations by design.
 */
export function RunHistory({ pathIndex }: { pathIndex: number }) {
  useEffect(() => {
    /** Back to the server at the index this history entry remembers. */
    function returnToServer(): void {
      const stored = (window.history.state as { pathIndex?: unknown } | null)
        ?.pathIndex;
      const hasIndexAlready = new URLSearchParams(window.location.search).has(
        "at",
      );

      if (typeof stored === "number" && !hasIndexAlready) {
        window.location.replace(`${window.location.pathname}?at=${stored}`);
        return;
      }

      window.location.reload();
    }

    // The back/forward cache: the whole page comes back from memory, and the
    // listener registered on the way out is what survives to notice.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) returnToServer();
    }
    window.addEventListener("pageshow", onPageShow);
    const stopListening = () =>
      window.removeEventListener("pageshow", onPageShow);

    // The ordinary HTTP cache: a history navigation builds a fresh document
    // out of a stored response without asking the server, which browsers do
    // even for `no-cache`. Even when it did ask, the request carried no index,
    // so the server may have read a loop-closing Back as a Choice — asking
    // again with the index is what puts the path right.
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (navigation?.type === "back_forward") {
      returnToServer();
      return stopListening;
    }

    window.history.replaceState(
      { ...(window.history.state ?? {}), pathIndex },
      "",
      window.location.pathname,
    );

    return stopListening;
  }, [pathIndex]);

  return null;
}
