"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { setJourneyThemeAction } from "@/app/projects/[projectId]/journeys/actions";
import { ThemeFields } from "@/components/theme-fields";
import { THEME_PRESETS, type Theme, type ThemeOverride } from "@/lib/theme";

/**
 * A Journey's Theme override on its Settings tab (ticket 11). Off, the
 * Journey is painted in its Project's Theme and the tab says which; on, the
 * Journey has a Theme of its own, chosen with the same picker the Project
 * uses. Turning it on starts from the Project's current Theme, so the
 * Author edits from what Participants already see rather than from the
 * default; turning it off clears the override, accent and all.
 */
export function JourneyThemeSettings({
  projectId,
  journeyId,
  projectTheme,
  theme,
}: {
  projectId: string;
  journeyId: string;
  /** What the Journey is painted in while it does not override. */
  projectTheme: Theme;
  theme: ThemeOverride;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // The box flips the moment it is clicked and settles on what the server
  // holds once the refresh lands: `useOptimistic` shows `on` for the length
  // of the transition below and then reads the prop again, so a refused
  // save puts the box back by itself.
  const overriding = theme.preset !== null;
  const [checked, setChecked] = useOptimistic(overriding);
  const [, startTransition] = useTransition();

  function toggle(on: boolean) {
    startTransition(async () => {
      setChecked(on);
      const next: ThemeOverride = on
        ? { preset: projectTheme.preset, accent: projectTheme.accent }
        : { preset: null, accent: null };
      const result = await setJourneyThemeAction(
        projectId,
        journeyId,
        next,
      ).catch(() => ({
        ok: false as const,
        error: "the server could not be reached",
      }));
      if (!result.ok) {
        setError(`Couldn't save: ${result.error}`);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  const projectPresetLabel =
    THEME_PRESETS.find((preset) => preset.id === projectTheme.preset)?.label ??
    projectTheme.preset;

  return (
    <section aria-labelledby="journey-theme" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="journey-theme" className="font-medium">
          Theme
        </h2>
        <p className="text-muted-foreground text-sm">
          How participants see this journey. It uses the project&apos;s theme (
          {projectPresetLabel}) unless you choose one here.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm leading-none font-medium">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={checked}
          onChange={(event) => toggle(event.target.checked)}
        />
        Use a different theme for this journey
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {theme.preset !== null ? (
        <ThemeFields
          theme={{ preset: theme.preset, accent: theme.accent }}
          submit={(next) => setJourneyThemeAction(projectId, journeyId, next)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
