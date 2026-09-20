import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The banner and back link every Preview screen shows, so an Author can
 * never mistake walking a Draft for walking a live, published Journey.
 * Preview-specific — unlike the components under `@/components/runner`,
 * this has no place in the participant runner ticket 06 builds.
 */
export function PreviewChrome({
  projectId,
  journeyId,
  children,
}: {
  projectId: string;
  journeyId: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">
        Preview — nothing you do here is recorded.
      </p>
      <Link
        href={`/projects/${projectId}/journeys/${journeyId}`}
        className="text-muted-foreground text-sm hover:text-foreground"
      >
        ← Back to journey
      </Link>
      {children}
    </main>
  );
}
