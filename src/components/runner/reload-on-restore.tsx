"use client";

import { useEffect } from "react";

/**
 * Makes the browser's own back button reach the server.
 *
 * A runner step page records the move its URL asks for while it renders, so a
 * back navigation has to be a real request. Browsers would rather it weren't:
 * the back/forward cache restores the previous page from memory, firing no
 * request at all, and it does so regardless of `Cache-Control` (Next.js owns
 * that header for App Router pages anyway, so it cannot be set to `no-store`
 * from `next.config.ts`). A restored page announces itself — `pageshow` with
 * `persisted` — and reloading from there is the only way back to the server.
 *
 * Without this, a backtrack taken with the browser button would go unrecorded
 * until the Participant's next Choice, which the path reducer does still
 * resolve (it truncates to the Step the Choice was offered from). This makes
 * the Run's path match what the Participant is actually looking at, the
 * moment they look at it.
 */
export function ReloadOnRestore() {
  useEffect(() => {
    // The back/forward cache: the whole page comes back from memory, and the
    // listener registered on the way out is what survives to notice.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);

    // The ordinary HTTP cache: a history navigation builds a fresh document
    // out of a stored response without asking the server, which browsers do
    // even for `no-cache`. Nothing came over the wire — `transferSize` is
    // zero — so this page is a picture of a Step the Run may have left.
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (navigation?.type === "back_forward" && navigation.transferSize === 0) {
      window.location.reload();
    }

    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
