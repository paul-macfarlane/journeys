import { Badge } from "@/components/ui/badge";

/**
 * There is no publish state column yet — every Journey reads as "Never
 * published" until ticket 05 adds the live-version pointer that changes it.
 */
export function JourneyStatusBadge() {
  return <Badge>Never published</Badge>;
}
