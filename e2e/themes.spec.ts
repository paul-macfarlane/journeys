import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { THEME_PRESETS, type ThemePreset } from "@/lib/theme";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import {
  publishDocument,
  QUEUE_STEP_TITLE,
  runnerDocument,
  START_STEP_TITLE,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAs,
} from "./setup/session";

/**
 * Ticket 11: Themes.
 *
 * `themes-settings` is Seam B: an Author picks a preset and an accent on
 * the Project's Settings tab, a Participant opens the public Project page
 * and the runner and finds the frame carrying that preset and accent; the
 * Author then gives one Journey a Theme of its own, which wins in the
 * runner while the Project page keeps the Project's, and clears it again.
 * The editor never carries a Theme.
 *
 * `themes-contrast` is the guarantee behind the presets: every one of the
 * six passes axe's `color-contrast` rule on the runner's start screen, a
 * Step, and the Project page, in light and dark, with a screenshot of each
 * as evidence. The presets are set straight on the row here — the picker
 * is Seam B's to prove — and each screen is a fresh Participant's.
 */

test.setTimeout(240_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/** The one element that carries the Theme: the runner frame. */
function themedFrame(page: Page) {
  return page.locator('[data-slot="runner-frame"]');
}

/**
 * The WCAG relative luminance of one painted color on an element, read the
 * way `e2e/branding.spec.ts` reads contrast: painted onto a one-pixel canvas
 * so an oklch-specified color comes back as the 8-bit sRGB Chromium drew.
 */
async function paintedLuminance(
  page: Page,
  selector: string,
  property: "border-top-color" | "background-color",
): Promise<number> {
  const value = await page.evaluate(
    ([selector, property]) => {
      const element = window.document.querySelector(selector);
      if (!element) return null;
      const canvas = window.document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = window
        .getComputedStyle(element)
        .getPropertyValue(property);
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(context.getImageData(0, 0, 1, 1).data);
      const linear = (channel: number) => {
        const s = channel / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    },
    [selector, property] as const,
  );
  expect(value, `${selector} ${property} painted`).not.toBeNull();
  return value as number;
}

async function readProjectTheme(projectId: string) {
  const [row] = await queryE2eDatabase<{
    theme_preset: string;
    theme_accent: string | null;
  }>('SELECT theme_preset, theme_accent FROM "project" WHERE id = $1', [
    projectId,
  ]);
  return { preset: row.theme_preset, accent: row.theme_accent };
}

async function readJourneyTheme(journeyId: string) {
  const [row] = await queryE2eDatabase<{
    theme_preset: string | null;
    theme_accent: string | null;
  }>('SELECT theme_preset, theme_accent FROM "journey" WHERE id = $1', [
    journeyId,
  ]);
  return { preset: row.theme_preset, accent: row.theme_accent };
}

/** A Project with one published Journey, made through the UI as an Author. */
async function publishOne(
  page: Page,
  label: string,
): Promise<{ projectId: string; journeyId: string }> {
  const suffix = uniqueSuffix();
  await page.goto("/projects");
  const projectId = await createProject(page, `${label} ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `${label} journey ${suffix}`,
    "A short walk to check the theme.",
  );
  await writeDraftDocument(journeyId, runnerDocument());
  await publishDocument(journeyId, runnerDocument());
  return { projectId, journeyId };
}

/** A Participant: no session, on a phone, holding only the link. */
function newParticipant(browser: Browser, colorScheme?: "light" | "dark") {
  return browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
    colorScheme,
  });
}

test("themes-settings: a Project's preset and accent reach the runner and the Project page, and a Journey's own Theme wins", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const { projectId, journeyId } = await publishOne(page, "Theme");

  // Every Project starts in the app's own palette, with no accent.
  expect(await readProjectTheme(projectId)).toEqual({
    preset: "trail",
    accent: null,
  });

  // The Project's Settings tab: a preset, then an accent.
  await page.goto(`/projects/${projectId}`);
  await openTab(page, "Settings");
  await expect(page.getByRole("radio", { name: /^Trail/ })).toBeChecked();
  await page.getByRole("radio", { name: /^Tide/ }).check();
  await expect
    .poll(() => readProjectTheme(projectId))
    .toEqual({
      preset: "tide",
      accent: null,
    });

  await page.getByRole("checkbox", { name: "Accent color" }).check();
  await expect
    .poll(async () => (await readProjectTheme(projectId)).accent)
    .toBe("#095b41");
  const accentField = page.getByLabel("Accent color value");
  await accentField.fill("#c2410c");
  await accentField.blur();
  await expect
    .poll(() => readProjectTheme(projectId))
    .toEqual({
      preset: "tide",
      accent: "#c2410c",
    });
  await page.screenshot({
    path: evidencePath("themes-settings", "project-settings.png"),
    fullPage: true,
  });

  // A Participant sees both on the Project page, the start screen, and a
  // Step: the preset as the frame's attribute, the accent as its primary.
  const phone = await newParticipant(browser);
  try {
    const participant = await phone.newPage();
    await participant.goto(`/p/${projectId}`);
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-theme",
      "tide",
    );
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-accent",
      "#c2410c",
    );
    // The stripe along the top is the accent as given, by day…
    const byDay = await paintedLuminance(
      participant,
      '[data-slot="runner-frame"]',
      "border-top-color",
    );
    expect(byDay).toBeLessThan(0.2);
    await participant.screenshot({
      path: evidencePath("themes-settings", "project-page-tide.png"),
      fullPage: true,
    });

    await participant.goto(`/j/${journeyId}`);
    await expect(
      participant.getByRole("heading", { name: START_STEP_TITLE, level: 1 }),
    ).toBeVisible();
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-theme",
      "tide",
    );
    await participant.getByRole("button", { name: "Wait your turn" }).click();
    await expect(
      participant.getByRole("heading", { name: QUEUE_STEP_TITLE, level: 1 }),
    ).toBeVisible();
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-theme",
      "tide",
    );
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-accent",
      "#c2410c",
    );
    await participant.screenshot({
      path: evidencePath("themes-settings", "runner-step-tide.png"),
      fullPage: true,
    });
  } finally {
    await phone.close();
  }

  // …and lifted by night, so a deep accent still shows on dark paper.
  const night = await newParticipant(browser, "dark");
  try {
    const participant = await night.newPage();
    await participant.goto(`/j/${journeyId}`);
    await expect(participant.locator("html")).toHaveClass(/\bdark\b/);
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-accent",
      "#c2410c",
    );
    const byNight = await paintedLuminance(
      participant,
      '[data-slot="runner-frame"]',
      "border-top-color",
    );
    expect(byNight).toBeGreaterThan(0.4);
    await participant.screenshot({
      path: evidencePath("themes-settings", "runner-start-tide-dark.png"),
      fullPage: true,
    });
  } finally {
    await night.close();
  }

  // The Journey's Settings tab: its own Theme, starting from the Project's.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  // The editor carries no Theme: no frame, and nothing on the page carries
  // the attribute while the editor is the open tab.
  await expect(themedFrame(page)).toHaveCount(0);
  await expect(page.locator("[data-theme]")).toHaveCount(0);
  await openTab(page, "Settings");
  await expect(page.getByText("uses the project's theme (Tide)")).toBeVisible();
  const override = page.getByRole("checkbox", {
    name: "Use a different theme for this journey",
  });
  await expect(override).not.toBeChecked();
  await override.check();
  await expect
    .poll(() => readJourneyTheme(journeyId))
    .toEqual({
      preset: "tide",
      accent: "#c2410c",
    });
  await expect(page.getByRole("radio", { name: /^Tide/ })).toBeChecked();

  await page.getByRole("radio", { name: /^Dusk/ }).check();
  await expect
    .poll(async () => (await readJourneyTheme(journeyId)).preset)
    .toBe("dusk");
  await page.getByRole("checkbox", { name: "Accent color" }).uncheck();
  await expect
    .poll(() => readJourneyTheme(journeyId))
    .toEqual({
      preset: "dusk",
      accent: null,
    });
  await page.screenshot({
    path: evidencePath("themes-settings", "journey-settings.png"),
    fullPage: true,
  });

  // Preview paints what a Participant will see, too.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}/preview`);
  await expect(themedFrame(page)).toHaveAttribute("data-theme", "dusk");

  // The Journey's Theme wins in the runner; the Project page keeps its own.
  const phoneAgain = await newParticipant(browser);
  try {
    const participant = await phoneAgain.newPage();
    await participant.goto(`/j/${journeyId}`);
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-theme",
      "dusk",
    );
    await expect(themedFrame(participant)).not.toHaveAttribute("data-accent");
    await participant.screenshot({
      path: evidencePath("themes-settings", "runner-start-dusk.png"),
      fullPage: true,
    });
    await participant.goto(`/p/${projectId}`);
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-theme",
      "tide",
    );

    // Clearing the override sends the Journey back to the Project's Theme.
    await page.goto(
      `/projects/${projectId}/journeys/${journeyId}?tab=settings`,
    );
    await page
      .getByRole("checkbox", { name: "Use a different theme for this journey" })
      .uncheck();
    await expect
      .poll(() => readJourneyTheme(journeyId))
      .toEqual({
        preset: null,
        accent: null,
      });
    await participant.goto(`/j/${journeyId}`);
    await expect(themedFrame(participant)).toHaveAttribute(
      "data-theme",
      "tide",
    );
  } finally {
    await phoneAgain.close();
  }
});

