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
}: {
  publishState: PublishState;
}) {
  return <Badge>{labels[publishState]}</Badge>;
}
