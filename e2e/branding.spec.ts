import { expect, test, type Locator, type Page } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishDocument,
  runnerDocument,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Ticket 31: the app's identity and theme, and the two legal pages.
 *
 * `legal-pages` proves the pages exist and are reachable from the two
 * footers the ticket names. `theme-light-and-dark` proves the identity
 * files are served, that every page carries the favicon, and that the
 * palette holds up in both schemes on the four surfaces the ticket names —
 * the sign-in page, the Projects list, a Journey page with its canvas, and
 * the runner on a phone — by screenshot and by reading the rendered text
 * contrast back out of the page.
 */

// Two walks, each making a Project and publishing a Journey.
test.setTimeout(90_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** The "Legal" navigation any of the app's footers carries. */
function legalLinks(scope: Page | Locator) {
  return scope.getByRole("navigation", { name: "Legal" });
}

/** A Project with one published Journey, made through the UI as an Author. */
async function publishOne(page: Page, label: string): Promise<string> {
  const suffix = uniqueSuffix();
  const projectId = await createProject(page, `${label} ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `${label} journey ${suffix}`,
    "A short walk to check the frame.",
  );
  await writeDraftDocument(journeyId, runnerDocument());
  await publishDocument(journeyId, runnerDocument());
  return `/projects/${projectId}/journeys/${journeyId}`;
}

test("legal-pages: /privacy and /terms render and are linked from the sign-in page and the runner footer", async ({
  page,
  context,
  browser,
}) => {
  // From the sign-in page's footer to the privacy policy.
  await page.goto("/sign-in");
  await expect(
    legalLinks(page).getByRole("link", { name: "Terms" }),
  ).toHaveAttribute("href", "/terms");
  await legalLinks(page).getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/privacy`);
  await expect(
    page.getByRole("heading", { name: "Privacy policy", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cookies" })).toBeVisible();
  await page.screenshot({
    path: evidencePath("legal-pages", "privacy.png"),
    fullPage: true,
  });

  // Each legal page links to the other from its own footer.
  await legalLinks(page).getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(`${E2E_BASE_URL}/terms`);
  await expect(
    page.getByRole("heading", { name: "Terms of service", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your journeys" }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath("legal-pages", "terms.png"),
    fullPage: true,
  });

  // The runner footer: an anonymous Participant on a phone reaches both.
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  await page.goto("/projects");
  const journeyHref = await publishOne(page, "Legal");
  const journeyId = journeyHref.split("/").pop();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const participant = await phone.newPage();
  await participant.goto(`/j/${journeyId}`);
  await expect(participant.getByRole("banner")).toContainText("Legal journey");
  const footer = participant.getByRole("contentinfo");
  await expect(
    footer.getByRole("link", { name: "Made with Journeys" }),
  ).toHaveAttribute("href", "/");
  await expect(
    legalLinks(footer).getByRole("link", { name: "Privacy" }),
  ).toHaveAttribute("href", "/privacy");
  await participant.screenshot({
    path: evidencePath("legal-pages", "legal-pages.png"),
    fullPage: true,
  });
  await legalLinks(footer).getByRole("link", { name: "Terms" }).click();
  await expect(participant).toHaveURL(`${E2E_BASE_URL}/terms`);
  await expect(
    participant.getByRole("heading", { name: "Terms of service", level: 1 }),
  ).toBeVisible();
  await phone.close();
});

/**
 * WCAG contrast of an element's text against the first painted background
 * behind it, computed in the page from what Chromium actually rendered
 * rather than from the tokens.
 */
async function contrastOf(page: Page, selector: string): Promise<number> {
  const ratio = await page.evaluate((selector) => {
    const element = window.document.querySelector(selector);
    if (!element) return null;
    // Chromium reports an oklch token back as oklch, so the colours are
    // painted onto a one-pixel canvas and read back as 8-bit sRGB — the
    // same numbers the accessibility panel shows.
    const canvas = window.document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const paint = (css: string): number[] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const luminance = ([r, g, b]: number[]) => {
      const [lr, lg, lb] = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    let node: Element | null = element;
    let background: number[] | null = null;
    while (node && !background) {
      const painted = paint(window.getComputedStyle(node).backgroundColor);
      if (painted[3] > 0) background = painted;
      node = node.parentElement;
    }
    const text = luminance(paint(window.getComputedStyle(element).color));
    const behind = luminance(background ?? [255, 255, 255, 255]);
    const [hi, lo] = text > behind ? [text, behind] : [behind, text];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  }, selector);
  expect(ratio, `${selector} rendered`).not.toBeNull();
  return ratio as number;
}

/**
 * Screenshots a page in both schemes and checks the body copy and the
 * muted copy both clear WCAG AA (4.5:1) as painted. The ratios are printed
 * so docs/branding.md can quote the browser's own numbers.
 */
async function proveTheme(
  page: Page,
  name: string,
  selectors: { body: string; muted: string },
): Promise<void> {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator("html")).toHaveClass(
      new RegExp(`\\b${scheme}\\b`),
    );
    const body = await contrastOf(page, selectors.body);
    const muted = await contrastOf(page, selectors.muted);
    console.log(`contrast ${name} ${scheme}: body ${body}:1, muted ${muted}:1`);
    expect(body, `${name} ${scheme} body text`).toBeGreaterThanOrEqual(4.5);
    expect(muted, `${name} ${scheme} muted text`).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({
      path: evidencePath("theme-light-and-dark", `${name}-${scheme}.png`),
      fullPage: true,
    });
  }
  await page.emulateMedia({ colorScheme: null });
}

test("theme-light-and-dark: the identity files are served and the palette holds on every surface in both schemes", async ({
  page,
  context,
  browser,
}) => {
  // The favicon set, the manifest, and the Open Graph image.
  for (const [path, type] of [
    ["/icon.svg", "image/svg+xml"],
    ["/favicon.ico", "image/x-icon"],
    ["/apple-icon.png", "image/png"],
    ["/manifest.webmanifest", "application/manifest+json"],
    ["/opengraph-image", "image/png"],
  ] as const) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(type);
  }

  // Every page links the favicon; the sign-in page stands in for them all.
  await page.goto("/sign-in");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute(
    "href",
    /favicon\.ico|icon\.svg/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  await proveTheme(page, "sign-in", { body: "h1", muted: "main p" });

  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  await page.goto("/projects");
  const journeyHref = await publishOne(page, "Theme");
  const journeyId = journeyHref.split("/").pop();

  // The Projects list, with at least one Project card on it.
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Your projects" }),
  ).toBeVisible();
  await proveTheme(page, "projects", { body: "h1", muted: "main header p" });

  // The Journey page, once the canvas has drawn the map.
  await page.goto(journeyHref);
  await expect(
    page
      .locator(".react-flow__node")
      .getByRole("button", { name: START_STEP_TITLE }),
  ).toBeVisible();
  await proveTheme(page, "journey", {
    body: ".react-flow__node p",
    muted: ".react-flow__node .text-muted-foreground",
  });

  // The runner on a phone, as an anonymous Participant.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const participant = await phone.newPage();
  await participant.goto(`/j/${journeyId}`);
  await expect(participant.getByRole("banner")).toContainText("Theme journey");
  await expect(
    participant.getByRole("heading", { name: START_STEP_TITLE, level: 1 }),
  ).toBeVisible();
  await proveTheme(participant, "runner", {
    body: "main h1",
    muted: "main > p",
  });
  await phone.close();
});
