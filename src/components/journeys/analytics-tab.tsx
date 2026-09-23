"use client";

import { useCallback } from "react";

import { AnalyticsCanvas } from "@/components/journeys/analytics-canvas";
import { AnalyticsVersionSelect } from "@/components/journeys/analytics-version-select";
import { DirectionControl } from "@/components/journeys/direction-control";
import type { VersionSummary } from "@/db/versions";
import {
  formatShare,
  type OutcomeGroup,
  type VersionAnalytics,
} from "@/lib/analytics";
import {
  ANALYTICS_DIRECTION_STORAGE_KEY,
  usePreference,
  writePreference,
} from "@/lib/browser-preferences";
import {
  layoutDirectionSchema,
  type GraphDocument,
  type LayoutDirection,
} from "@/lib/graph/document";
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
 *
 * Which way the map runs is the reader's to choose, beside the version: a
 * Published Version is immutable, so turning the map is a way of reading it
 * and not an edit, and the browser keeps the choice for every version and
 * every Journey it reads — as it keeps whether the editor's panel is put
 * away — with the version's own direction until it has chosen.
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

  return <AnalyticsReading versions={versions} selected={selected} />;
}

/**
 * The tab with a version to read: the row of controls, the totals, the map,
 * and the chart. Apart from `AnalyticsTab` only so the empty tab above has
 * no state to carry.
 */
function AnalyticsReading({
  versions,
  selected,
}: {
  versions: VersionSummary[];
  selected: SelectedVersionAnalytics;
}) {
  const { analytics, document } = selected;

  // Which way this browser has turned the map, if it has. Until it has
  // chosen — and, on the render the server sent, until the page is the
  // browser's — the map runs the way the version was published.
  const stored = layoutDirectionSchema.safeParse(
    usePreference(ANALYTICS_DIRECTION_STORAGE_KEY),
  );
  const preference = stored.success ? stored.data : null;

  const chooseDirection = useCallback((direction: LayoutDirection) => {
    writePreference(ANALYTICS_DIRECTION_STORAGE_KEY, direction);
  }, []);

  const direction = preference ?? document.layoutDirection;

  return (
    <section aria-label="Analytics" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <AnalyticsVersionSelect
            versions={versions}
            selectedId={selected.versionId}
          />
          <DirectionControl
            direction={direction}
            onSetLayoutDirection={chooseDirection}
          />
        </div>
        <p className="text-muted-foreground text-sm">
          Every number is computed from runs of this version alone. Runs are
          anonymous.
        </p>
      </div>

      <Totals analytics={analytics} />

      {/* Remounted per version, so the map fits the version it now shows. */}
      <AnalyticsCanvas
        key={selected.versionId}
        document={document}
        analytics={analytics}
        direction={direction}
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
