import { expect, test } from "@playwright/test";

import { createProject, openTab, uniqueSuffix } from "./setup/authoring";
import { evidencePath } from "./setup/evidence";
import {
  cleanup,
  closePools,
  queryE2eDatabase,
  signInAgain,
  signInAs,
} from "./setup/session";

/**
 * Ticket 52, AC 1 and the on-screen half of AC 3: an Author opens Settings
 * from the user menu, renames themselves — the navbar, the Projects list,
 * and a Project's Members tab follow, and a later sign-in keeps the name —
 * sets, has refused, and clears their profile picture link, has a blank or
 * over-long name refused with the previous one kept, writes
 * a bio and a LinkedIn link, has a link on the wrong host and a plain
 * `http:` one refused without anything stored, and turns their Author page
 * on. Every save is proved against the `user` row as well as the screen.
 *
 * The public page itself is `author-page.spec.ts`'s; this spec never
 * visits `/authors/<id>`.
 */

const mintedAuthorIds: string[] = [];

test.afterAll(async () => {
  await cleanup(mintedAuthorIds);
  await closePools();
});

type AuthorRow = {
  name: string;
  image: string | null;
  bio: string | null;
  links: { kind: string; url: string }[];
  public: boolean;
};

async function readAuthor(userId: string): Promise<AuthorRow> {
  const [row] = await queryE2eDatabase<AuthorRow>(
    'SELECT name, image, bio, links, "public" FROM "user" WHERE id = $1',
    [userId],
  );
  return row;
}

test("author-settings", async ({ page, context }) => {
  // A refused edit is still unsaved, so leaving the page asks first; every
  // leave in this spec is meant, so the question is always answered yes.
  page.on("dialog", (dialog) => void dialog.accept());

  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  const suffix = uniqueSuffix();
  const newName = `Ada Lovelace ${suffix}`;

  // Settings is a row in the user menu.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Account: Test Author" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/projects\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeVisible();

  // Rename. Made until it takes, as `editJourneyField` does: hydration
  // writes the stored name into the field over a `fill` that lands first.
  const nameField = page.getByRole("textbox", { name: "Display name" });
  await expect(async () => {
    await nameField.fill(newName);
    await expect(nameField).toHaveValue(newName, { timeout: 1_000 });
    await nameField.press("Enter");
    await expect
      .poll(async () => (await readAuthor(author.id)).name, { timeout: 3_000 })
      .toBe(newName);
  }).toPass({ timeout: 20_000 });

  // The navbar, the Projects list, and the Members tab all read the name.
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Account: ${newName}` }),
  ).toBeVisible();
  await page.goto("/projects");
  await expect(page.getByText(`Signed in as ${newName}`)).toBeVisible();
  const projectId = await createProject(page, `Author settings ${suffix}`);
  await page.goto(`/projects/${projectId}`);
  await openTab(page, "Members");
  await expect(
    page.getByRole("tabpanel").getByText(newName, { exact: true }),
  ).toBeVisible();

  // The edit lives on the row: a later sign-in does not lose it.
  await signInAgain(context, author.id);
  await page.goto("/projects/settings");
  await expect(nameField).toHaveValue(newName);

  // The profile picture is a link the Author may change (Paul, 2026-09-24):
  // saved on blur, read back after a reload; a link that is not http(s) is
  // refused with the row untouched; blank clears it to the initials. The
  // first edit after the navigation is made until it takes, as the rename.
  const imageField = page.getByRole("textbox", { name: "Profile picture" });
  const imageUrl = `https://example.com/ada-${suffix}.png`;
  await expect(async () => {
    await imageField.fill(imageUrl);
    await expect(imageField).toHaveValue(imageUrl, { timeout: 1_000 });
    await imageField.press("Enter");
    await expect
      .poll(async () => (await readAuthor(author.id)).image, {
        timeout: 3_000,
      })
      .toBe(imageUrl);
  }).toPass({ timeout: 20_000 });
  await page.reload();
  await expect(imageField).toHaveValue(imageUrl);
  await imageField.fill("javascript:alert(1)");
  await imageField.blur();
  await expect(
    page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: "Use a link that starts with https:// or http://" }),
  ).toBeVisible();
  expect((await readAuthor(author.id)).image).toBe(imageUrl);
  await imageField.fill("");
  await imageField.blur();
  await expect.poll(async () => (await readAuthor(author.id)).image).toBeNull();

  // Scoped to the page body: Next's route announcer is an empty alert too.
  const alerts = page.getByRole("main").getByRole("alert");

  // A blank name and an over-long one are refused; the previous one stays.
  // The first edit after a navigation is made until it takes, as the rename
  // was: hydration writes the stored name back over a `fill` that lands
  // first, and a blank the page never saw raises no alert.
  await expect(async () => {
    await nameField.fill("");
    await expect(nameField).toHaveValue("", { timeout: 1_000 });
    await nameField.blur();
    await expect(alerts).toHaveText("Enter a name", { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await nameField.fill("x".repeat(61));
  await nameField.blur();
  await expect(alerts).toHaveText("Use 60 characters or fewer");
  await page.reload();
  await expect(nameField).toHaveValue(newName);
  expect((await readAuthor(author.id)).name).toBe(newName);

  // better-auth's own update endpoint is closed, so the Settings actions are
  // the only path that writes the name: a blank sent straight at it is a 404
  // and the row is untouched.
  const bypass = await page.request.post("/api/auth/update-user", {
    data: { name: "" },
  });
  expect(bypass.status()).toBe(404);
  expect((await readAuthor(author.id)).name).toBe(newName);

  // A bio, line break and all, and a LinkedIn link. The bio is the first
  // edit after the reload, so it is made until it takes, as above.
  const bio = "I write branching journeys about care.\nSecond line.";
  const bioField = page.getByRole("textbox", { name: "Bio" });
  await expect(async () => {
    await bioField.fill(bio);
    await expect(bioField).toHaveValue(bio, { timeout: 1_000 });
    await bioField.blur();
    await expect
      .poll(async () => (await readAuthor(author.id)).bio, { timeout: 3_000 })
      .toBe(bio);
  }).toPass({ timeout: 20_000 });

  const linkedinUrl = `https://www.linkedin.com/in/ada-${suffix}`;
  const linkedinField = page.getByRole("textbox", { name: "LinkedIn" });
  await linkedinField.fill(linkedinUrl);
  await linkedinField.blur();
  const storedLinks = [{ kind: "linkedin", url: linkedinUrl }];
  await expect
    .poll(async () => (await readAuthor(author.id)).links)
    .toEqual(storedLinks);

  // A link on the wrong host, and one that is not https, are refused and
  // nothing new is stored.
  const githubField = page.getByRole("textbox", { name: "GitHub" });
  await githubField.fill("https://linkedin.com/in/ada");
  await githubField.blur();
  await expect(
    alerts.filter({ hasText: "Use a link on github.com" }),
  ).toBeVisible();
  const websiteField = page.getByRole("textbox", { name: "Website" });
  await websiteField.fill("http://example.com");
  await websiteField.blur();
  await expect(
    alerts.filter({ hasText: "Use an https:// link" }),
  ).toBeVisible();
  // Both refusals are on screen, so both saves have finished: one read.
  expect((await readAuthor(author.id)).links).toEqual(storedLinks);

  // Cleared, both refusals go and the section is saved again.
  await githubField.fill("");
  await githubField.blur();
  await websiteField.fill("");
  await websiteField.blur();
  await expect(alerts).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Author page", exact: true })
      .getByRole("status"),
  ).toHaveText("Saved");

  // The page goes public, and Settings says where.
  await page.getByRole("checkbox", { name: "Public Author page" }).check();
  await expect
    .poll(async () => (await readAuthor(author.id)).public)
    .toBe(true);
  const publicLink = page.getByRole("link", {
    name: `/authors/${author.id}`,
  });
  await expect(publicLink).toBeVisible();
  await expect(publicLink).toHaveAttribute("href", `/authors/${author.id}`);

  // Back to the top first: the checkbox scrolled the page, and a fullPage
  // capture of a scrolled page paints the sticky navbar mid-image.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.screenshot({
    path: evidencePath("author-settings", "author-settings.png"),
    fullPage: true,
  });
});

