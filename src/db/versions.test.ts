import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { createDraftDocument } from "@/lib/graph/document";

import { parseVersionDocument, toLiveVersion, toVersionView } from "./versions";

/**
 * Ticket 83: `getLiveVersion`'s row is read with `safeParse`. A Published
 * Version that fails the document contract answers `unreadable` (its id and
 * version number, so the Journey page can name it), never a throw — the
 * runner and the Author's other tabs must keep working beside a live
 * version that cannot be read.
 */
describe("toLiveVersion", () => {
  const document = createDraftDocument();

  it("reads a row that satisfies the contract as the live version", () => {
    expect(
      toLiveVersion({
        journeyId: "journey-1",
        versionId: "version-1",
        versionNumber: 3,
        title: "Border Crossing",
        description: "A journey",
        document,
      }),
    ).toEqual({
      kind: "ok",
      title: "Border Crossing",
      description: "A journey",
      document,
    });
  });

  it("reads a row that fails the contract as unreadable, keeping its id and number", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      toLiveVersion({
        journeyId: "journey-1",
        versionId: "version-1",
        versionNumber: 3,
        title: "Border Crossing",
        description: "A journey",
        document: { schemaVersion: 1, steps: "not a map" },
      }),
    ).toEqual({ kind: "unreadable", versionId: "version-1", versionNumber: 3 });
    expect(logged).toHaveBeenCalledWith("[unreadable]", "published version", {
      journeyId: "journey-1",
      versionId: "version-1",
    });
    logged.mockRestore();
  });
});

/**
 * `restoreVersion` reads the Published Version it copies from the same
 * way: a row that fails the contract answers null rather than throwing, so
 * the restore action can refuse it by name instead of 500ing.
 */
describe("parseVersionDocument", () => {
  const document = createDraftDocument();

  it("parses a document that satisfies the contract", () => {
    expect(parseVersionDocument(document)).toEqual(document);
  });

  it("answers null for a document that fails the contract", () => {
    expect(parseVersionDocument({ schemaVersion: 1, steps: "not a map" })).toBe(
      null,
    );
  });
});

/**
 * Ticket 94: the read behind a Published Version's own view (and, next,
 * its Preview). A row that satisfies the contract answers everything the
 * view shows about it, live or not; one that fails answers `unreadable`
 * with its id and number, logged, never thrown.
 */
describe("toVersionView", () => {
  const document = createDraftDocument();
  const publishedAt = new Date("2026-09-20T10:00:00.000Z");
  const row = {
    journeyId: "journey-1",
    id: "version-1",
    versionNumber: 1,
    title: "Border Crossing",
    description: "A journey",
    document,
    publishedAt,
    publishedByName: "Ada",
  };

  it("reads a row that satisfies the contract, naming whether it is live", () => {
    expect(toVersionView({ ...row, liveVersionId: "version-1" })).toEqual({
      kind: "ok",
      id: "version-1",
      versionNumber: 1,
      title: "Border Crossing",
      description: "A journey",
      document,
      publishedAt,
      publishedByName: "Ada",
      isLive: true,
    });
    expect(toVersionView({ ...row, liveVersionId: "version-2" })).toMatchObject(
      { kind: "ok", isLive: false },
    );
    expect(toVersionView({ ...row, liveVersionId: null })).toMatchObject({
      kind: "ok",
      isLive: false,
    });
  });

  it("reads a row that fails the contract as unreadable, keeping its id and number", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      toVersionView({
        ...row,
        document: { schemaVersion: 1, steps: "broken" },
        liveVersionId: "version-1",
      }),
    ).toEqual({ kind: "unreadable", id: "version-1", versionNumber: 1 });
    expect(logged).toHaveBeenCalledWith("[unreadable]", "published version", {
      journeyId: "journey-1",
      versionId: "version-1",
    });
    logged.mockRestore();
  });
});
