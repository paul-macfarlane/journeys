import path from "node:path";

/**
 * Where a spec's screenshots and videos go.
 *
 * Evidence is scoped to the work package (`docs/agents/testing.md`): a
 * ticket commits the screenshot directories of the specs it names and
 * leaves every other directory under the proof root as the last work
 * package left it. A spec writing straight into `test-results/<test>/`
 * cannot know whether it is one of the named ones, so a full run used to
 * rewrite sixty-odd tracked screenshots that then had to be restored by
 * hand.
 *
 * `E2E_EVIDENCE` names, comma separated, the tests whose evidence the run
 * is committing; those write into the tracked proof root. Every other test
 * writes under Playwright's git-ignored scratch output, so a plain run —
 * locally or on CI — touches nothing tracked. `E2E_EVIDENCE=all` tracks
 * every test.
 */
const named = new Set(
  (process.env.E2E_EVIDENCE ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== ""),
);

export const TRACKED_EVIDENCE_ROOT = "test-results";
export const SCRATCH_EVIDENCE_ROOT = "test-results/playwright/evidence";

/** The proof root when the run names the test, else scratch. */
function evidenceRoot(testName: string): string {
  return named.has("all") || named.has(testName)
    ? TRACKED_EVIDENCE_ROOT
    : SCRATCH_EVIDENCE_ROOT;
}

/** `test-results/<test>/<file>` when the run names the test, else scratch. */
export function evidencePath(testName: string, file: string): string {
  return path.join(evidenceRoot(testName), testName, file);
}

/**
 * `test-results/<file>` when the run names the test, else scratch: for a
 * captured response a ticket files at the proof root as
 * `ac-<n>-<slug>.txt` rather than under the test's own directory.
 */
export function capturePath(testName: string, file: string): string {
  return path.join(evidenceRoot(testName), file);
}
