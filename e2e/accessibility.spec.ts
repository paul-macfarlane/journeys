import { expect, test, type Browser, type Page } from "@playwright/test";

import type { Content } from "@/lib/graph/content";

import {
  createJourney,
  createProject,
  openTab,
  uniqueSuffix,
} from "./setup/authoring";
import { expectNoViolations } from "./setup/axe";
import {
  publishableDocument,
  publishDocument,
  START_STEP_ID,
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
 * Ticket 78: the accessibility pass's automated half. `a11y-project-page`
 * and `a11y-journey-page` run axe's full default rule set over the two
 * Author pages `generateMetadata` now titles, in both color schemes;
 * `runner-single-h1` proves a Step whose content opens with an H1 still
 * renders exactly one `h1` on the runner — the Step's own title
 * (`step-view.tsx`), with the content's heading shifted down
 * (`@/components/runner/rich-text`).
 *
 * The walk (item 5) added the rest: `a11y-preview` and
 * `a11y-project-settings` hold two more pages to zero violations,
 * `a11y-names` pins the names, roles, and focus the walk corrected, and
 * `a11y-reduced-motion` proves a reader who asked for less motion gets
 * none from the app's own popups or map.
 */

test.setTimeout(120_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/**
 * A second context for the same signed-in Author, in the other color
 * scheme: the app follows the system scheme by default, so a fresh context
 * with `colorScheme` set is a fresh Participant's — or here, the same
 * Author's — read of it. The cookie jar is copied rather than minted again,
 * so both contexts are the one Author's session.
 */
async function darkContextFor(
  browser: Browser,
  page: Page,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    colorScheme: "dark",
  });
  await context.addCookies(await page.context().cookies());
  const darkPage = await context.newPage();
  return { page: darkPage, close: () => context.close() };
}

test("a11y-project-page: zero axe violations in both schemes, and the Project's own title", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();
  const title = `A11y project ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, title);
  await page.goto(`/projects/${projectId}`);
  await createJourney(page, projectId, `A11y journey ${suffix}`);

  await page.goto(`/projects/${projectId}`);
  await expect(
    page.getByRole("link", { name: new RegExp(`A11y journey ${suffix}`) }),
  ).toBeVisible();
  await expect(page).toHaveTitle(`${title} · Journeys`);
  await expectNoViolations(page, "project page, light");
  await page.screenshot({
    path: evidencePath("a11y-project-page", "project-page-light.png"),
    fullPage: true,
  });

  const dark = await darkContextFor(browser, page);
  try {
    await dark.page.goto(`/projects/${projectId}`);
    await expect(dark.page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(dark.page).toHaveTitle(`${title} · Journeys`);
    await expectNoViolations(dark.page, "project page, dark");
  } finally {
    await dark.close();
  }
});

test("a11y-journey-page: zero axe violations on the Editor tab in both schemes, and the Journey's own title", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();
  const projectTitle = `A11y editor project ${suffix}`;
  const journeyTitle = `A11y editor journey ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(page, projectId, journeyTitle);
  await writeDraftDocument(journeyId, publishableDocument());

  // The Editor tab is the address's default; the Draft's Start Step is
  // already the one the editor selects, so the Step panel and the canvas
  // both render with nothing further clicked.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await expect(page.getByLabel("Step title")).toBeVisible();
  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page).toHaveTitle(`${journeyTitle} · Journeys`);
  await expectNoViolations(page, "journey page, light");
  await page.screenshot({
    path: evidencePath("a11y-journey-page", "journey-page-light.png"),
    fullPage: true,
  });

  // The Journey page's other tabs, light only: each opened and checked in
  // turn, since axe reads the tree the open tab renders, not the ones
  // hidden behind it.
  for (const tab of [
    "Versions",
    "Responses",
    "Analytics",
    "Settings",
  ] as const) {
    await openTab(page, tab);
    await expectNoViolations(page, `journey page, ${tab} tab, light`);
  }

  const dark = await darkContextFor(browser, page);
  try {
    await dark.page.goto(`/projects/${projectId}/journeys/${journeyId}`);
    await expect(dark.page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(dark.page.getByLabel("Step title")).toBeVisible();
    await expect(dark.page).toHaveTitle(`${journeyTitle} · Journeys`);
    await expectNoViolations(dark.page, "journey page, dark");
  } finally {
    await dark.close();
  }
});

