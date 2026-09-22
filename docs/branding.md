# Branding

The app's identity and theme, chosen for ticket 31 (2026-09-22). This is the
record of the direction and the values; the values themselves live in
`src/app/globals.css` (tokens), `src/app/layout.tsx` (fonts), `src/lib/brand.ts`
(name, tagline, contact, hex anchors), `src/components/brand.tsx` (the mark,
the wordmark, the legal links), and the metadata files under `src/app/`.

## Direction

Journeys is a place to read: a Participant reads a Step, takes a Choice, and
lives with where it leads. The identity comes from that and from nothing else.

- **The mark is a path that forks.** One trunk rises and splits; one way goes
  further than the other, so it reads as a trail rather than the letter Y. It
  sits on a rounded square in the primary colour (the tile) in the navbar, on
  the sign-in page, and in the favicon set, and as a bare line in the current
  text colour where it should stay quiet, like the runner footer.
- **The palette is a trail at two times of day.** Chalk paper and pine ink by
  day; pine night and sage by dark. One spruce green does every accent job —
  the mark, buttons, focus rings, the selected arrow on the canvas — and every
  other tone is that green with the chroma nearly gone, so the surfaces read
  as one material rather than grey with a coloured button on it. Chroma stays
  low in both schemes because the runner is read on a phone, sometimes in the
  dark, and a per-Project Theme (ticket 11) will layer over it.
- **The type is a reading pair.** Literata, drawn for reading long text on
  screens, carries the name and every heading, including the Step titles a
  Participant reads and the headings inside a Step's rich text. Atkinson
  Hyperlegible Next, drawn for legibility first, carries everything else.
- **One bold thing.** The landing page's oversized name and mark are the loud
  moment; the rest of the app keeps to the tokens and the type.

Rejected on the way: a warm cream page with a terracotta accent, and a
near-black page with one bright accent, because both are what generated
interfaces default to; violet, because it is what software defaults to.

## Palette

Tokens are oklch in `globals.css`. The hex values are the same colours in
sRGB, for the surfaces that cannot read a CSS variable (favicon, manifest,
theme-color, the Open Graph image) and are mirrored in `src/lib/brand.ts`.

| Token                     | Light                                      | Dark                                       |
| ------------------------- | ------------------------------------------ | ------------------------------------------ |
| `--background`            | chalk `oklch(0.985 0.005 150)` `#f8fbf8`   | pine night `oklch(0.2 0.02 165)` `#0d1914` |
| `--foreground`            | pine ink `oklch(0.23 0.025 160)` `#122119` | `oklch(0.95 0.012 150)` `#e9f1ea`          |
| `--card` / `--popover`    | `oklch(0.995 0.003 150)` `#fcfefc`         | `oklch(0.24 0.02 165)` `#16221d`           |
| `--primary`               | spruce `oklch(0.42 0.085 165)` `#095b41`   | sage `oklch(0.8 0.09 160)` `#89d0aa`       |
| `--primary-foreground`    | `oklch(0.985 0.01 150)` `#f6fcf7`          | `oklch(0.2 0.03 165)` `#071a13`            |
| `--muted` / `--secondary` | `oklch(0.955 0.012 155)` `#eaf3ed`         | `oklch(0.29 0.022 165)` `#212f29`          |
| `--muted-foreground`      | moss `oklch(0.46 0.035 160)` `#475e51`     | `oklch(0.74 0.03 160)` `#9bb1a4`           |
| `--accent`                | `oklch(0.94 0.02 158)`                     | `oklch(0.31 0.03 163)`                     |
| `--border` / `--input`    | `oklch(0.9 0.015 155)` `#d7e1da`           | `oklch(1 0 0 / 12%)` / `15%`               |
| `--ring`                  | `oklch(0.55 0.08 165)`                     | `oklch(0.7 0.08 160)`                      |
| `--destructive`           | unchanged shadcn red                       | unchanged shadcn red                       |
| `--warning`               | unchanged                                  | unchanged                                  |

The chart tokens are retuned to the same hues (spruce, ochre, slate blue,
clay, plum) and the sidebar tokens mirror the card and accent tokens; neither
is used yet.

