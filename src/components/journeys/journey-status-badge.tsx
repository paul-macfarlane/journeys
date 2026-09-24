"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { PublishState } from "@/lib/publish-state";

/**
 * What a Journey's publish state is called where an Author reads it. The
 * state itself is derived from the live-version pointer and the Journey's
 * Published Versions; this only names it.
 */
const labels: Record<PublishState, string> = {
  "never-published": "Never published",
  published: "Published",
  unpublished: "Unpublished",
};

export function JourneyStatusBadge({
  publishState,
  entrance = false,
}: {
  publishState: PublishState;
  /**
   * On the Journey page, where the badge is what a publish changes
   * (ticket 65): "Published" fades in when it arrives, so the change
   * registers without anything moving. Only for a change made under the
   * Author — a page that loads already published has nothing to register,
   * so the entrance waits for the state to differ from the one it mounted
   * with. Off in lists, where nothing changes under the reader.
   */
  entrance?: boolean;
}) {
  const [mountedWith] = useState(publishState);
  const entering =
    entrance && publishState === "published" && publishState !== mountedWith;

  return (
    <Badge
      className={
        entering
          ? "animate-in fade-in duration-500 motion-reduce:animate-none"
          : undefined
      }
    >
      {labels[publishState]}
    </Badge>
  );
}
