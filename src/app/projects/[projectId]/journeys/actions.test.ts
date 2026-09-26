import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Seam A for ticket 28's "Move up" / "Move down" action. The order rule is
 * tested on its own in `src/lib/journey-order.test.ts`; what is proved here
 * is the shell around it — who may move a Journey, what the data layer is
 * asked, and what the row's buttons hear back — with the session, the cache,
 * and the database replaced by doubles.
 */

const doubles = vi.hoisted(() => ({
  session: { user: { id: "author-1" } },
  journeys: {
    createJourney: vi.fn(),
    deleteJourney: vi.fn(),
    moveJourney: vi.fn(),
    setJourneyTheme: vi.fn(),
    updateJourney: vi.fn(),
  },
  revalidatePath: vi.fn(),
  drafts: { saveDraft: vi.fn() },
  versions: {
    publishDraft: vi.fn(),
    restoreVersion: vi.fn(),
    unpublishJourney: vi.fn(),
  },
  // Mutable, so a test can take the key away; never a real credential.
  env: { AI_GATEWAY_API_KEY: "test-key" as string | undefined },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
}));
vi.mock("@/db/journeys", () => doubles.journeys);
vi.mock("@/db/drafts", () => doubles.drafts);
vi.mock("@/db/projects", () => ({ getProjectForMember: vi.fn() }));
vi.mock("@/db/versions", () => doubles.versions);
vi.mock("@/lib/env", () => ({ env: doubles.env }));

import type { GraphDocument } from "@/lib/graph/document";

import {
  moveJourneyAction,
  publishJourneyAction,
  restoreVersionAction,
  saveDraftAction,
  setJourneyThemeAction,
  updateJourneyAction,
} from "./actions";

const STALE_DRAFT =
  "Someone else changed this draft since you opened it. Reload to see their changes.";

describe("setJourneyThemeAction", () => {
  const summary = {
    id: "journey-1",
    title: "Border Crossing",
    description: "",
    publishState: "never-published",
    theme: { preset: "dusk", accent: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    doubles.journeys.setJourneyTheme.mockResolvedValue(summary);
  });

  it("stores the override for the signed-in Author and refreshes the Journey page", async () => {
    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: "#FFD400" },
      { preset: null, accent: null },
    );

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.journeys.setJourneyTheme).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: "#ffd400" },
      { preset: null, accent: null },
      "author-1",
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/projects/[projectId]/journeys/[journeyId]",
      "page",
    );
  });

  it("clears the override, and any accent with it, when the preset is null", async () => {
    await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: null, accent: "#ffd400" },
      { preset: "dusk", accent: "#ffd400" },
    );

    expect(doubles.journeys.setJourneyTheme).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      { preset: null, accent: null },
      { preset: "dusk", accent: "#ffd400" },
      "author-1",
    );
  });

  it("refuses a preset that is not one of the six without touching the database", async () => {
    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "neon", accent: null },
      { preset: null, accent: null },
    );

    expect(result).toEqual({ ok: false, error: "Choose one of the themes" });
    expect(doubles.journeys.setJourneyTheme).not.toHaveBeenCalled();
  });

  it("answers a non-Member like a Journey that is not there", async () => {
    doubles.journeys.setJourneyTheme.mockResolvedValue(null);

    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: null },
      { preset: null, accent: null },
    );

    expect(result).toEqual({
      ok: false,
      error: "That journey no longer exists",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a Theme another Member changed first as stale, naming the journey", async () => {
    doubles.journeys.setJourneyTheme.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: null },
      { preset: null, accent: null },
    );

    expect(result).toEqual({
      ok: false,
      stale: true,
      error:
        "Someone else changed this journey since you opened it. Reload to see their changes.",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateJourneyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the title and description with the baseline they were edited from, both trimmed", async () => {
    doubles.journeys.updateJourney.mockResolvedValue({ id: "journey-1" });

    const result = await updateJourneyAction(
      "project-1",
      "journey-1",
      { title: " Night crossing ", description: "" },
      { title: "Border ", description: "" },
    );

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.journeys.updateJourney).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      { title: "Night crossing", description: "" },
      { title: "Border", description: "" },
      "author-1",
    );
  });

  it("answers a title another Member changed first as stale", async () => {
    doubles.journeys.updateJourney.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await updateJourneyAction(
      "project-1",
      "journey-1",
      { title: "Night crossing", description: "" },
      { title: "Border", description: "" },
    );

    expect(result).toMatchObject({ ok: false, stale: true });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the document against the version the editor holds, and hands back the new one", async () => {
    const document = { schemaVersion: 1 };
    doubles.drafts.saveDraft.mockResolvedValue({
      ok: true,
      document,
      version: 5,
    });

    const result = await saveDraftAction("project-1", "journey-1", document, 4);

    expect(result).toEqual({ ok: true, id: "journey-1", version: 5 });
    expect(doubles.drafts.saveDraft).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      document,
      4,
      "author-1",
    );
  });

  it("answers another Member's save since as stale, and refreshes nothing", async () => {
    doubles.drafts.saveDraft.mockResolvedValue({ ok: false, reason: "stale" });

    const result = await saveDraftAction("project-1", "journey-1", {}, 4);

    expect(result).toEqual({ ok: false, stale: true, error: STALE_DRAFT });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a version that is not a count without touching the database", async () => {
    const result = await saveDraftAction("project-1", "journey-1", {}, "4");

    expect(result).toMatchObject({ ok: false });
    expect(doubles.drafts.saveDraft).not.toHaveBeenCalled();
  });
});

