"use client";

import { useSyncExternalStore } from "react";

/** Whether the client has mounted never changes once it has, so nothing to subscribe to. */
const noSubscription = () => () => {};

/**
 * A moment in the viewer's own time and zone, everywhere but the server
 * (ticket 79 item 6). Every viewer's browser reads a different zone off
 * `Intl.DateTimeFormat(undefined, …)`, which the server cannot know and
 * would mismatch on hydration if it tried — so the server and the client,
 * through hydration, render the same fixed UTC text every viewer agrees on,
 * and only once mounted does this switch to the local one.
 *
 * `useSyncExternalStore` with a `null` server snapshot is the pattern
 * `copy-link-button.tsx` uses for the same shape of problem: a value the
 * client alone can read, never a `useState` set from an effect, which the
 * React compiler's lint refuses.
 *
 * The `dateTime` attribute always carries the exact instant, in whichever
 * text is showing.
 */
export function LocalTime({
  instant,
  className,
}: {
  instant: Date;
  className?: string;
}) {
  const isClient = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const text = isClient
    ? formatLocal(instant)
    : `${serverFormat.format(instant)} UTC`;

  return (
    <time dateTime={instant.toISOString()} className={className}>
      {text}
    </time>
  );
}

/**
 * The viewer's own date, time, and zone abbreviation — two calls, not one:
 * `Intl.DateTimeFormat` refuses `dateStyle`/`timeStyle` combined with
 * `timeZoneName` in the same options object (`Invalid option : option`,
 * confirmed against the engine this app ships on), so the zone is read off
 * a second, narrow formatter and appended.
 */
function formatLocal(instant: Date): string {
  const main = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
  const zone = new Intl.DateTimeFormat(undefined, {
    timeZoneName: "short",
    hour: "numeric",
  })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  return zone === undefined ? main : `${main} ${zone}`;
}

/**
 * Fixed locale and time zone, formatted on the server and through
 * hydration: the same text for every viewer until the client takes over.
 */
const serverFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
