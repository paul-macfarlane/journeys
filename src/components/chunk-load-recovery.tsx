"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  forgetChunkReload,
  isChunkLoadError,
  reloadOnceForChunkError,
} from "@/lib/chunk-load";

/**
 * `reloadOnceForChunkError` with the real window's `sessionStorage` and
 * reload, for the three places that need it: `ChunkLoadRecovery` below and
 * the `error.tsx` / `global-error.tsx` boundaries. Reports whether it
 * reloaded.
 */
export function reloadOnceInBrowser(): boolean {
  return reloadOnceForChunkError({
    storage: () => window.sessionStorage,
    reload: () => window.location.reload(),
  });
}

/** `forgetChunkReload` against the real window's `sessionStorage`. */
export function clearChunkReloadMarker(): void {
  forgetChunkReload({ storage: () => window.sessionStorage });
}

/**
 * Ticket 74: a tab opened before a deploy throws a chunk-load failure on
 * its first client-side navigation, once the old build's assets are gone.
 * Mounted once in the root layout, this listens for that failure — as a
 * thrown `error` event or a rejected dynamic `import()` surfacing as
 * `unhandledrejection` — and reloads the page once via
 * `reloadOnceInBrowser`. When the pathname changes after the first render,
 * a client-side navigation has succeeded, so it clears the reload marker
 * and a later deploy gets its own one reload. It renders nothing.
 */
export function ChunkLoadRecovery() {
  const pathname = usePathname();
  const firstPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== firstPathname.current) {
      firstPathname.current = pathname;
      clearChunkReloadMarker();
    }
  }, [pathname]);

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (isChunkLoadError(event.error)) {
        reloadOnceInBrowser();
      }
    }

    function handleRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) {
        reloadOnceInBrowser();
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