describe("restoreVersionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores against the Draft version the page read", async () => {
    doubles.versions.restoreVersion.mockResolvedValue({ versionNumber: 1 });

    const result = await restoreVersionAction(
      "project-1",
      "journey-1",
      "version-1",
      3,
    );

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.versions.restoreVersion).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      "version-1",
      3,
      "author-1",
    );
  });

  it("answers a Draft another Member saved since as stale", async () => {
    doubles.versions.restoreVersion.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await restoreVersionAction(
      "project-1",
      "journey-1",
      "version-1",
      3,
    );

    expect(result).toEqual({ ok: false, stale: true, error: STALE_DRAFT });
  });
});

describe("moveJourneyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves the Journey for the signed-in Author and refreshes the Project page", async () => {
    doubles.journeys.moveJourney.mockResolvedValue(true);

    const result = await moveJourneyAction("project-1", "journey-1", "up");

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.journeys.moveJourney).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      "up",
      "author-1",
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/projects/[projectId]",
      "page",
    );
  });

  it("answers a non-Member like a Journey that is not there", async () => {
    doubles.journeys.moveJourney.mockResolvedValue(false);

    const result = await moveJourneyAction("project-1", "journey-1", "down");

    expect(result).toEqual({
      ok: false,
      error: "That journey no longer exists",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a direction that is neither up nor down without touching the database", async () => {
    const result = await moveJourneyAction("project-1", "journey-1", "left");

    expect(result).toEqual({ ok: false, error: "Choose up or down" });
    expect(doubles.journeys.moveJourney).not.toHaveBeenCalled();
  });
});

describe("publishJourneyAction", () => {
  const content = {
    type: "doc" as const,
    content: [{ type: "paragraph" as const }],
  };

  /** One Step with two Choices to Endings, its Prompt deciding or not. */
  function documentWhosePromptDecides(decides: boolean): GraphDocument {
    const ending = (id: string) => ({
      id,
      title: id,
      content,
      choices: [],
      prompt: null,
      outcomeId: null,
      position: null,
    });
    return {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: {
        start: {
          id: "start",
          title: "Border post",
          content,
          choices: ["a", "b"].map((id) => ({
            id,
            label: id,
            targetStepId: id,
            condition: null,
            effect: null,
          })),
          prompt: {
            type: "free_text",
            label: "What do you do?",
            required: true,
            decides,
          },
          outcomeId: null,
          position: null,
        },
        a: ending("a"),
        b: ending("b"),
      },
      outcomes: {},
      layoutDirection: "TB",
    };
  }

  const WARNING =
    "This journey has a prompt that decides the next step, but no AI Gateway key is set. Participants will choose for themselves.";

  beforeEach(() => {
    vi.clearAllMocks();
    doubles.env.AI_GATEWAY_API_KEY = "test-key";
  });

  it("publishes a deciding Prompt with no key, and warns that Participants will choose for themselves", async () => {
    doubles.env.AI_GATEWAY_API_KEY = undefined;
    doubles.versions.publishDraft.mockResolvedValue({
      ok: true,
      versionNumber: 3,
      document: documentWhosePromptDecides(true),
    });

    const result = await publishJourneyAction("project-1", "journey-1", 0);

    expect(result).toEqual({ ok: true, versionNumber: 3, warning: WARNING });
  });

  it("does not warn when the key is set", async () => {
    doubles.versions.publishDraft.mockResolvedValue({
      ok: true,
      versionNumber: 3,
      document: documentWhosePromptDecides(true),
    });

    const result = await publishJourneyAction("project-1", "journey-1", 0);

    expect(result).toEqual({ ok: true, versionNumber: 3 });
  });

  it("does not warn when no Prompt decides", async () => {
    doubles.env.AI_GATEWAY_API_KEY = undefined;
    doubles.versions.publishDraft.mockResolvedValue({
      ok: true,
      versionNumber: 1,
      document: documentWhosePromptDecides(false),
    });

    const result = await publishJourneyAction("project-1", "journey-1", 0);

    expect(result).toEqual({ ok: true, versionNumber: 1 });
  });

  it("publishes the Draft at the version the Member holds, and answers a newer one as stale", async () => {
    doubles.versions.publishDraft.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await publishJourneyAction("project-1", "journey-1", 2);

    expect(doubles.versions.publishDraft).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      2,
      "author-1",
    );
    expect(result).toEqual({ ok: false, stale: true, error: STALE_DRAFT });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a Draft whose row cannot be read", async () => {
    doubles.versions.publishDraft.mockResolvedValue({
      ok: false,
      unreadable: true,
    });

    const result = await publishJourneyAction("project-1", "journey-1", 2);

    expect(result).toEqual({
      ok: false,
      error:
        "This journey's draft can't be read. Restore it from a published version before publishing.",
    });
  });
});
