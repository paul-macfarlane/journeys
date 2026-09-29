"use client";

import { useState, type ReactNode } from "react";

import { VersionMap } from "@/components/journeys/analytics-canvas";
import { stepName, type GraphDocument } from "@/lib/graph/document";

/**
 * A Published Version's map beside the Step it has selected (ticket 94):
 * the Start until the Member picks another box. The panels arrive rendered
 * — one per Step, by the server, with the runner's rich text — and this
 * shows the selected one. Side by side on a wide screen, the panel under
 * the map on a narrow one.
 *
 * Selecting a box leaves focus on it, so the panel's change is said aloud
 * instead: a polite, visually hidden "Showing <step>" — empty until the
 * first selection, so loading the page announces nothing. Not
 * `role="status"`: the view's Restore already reports through one.
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
  const [announcement, setAnnouncement] = useState("");

  function selectStep(stepId: string) {
    setSelectedStepId(stepId);
    const step = document.steps[stepId];
    if (step !== undefined) setAnnouncement(`Showing ${stepName(step)}`);
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <VersionMap
          document={document}
          selectedStepId={selectedStepId}
          onSelectStep={selectStep}
        />
      </div>
      <section
        aria-label="Selected step"
        className="min-w-0 rounded-xl px-5 py-4 ring-1 ring-foreground/10"
      >
        <p aria-live="polite" className="sr-only" data-slot="step-announcer">
          {announcement}
        </p>
        {panels[selectedStepId] ?? null}
      </section>
    </div>
  );
}