The canvas reads the same tokens through React Flow's CSS variables (the
`.react-flow` block at the end of `globals.css`): arrows are
`--muted-foreground` until selected, the selected arrow and a connection being
dragged are `--primary`, boxes are `--card` on `--border`.

## Type

| Role    | Face                                         | Loaded as                                                     | Used for                                                                                               |
| ------- | -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Display | Literata (variable, `opsz` axis)             | `next/font/google`, `--font-display`, Tailwind `font-display` | The wordmark; every `h1`, `h2`, `h3` (a base rule in `globals.css`); the runner header's Journey title |
| Text    | Atkinson Hyperlegible Next (variable weight) | `next/font/google`, `--font-text`, Tailwind `font-sans`       | Everything else                                                                                        |
| Mono    | system `ui-monospace`                        | not loaded                                                    | Nothing today; the token is kept for shadcn components that expect it                                  |

Heading weights stay whatever each heading sets (`font-semibold` on most
page titles, `font-medium` on the landing page and the legal pages).

The Open Graph image (`src/app/opengraph-image.tsx`) fetches a Literata TTF
from Google Fonts at build time for the name. If that fetch fails the image
still builds, in the renderer's default serif, so an outage never fails a
build; the trade is that a build made offline renders the name in a different
face.

## Radius

`--radius: 0.375rem` (6px), down from shadcn's 10px. Buttons, inputs, and
cards take it through the shadcn radius scale; the Choices in the runner and
the boxes on the canvas keep the slightly crisper corner that the serif and
the low-chroma palette ask for.

## Contrast

WCAG AA asks for 4.5:1 on body text. The ratios below are computed from the
tokens (`scratchpad/contrast.mjs`, oklch → linear sRGB → relative luminance)
and confirmed as painted by the `theme-light-and-dark` spec, which reads the
rendered text and background colours out of Chromium on each surface and
fails under 4.5:1.

| Pair                                   | Light | Dark  |
| -------------------------------------- | ----- | ----- |
| `--foreground` on `--background`       | 16.08 | 15.63 |
| `--muted-foreground` on `--background` | 6.71  | 7.91  |
| `--foreground` on `--card`             | 16.54 | 14.18 |
| `--muted-foreground` on `--card`       | 6.90  | 7.18  |
| `--foreground` on `--muted`            | 14.76 | 12.13 |
| `--muted-foreground` on `--muted`      | 6.16  | 6.14  |
| `--primary-foreground` on `--primary`  | 7.78  | 9.98  |
| `--primary` on `--background`          | 7.76  | 10.00 |
| `--destructive` on `--background`      | 4.57  | 6.23  |

As painted (from the spec's console output at the verified commit; the
numbers differ from the table only by Chromium's rounding to 8-bit sRGB):

| Surface                   | Light body / muted | Dark body / muted |
| ------------------------- | ------------------ | ----------------- |
| Sign-in page              | 16.02 / 6.74       | 15.64 / 7.90      |
| Projects list             | 16.02 / 6.74       | 15.64 / 7.90      |
| Journey page (canvas box) | 16.02 / 6.74       | 15.64 / 7.90      |
| Runner on a phone         | 16.02 / 6.74       | 15.64 / 7.90      |

## Identity files

All under `src/app/`, by Next's metadata file conventions, so every page links
them without a component knowing:

| File                  | Served at               | Made by                                                                                                        |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `icon.svg`            | `/icon.svg`             | hand-written; the source of the mark                                                                           |
| `favicon.ico`         | `/favicon.ico`          | 16, 32, 48 px PNG entries rendered from `icon.svg` with the repo's Chromium (script in the ticket 31 closeout) |
| `apple-icon.png`      | `/apple-icon.png`       | 180 px, the tile full-bleed (iOS rounds the corners itself), same script                                       |
| `manifest.ts`         | `/manifest.webmanifest` | name, tagline, colours, the two icons                                                                          |
| `opengraph-image.tsx` | `/opengraph-image`      | 1200×630, the tile, the name in Literata, the tagline                                                          |

Regenerating the two raster files: render `icon.svg` at each size with a
headless browser and wrap the PNGs in an ICO container; the one-file Node
script that did it is recorded in the ticket 31 closeout.
