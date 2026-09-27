import { documentsEqual, type GraphDocument } from "@/lib/graph/document";

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

/**
 * What a Journey has that participants are not yet seeing (ticket 82): the
 * rule behind the Journey page's "Unpublished changes", Publish's
 * enablement, and the Draft row's timestamp on the Versions tab.
 *
 * `draft.document` is null for a Draft whose row cannot be read, and `live`
 * is the live Published Version (`unreadable` when its row cannot be read,
 * ticket 83), or null when the Journey has none. Neither unreadable side is
 * ever what participants see, so either keeps Publish on offer, and Publish
 * refuses it with the reason.
 */
export function draftPending({
  journey,
  draft,
  live,
}: {
  journey: { title: string; description: string; updatedAt: Date };
  draft: { document: GraphDocument | null; updatedAt: Date };
  live:
    | {
        kind: "ok";
        title: string;
        description: string;
        document: GraphDocument;
      }
    | { kind: "unreadable" }
    | null;
}): {
  hasUnpublishedChanges: boolean;
  draftEditedAt: Date;
} {
  const liveOk = live?.kind === "ok" ? live : null;
  const titleOrDescriptionPending =
    liveOk === null ||
    liveOk.title !== journey.title ||
    liveOk.description !== journey.description;
  const hasUnpublishedChanges =
    titleOrDescriptionPending ||
    draft.document === null ||
    liveOk === null ||
    !documentsEqual(draft.document, liveOk.document);

  // The document's own save, or the title's and description's when they are
  // what is pending and were edited later. The Journey row's timestamp also
  // moves on publish, unpublish, and a Theme change, so it counts only while
  // the title or description differs from the live version.
  const draftEditedAt =
    titleOrDescriptionPending && journey.updatedAt > draft.updatedAt
      ? journey.updatedAt
      : draft.updatedAt;

  return { hasUnpublishedChanges, draftEditedAt };
}
