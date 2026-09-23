import { AnalyticsCanvas } from "@/components/journeys/analytics-canvas";
import { AnalyticsVersionSelect } from "@/components/journeys/analytics-version-select";
import type { VersionSummary } from "@/db/versions";
import {
  formatShare,
  type OutcomeGroup,
  type VersionAnalytics,
} from "@/lib/analytics";
import type { GraphDocument } from "@/lib/graph/document";
import { cn } from "@/lib/utils";

/**
 * The Journey page's Analytics tab: one Published Version's Runs, read off
 * the map. Which version is the address's to say (`AnalyticsVersionSelect`);
 * the totals sit above the map, the map carries the numbers on its Steps
 * and Choices, and the Runs-by-Outcome chart beneath it says what happened
 * in the Author's own words — "40% reached care" — with an untagged Ending
 * standing under its own title and the Runs that stopped short as a bar of
 * their own, so every start is in exactly one bar. Member-only by way of
 * the page that renders it; never a Run id or a Participant.
 */

export type SelectedVersionAnalytics = {
  versionId: string;
  document: GraphDocument;
  analytics: VersionAnalytics;
};

export function AnalyticsTab({
  versions,
  selected,
}: {
  /** Newest first. Empty for a Journey never published. */
  versions: VersionSummary[];
  /** Null exactly when there is no version to read. */
  selected: SelectedVersionAnalytics | null;
}) {
  if (versions.length === 0 || selected === null) {
    return (
      <section aria-label="Analytics" className="flex flex-col gap-2">
        <p className="text-muted-foreground">
          Not published yet. Analytics are computed per published version, from
          the runs participants make through it.
        </p>
      </section>
    );
  }

  const { analytics } = selected;

  return (
    <section aria-label="Analytics" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AnalyticsVersionSelect
          versions={versions}
          selectedId={selected.versionId}
        />
        <p className="text-muted-foreground text-sm">
          Every number is computed from runs of this version alone. Runs are
          anonymous.
        </p>
      </div>

      <Totals analytics={analytics} />

      {/* Remounted per version, so the map fits the version it now shows. */}
      <AnalyticsCanvas
        key={selected.versionId}
        document={selected.document}
        analytics={analytics}
      />

      <OutcomeChart groups={analytics.outcomes} starts={analytics.starts} />
    </section>
  );
}

/** The basic denominators (spec story 66), as a row of tiles. */
function Totals({ analytics }: { analytics: VersionAnalytics }) {
  const tiles: { label: string; value: string }[] = [
    { label: "Starts", value: String(analytics.starts) },
    { label: "Completions", value: String(analytics.completions) },
    { label: "Abandoned", value: String(analytics.abandoned) },
    { label: "Completion rate", value: formatShare(analytics.completionRate) },
  ];

  return (
    <dl aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-foreground/10"
        >
          <dt className="text-muted-foreground text-sm">{tile.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Runs by Outcome as a table that draws its own bars: each row an Outcome
 * (or an untagged Ending, or Abandoned), its Run count, and its share of
 * every start, with the bar's length the share. One hue for what the Author
 * named and a muted bar for the Runs that stopped short; the numbers are
 * text beside every bar, so nothing is read off length or color alone.
 */
function OutcomeChart({
  groups,
  starts,
}: {
  groups: OutcomeGroup[];
  starts: number;
}) {
  return (
    <section aria-label="Runs by outcome" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">Runs by outcome</h3>
        <p className="text-muted-foreground text-sm">
          {starts === 0
            ? "No runs yet. Once participants walk this version, each outcome's share appears here."
            : "Each run counts once: under the outcome of the ending it reached, under the ending's own title when it has no outcome, or as abandoned."}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Outcome</th>
            <th scope="col">Runs</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.key} data-outcome-key={group.key}>
              <th
                scope="row"
                className={cn(
                  "w-1/3 py-1.5 pr-3 text-left font-normal",
                  group.kind === "abandoned" ? "text-muted-foreground" : null,
                )}
              >
                {group.label}
              </th>
              <td className="w-16 py-1.5 pr-3 text-right tabular-nums">
                {group.runs}
              </td>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 flex-1 rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        group.kind === "abandoned"
                          ? "bg-muted-foreground/40"
                          : "bg-primary",
                      )}
                      style={{ width: `${(group.share ?? 0) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right tabular-nums">
                    {formatShare(group.share)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
