"use client";

import { useEffect } from "react";

/**
 * Keeps the browser's own history in step with the Run's path — the half of
 * that job which can wait for hydration.
 *
 * A runner step page records the move its URL asks for while it renders, so a
 * back navigation has to be a real request. Browsers would rather it weren't:
 * the back/forward cache restores the previous page from memory, firing no
 * request at all, and it does so regardless of `Cache-Control` (Next.js owns
 * that header for App Router pages anyway, so it cannot be set to `no-store`
 * from `next.config.ts`). A restored page announces itself with a `pageshow`
 * whose `persisted` flag is set, and going back to the server from there is
 * the only way to record the backtrack the moment the Participant takes it.
 * The restored document is the old one, rendered against a path the Run may
 * have walked on from, so there is nothing to compare its index against: it
 * always returns to the server.
 *
 * Since ticket 18 a Published Version may hold a loop, and then the URL alone
 * no longer says what a back navigation means: on a loop-closing Step the Step
 * behind the Participant is also a Choice of the Step they are on, and the
 * path reducer resolves a Choice first. So every step page stores its path
 * index in `history.state`, and a restored page goes back to the server at
 * `?at=<that index>` — an entry of the path, not a Choice. With no usable
 * index stored (an entry from before this shipped) it falls back to a plain
 * reload, which is still right for every Journey without a loop.
 *
 * The other half — remembering the index, and correcting a *fresh* document
 * built by a back/forward navigation — cannot afford to wait for React at
 * all, and lives in `RunHistoryScript`, inline above this component.
 *
 * What is left here, besides `pageshow`, is rewriting the URL to the bare
 * step path: `?at` and `?notice` have been read by the server and have no
 * business staying in the address bar or in the history entry a later Back
 * would return to. Doing it needs the router, so it needs hydration — and it
 * writes the index again on the way past, which costs nothing and keeps the
 * two pieces saying the same thing. The state written is a plain object,
 * deliberately not a copy of what is already there: Next.js App Router
 * patches `replaceState`, and carrying its `__NA` marker back in makes that
 * patch treat the call as one of its own and skip syncing the router's
 * canonical URL, which would leave `?at` on the entry. A plain object lets
 * Next.js put its own internals back and sync. Nothing here uses `next/link`
 * or the router directly: these are whole-document navigations by design.
 */
export function RunHistory({ pathIndex }: { pathIndex: number }) {
  useEffect(() => {
    // The back/forward cache: the whole page comes back from memory, and the
    // listener registered on the way out is what survives to notice.
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;

      const stored = (window.history.state as { pathIndex?: unknown } | null)
        ?.pathIndex;

      if (typeof stored === "number") {
        window.location.replace(`${window.location.pathname}?at=${stored}`);
        return;
      }

      window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);

    window.history.replaceState({ pathIndex }, "", window.location.pathname);

    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathIndex]);

  return null;
}
