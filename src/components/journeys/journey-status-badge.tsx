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
   * registers without anything moving. Keyed on the state, so the badge
   * is a new element — and the entrance plays — when the state changes
   * under a re-render of the page, and otherwise only once, as the page
   * loads. Off in lists, where a fade on every load would say nothing.
   */
  entrance?: boolean;
}) {
  return (
    <Badge
      key={publishState}
      className={
        entrance && publishState === "published"
          ? "animate-in fade-in duration-500 motion-reduce:animate-none"
          : undefined
      }
    >
      {labels[publishState]}
    </Badge>
  );
}
