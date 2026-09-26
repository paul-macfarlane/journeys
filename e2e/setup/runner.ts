import type { Page } from "@playwright/test";

/** The Prompt's textbox on a runner or Preview screen, found by its question. */
export function promptBox(page: Page, label: string) {
  return page.getByRole("textbox", { name: label });
}
