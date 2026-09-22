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
    updateJourney: vi.fn(),
  },
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
}));
vi.mock("@/db/journeys", () => doubles.journeys);
vi.mock("@/db/drafts", () => ({ saveDraft: vi.fn() }));
vi.mock("@/db/projects", () => ({ getProjectForMember: vi.fn() }));
vi.mock("@/db/versions", () => ({
  publishDraft: vi.fn(),
  restoreVersion: vi.fn(),
  unpublishJourney: vi.fn(),
}));

import { moveJourneyAction } from "./actions";

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

    expect(result.ok).toBe(false);
    expect(doubles.journeys.moveJourney).not.toHaveBeenCalled();
  });
});
