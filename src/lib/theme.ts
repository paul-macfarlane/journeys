import { z } from "zod";

/**
 * Themes (ticket 11): the small set of visual tokens the participant runner
 * and the public Project page are painted in. A Theme is a preset id plus an
 * optional accent color, stored on the Project with an optional override on
 * the Journey (spec, Data model). Pure and database-free on purpose: the
 * pickers, the server actions' schemas, and the runner frame all read the
 * same definitions from here, and the tokens themselves are CSS — one block
 * per preset in `src/app/globals.css`, keyed by `data-theme="<id>"`.
 *
 * The authoring UI never carries a Theme (story 75): only `RunnerFrame`
 * sets the attribute, so nothing an Author edits in is ever recolored.
 */

/**
 * The six curated presets, in the order the picker offers them. The first
 * is the app's own palette (`docs/branding.md`), which every Project starts
 * with; its block in `globals.css` is empty because the root tokens already
 * are it. Ids are what the `theme_preset` columns store, so renaming one is
 * a migration; labels and descriptions are the picker's copy.
 */
export const THEME_PRESETS = [
  {
    id: "trail",
    label: "Trail",
    description: "Chalk paper and pine ink, with a spruce accent.",
  },
  {
    id: "parchment",
    label: "Parchment",
    description:
      "Warm cream, sepia ink, and a terracotta accent, set in serif.",
  },
  {
    id: "tide",
    label: "Tide",
    description: "Cool sea-glass paper with a deep teal accent.",
  },
  {
    id: "dusk",
    label: "Dusk",
    description: "Lavender-grey paper with a plum accent.",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm stone with a burnt-orange accent.",
  },
  {
    id: "slate",
    label: "Slate",
    description: "Plain grey paper with a cobalt accent.",
  },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number]["id"];

export const DEFAULT_THEME_PRESET: ThemePreset = "trail";

const presetIds = THEME_PRESETS.map((preset) => preset.id) as [
  ThemePreset,
  ...ThemePreset[],
];

export const themePresetSchema = z.enum(presetIds, {
  error: "Choose one of the themes",
});

/**
 * An accent is one `#rrggbb` color, as the browser's color input produces
 * it. Lowercased so two spellings of one color store the same.
 */
export const accentColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a color like #095b41")
  .transform((value) => value.toLowerCase());

/**
 * The preset a stored id names, or the default when it names none. Every
 * id reached storage through `themePresetSchema`, so this only ever differs
 * from the stored value if a preset is one day retired; a Project keeps
 * rendering in the app's palette then rather than failing its public page.
 */
export function toThemePreset(value: string): ThemePreset {
  const parsed = themePresetSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME_PRESET;
}

/** A Theme as stored on a Project and as the runner paints it. */
export type Theme = {
  preset: ThemePreset;
  accent: string | null;
};

/**
 * A Journey's override: the same shape with the preset nullable. A Journey
 * overrides its Project exactly when `preset` is set; an accent with no
 * preset is never stored (the schemas refuse it), so `preset === null`
 * alone says "use the Project's".
 */
export type ThemeOverride = {
  preset: ThemePreset | null;
  accent: string | null;
};

/**
 * A Journey's override as its two columns store it: a null preset is no
 * override at all, and a set one is read through `toThemePreset` like the
 * Project's. Every read of the `journey` row's Theme goes through here.
 */
export function readThemeOverride(row: {
  themePreset: string | null;
  themeAccent: string | null;
}): ThemeOverride {
  return row.themePreset === null
    ? { preset: null, accent: null }
    : { preset: toThemePreset(row.themePreset), accent: row.themeAccent };
}

/**
 * What a Participant sees: the Journey's Theme when it overrides, else the
 * Project's. The override is taken whole — its own accent, or none — rather
 * than layered over the Project's accent, so an Author who picks a preset
 * for one Journey does not inherit a signature color they did not choose.
 */
export function effectiveTheme(project: Theme, journey: ThemeOverride): Theme {
  if (journey.preset === null) return project;
  return { preset: journey.preset, accent: journey.accent };
}

/** sRGB channel to linear light, per WCAG 2.x. */
function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#111111";

/**
 * The text color that reads on an accent: whichever of white and near-black
 * contrasts more with it. An Author picks any color they like, and this is
 * what keeps the one place the accent carries text — a primary button, if a
 * themed surface ever renders one — readable without asking them to check.
 */
export function accentForeground(accent: string): string {
  const behind = luminance(accent);
  return contrast(luminance(LIGHT_TEXT), behind) >=
    contrast(luminance(DARK_TEXT), behind)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

/**
 * The inline custom properties the themed frame carries for an accent: the
 * color itself and the text color that reads on it. The frame's
 * `data-accent` attribute is what turns them into tokens — the
 * `[data-theme][data-accent]` rules in `globals.css` map them onto
 * `--primary`, `--primary-foreground`, and `--ring` over whichever preset
 * is set, and in the dark scheme lift the accent's lightness first, so a
 * deep accent that reads on light paper is not lost on dark. Without an
 * accent nothing is set and the preset's tokens stand. The accent is a fill
 * and a border in the runner (the stripe across the top, a Choice's hover
 * and focus border, focus rings), never body text, which is why an
 * arbitrary accent cannot break the presets' contrast guarantee.
 */
export function themeStyle(theme: Theme): Record<string, string> {
  if (theme.accent === null) return {};
  return {
    "--theme-accent": theme.accent,
    "--theme-accent-foreground": accentForeground(theme.accent),
  };
}
