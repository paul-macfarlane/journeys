import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A small status label — "Never published", "Start", "Ending". One recipe so
 * every badge in the app reads the same; the styling lives here and nowhere
 * else.
 */
export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  /** `destructive` for a label about something wrong — a problem count. */
  tone?: "default" | "destructive";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "destructive"
          ? "border-destructive/50 text-destructive"
          : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
