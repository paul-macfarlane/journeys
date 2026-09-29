import type { Metadata } from "next";

import { RunnerFrame } from "@/components/runner/runner-frame";

// Replaces the root not-found's own title (ticket 60) whenever this
// segment's `notFound()` fires.
export const metadata: Metadata = {
  title: "Journey not available",
};

/**
 * What `/j/[journeyId]` renders for an unknown id, a never-published
 * Journey, and a taken-down one alike (ticket 42, decision 4): the copy
 * this screen showed inline before the scope change, now the app's own
 * 404 so a link to nothing previews and answers exactly as an unknown id
 * does. Painted in the app's own `trail` Theme, since a segment
 * `not-found.tsx` is never handed the route's params and so cannot read
 * the Journey's own.
 */
export default function JourneyNotFound() {
  return (
    <RunnerFrame theme={{ preset: "trail", accent: null }} home>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          This journey isn&apos;t available
        </h1>
        <p className="text-muted-foreground">
          It has been taken down or hasn&apos;t been published yet.
        </p>
      </div>
    </RunnerFrame>
  );
}
