import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { emptyContent } from "@/lib/graph/content";

import { toPublicAuthorProject } from "./users";

/**
 * Ticket 83: a Project row an Author's public page lists whose description
 * fails `contentSchema` reads back as empty rich text, never a throw — an
 * anonymous reader still sees the Project's title and link.
 */
describe("toPublicAuthorProject", () => {
  const row = {
    id: "project-1",
    title: "Refugee Health",
    descriptionContent: { type: "doc", content: [] },
  };

  it("reads a row whose description satisfies the contract as itself", () => {
    expect(toPublicAuthorProject(row)).toEqual({
      id: "project-1",
      title: "Refugee Health",
      description: { type: "doc", content: [] },
    });
  });

  it("reads a row whose description fails the contract as empty rich text", () => {
    expect(
      toPublicAuthorProject({ ...row, descriptionContent: "not a document" }),
    ).toEqual({
      id: "project-1",
      title: "Refugee Health",
      description: emptyContent,
    });
  });
});
