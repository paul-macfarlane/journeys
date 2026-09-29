"use client";

import { useState, type ReactNode } from "react";

import { VersionMap } from "@/components/journeys/analytics-canvas";
import type { GraphDocument } from "@/lib/graph/document";

/**
 * A Published Version's map beside the Step it has selected (ticket 94):
 * the Start until the Member picks another box. The panels arrive rendered
 * — one per Step, by the server, with the runner's rich text — and this
 * shows the selected one. Side by side on a wide screen, the panel under
 * the map on a narrow one.
 */
export function VersionView({
  document,
  panels,
}: {
  document: GraphDocument;
  /** Every Step's read-only panel, by Step id. */
  panels: Record<string, ReactNode>;
}) {
  const [selectedStepId, setSelectedStepId] = useState(document.startStepId);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <VersionMap
          document={document}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
        />
      </div>
      <section
        aria-label="Selected step"
        className="min-w-0 rounded-xl px-5 py-4 ring-1 ring-foreground/10"
      >
        {panels[selectedStepId] ?? null}
      </section>
    </div>
  );
}
