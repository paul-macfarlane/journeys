import { expect, type Page } from "@playwright/test";

/**
 * Ticket 62's acceptance criterion: the footer's content spans at least
 * this many pixels at the default (1280 px) viewport, well past the prose
 * column (about 650 px) the prose pages used to squeeze it into.
 */
const MIN_FOOTER_SPAN = 1000;

/**
 * The site footer on one row across the page (ticket 62). The `<footer>`
 * landmark itself is always page-wide, so the proof measures its content:
 * the first item (the mark, linking home) and the last (the Terms link)
 * share a row, and the span from the mark's left edge to the Terms link's
 * right edge is at least `MIN_FOOTER_SPAN`, where Privacy and Terms used
 * to drop to a second row.
 */
export async function expectFooterOnOneRow(page: Page): Promise<void> {
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
    MIN_FOOTER_SPAN,
  );
}
