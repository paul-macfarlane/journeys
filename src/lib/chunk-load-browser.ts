"use client";

// The real-`window` deps for `reloadOnceForChunkError`, shared by the three
// call sites that need them: `ChunkLoadRecovery` (the root layout's
// listener) and the `error.tsx` / `global-error.tsx` boundaries.
import { reloadOnceForChunkError } from "@/lib/chunk-load";

export function reloadOnceInBrowser(): boolean {
  return reloadOnceForChunkError({
    storage: () => window.sessionStorage,
    reload: () => window.location.reload(),
    now: () => Date.now(),
  });
}
