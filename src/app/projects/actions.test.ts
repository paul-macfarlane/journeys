import { beforeEach, describe, expect, it, vi } from "vitest";

import { failureResult } from "@/lib/action-result";
import type { Content } from "@/lib/graph/content";
import { invalid, notFound } from "@/lib/write-result";

/**
 * Seam A for the Project actions: who may write (the membership seam,
 * ticket 82), what the data layer is asked, and what the dialog hears back,
 * with the session, the cache, and the database replaced by doubles. The
 * description's cleaning rule lives in the data layer since ticket 82 and
 * is proved there (`src/db/projects.test.ts`).
 */

const doubles = vi.hoisted(() => ({
  session: { user: { id: "author-1" } },
  access: { projectForMember: vi.fn() },
  projects: {
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    editProjectDescription: vi.fn(),
    renameProject: vi.fn(),
    setProjectTheme: vi.fn(),
  },
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
}));
vi.mock("@/db/access", () => doubles.access);
vi.mock("@/db/projects", () => doubles.projects);
vi.mock("@/db/members", () => ({
  addMemberByEmail: vi.fn(),
  removeMember: vi.fn(),
}));

import {
  editProjectDescriptionAction,
  renameProjectAction,
  setProjectThemeAction,
} from "./actions";

const summary = {
  id: "project-1",
  title: "Refugee Health",
  description: { type: "doc", content: [] } satisfies Content,
  theme: { preset: "trail", accent: null },
};

/** The Project as the membership seam resolves it for the signed-in Author. */
const memberProject = { ...summary, memberUserId: "author-1" };

const NO_PROJECT = failureResult(notFound(), { missing: "project" });

beforeEach(() => {
  doubles.access.projectForMember.mockResolvedValue(memberProject);
});

