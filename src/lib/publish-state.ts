/**
 * A Journey's publish state, derived and never stored: the Journey row
 * carries only the pointer at its live Published Version, and the Published
 * Versions themselves are the record of whether it was ever published.
 *
 * Deliberately no `server-only` — the Journey page, the Project page's list,
 * and the badge they share all read it, and it touches no database.
 */
export type PublishState = "never-published" | "published" | "unpublished";

export function publishStateOf({
  liveVersionId,
  versionCount,
}: {
  liveVersionId: string | null;
  versionCount: number;
}): PublishState {
  // A live pointer is the whole of "published": it can only ever name a
  // Published Version of this Journey, and it is cleared by unpublishing.
  if (liveVersionId !== null) return "published";

  // No live version, but versions exist: the Journey was taken back from
  // participants rather than never offered to them.
  return versionCount > 0 ? "unpublished" : "never-published";
}