/**
 * A refused link stays refused on screen while the page refreshes under it.
 * Every save on Settings refreshes the page, and the refresh hands the
 * "Author page" form the server's values again; the refused edit is kept,
 * and so is the sentence saying why it was refused. Before this held, a
 * refresh landing just after a refusal wiped the alert and left the field
 * showing a link nothing would save (author-settings under the load recipe,
 * 2026-09-26: the LinkedIn save's refresh landed after the Website refusal).
 * The Display name save is used to make the refresh certain.
 */
test("author-settings-refusal-survives-refresh", async ({ page, context }) => {
  page.on("dialog", (dialog) => void dialog.accept());

  const author = await signInAs(context);
  mintedAuthorIds.push(author.id);
  await page.goto("/projects/settings");

  const alerts = page.getByRole("main").getByRole("alert");
  const refusal = alerts.filter({ hasText: "Use a link on github.com" });
  const githubField = page.getByRole("textbox", { name: "GitHub" });
  // The first edit after the navigation is made until it takes: hydration
  // writes the stored value over a `fill` that lands first.
  await expect(async () => {
    await githubField.fill("https://linkedin.com/in/ada");
    await expect(githubField).toHaveValue("https://linkedin.com/in/ada", {
      timeout: 1_000,
    });
    await githubField.blur();
    await expect(refusal).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });

  // The name is saved and the page refreshes: the navbar reads the new name
  // once the refresh has landed.
  const newName = `Grace Hopper ${uniqueSuffix()}`;
  const nameField = page.getByRole("textbox", { name: "Display name" });
  await nameField.fill(newName);
  await nameField.blur();
  await expect
    .poll(async () => (await readAuthor(author.id)).name)
    .toBe(newName);
  await expect(
    page.getByRole("button", { name: `Account: ${newName}` }),
  ).toBeVisible();

  await expect(refusal).toBeVisible();
  await expect(githubField).toHaveValue("https://linkedin.com/in/ada");
  await expect(
    page
      .getByRole("region", { name: "Author page", exact: true })
      .getByRole("status"),
  ).toHaveText("Unsaved changes");
  expect((await readAuthor(author.id)).links).toEqual([]);
});
