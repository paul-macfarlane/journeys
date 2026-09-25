"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

/** The three answers next-themes accepts, "system" following the OS. */
export type Appearance = "light" | "dark" | "system";

/** The three, in the order both controls offer them, each with its icon. */
export const APPEARANCES: readonly SegmentOption<Appearance>[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
];

/** Whether a stored choice is one of the three; anything else reads as System. */
export function isAppearance(value: string | undefined): value is Appearance {
  return APPEARANCES.some((option) => option.value === value);
}

const subscribeToNothing = () => () => {};

/** False while the server renders and the client hydrates, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * The footer's Light / Dark / System control (ticket 70), so a guest — who
 * has no account menu — can choose too. It drives the same next-themes
 * choice as the account menu's row, so the two always agree.
 *
 * Named "Appearance", never "Theme": a Theme here is the runner's preset and
 * accent, and inside the runner this footer sits in a themed frame.
 *
 * next-themes has no answer during server rendering and reads the stored
 * choice on the client's first render, so reading it straight away would
 * leave `aria-checked` differing between the two, a mismatch React never
 * repairs. Until hydration is over the control shows System checked, then
 * the real choice.
 */
export function AppearanceControl() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <SegmentedControl
      label="Appearance"
      value={hydrated && isAppearance(theme) ? theme : "system"}
      onValueChange={setTheme}
      options={APPEARANCES}
      size="icon-sm"
      segmentClassName="max-sm:size-11"
    />
  );
}

/**
 * The runner header's one-press switch (ticket 70): where a Participant is
 * reading, a scroll away from the footer's control. It flips whatever the
 * page shows now — a reader on System gets the other scheme — by setting the
 * opposite one explicitly, so the footer then shows Light or Dark.
 *
 * A toggle button named "Dark mode", pressed while the page is dark. The
 * pressed state waits for hydration, as the footer's control does; the icon
 * does not, because the `dark:` variant picks it from the class next-themes
 * sets before paint: a moon on a light page, a sun on a dark one.
 */
export function DarkModeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Dark mode"
      aria-pressed={hydrated ? dark : undefined}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md max-sm:size-11",
        className,
      )}
    >
      <MoonIcon aria-hidden className="size-4 dark:hidden" />
      <SunIcon aria-hidden className="hidden size-4 dark:block" />
    </button>
  );
}
