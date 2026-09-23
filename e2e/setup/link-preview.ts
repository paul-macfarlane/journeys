import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { APIResponse, Page } from "@playwright/test";

/**
 * Reading a link preview (ticket 37) the way a crawler does: the tags off
 * the page, and the image without an image library — the PNG header
 * carries the size, and the browser itself can paint the image onto a
 * canvas and read a pixel back.
 */

/**
 * The `content` of the page's `<meta property="og:…">` or
 * `<meta name="twitter:…">` tag: Open Graph keys are properties, the rest
 * are names.
 */
export function metaContent(page: Page, key: string): Promise<string | null> {
  const attribute = key.startsWith("og:") ? "property" : "name";
  return page.locator(`meta[${attribute}="${key}"]`).getAttribute("content");
}

export type PngResponse = {
  status: number;
  contentType: string;
  cacheControl: string;
  width: number;
  height: number;
  bytes: Buffer;
};

/** A GET of an image: its status, headers, and the size the PNG declares. */
export async function readPng(response: APIResponse): Promise<PngResponse> {
  const bytes = await response.body();
  const headers = response.headers();
  return {
    status: response.status(),
    contentType: headers["content-type"] ?? "",
    cacheControl: headers["cache-control"] ?? "",
    // The IHDR chunk follows the eight-byte signature and its own length
    // and type fields: width and height are big-endian at 16 and 20.
    width: bytes.length >= 24 ? bytes.readUInt32BE(16) : 0,
    height: bytes.length >= 24 ? bytes.readUInt32BE(20) : 0,
    bytes,
  };
}

/** Writes the bytes as they were served, creating the directory. */
export function saveBytes(file: string, bytes: Buffer): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

/**
 * The colours at the given points of an image, as `#rrggbb`, read by
 * opening the image in the page and painting it onto a canvas. A PNG is
 * lossless, so a point inside a flat fill reads exactly the colour it was
 * painted with.
 */
export async function pixelsAt(
  page: Page,
  imageUrl: string,
  points: Array<{ x: number; y: number }>,
): Promise<string[]> {
  await page.goto(imageUrl);
  return page.evaluate(async (wanted) => {
    const image = window.document.querySelector("img");
    if (!image) throw new Error("the image did not render");
    await image.decode();
    const canvas = window.document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    return wanted.map(({ x, y }) => {
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    });
  }, points);
}
