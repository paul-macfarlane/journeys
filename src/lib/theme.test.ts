import { describe, expect, it } from "vitest";

import {
  accentColorSchema,
  accentForeground,
  DEFAULT_THEME_PRESET,
  effectiveTheme,
  THEME_PRESETS,
  themePresetSchema,
  themeStyle,
  toThemePreset,
} from "./theme";

describe("THEME_PRESETS", () => {
  it("offers six presets with distinct ids and labels", () => {
    expect(THEME_PRESETS).toHaveLength(6);
    expect(new Set(THEME_PRESETS.map((preset) => preset.id)).size).toBe(6);
    expect(new Set(THEME_PRESETS.map((preset) => preset.label)).size).toBe(6);
  });

  it("names the app's own palette as the default", () => {
    expect(DEFAULT_THEME_PRESET).toBe("trail");
    expect(THEME_PRESETS[0].id).toBe(DEFAULT_THEME_PRESET);
  });
});

describe("themePresetSchema", () => {
  it("accepts every preset id", () => {
    for (const preset of THEME_PRESETS) {
      expect(themePresetSchema.safeParse(preset.id).success).toBe(true);
    }
  });

  it("refuses anything else", () => {
    expect(themePresetSchema.safeParse("neon").success).toBe(false);
    expect(themePresetSchema.safeParse("").success).toBe(false);
    expect(themePresetSchema.safeParse(null).success).toBe(false);
  });
});

describe("accentColorSchema", () => {
  it("accepts a six-digit hex color and lowercases it", () => {
    expect(accentColorSchema.parse("#095B41")).toBe("#095b41");
    expect(accentColorSchema.parse("#ffd400")).toBe("#ffd400");
  });

  it("refuses short, named, and malformed colors", () => {
    for (const value of ["#abc", "red", "095b41", "#12345g", "#1234567", ""]) {
      expect(accentColorSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("toThemePreset", () => {
  it("reads a stored preset id back", () => {
    expect(toThemePreset("dusk")).toBe("dusk");
  });

  it("falls back to the default for an id no preset has", () => {
    expect(toThemePreset("retired")).toBe(DEFAULT_THEME_PRESET);
  });
});

describe("effectiveTheme", () => {
  const project = { preset: "tide", accent: "#095b41" } as const;

  it("is the Project's Theme when the Journey does not override it", () => {
    expect(effectiveTheme(project, { preset: null, accent: null })).toEqual(
      project,
    );
  });

  it("is the Journey's Theme when it overrides, accent included", () => {
    expect(
      effectiveTheme(project, { preset: "dusk", accent: "#ffd400" }),
    ).toEqual({ preset: "dusk", accent: "#ffd400" });
  });

  it("drops the Project's accent when the Journey overrides without one", () => {
    expect(effectiveTheme(project, { preset: "dusk", accent: null })).toEqual({
      preset: "dusk",
      accent: null,
    });
  });
});

describe("accentForeground", () => {
  it("puts light text on a dark accent", () => {
    expect(accentForeground("#095b41")).toBe("#ffffff");
    expect(accentForeground("#000000")).toBe("#ffffff");
  });

  it("puts dark text on a light accent", () => {
    expect(accentForeground("#ffd400")).toBe("#111111");
    expect(accentForeground("#ffffff")).toBe("#111111");
  });
});

describe("themeStyle", () => {
  it("is empty without an accent, so the preset's own tokens stand", () => {
    expect(themeStyle({ preset: "tide", accent: null })).toEqual({});
  });

  it("replaces the primary and ring tokens with the accent", () => {
    expect(themeStyle({ preset: "tide", accent: "#095b41" })).toEqual({
      "--primary": "#095b41",
      "--primary-foreground": "#ffffff",
      "--ring": "#095b41",
    });
  });
});
