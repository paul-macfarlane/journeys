import type { ReactNode } from "react";

/**
 * The shell every participant screen sits in: the start screen, each Step,
 * and the unavailable screen. Mobile-first — a Participant arrives on a
 * phone, from a link somebody sent them — so the column is narrow, the
 * padding is small at the smallest size, and nothing inside may push the page
 * sideways.
 *
 * Deliberately plain: a per-Project Theme colors this surface in ticket 11,
 * and anything decorative added here now would only have to be undone.
 */
export function RunnerFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {children}
    </main>
  );
}
