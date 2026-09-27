import { beforeEach, describe, expect, it, vi } from "vitest";

import { conflict, invalid, notFound } from "@/lib/write-result";

/**
 * Seam A for ticket 28's "Move up" / "Move down" action. The order rule is
 * tested on its own in `src/lib/journey-order.test.ts`; what is proved here
 * is the shell around it — who may move a Journey (the membership seam,
 * ticket 82), what the data layer is asked, and what the row's buttons hear
 * back — with the session, the cache, and the database replaced by doubles.
 */

const doubles = vi.hoisted(() => ({
  session: { user: { id: "author-1" } },
  access: { journeyForMember: vi.fn(), projectForMember: vi.fn() },
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
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
}));
vi.mock("@/db/access", () => doubles.access);
vi.mock("@/db/journeys", () => doubles.journeys);
vi.mock("@/db/drafts", () => doubles.drafts);
vi.mock("@/db/versions", () => doubles.versions);

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

/** The Journey as the membership seam resolves it for the signed-in Author. */
const memberJourney = {
  id: "journey-1",
  projectId: "project-1",
  memberUserId: "author-1",
  title: "Border Crossing",
};

const NO_JOURNEY = { ok: false, error: "That journey no longer exists" };

beforeEach(() => {
  doubles.access.journeyForMember.mockResolvedValue(memberJourney);
});

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
    doubles.journeys.setJourneyTheme.mockResolvedValue({
      ok: true,
      journey: summary,
    });
  });

  it("stores the override for the signed-in Author and refreshes the Journey page", async () => {
    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: "#FFD400" },
      { preset: null, accent: null },
    );

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.access.journeyForMember).toHaveBeenCalledWith(
      "project-1",
      "journey-1",
      "author-1",
    );
    expect(doubles.journeys.setJourneyTheme).toHaveBeenCalledWith(
      memberJourney,
      { preset: "dusk", accent: "#ffd400" },
      { preset: null, accent: null },
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
      memberJourney,
      { preset: null, accent: null },
      { preset: "dusk", accent: "#ffd400" },
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

  it("answers a non-Member like a Journey that is not there, and writes nothing", async () => {
    doubles.access.journeyForMember.mockResolvedValue(null);

    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: null },
      { preset: null, accent: null },
    );

    expect(result).toEqual(NO_JOURNEY);
    expect(doubles.journeys.setJourneyTheme).not.toHaveBeenCalled();
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a Journey deleted since it was resolved like one that is not there", async () => {
    doubles.journeys.setJourneyTheme.mockResolvedValue(notFound());

    const result = await setJourneyThemeAction(
      "project-1",
      "journey-1",
      { preset: "dusk", accent: null },
      { preset: null, accent: null },
    );

    expect(result).toEqual(NO_JOURNEY);
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
    doubles.journeys.updateJourney.mockResolvedValue({
      ok: true,
      journey: { id: "journey-1" },
    });

    const result = await updateJourneyAction(
      "project-1",
      "journey-1",
      { title: " Night crossing ", description: "" },
      { title: "Border ", description: "" },
    );

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.journeys.updateJourney).toHaveBeenCalledWith(
      memberJourney,
      { title: "Night crossing", description: "" },
      { title: "Border", description: "" },
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
      memberJourney,
      document,
      4,
    );
  });

  it("hands back the Step whose rich text the data layer refused", async () => {
    doubles.drafts.saveDraft.mockResolvedValue(
      invalid("Links must start with http:// or https://", { stepId: "s1" }),
    );

    const result = await saveDraftAction("project-1", "journey-1", {}, 4);

    expect(result).toEqual({
      ok: false,
      error: "Links must start with http:// or https://",
      stepId: "s1",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a non-Member like a Journey that is not there", async () => {
    doubles.access.journeyForMember.mockResolvedValue(null);

    const result = await saveDraftAction("project-1", "journey-1", {}, 4);

    expect(result).toEqual(NO_JOURNEY);
    expect(doubles.drafts.saveDraft).not.toHaveBeenCalled();
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
    doubles.versions.restoreVersion.mockResolvedValue({
      ok: true,
      versionNumber: 1,
    });

    const result = await restoreVersionAction(
      "project-1",
      "journey-1",
      "version-1",
      3,
    );

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.versions.restoreVersion).toHaveBeenCalledWith(
      memberJourney,
      "version-1",
      3,
    );
  });

  it("answers a version that is not this Journey's, and a non-Member, as a version that is not there", async () => {
    const noVersion = { ok: false, error: "That version no longer exists" };

    doubles.versions.restoreVersion.mockResolvedValue(notFound());
    expect(
      await restoreVersionAction("project-1", "journey-1", "version-9", 3),
    ).toEqual(noVersion);

    doubles.access.journeyForMember.mockResolvedValue(null);
    expect(
      await restoreVersionAction("project-1", "journey-1", "version-1", 3),
    ).toEqual(noVersion);
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
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

  it("refuses to restore a version that fails the document contract (ticket 83)", async () => {
    doubles.versions.restoreVersion.mockResolvedValue(
      invalid("Version 1 can't be read, so it can't be restored."),
    );

    const result = await restoreVersionAction(
      "project-1",
      "journey-1",
      "version-1",
      3,
    );

    expect(result).toEqual({
      ok: false,
      error: "Version 1 can't be read, so it can't be restored.",
    });
  });
});

describe("moveJourneyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves the Journey for the signed-in Author and refreshes the Project page", async () => {
    doubles.journeys.moveJourney.mockResolvedValue({ ok: true });

    const result = await moveJourneyAction("project-1", "journey-1", "up");

    expect(result).toEqual({ ok: true, id: "journey-1" });
    expect(doubles.journeys.moveJourney).toHaveBeenCalledWith(
      memberJourney,
      "up",
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/projects/[projectId]",
      "page",
    );
  });

  it("answers a non-Member like a Journey that is not there", async () => {
    doubles.access.journeyForMember.mockResolvedValue(null);

    const result = await moveJourneyAction("project-1", "journey-1", "down");

    expect(result).toEqual(NO_JOURNEY);
    expect(doubles.journeys.moveJourney).not.toHaveBeenCalled();
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a direction that is neither up nor down without touching the database", async () => {
    const result = await moveJourneyAction("project-1", "journey-1", "left");

    expect(result).toEqual({ ok: false, error: "Choose up or down" });
    expect(doubles.journeys.moveJourney).not.toHaveBeenCalled();
  });
});

