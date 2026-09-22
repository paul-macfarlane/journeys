// No "use client" of its own: only the two Settings components import this,
// and both carry the directive, so it inherits their client boundary (a
// directive here would have Next's plugin warn about the function props).
import { useId, useMemo } from "react";
import { z } from "zod";

import { useBlurSavedForm } from "@/components/blur-saved-form";
import type { ActionResult } from "@/lib/action-result";
import {
  accentColorSchema,
  THEME_PRESETS,
  themePresetSchema,
  type Theme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The picker's own shape: the accent is a string, empty for none, because
 * a form field always holds a string and a color input never holds an
 * empty one — the checkbox beside it is what says "none". The Theme the
 * action receives is made from it in `submit` below.
 */
const themeFormSchema = z.object({
  preset: themePresetSchema,
  accent: z.union([z.literal(""), accentColorSchema]),
});

type ThemeFormInput = z.infer<typeof themeFormSchema>;

/** What a fresh accent starts as when the checkbox is ticked: the app's spruce. */
const FIRST_ACCENT = "#095b41";

/**
 * A Theme picker (ticket 11): the six presets as a radio group, each with a
 * swatch painted by the preset's own tokens, and an optional accent color.
 * Saved the way every other Settings field is — when a control is left, or
 * as soon as a radio or the checkbox changes, through `useBlurSavedForm` —
 * so it needs no Save button and a refused save says so under the group.
 *
 * Shared by the Project's Settings tab and the Journey's: the caller says
 * what the Theme currently is and where the next one goes.
 */
export function ThemeFields({
  theme,
  submit,
  onSaved,
}: {
  /** The Theme as stored, which the fields read until edited. */
  theme: Theme;
  /** The server action the whole Theme goes to. */
  submit: (theme: Theme) => Promise<ActionResult>;
  /** After a save the server accepted, typically a router refresh. */
  onSaved: () => void;
}) {
  const id = useId();
  const values = useMemo<ThemeFormInput>(
    () => ({ preset: theme.preset, accent: theme.accent ?? "" }),
    [theme.preset, theme.accent],
  );
  const { form, save } = useBlurSavedForm({
    schema: themeFormSchema,
    values,
    submit: (next) =>
      submit({
        preset: next.preset,
        accent: next.accent === "" ? null : next.accent,
      }),
    onSaved,
  });
  const { errors } = form.formState;
  const accent = form.watch("accent");

  function toggleAccent(on: boolean) {
    form.setValue("accent", on ? FIRST_ACCENT : "", { shouldDirty: true });
    void save("accent");
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">
          Preset
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_PRESETS.map((preset) => (
            <label
              key={preset.id}
              htmlFor={`${id}-${preset.id}`}
              className="has-checked:border-primary has-checked:ring-primary/30 hover:bg-muted/60 flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:ring-2"
            >
              <input
                type="radio"
                id={`${id}-${preset.id}`}
                value={preset.id}
                className="accent-primary mt-1 size-4 shrink-0"
                {...form.register("preset", {
                  onChange: () => void save("preset"),
                })}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{preset.label}</span>
                  <ThemeSwatch preset={preset.id} />
                </span>
                <span className="text-muted-foreground text-xs">
                  {preset.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.preset ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.preset.message}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${id}-accent-on`}
          className="flex items-center gap-2 text-sm leading-none font-medium"
        >
          <input
            type="checkbox"
            id={`${id}-accent-on`}
            className="accent-primary size-4"
            checked={accent !== ""}
            onChange={(event) => toggleAccent(event.target.checked)}
          />
          Accent color
        </label>
        {accent !== "" ? (
          <div className="flex items-center gap-3">
            <input
              type="color"
              id={`${id}-accent`}
              aria-label="Accent color value"
              className="border-input h-9 w-14 cursor-pointer rounded-md border bg-transparent p-0.5"
              {...form.register("accent", {
                onBlur: () => void save("accent"),
              })}
            />
            <span className="text-muted-foreground font-mono text-xs">
              {accent}
            </span>
          </div>
        ) : null}
        <p className="text-muted-foreground text-xs">
          The accent colors the stripe above the journey and the edge of a
          choice as it is chosen. Text keeps the theme&apos;s own colors.
        </p>
        {errors.accent ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.accent.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Three dots in the preset's own paper, ink, and primary, painted by the
 * preset's tokens themselves (`data-theme` scopes them to this span), so
 * the picker never repeats a color the stylesheet already holds.
 */
function ThemeSwatch({ preset }: { preset: Theme["preset"] }) {
  return (
    <span
      data-theme={preset}
      aria-hidden
      className={cn(
        "bg-background flex shrink-0 items-center gap-1 rounded-full border p-1",
      )}
    >
      <span className="bg-primary size-3 rounded-full" />
      <span className="bg-foreground size-3 rounded-full" />
      <span className="bg-muted size-3 rounded-full border" />
    </span>
  );
}