describe("setProjectThemeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.access.projectForMember.mockResolvedValue(memberProject);
    doubles.projects.setProjectTheme.mockResolvedValue({
      ok: true,
      project: summary,
    });
  });

  it("stores the preset and accent for the signed-in Author and refreshes the Project page", async () => {
    const result = await setProjectThemeAction(
      "project-1",
      { preset: "tide", accent: "#095B41" },
      { preset: "trail", accent: null },
    );

    expect(result).toEqual({ ok: true, id: "project-1" });
    // The accent is stored lowercased, as the schema normalizes it; the
    // Theme it replaces goes along as the guard.
    expect(doubles.access.projectForMember).toHaveBeenCalledWith(
      "project-1",
      "author-1",
    );
    expect(doubles.projects.setProjectTheme).toHaveBeenCalledWith(
      memberProject,
      { preset: "tide", accent: "#095b41" },
      { preset: "trail", accent: null },
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/projects/[projectId]",
      "page",
    );
  });

  it("stores a preset with no accent", async () => {
    await setProjectThemeAction(
      "project-1",
      { preset: "dusk", accent: null },
      { preset: "trail", accent: null },
    );

    expect(doubles.projects.setProjectTheme).toHaveBeenCalledWith(
      memberProject,
      { preset: "dusk", accent: null },
      { preset: "trail", accent: null },
    );
  });

  it("refuses a preset that is not one of the six, and a malformed accent, without touching the database", async () => {
    const baseline = { preset: "trail", accent: null };
    expect(
      await setProjectThemeAction(
        "project-1",
        { preset: "neon", accent: null },
        baseline,
      ),
    ).toEqual({ ok: false, error: "Choose one of the themes" });
    expect(
      await setProjectThemeAction(
        "project-1",
        { preset: "tide", accent: "teal" },
        baseline,
      ),
    ).toEqual({ ok: false, error: "Use a color like #095b41" });
    // The baseline is parsed by the same schema as the value.
    expect(
      await setProjectThemeAction(
        "project-1",
        { preset: "tide", accent: null },
        { preset: "neon", accent: null },
      ),
    ).toEqual({ ok: false, error: "Choose one of the themes" });
    expect(doubles.projects.setProjectTheme).not.toHaveBeenCalled();
  });

  it("answers a non-Member like a Project that is not there, and writes nothing", async () => {
    doubles.access.projectForMember.mockResolvedValue(null);

    const result = await setProjectThemeAction(
      "project-1",
      { preset: "tide", accent: null },
      { preset: "trail", accent: null },
    );

    expect(result).toEqual(NO_PROJECT);
    expect(doubles.projects.setProjectTheme).not.toHaveBeenCalled();
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a Project deleted since it was resolved like one that is not there", async () => {
    doubles.projects.setProjectTheme.mockResolvedValue(notFound());

    const result = await setProjectThemeAction(
      "project-1",
      { preset: "tide", accent: null },
      { preset: "trail", accent: null },
    );

    expect(result).toEqual(NO_PROJECT);
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a Theme another Member changed first as stale, and refreshes nothing", async () => {
    doubles.projects.setProjectTheme.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await setProjectThemeAction(
      "project-1",
      { preset: "tide", accent: null },
      { preset: "trail", accent: null },
    );

    expect(result).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this project since you opened it. Reload to see their changes.",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("editProjectDescriptionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.projects.editProjectDescription.mockResolvedValue({
      ok: true,
      project: summary,
    });
  });

  it("stores the description for the signed-in Author and refreshes the Project page", async () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Welcome" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Three journeys." }],
        },
      ],
    };

    const result = await editProjectDescriptionAction("project-1", content, {
      type: "doc",
      content: [],
    });

    expect(result).toEqual({ ok: true, id: "project-1" });
    expect(doubles.projects.editProjectDescription).toHaveBeenCalledWith(
      memberProject,
      content,
      { type: "doc", content: [] },
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/projects/[projectId]",
      "page",
    );
  });

  it("passes on the data layer's refusal of input that is not a document", async () => {
    doubles.projects.editProjectDescription.mockResolvedValue(
      invalid("Content must be a document with a list of blocks"),
    );

    const result = await editProjectDescriptionAction(
      "project-1",
      "<b>hi</b>",
      { type: "doc", content: [] },
    );

    expect(result).toEqual({
      ok: false,
      error: "Content must be a document with a list of blocks",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a non-Member the way the page's 404 does", async () => {
    doubles.access.projectForMember.mockResolvedValue(null);

    const result = await editProjectDescriptionAction(
      "project-1",
      { type: "doc", content: [] },
      { type: "doc", content: [] },
    );

    expect(result).toEqual(NO_PROJECT);
    expect(doubles.projects.editProjectDescription).not.toHaveBeenCalled();
  });

  it("answers a description another Member changed first as stale", async () => {
    doubles.projects.editProjectDescription.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await editProjectDescriptionAction(
      "project-1",
      { type: "doc", content: [] },
      { type: "doc", content: [] },
    );

    expect(result).toMatchObject({ ok: false, stale: true });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("renameProjectAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames the Project and refreshes both Project pages", async () => {
    doubles.projects.renameProject.mockResolvedValue({
      ok: true,
      project: summary,
    });

    const result = await renameProjectAction(
      "project-1",
      { title: "  Refugee Health  " },
      { title: "Refugee  " },
    );

    expect(result).toEqual({ ok: true, id: "project-1" });
    // Both the title and the baseline are what the schema stores: trimmed.
    expect(doubles.projects.renameProject).toHaveBeenCalledWith(
      memberProject,
      { title: "Refugee Health" },
      { title: "Refugee" },
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/projects");
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/projects/[projectId]",
      "page",
    );
  });

  it("returns the first validation issue for a blank title", async () => {
    const result = await renameProjectAction(
      "project-1",
      { title: " " },
      { title: "Refugee" },
    );

    expect(result).toEqual({ ok: false, error: "Enter a title" });
    expect(doubles.projects.renameProject).not.toHaveBeenCalled();
  });

  it("refuses a missing baseline without touching the database", async () => {
    const result = await renameProjectAction(
      "project-1",
      { title: "Refugee Health" },
      undefined,
    );

    expect(result).toMatchObject({ ok: false });
    expect(doubles.projects.renameProject).not.toHaveBeenCalled();
  });

  it("answers a title another Member changed first as stale, naming the project", async () => {
    doubles.projects.renameProject.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await renameProjectAction(
      "project-1",
      { title: "Refugee Health" },
      { title: "Refugee" },
    );

    expect(result).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this project since you opened it. Reload to see their changes.",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});
