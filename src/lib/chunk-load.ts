/**
 * Recognizing a chunk-load failure and deciding whether to reload once for
 * it. Pure and database-free: no `server-only`, no React; the browser's
 * storage and reload come in as parameters, so the rules can be checked
 * without a browser. Ticket 74: a tab opened before a deploy throws this on
 * its first client-side navigation after the old build's assets are gone.
 *
 * The reload guard is a marker in `sessionStorage` that allows exactly one
 * reload: with no marker, the marker is set and the page reloads; with the
 * marker present, nothing reloads, however long after. Only a client-side
 * navigation that succeeds clears it (`forgetChunkReload`, called by
 * `ChunkLoadRecovery` when the pathname changes), so a failure that
 * survives the reload cannot loop, and a later deploy still gets its one
 * reload. A browser that refuses storage — Chrome throws from
 * `window.sessionStorage` itself in some modes (ticket 35) — gives no way
 * to tell whether a reload already happened, so it gets no reload at all:
 * the error page instead of a possible reload loop.
 */

/**
 * The patterns cover the bundler/runtime combinations Next can produce:
 * webpack's "Loading chunk … failed" and "Loading CSS chunk … failed"
 * messages, and the dynamic-import failure message browsers and Turbopack
 * raise for an ESM chunk that 404s. Webpack's own `ChunkLoadError` is
 * matched by name.
 */
const CHUNK_LOAD_MESSAGE_PATTERNS = [
  /loading chunk .*failed/i,
  /failed to load chunk/i,
  /loading css chunk .*failed/i,
  /failed to fetch dynamically imported module/i,
];

/** Whether `error` is a failure to load one of the build's own chunks. */
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

/** The `sessionStorage` key whose presence means the one reload is spent. */
export const CHUNK_RELOAD_MARKER_KEY = "journeys:chunk-reload";

export type ChunkReloadStorage = {
  /** May throw (ticket 35: Chrome throws on storage access in some modes). */
  storage: () => Storage;
};

export type ReloadOnceForChunkErrorDeps = ChunkReloadStorage & {
  reload: () => void;
};

/**
 * Reloads once and reports whether it did: only when no marker is stored,
 * and only once the marker is written. Any storage failure means no reload.
 */
export function reloadOnceForChunkError(
  deps: ReloadOnceForChunkErrorDeps,
): boolean {
  try {
    const storage = deps.storage();
    if (storage.getItem(CHUNK_RELOAD_MARKER_KEY) !== null) {
      return false;
    }
    storage.setItem(CHUNK_RELOAD_MARKER_KEY, "1");
    deps.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears the marker after a client-side navigation succeeded, so the next
 * chunk-load failure (a later deploy) may reload once again. A storage that
 * throws is left as it is.
 */
export function forgetChunkReload(deps: ChunkReloadStorage): void {
  try {
    deps.storage().removeItem(CHUNK_RELOAD_MARKER_KEY);
  } catch {
    // Nothing was stored that could be read back either.
  }
}
