import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { createDraftDocument } from "@/lib/graph/document";

import { toStoredDraft } from "./drafts";

/**
 * Ticket 73, design point 5: a Draft row that fails the document contract
 * is read as unreadable — with its version, so a Restore can be guarded by
 * it — rather than thrown, so the Journey page can offer a way back instead
 * of a 500.
 */
describe("toStoredDraft", () => {
  const updatedAt = new Date("2026-09-26T12:00:00Z");

  it("reads a row that satisfies the contract as the document and its version", () => {
    const document = createDraftDocument();

    expect(toStoredDraft({ document, version: 3, updatedAt })).toEqual({
      kind: "ok",
      document,
      version: 3,
      updatedAt,
    });
  });

  it("reads a row that fails the contract as unreadable, keeping its version", () => {
    expect(
      toStoredDraft({
        document: { schemaVersion: 1, steps: "not a map" },
        version: 7,
        updatedAt,
      }),
    ).toEqual({ kind: "unreadable", version: 7, updatedAt });
  });
});
