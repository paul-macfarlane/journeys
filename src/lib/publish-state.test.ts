import { describe, expect, it } from "vitest";

import { publishStateOf } from "@/lib/publish-state";

/**
 * Seam A for ticket 05: the rule that turns a Journey's live-version pointer
 * and its count of Published Versions into the state the badge reads.
 *
 * Expected values are the three states named in the ticket, written out
 * rather than derived the way the function derives them.
 */
describe("publishStateOf", () => {
  it("is never published when the Journey has no version and no live one", () => {
    expect(publishStateOf({ liveVersionId: null, versionCount: 0 })).toBe(
      "never-published",
    );
  });

  it("is published while the Journey points at a live version", () => {
    expect(
      publishStateOf({ liveVersionId: "version-1", versionCount: 1 }),
    ).toBe("published");
  });

  it("is unpublished once versions exist but none is live", () => {
    expect(publishStateOf({ liveVersionId: null, versionCount: 2 })).toBe(
      "unpublished",
    );
  });
});
