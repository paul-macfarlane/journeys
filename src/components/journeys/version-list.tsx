import Link from "next/link";

import { CannotBeRead } from "@/components/cannot-be-read";
import { PublishButton } from "@/components/journeys/publish-controls";
import { RestoreVersionDialog } from "@/components/journeys/restore-version-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { VersionSummary } from "@/db/versions";
import { cn } from "@/lib/utils";

/**
 * A Journey's Published Versions, newest first: what was published, when, by
 * whom, which one participants are walking, and a way back to any of them.
 *
 * Above them, while it differs from the live version, the Draft: what would
 * be published next, when it was last edited, and the two things to do with
 * it — go and edit it, or publish it. When the live version is the Draft
 * exactly there is nothing pending, so the list is the versions alone.
 */

/**
 * Fixed locale and time zone, formatted on the server: the moment a version
 * was published is the same moment for every Member, and a browser-local
 * format would differ from what the server rendered and mismatch on
 * hydration. The `dateTime` attribute carries the exact instant.
 */
const publishedAtFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const rowClassName =
  "flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 ring-1 ring-foreground/10";

export function VersionList({
  projectId,
  journeyId,
  versions,
  hasUnpublishedChanges,
  draftUpdatedAt,
  unreadableLive,
}: {
  projectId: string;
  journeyId: string;
  versions: VersionSummary[];
  /**
   * True while the Draft, the title, or the description differs from the
   * live version — and always for a Journey with no live version.
   */
  hasUnpublishedChanges: boolean;
  /**
   * When the Draft was last edited: its document's save or restore, or a
   * later title or description edit while that is what is pending.
   */
  draftUpdatedAt: Date;
  /**
   * The Journey's live Published Version, when its row fails the document
   * contract (ticket 83): named in a banner above the list, which still
   * renders every version — restoring an earlier one is the way back.
   */
  unreadableLive: { versionNumber: number } | null;
}) {
  return (
    <section aria-label="Versions" className="flex flex-col gap-4">
      {unreadableLive ? (
        <CannotBeRead
          title={`Version ${unreadableLive.versionNumber} can't be read`}
        >
          <p>
            {`The live version, Version ${unreadableLive.versionNumber}, is stored in a shape participants can’t read, so it shows as unavailable to them. Restoring an earlier version and publishing again replaces it.`}
          </p>
        </CannotBeRead>
      ) : null}

      {hasUnpublishedChanges || versions.length > 0 ? (
        // role="list" is explicit: the flex layout strips the list marker,
        // and some browsers drop the implicit role with it.
        <ul role="list" aria-label="Versions" className="flex flex-col gap-2">
          {hasUnpublishedChanges ? (
            <li className={rowClassName}>
              <span className="font-medium">Draft</span>
              <Badge>Unpublished changes</Badge>

              <span className="text-muted-foreground text-sm">
                Last edited{" "}
                <time dateTime={draftUpdatedAt.toISOString()}>
                  {publishedAtFormat.format(draftUpdatedAt)} UTC
                </time>
              </span>

              <div className="ml-auto flex items-center gap-2">
                {/* The editor is the plain address: `UrlTabs` reads the tab
                    off the address, so this link opens it in place. */}
                <Link
                  href={`/projects/${projectId}/journeys/${journeyId}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  Open editor
                </Link>
                <PublishButton
                  projectId={projectId}
                  journeyId={journeyId}
                  hasUnpublishedChanges
                  size="sm"
                />
              </div>
            </li>
          ) : null}

          {versions.map((version) => (
            <li key={version.id} className={rowClassName}>
              <span className="font-medium">
                Version {version.versionNumber}
              </span>
              {version.isLive ? <Badge>Live</Badge> : null}

              <time
                dateTime={version.publishedAt.toISOString()}
                className="text-muted-foreground text-sm"
              >
                {publishedAtFormat.format(version.publishedAt)} UTC
              </time>

              <span className="text-muted-foreground text-sm">
                {/* The Member who published it, while their account exists. */}
                by {version.publishedByName ?? "a former member"}
              </span>

              <div className="ml-auto">
                <RestoreVersionDialog
                  projectId={projectId}
                  journeyId={journeyId}
                  versionId={version.id}
                  versionNumber={version.versionNumber}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {versions.length === 0 ? (
        <p className="text-muted-foreground text-sm">Not published yet.</p>
      ) : null}
    </section>
  );
}
