import type { ReactNode } from "react";

/**
 * A small status label — "Never published", "Start", "Ending". One recipe so
 * every badge in the app reads the same; the styling lives here and nowhere
 * else.
 */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