/**
 * axe's contrast rule over the whole page, in the scheme the page is in.
 * Fails on any violation, and on a page where the rule found nothing to
 * check — a pass with no text behind it would prove nothing.
 */
async function expectContrast(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  const checked = results.passes.find((rule) => rule.id === "color-contrast");
  expect(checked?.nodes.length ?? 0, `${label}: text checked`).toBeGreaterThan(
    0,
  );
  const violations = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${node.target.join(" ")}: ${node.failureSummary}`,
    ),
  );
  expect(violations, `${label}: color-contrast violations`).toEqual([]);
  console.log(
    `contrast ${label}: ${checked?.nodes.length ?? 0} elements pass, ${violations.length} fail`,
  );
}

test("themes-contrast: every preset passes WCAG AA on the start screen, a Step, and the Project page in light and dark", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const { projectId, journeyId } = await publishOne(page, "Contrast");

  for (const { id: preset } of THEME_PRESETS) {
    await queryE2eDatabase(
      'UPDATE "project" SET theme_preset = $1, theme_accent = NULL WHERE id = $2',
      [preset satisfies ThemePreset, projectId],
    );

    for (const scheme of ["light", "dark"] as const) {
      // A fresh Participant per screen set, so a Run from the last preset
      // never puts a resume panel over the start screen.
      const phone = await newParticipant(browser, scheme);
      try {
        const participant = await phone.newPage();

        await participant.goto(`/j/${journeyId}`);
        await expect(participant.locator("html")).toHaveClass(
          new RegExp(`\\b${scheme}\\b`),
        );
        await expect(themedFrame(participant)).toHaveAttribute(
          "data-theme",
          preset,
        );
        await expect(
          participant.getByRole("heading", {
            name: START_STEP_TITLE,
            level: 1,
          }),
        ).toBeVisible();
        await expectContrast(participant, `${preset} ${scheme} start`);
        await participant.screenshot({
          path: evidencePath(
            "themes-contrast",
            `${preset}-${scheme}-start.png`,
          ),
          fullPage: true,
        });

        await participant
          .getByRole("button", { name: "Wait your turn" })
          .click();
        await expect(
          participant.getByRole("heading", {
            name: QUEUE_STEP_TITLE,
            level: 1,
          }),
        ).toBeVisible();
        await expectContrast(participant, `${preset} ${scheme} step`);
        await participant.screenshot({
          path: evidencePath("themes-contrast", `${preset}-${scheme}-step.png`),
          fullPage: true,
        });

        await participant.goto(`/p/${projectId}`);
        await expect(
          participant.getByRole("list", { name: "Journeys" }),
        ).toBeVisible();
        await expectContrast(participant, `${preset} ${scheme} project`);
        await participant.screenshot({
          path: evidencePath(
            "themes-contrast",
            `${preset}-${scheme}-project.png`,
          ),
          fullPage: true,
        });
      } finally {
        await phone.close();
      }
    }
  }
});
