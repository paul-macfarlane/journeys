import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * axe's full default rule set over the whole page, in whatever scheme the
 * page already carries, one line per failing node: `<rule id> (<impact>):
 * <target>: <summary>`. Shared by `accessibility.spec.ts` and any spec that
 * holds one of its own pages to a rule.
 */
export async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact}): ${node.target.join(" ")}: ${node.failureSummary}`,
    ),
  );
}

/**
 * Fails on any violation — no rule here is ever switched off to get to zero
 * (ticket 78); a real one is fixed at its cause, and one outside this
 * ticket's own pages is reported instead.
 */
export async function expectNoViolations(
  page: Page,
  label: string,
): Promise<void> {
  expect(await axeViolations(page), `${label}: axe violations`).toEqual([]);
}
