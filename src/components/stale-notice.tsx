"use client";

import { reloadPage } from "@/components/autosave";
import { Button } from "@/components/ui/button";
import { staleText, type StaleNoun } from "@/lib/autosave";

/**
 * What a Member sees when their save was refused because another Member
 * changed the same thing first (ticket 73): the sentence naming what was
 * changed, and the way out, which is to reload and see the other change.
 * Nothing is merged or retried; the refused edit stays on screen above
 * this until the Member reloads.
 */
export function StaleNotice({
  noun,
  onReload = reloadPage,
}: {
  /** What was changed; the sentence says "this" alone without one. */
  noun?: StaleNoun;
  /** A loop's own `reload`, which stands its unload guard down first. */
  onReload?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-destructive"
    >
      <span>{staleText(noun)}</span>
      <Button type="button" size="sm" variant="outline" onClick={onReload}>
        Reload
      </Button>
    </div>
  );
}
