import { RestoreVersionDialog } from "@/components/journeys/restore-version-dialog";
import { Badge } from "@/components/ui/badge";
import type { VersionSummary } from "@/db/versions";

/**
 * A Journey's Published Versions, newest first: what was published, when, by
 * whom, which one participants are walking, and a way back to any of them.
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

export function VersionList({
  projectId,
  journeyId,
  versions,
}: {
  projectId: string;
  journeyId: string;
  versions: VersionSummary[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium tracking-tight">Versions</h2>

      {versions.length === 0 ? (
        <p className="text-muted-foreground text-sm">Not published yet.</p>
      ) : (
        // role="list" is explicit: the flex layout strips the list marker,
        // and some browsers drop the implicit role with it.
        <ul role="list" aria-label="Versions" className="flex flex-col gap-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 ring-1 ring-foreground/10"
            >
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
      )}
    </section>
  );
}