describe("publishJourneyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes the Draft and reports the new version", async () => {
    doubles.versions.publishDraft.mockResolvedValue({
      ok: true,
      versionNumber: 3,
    });

    const result = await publishJourneyAction("project-1", "journey-1", 0);

    expect(result).toEqual({ ok: true, versionNumber: 3 });
  });

  it("publishes the Draft at the version the Member holds, and answers a newer one as stale", async () => {
    doubles.versions.publishDraft.mockResolvedValue({
      ok: false,
      reason: "stale",
    });

    const result = await publishJourneyAction("project-1", "journey-1", 2);

    expect(doubles.versions.publishDraft).toHaveBeenCalledWith(
      memberJourney,
      2,
    );
    expect(result).toEqual({ ok: false, stale: true, error: STALE_DRAFT });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a Draft whose row cannot be read", async () => {
    doubles.versions.publishDraft.mockResolvedValue(
      invalid(
        "This journey's draft can't be read. Restore it from a published version before publishing.",
      ),
    );

    const result = await publishJourneyAction("project-1", "journey-1", 2);

    expect(result).toEqual({
      ok: false,
      error:
        "This journey's draft can't be read. Restore it from a published version before publishing.",
    });
  });

  it("refuses a Draft with publish-time problems, handing back every one", async () => {
    const problems = [
      { code: "missing-start" as const, message: "The draft has no start" },
    ];
    doubles.versions.publishDraft.mockResolvedValue(
      invalid("This journey can't be published yet", { problems }),
    );

    const result = await publishJourneyAction("project-1", "journey-1", 2);

    expect(result).toEqual({
      ok: false,
      error: "This journey can't be published yet",
      problems,
    });
  });

  it("tells the loser of a publish race to reload", async () => {
    doubles.versions.publishDraft.mockResolvedValue(conflict());

    const result = await publishJourneyAction("project-1", "journey-1", 2);

    expect(result).toEqual({
      ok: false,
      error:
        "Another member published this journey just now. Reload to see their version, then publish again.",
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});
