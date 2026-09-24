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
