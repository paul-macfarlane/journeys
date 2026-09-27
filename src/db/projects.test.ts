import { describe, expect, it, vi } from "vitest";

import type { MemberProject } from "@/db/access";

/**
 * The database, at its boundary: an UPDATE records what it was asked to
 * set and answers one row, as Postgres does when the guard holds.
 */
const database = vi.hoisted(() => ({
  set: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        database.set(values);
        return {
          where: () => ({
            returning: async () => [
              {
                id: "project-1",
                title: "Refugee Health",
                descriptionContent: values.descriptionContent,
                themePreset: "trail",
                themeAccent: null,
              },
            ],
          }),
        };
      },
    }),
  },
}));

import { emptyContent } from "@/lib/graph/content";

import {
  editProjectDescription,
  guardsDescription,
  toProjectSummary,
} from "./projects";

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

/**
 * Ticket 82: `editProjectDescription` is the one path a Project description
 * reaches storage by, so it — not the action in front of it — puts every
 * write through the shared allowed set, as `saveDraft` does a Draft's.
 */
describe("editProjectDescription", () => {
  const project = {
    id: "project-1",
    title: "Refugee Health",
    description: emptyContent,
    theme: { preset: "trail", accent: null },
    memberUserId: "author-1",
  } as unknown as MemberProject;
  // A baseline the Member could read, so the write is guarded as usual.
  const baseline = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
  };

  it("cleans the content with the shared allowed set before storing it", async () => {
    database.set.mockClear();

    const result = await editProjectDescription(
      project,
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
              { type: "text", text: " here", marks: [{ type: "code" }] },
            ],
          },
          { type: "codeBlock", content: [{ type: "text", text: "rm -rf /" }] },
          {
            type: "image",
            attrs: { src: "data:image/png;base64,AAAA", alt: "x" },
          },
        ],
      },
      baseline,
    );

    const cleaned = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Click" },
            { type: "text", text: " here" },
          ],
        },
      ],
    };
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({ descriptionContent: cleaned }),
    );
    expect(result).toMatchObject({
      ok: true,
      project: { id: "project-1", description: cleaned },
    });
  });

  it("refuses input that is not a document without touching the database", async () => {
    database.set.mockClear();

    const result = await editProjectDescription(project, "<b>hi</b>", baseline);

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      error: "Content must be a document with a list of blocks",
    });
    expect(database.set).not.toHaveBeenCalled();
  });

  it("refuses a baseline that is not a document without touching the database", async () => {
    database.set.mockClear();

    const result = await editProjectDescription(project, baseline, 42);

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(database.set).not.toHaveBeenCalled();
  });
});
