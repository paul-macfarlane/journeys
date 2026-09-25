import { expect, test, type Locator, type Page } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishDocument,
  runnerDocument,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { evidencePath } from "./setup/evidence";
import { expectFooterInTwoRows } from "./setup/footer";
import { cleanup, closePools, signInAs } from "./setup/session";

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/**
 * Ticket 67: the site footer on a phone. At 375 px the footer's seven
 * items cannot share a row, and `justify-between` used to scatter whichever
 * ones wrapped across the width. Now the mark and the copyright are one
 * group and the five links another, so the wrap is two rows that start at
 * the same left edge. The About page is the static, session-free surface
 * the proof uses; the footer is the one component every page renders.
 */
test("footer-wrap: at 375 px the footer wraps into two rows that share a left edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/about");
  await expect(page.getByRole("contentinfo")).toBeVisible();

  await expectFooterInTwoRows(page);

  // No horizontal scroll: the footer fits the phone's width.
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(375);

  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: evidencePath("footer-wrap", "footer-375.png"),
  });
});

/** The footer's Light / Dark / System control (ticket 70). */
function appearance(page: Page): Locator {
  return page
    .getByRole("contentinfo")
    .getByRole("radiogroup", { name: "Appearance" });
}

/**
 * Presses one of the footer's segments until the page answers. The footer
 * is server-rendered, so a press that lands before hydration does nothing;
 * pressing a segment again is harmless, so retrying is safe.
 */
async function choose(
  page: Page,
  name: "Light" | "Dark" | "System",
  dark: boolean,
): Promise<void> {
  const html = page.locator("html");
  await expect(async () => {
    await appearance(page).getByRole("radio", { name }).click();
    if (dark) await expect(html).toHaveClass(/\bdark\b/, { timeout: 1_000 });
    else await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 1_000 });
  }).toPass();
  await expect(appearance(page).getByRole("radio", { name })).toHaveAttribute(
    "aria-checked",
    "true",
  );
}

/**
 * Ticket 70: a guest, with no account menu, chooses light or dark from the
 * footer. The choice is next-themes' own (stored in the browser), so it
 * survives a reload and follows the guest into the runner, and System hands
 * the page back to the operating system.
 */
test("guest-appearance: a guest chooses dark from the footer, and it follows them into the runner", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90_000);

  // A published Journey for the guest to walk, made as an Author.
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  await page.goto("/projects");
  const suffix = uniqueSuffix();
  const projectId = await createProject(page, `Appearance ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `Appearance journey ${suffix}`,
    "A short walk in the dark.",
  );
  await writeDraftDocument(journeyId, runnerDocument());
  await publishDocument(journeyId, runnerDocument());

  // The guest: no session, an operating system set to light.
  const guestContext = await browser.newContext({ colorScheme: "light" });
  const guest = await guestContext.newPage();
  const html = guest.locator("html");

  await guest.goto("/");
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(appearance(guest).getByRole("radio")).toHaveCount(3);
  await expect(
    appearance(guest).getByRole("radio", { name: "System" }),
  ).toHaveAttribute("aria-checked", "true");

  // Dark, from the footer: the page and the recording turn with it.
  await choose(guest, "Dark", true);
  await expect(guest.locator('video[data-scheme="dark"]')).toBeVisible();
  await expect(guest.locator('video[data-scheme="light"]')).toBeHidden();

  // The choice survives a reload.
  await guest.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(
    appearance(guest).getByRole("radio", { name: "Dark" }),
  ).toHaveAttribute("aria-checked", "true");

  // The hero fades in on every load; shoot it once the fade is over.
  await guest.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  await guest.screenshot({
    path: evidencePath("guest-appearance", "guest-appearance.png"),
    fullPage: true,
  });

  // It follows the guest into the runner, whose own footer shows it.
  await guest.goto(`/j/${journeyId}`);
  await expect(
    guest.getByRole("heading", { name: START_STEP_TITLE }),
  ).toBeVisible();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(
    appearance(guest).getByRole("radio", { name: "Dark" }),
  ).toHaveAttribute("aria-checked", "true");

  // System hands the page back to the operating system's light.
  await choose(guest, "System", false);
  await guest.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);

  await guestContext.close();
});
