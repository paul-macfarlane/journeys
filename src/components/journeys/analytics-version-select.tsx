"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

import { SELECT_CLASS } from "@/components/journeys/editor-shared";
import type { VersionSummary } from "@/db/versions";

/**
 * Which Published Version the Analytics tab is reading. Analytics are
 * scoped to one version at a time (spec story 65), and the chosen one is
 * named in the address — `?tab=analytics&version=<id>` — so a reload or a
 * shared link opens on the same numbers. Choosing replaces the address and
 * the server renders the tab again for that version; nothing is computed
 * in the browser.
 */
export function AnalyticsVersionSelect({
  versions,
  selectedId,
}: {
  /** Newest first, as the Versions tab lists them. */
  versions: VersionSummary[];
  selectedId: string;
}) {
  const router = useRouter();
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Version
      </label>
      <select
        id={id}
        className={SELECT_CLASS}
        value={selectedId}
        onChange={(event) => {
          const params = new URLSearchParams({
            tab: "analytics",
            version: event.target.value,
          });
          router.replace(`?${params.toString()}`);
        }}
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            Version {version.versionNumber}
            {version.isLive ? " (live)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
