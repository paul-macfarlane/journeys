import type { Metadata } from "next";

import { RunnerFrame } from "@/components/runner/runner-frame";

// Replaces the root not-found's own title (ticket 60) whenever this
// segment's `notFound()` fires, so a missing or empty Project gets its own
// title rather than the generic "Page not found".
export const metadata: Metadata = {
  title: "Project not available",
};

/**
 * What `/p/[projectId]` renders for an unknown id and for a Project with no
 * live Journey alike (ticket 42, decision 4): the same screen for both, so
 * a link says nothing about whether the row exists. Painted in the app's
 * own `trail` Theme, since a segment `not-found.tsx` is never handed the
 * route's params and so cannot read the Project's own.
 */
export default function ProjectNotFound() {
  return (
    <RunnerFrame theme={{ preset: "trail", accent: null }} home>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          This project isn&apos;t available
        </h1>
        <p className="text-muted-foreground">
          It has no published journeys right now, or the link is wrong.
        </p>
      </div>
    </RunnerFrame>
  );
}
