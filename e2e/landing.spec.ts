import { expect, test } from "@playwright/test";

import { evidencePath } from "./setup/evidence";

test("landing page explains the product and offers a single sign-in link while signed out", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Journeys", level: 1 }),
  ).toBeVisible();

  // One entry point: the provider choice lives on /sign-in, not here.
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  await expect(page.getByRole("button", { name: /Sign in with/ })).toHaveCount(
    0,
  );

  // Signed out: the page never links to /projects.
  await expect(page.locator('a[href="/projects"]')).toHaveCount(0);

  // The site footer: the wordmark, the copyright line, the GitHub link,
  // and the legal links.
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Journeys" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(footer).toContainText(
    `© ${new Date().getFullYear()} Paul Macfarlane`,
  );
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/paul-macfarlane/journeys",
  );
  await expect(
    footer.getByRole("navigation", { name: "Legal" }).getByRole("link", {
      name: "Privacy",
    }),
  ).toHaveAttribute("href", "/privacy");
  await expect(
    footer.getByRole("navigation", { name: "Legal" }).getByRole("link", {
      name: "Terms",
    }),
  ).toHaveAttribute("href", "/terms");

  await page.screenshot({
    path: evidencePath("landing", "landing.png"),
    fullPage: true,
  });
});

/**
 * Ticket 38: the recording of the canvas between the tagline and the
 * explanation. One `<video>` per theme, silent and looping, the light one
 * shown unless the page is dark; each with its poster; and, when the
 * visitor prefers reduced motion, the poster of the matching theme in place
 * of any video. The files are what `scripts/record-landing-demo.ts` wrote
 * into `public/demo/`, served as static files, so the WebM itself is asked
 * for and must answer as a WebM.
 */
test("landing-canvas-demo", async ({ page }) => {
  const video = (scheme: "light" | "dark") =>
    page.locator(`video[data-scheme="${scheme}"]`);
  const poster = (scheme: "light" | "dark") =>
    page.locator(`img[data-scheme="${scheme}"]`);

  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto("/");

  // Light: the light recording, with its poster; the dark one there but
  // hidden; no still in either theme.
  const light = video("light");
  await expect(light).toBeVisible();
  await expect(light).toHaveAttribute("poster", "/demo/canvas-light.png");
  await expect(light).toHaveAttribute("autoplay", "");
  await expect(light).toHaveAttribute("loop", "");
  await expect(light).toHaveAttribute("playsinline", "");
  // React renders `muted` as an attribute on the server (React 19), which
  // is what lets the browser start it before any script has run.
  await expect(light).toHaveAttribute("muted", "");
  await expect(light.locator("source")).toHaveAttribute(
    "src",
    "/demo/canvas-light.webm",
  );
  await expect(video("dark")).toBeHidden();
  await expect(poster("light")).toBeHidden();
  await expect(poster("dark")).toBeHidden();

  // It plays, by itself, silently: the video advances on its own.
  await expect
    .poll(
      () =>
        light.evaluate((element) => {
          const media = element as HTMLVideoElement;
          return media.muted && !media.paused && media.currentTime > 0;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.screenshot({
    path: evidencePath("landing-canvas-demo", "landing-canvas-demo.png"),
    fullPage: true,
  });

  // The recording answers as a WebM from the app's own origin.
  for (const scheme of ["light", "dark"] as const) {
    const webm = await page.request.get(`/demo/canvas-${scheme}.webm`);
    expect(webm.status(), `canvas-${scheme}.webm`).toBe(200);
    expect(webm.headers()["content-type"]).toBe("video/webm");
    const png = await page.request.get(`/demo/canvas-${scheme}.png`);
    expect(png.status(), `canvas-${scheme}.png`).toBe(200);
    expect(png.headers()["content-type"]).toBe("image/png");
  }

  // Dark: the dark recording and nothing else.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(video("dark")).toBeVisible();
  await expect(video("dark")).toHaveAttribute(
    "poster",
    "/demo/canvas-dark.png",
  );
  await expect(video("light")).toBeHidden();
  await expect(poster("dark")).toBeHidden();

  // Reduced motion: no video at all, the poster of the current theme.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(poster("dark")).toBeVisible();
  await expect(video("dark")).toBeHidden();
  await expect(video("light")).toBeHidden();
  await expect(poster("light")).toBeHidden();

  await page.emulateMedia({ colorScheme: "light" });
  await expect(poster("light")).toBeVisible();
  await expect(poster("dark")).toBeHidden();
  await expect(video("light")).toBeHidden();

  await page.screenshot({
    path: evidencePath("landing-canvas-demo", "reduced-motion-light.png"),
    fullPage: true,
  });
});
