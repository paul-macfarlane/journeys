import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { createDraftDocument } from "@/lib/graph/document";

import { toAnalyticsSource } from "./analytics";

/**
 * Ticket 83: `getAnalyticsForMember`'s Published Version row is read with
 * `safeParse`. A version whose document fails the contract answers
 * `unreadable` (its id and version number), never a throw — the Analytics
 * tab names it in a banner and the Draft and other versions keep working.
 */
describe("toAnalyticsSource", () => {
  const document = createDraftDocument();
  const runs = [{ versionId: "version-1", path: ["start"] }];

  it("reads a version whose document satisfies the contract", () => {
    expect(
      toAnalyticsSource(
        { journeyId: "journey-1", id: "version-1", versionNumber: 2, document },
        runs,
      ),
    ).toEqual({
      kind: "ok",
      version: { id: "version-1", versionNumber: 2, document },
      runs,
    });
  });

  it("reads a version whose document fails the contract as unreadable", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      toAnalyticsSource(
        {
          journeyId: "journey-1",
          id: "version-1",
          versionNumber: 2,
          document: { schemaVersion: 1, steps: "not a map" },
        },
        runs,
      ),
    ).toEqual({ kind: "unreadable", versionId: "version-1", versionNumber: 2 });
    expect(logged).toHaveBeenCalledWith("[unreadable]", "published version", {
      journeyId: "journey-1",
      versionId: "version-1",
    });
    logged.mockRestore();
  });
});
