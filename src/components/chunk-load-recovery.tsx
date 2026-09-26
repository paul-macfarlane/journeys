"use client";

import { useEffect } from "react";

import { isChunkLoadError } from "@/lib/chunk-load";
import { reloadOnceInBrowser } from "@/lib/chunk-load-browser";

/**
 * Ticket 74: a tab opened before a deploy throws a chunk-load failure on
 * its first client-side navigation, once the old build's assets are gone.
 * Mounted once in the root layout, this listens for that failure — as a
 * thrown `error` event or a rejected dynamic `import()` surfacing as
 * `unhandledrejection` — and reloads the page once via
 * `reloadOnceForChunkError`. It renders nothing.
 */
export function ChunkLoadRecovery() {
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
