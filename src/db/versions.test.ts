import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { createDraftDocument } from "@/lib/graph/document";

import { parseVersionDocument, toLiveVersion } from "./versions";

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
    expect(
      toLiveVersion({
        versionId: "version-1",
        versionNumber: 3,
        title: "Border Crossing",
        description: "A journey",
        document: { schemaVersion: 1, steps: "not a map" },
      }),
    ).toEqual({ kind: "unreadable", versionId: "version-1", versionNumber: 3 });
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
