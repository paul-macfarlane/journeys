import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { emptyContent } from "@/lib/graph/content";

import { toProjectSummary } from "./projects";

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
