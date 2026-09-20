/**
 * Reads the legacy site's prerendered case-3 pages.
 *
 * Two things about the legacy host matter here. Its step hrefs omit the
 * trailing slash and it answers them with a 301 to `/<n>/`, so redirects must
 * be followed — `fetch` does that by default, which is why this uses `fetch`
 * and not a bare `curl` (a `curl -s` without `-L` returns an empty body). And
 * nothing lists the steps: the crawl starts at the entry step and follows
 * case-3 links until no new step number appears.
 *
 * Throwaway, like the rest of this script: it reads the markup the site emits
 * today and is not maintained against changes to it.
 */

export const LEGACY_ORIGIN = "https://journey-stories.netlify.app";

/** The entry Step of case 3 — "Preface", which is not step 1. */
export const CASE_3_START_STEP = 7;

/** How many pages are in flight at once, to stay polite to a free host. */
const CONCURRENCY = 6;

/**
 * Discovery only: the converter does the real reading of a page. A regex is
 * enough to find which step numbers a page points at, and keeps the crawl
 * independent of the converter.
 */
const STEP_LINK = /href="\/journeys\/case-3\/(\d+)\/?"/g;

export type FetchedStepPage = { step: number; html: string };

export function stepUrl(step: number): string {
  return `${LEGACY_ORIGIN}/journeys/case-3/${step}`;
}

export async function fetchStepPage(step: number): Promise<FetchedStepPage> {
  const response = await fetch(stepUrl(step), { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `${stepUrl(step)} answered ${response.status} ${response.statusText}`,
    );
  }
  const html = await response.text();
  if (html.trim().length === 0) {
    throw new Error(`${stepUrl(step)} answered with an empty body`);
  }
  return { step, html };
}

function linkedStepsIn(html: string): number[] {
  return [...html.matchAll(STEP_LINK)].map((match) => Number(match[1]));
}

/**
 * Walks out from the entry Step, a bounded batch at a time, until every page
 * reachable through case-3 links has been read. Returns them in step order.
 */
export async function scrapeCase3(
  options: { start?: number; onPage?: (step: number) => void } = {},
): Promise<FetchedStepPage[]> {
  const start = options.start ?? CASE_3_START_STEP;
  const fetched = new Map<number, FetchedStepPage>();
  let frontier = [start];

  while (frontier.length > 0) {
    const batch = frontier.slice(0, CONCURRENCY);
    frontier = frontier.slice(CONCURRENCY);

    const pages = await Promise.all(batch.map((step) => fetchStepPage(step)));
    for (const page of pages) {
      fetched.set(page.step, page);
      options.onPage?.(page.step);
      for (const linked of linkedStepsIn(page.html)) {
        if (!fetched.has(linked) && !frontier.includes(linked)) {
          frontier.push(linked);
        }
      }
    }
  }

  return [...fetched.values()].sort((left, right) => left.step - right.step);
}
