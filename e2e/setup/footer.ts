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

/**
 * The site footer wrapped into two tidy rows (ticket 67): on a phone the
 * mark and the copyright share the first row and the five links share the
 * second, each row starting at the same left edge, where `justify-between`
 * used to scatter whichever items wrapped across the width.
 */
export async function expectFooterInTwoRows(page: Page): Promise<void> {
  const footer = page.getByRole("contentinfo");
  const box = async (name: string) => {
    const b = await footer.getByRole("link", { name }).boundingBox();
    expect(b, `the ${name} link is rendered`).not.toBeNull();
    return b!;
  };
  const mark = await box("Journeys");
  const about = await box("About");
  const terms = await box("Terms");
  const rowOf = (b: { y: number; height: number }) => b.y + b.height / 2;
  // The links sit on one row below the mark's row.
  expect(rowOf(about), "About under the mark").toBeGreaterThan(
    mark.y + mark.height,
  );
  expect(
    Math.abs(rowOf(terms) - rowOf(about)),
    "About and Terms on one row",
  ).toBeLessThan(2);
  // Both rows start at the same left edge: nothing was pushed to the right.
  expect(Math.abs(about.x - mark.x), "rows share a left edge").toBeLessThan(2);
}
