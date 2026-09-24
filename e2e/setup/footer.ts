import { expect, type Page } from "@playwright/test";

/**
 * The site footer on one row across the page (ticket 62). The `<footer>`
 * landmark itself is always page-wide, so the proof measures its content:
 * the first item (the mark, linking home) and the last (the Terms link)
 * share a row, and the span from the mark's left edge to the Terms link's
 * right edge is at least `minWidth` pixels — well past the prose column
 * the four prose pages used to squeeze the footer into, where Privacy and
 * Terms dropped to a second row.
 */
export async function expectFooterOnOneRow(
  page: Page,
  minWidth = 1000,
): Promise<void> {
  const footer = page.getByRole("contentinfo");
  const first = await footer
    .getByRole("link", { name: "Journeys" })
    .boundingBox();
  const last = await footer.getByRole("link", { name: "Terms" }).boundingBox();
  expect(first, "the mark is rendered").not.toBeNull();
  expect(last, "the Terms link is rendered").not.toBeNull();
  if (!first || !last) return;
  // Same row: the Terms link starts above the mark's bottom edge.
  expect(last.y, "Terms on the mark's row").toBeLessThan(
    first.y + first.height,
  );
  expect(last.x + last.width - first.x, "footer span").toBeGreaterThanOrEqual(
    minWidth,
  );
}
