// Renders src/app/icon.svg to favicon.ico (16/32/48 PNG entries) and
// apple-icon.png (180, full-bleed tile) with the repo's own Chromium.
// Usage (from the repo root): node scripts/make-icons.mjs [preview-dir]
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const root = process.cwd();
const svg = readFileSync(`${root}/src/app/icon.svg`, "utf8");
// iOS rounds the corners itself, so the Apple icon is the tile without them
// and the fork sits a touch smaller inside it.
const appleSvg = svg
  .replace('rx="8"', 'rx="0"')
  .replace(
    "<g ",
    '<g transform="translate(16 16) scale(0.86) translate(-16 -16)" ',
  );

const browser = await chromium.launch();
async function png(markup, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace(
      "<svg ",
      `<svg width="${size}" height="${size}" `,
    )}</body></html>`,
  );
  const buffer = await page.screenshot({ omitBackground: true, type: "png" });
  await page.close();
  return buffer;
}

const sizes = [16, 32, 48];
const images = [];
for (const s of sizes) images.push(await png(svg, s));

// ICO container: header, one directory entry per image, then the PNGs.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
const entries = [];
let offset = 6 + 16 * images.length;
images.forEach((img, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(img.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.length;
  entries.push(e);
});
writeFileSync(
  `${root}/src/app/favicon.ico`,
  Buffer.concat([header, ...entries, ...images]),
);
writeFileSync(`${root}/src/app/apple-icon.png`, await png(appleSvg, 180));

// A preview strip for eyeballing: the tile at 16, 32, 64 and 180.
const preview = await (async () => {
  const page = await browser.newPage({ viewport: { width: 420, height: 220 } });
  await page.setContent(
    `<html><body style="margin:0;background:#fff;display:flex;gap:24px;align-items:center;padding:20px">
      ${[16, 32, 64].map((s) => svg.replace("<svg ", `<svg width="${s}" height="${s}" `)).join("")}
      ${appleSvg.replace("<svg ", '<svg width="180" height="180" ')}
    </body></html>`,
  );
  const b = await page.screenshot({ type: "png" });
  await page.close();
  return b;
})();
writeFileSync(`${process.argv[2] ?? "."}/icon-preview.png`, preview);
await browser.close();
console.log(
  "wrote src/app/favicon.ico, src/app/apple-icon.png, icon-preview.png",
);
