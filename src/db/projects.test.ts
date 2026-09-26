import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { emptyContent } from "@/lib/graph/content";

import { guardsDescription, toProjectSummary } from "./projects";

/**
 * Ticket 83: a Project row whose description fails `contentSchema` reads
 * back as empty rich text, never a throw — a rename or a Theme change must
 * still work beside a description no Author can read.
 */
describe("toProjectSummary", () => {
  const row = {
    id: "project-1",
    title: "Refugee Health",
    descriptionContent: { type: "doc", content: [] },
    themePreset: "trail",
    themeAccent: null,
  };

  it("reads a row whose description satisfies the contract as itself", () => {
    expect(toProjectSummary(row)).toEqual({
      id: "project-1",
      title: "Refugee Health",
      description: { type: "doc", content: [] },
      theme: { preset: "trail", accent: null },
    });
  });

  it("reads a row whose description fails the contract as empty rich text", () => {
    expect(
      toProjectSummary({ ...row, descriptionContent: "not a document" }),
    ).toEqual({
      id: "project-1",
      title: "Refugee Health",
      description: emptyContent,
      theme: { preset: "trail", accent: null },
    });
  });
});

/**
 * Ticket 83 with ticket 73: a Member whose Project description could not be
 * read edits from empty rich text, which the stored row never equals, so a
 * guard on it would refuse every description save as stale. Such a save is
 * written unguarded; every other one is guarded as usual.
 */
describe("guardsDescription", () => {
  const readable = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
  };

  it("guards an edit made from a description the Member could read", () => {
    expect(guardsDescription(readable, "not a document")).toBe(true);
  });

  it("guards an edit made from empty rich text while the stored description is readable", () => {
    expect(guardsDescription(emptyContent, emptyContent)).toBe(true);
    expect(guardsDescription(emptyContent, readable)).toBe(true);
  });

  it("does not guard an edit made from empty rich text over a description that cannot be read", () => {
    expect(guardsDescription(emptyContent, "not a document")).toBe(false);
  });
});
