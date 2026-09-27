import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { createJourney, createProject, uniqueSuffix } from "./setup/authoring";
import {
  publishableDocument,
  publishDocument,
  START_STEP_ID,
  writeDraftDocument,
} from "./setup/documents";
import { E2E_BASE_URL } from "./setup/e2e-env";
import { evidencePath } from "./setup/evidence";
import { cleanup, closePools, signInAs } from "./setup/session";

/**
 * Ticket 78: the accessibility pass's automated half. `a11y-project-page`
 * and `a11y-journey-page` run axe's full default rule set over the two
 * Author pages `generateMetadata` now titles, in both color schemes;
 * `runner-single-h1` proves a Step whose content opens with an H1 still
 * renders exactly one `h1` on the runner — the Step's own title
 * (`step-view.tsx`), with the content's heading shifted down
 * (`@/components/runner/rich-text`).
 */

test.setTimeout(120_000);

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

/**
 * axe's full default rule set over the whole page, in whatever scheme the
 * page already carries. Fails on any violation — no rule here is ever
 * switched off to get to zero (ticket 78); a real one is fixed at its
 * cause, and one outside this ticket's own pages is reported instead.
 */
async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact}): ${node.target.join(" ")}: ${node.failureSummary}`,
    ),
  );
  expect(violations, `${label}: axe violations`).toEqual([]);
}

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
    // The content's own heading, shifted down one level
    // (`shiftHeadingLevel` in `rich-text.tsx`): H1 -> h2, not a second h1.
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
