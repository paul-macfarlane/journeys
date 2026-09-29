import type { Page } from "@playwright/test";

/**
 * The share of a committed still's pixels that read as purple: hue roughly
 * 260–330° (violet through magenta, the range Dusk's plum falls in) with
 * enough saturation that greys and near-neutral tones do not count. Used to
 * tell a still shot in Dusk from one shot in the app's own palette, Trail,
 * which is green (ticket 93).
 *
 * The image is opened as its own page and painted onto a canvas, the same
 * technique `pixelsAt` in `e2e/setup/link-preview.ts` and the painted-color
 * probe in `e2e/themes.spec.ts` use to read a browser-drawn color back. A
 * grid of the image's pixels is sampled rather than every one, which is
 * plenty for a whole-image share and fast even at 1280 × 720.
 */
export async function purpleShare(
  page: Page,
  imageUrl: string,
): Promise<number> {
  await page.goto(imageUrl);
  return page.evaluate(async () => {
    const image = window.document.querySelector("img");
    if (!image) throw new Error("the image did not render");
    await image.decode();
    const canvas = window.document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);

    // One readback for the whole image, then indexed: a readback per
    // sampled pixel is tens of thousands of GPU round trips.
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const step = 4;
    let sampled = 0;
    let purple = 0;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const at = (y * canvas.width + x) * 4;
        const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const delta = max - min;
        const lightness = (max + min) / 2;
        const saturation =
          delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
        let hue = 0;
        if (delta !== 0) {
          if (max === rn) hue = ((gn - bn) / delta) % 6;
          else if (max === gn) hue = (bn - rn) / delta + 2;
          else hue = (rn - gn) / delta + 4;
          hue *= 60;
          if (hue < 0) hue += 360;
        }
        sampled += 1;
        if (hue >= 260 && hue <= 330 && saturation >= 0.15) purple += 1;
      }
    }
    return sampled === 0 ? 0 : purple / sampled;
  });
}
