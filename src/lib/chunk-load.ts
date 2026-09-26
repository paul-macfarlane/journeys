// Pure, database-free (no `server-only`, no React): recognizing a
// chunk-load failure and deciding whether to reload once for it. Ticket 74:
// a tab opened before a deploy throws this on its first client-side
// navigation after the old build's assets are gone.
//
// The patterns below cover the bundler/runtime combinations Next can
// produce: webpack's own `ChunkLoadError` name, its "Loading chunk … failed"
// and "Loading CSS chunk … failed" messages, and the dynamic-import failure
// message browsers and Turbopack raise for an ESM chunk that 404s.
const CHUNK_LOAD_MESSAGE_PATTERNS = [
  /loading chunk .*failed/i,
  /failed to load chunk/i,
  /loading css chunk .*failed/i,
  /failed to fetch dynamically imported module/i,
];

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "ChunkLoadError") {
    return true;
  }
  return CHUNK_LOAD_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(error.message),
  );
}

// A second failure right after the reload should not loop; a later deploy
// should still get a fresh reload. Any interval short enough to not span a
// real user session but long enough to cover the reload's own round trip
// works here.
const RELOAD_MARKER_KEY = "journeys.chunk-reload";
const RELOAD_WINDOW_MS = 10_000;

export interface ReloadOnceForChunkErrorDeps {
  // May throw (ticket 35: Chrome throws on storage access in some modes).
  storage: () => Storage;
  reload: () => void;
  now: () => number;
}

// Reloads at most once per `RELOAD_WINDOW_MS`. Every storage access is in
// try/catch; if storage is unavailable we cannot tell whether a reload
// already happened, so we do not reload rather than risk a loop.
export function reloadOnceForChunkError(
  deps: ReloadOnceForChunkErrorDeps,
): boolean {
  try {
    const storage = deps.storage();
    const marker = storage.getItem(RELOAD_MARKER_KEY);
    const now = deps.now();

    if (marker !== null) {
      const markedAt = Number(marker);
      if (Number.isFinite(markedAt) && now - markedAt < RELOAD_WINDOW_MS) {
        return false;
      }
    }

    storage.setItem(RELOAD_MARKER_KEY, String(now));
    deps.reload();
    return true;
  } catch {
    return false;
  }
}