test("runner-single-h1: a Step whose content opens with an H1 still renders exactly one h1", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `A11y runner ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `A11y runner journey ${suffix}`,
  );

  // The Start Step's content opens with an H1 of its own — the shape a
  // pasted document or an imported case can carry — to prove the runner
  // never renders two `h1`s: the Step's own title, and this one.
  const document = publishableDocument();
  document.steps[START_STEP_ID] = {
    ...document.steps[START_STEP_ID],
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Border crossing" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The queue has not moved in an hour." },
          ],
        },
      ],
    },
  };
  await writeDraftDocument(journeyId, document);
  await publishDocument(journeyId, document);

  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    const participant = await participantContext.newPage();
    await participant.goto(`/j/${journeyId}`);

    await expect(participant.locator("h1")).toHaveCount(1);
    await expect(
      participant.getByRole("heading", {
        name: document.steps[START_STEP_ID].title,
        level: 1,
      }),
    ).toBeVisible();
    // The content's own heading, normalised to the first level below the
    // page's own h1 (`normalizeHeadingLevel` in `rich-text.tsx`): H1 -> h2,
    // not a second h1.
    await expect(
      participant.getByRole("heading", { name: "Border crossing", level: 2 }),
    ).toBeVisible();

    await participant.screenshot({
      path: evidencePath("runner-single-h1", "start-step.png"),
      fullPage: true,
    });
  } finally {
    await participantContext.close();
  }
});

test("a11y-preview: zero axe violations on Preview in both schemes, with one banner", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `A11y preview ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `A11y preview journey ${suffix}`,
  );
  await writeDraftDocument(journeyId, publishableDocument());
  const previewPath = `/projects/${projectId}/journeys/${journeyId}/preview`;

  // Preview sits under the Author navbar, whose header is the page's one
  // banner; the frame's own header is a region named "Journey" there, and
  // the bar saying this is Preview is a region of its own.
  await page.goto(previewPath);
  await expect(
    page.getByRole("heading", { name: START_STEP_TITLE, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Preview" })
      .getByRole("link", { name: "Back to editor" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Journey", exact: true })
      .getByRole("button", { name: "Dark mode" }),
  ).toBeVisible();
  await expectNoViolations(page, "preview, light");
  await page.screenshot({
    path: evidencePath("a11y-preview", "preview-light.png"),
    fullPage: true,
  });

  const dark = await darkContextFor(browser, page);
  try {
    await dark.page.goto(previewPath);
    await expect(dark.page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(
      dark.page.getByRole("heading", { name: START_STEP_TITLE, level: 1 }),
    ).toBeVisible();
    await expectNoViolations(dark.page, "preview, dark");
  } finally {
    await dark.close();
  }
});

test("a11y-project-settings: zero axe violations on the Project's Settings tab in both schemes", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `A11y settings ${suffix}`);
  const settingsPath = `/projects/${projectId}?tab=settings`;

  // The description is a rich-text surface: a multi-line textbox named
  // "Description", rather than a bare `div` carrying a name it is not
  // allowed (axe `aria-prohibited-attr`).
  await page.goto(settingsPath);
  const description = page.getByRole("textbox", { name: "Description" });
  await expect(description).toBeVisible();
  await expect(description).toHaveAttribute("aria-multiline", "true");
  await expectNoViolations(page, "project settings, light");
  await page.screenshot({
    path: evidencePath("a11y-project-settings", "project-settings-light.png"),
    fullPage: true,
  });

  const dark = await darkContextFor(browser, page);
  try {
    await dark.page.goto(settingsPath);
    await expect(dark.page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(
      dark.page.getByRole("textbox", { name: "Description" }),
    ).toBeVisible();
    await expectNoViolations(dark.page, "project settings, dark");
  } finally {
    await dark.close();
  }
});

test("a11y-names: the names, roles, and focus the walk corrected", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();

  await page.goto("/projects");
  const projectId = await createProject(page, `A11y names ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  const journeyId = await createJourney(
    page,
    projectId,
    `A11y names journey ${suffix}`,
  );
  await writeDraftDocument(journeyId, publishableDocument());

  // The Step's content is a multi-line textbox named for what it holds, and
  // Tab from the toolbar's last button lands in it showing the focus ring
  // the app's fields do, not a caret alone.
  await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
  await expect(page.getByLabel("Step title")).toHaveValue(START_STEP_TITLE);
  const content = page.getByRole("textbox", { name: "Step content" });
  await expect(content).toHaveAttribute("aria-multiline", "true");
  await page.getByRole("button", { name: "Image", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(content).toBeFocused();
  await expect(content).not.toHaveCSS("box-shadow", "none");

  // A tab panel is a tab stop of its own, and shows it: Tab from the open
  // tab lands on the panel, which carries the focus ring the tabs do.
  await page.getByRole("tab", { name: "Editor", exact: true }).focus();
  await page.keyboard.press("Tab");
  const panel = page.getByRole("tabpanel", { name: "Editor" });
  await expect(panel).toBeFocused();
  await expect(panel).not.toHaveCSS("box-shadow", "none");

  // The Author page's copy button opens with the words it shows, "Copy
  // link", so a voice-control user who says them reaches it (WCAG 2.5.3),
  // and names whose link it is.
  await queryE2eDatabase('UPDATE "user" SET "public" = true WHERE id = $1', [
    author.id,
  ]);
  await page.goto("/projects/settings");
  const copy = page.getByRole("button", {
    name: "Copy link to your Author page",
    exact: true,
  });
  await expect(copy).toBeVisible();
  await expect(copy).toHaveText("Copy link");
  await page.screenshot({
    path: evidencePath("a11y-names", "account-settings.png"),
    fullPage: true,
  });

  // The provider marks are decorative: each button is named by its words
  // alone, not "Google Sign in with Google".
  const guest = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const signIn = await guest.newPage();
    await signIn.goto("/sign-in");
    await expect(
      signIn.getByRole("button", { name: "Sign in with Google", exact: true }),
    ).toBeVisible();
    await expect(
      signIn.getByRole("button", { name: "Sign in with Discord", exact: true }),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
});

test("a11y-reduced-motion: popups and the map move at once for a reader who asked for less motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const author = await signInAs(context);
    mintedAuthorIds.push(author.id);
    const suffix = uniqueSuffix();

    await page.goto("/projects");
    const projectId = await createProject(page, `A11y motion ${suffix}`);
    await page.goto(`/projects/${projectId}`);
    const journeyId = await createJourney(
      page,
      projectId,
      `A11y motion journey ${suffix}`,
    );
    await writeDraftDocument(journeyId, publishableDocument());

    // A dialog's entrance (tw-animate-css's `enter`, 100ms by default)
    // finishes at once.
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: "New journey" }).click();
    const dialog = page.getByRole("dialog", { name: "New journey" });
    await expect(dialog).toBeVisible();
    const seconds = await dialog.evaluate((element) =>
      parseFloat(getComputedStyle(element).animationDuration),
    );
    expect(seconds).toBeLessThan(0.001);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // The map's own move — the fit after it turns a quarter, 200ms of
    // frames by default — lands in one: sampled every frame from before the
    // click to well after the move would have finished, the map's
    // transform takes no value between where it was and where it ends.
    await page.goto(`/projects/${projectId}/journeys/${journeyId}`);
    await expect(page.getByLabel("Step title")).toHaveValue(START_STEP_TITLE);
    const viewport = page
      .getByRole("region", { name: "Canvas" })
      .locator(".react-flow__viewport");
    await expect(viewport).toHaveAttribute("style", /transform/);

    // Started before the click and awaited after it: `evaluate` awaits a
    // returned promise, and this one resolves only once its own sampling
    // window — 1.5s of frames, well past the move's 200ms — has ended, with
    // every transform it saw along the way.
    const framesPromise = page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const element = document.querySelector<HTMLElement>(
            ".react-flow__viewport",
          );
          const seen: string[] = [];
          const started = performance.now();
          const sample = () => {
            const value = element?.style.transform ?? "";
            if (seen.at(-1) !== value) seen.push(value);
            if (performance.now() - started < 1_500) {
              requestAnimationFrame(sample);
            } else {
              resolve(seen);
            }
          };
          requestAnimationFrame(sample);
        }),
    );
    await page.getByRole("radio", { name: "Left to right" }).click();
    const frames = await framesPromise;

    const before = frames[0];
    const after = frames[frames.length - 1];
    expect(
      frames.every((frame) => frame === before || frame === after),
      "the map's transform took no value between where it was and where it ends",
    ).toBe(true);
    await page.screenshot({
      path: evidencePath("a11y-reduced-motion", "turned-map.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});

test("a11y-heading-order: a public Project's description never skips a heading level (ticket 92)", async ({
  page,
  context,
  browser,
}) => {
  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();
  const projectTitle = `A11y heading order ${suffix}`;

  await page.goto("/projects");
  const projectId = await createProject(page, projectTitle);
  await page.goto(`/projects/${projectId}`);
  // A live Journey (ticket 42, decision 4): a Project with none is a 404,
  // so the public page this test checks needs one to render at all.
  const journeyId = await createJourney(
    page,
    projectId,
    `A11y heading order journey ${suffix}`,
  );
  await publishDocument(journeyId, publishableDocument());

  // A description opening with an H2 then an H3, and a paragraph — the
  // shape that rendered h3-then-h4 under the fixed one-level shift ticket
  // 92 replaced, an axe heading-order violation since nothing rendered the
  // h2 in between.
  const description: Content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "About this route" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "What to bring" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Water and shade." }],
      },
    ],
  };
  await queryE2eDatabase(
    'UPDATE "project" SET description_content = $1::jsonb WHERE id = $2',
    [JSON.stringify(description), projectId],
  );

  const guestContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    const guest = await guestContext.newPage();
    await guest.goto(`/p/${projectId}`);

    await expect(
      guest.getByRole("heading", { name: projectTitle, level: 1 }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "About this route", level: 2 }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "What to bring", level: 3 }),
    ).toBeVisible();

    await expectNoViolations(guest, "public project page, heading order");
    await guest.screenshot({
      path: evidencePath("a11y-heading-order", "public-project.png"),
      fullPage: true,
    });
  } finally {
    await guestContext.close();
  }
});
