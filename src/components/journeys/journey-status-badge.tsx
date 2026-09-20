/**
 * There is no publish state column yet — every Journey reads as "Never
 * published" until ticket 05 adds the live-version pointer that changes it.
 */
export function JourneyStatusBadge() {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Never published
    </span>
  );
}
