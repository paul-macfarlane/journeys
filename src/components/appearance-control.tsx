"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/segmented-control";

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
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

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
