import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GraphDocument, Step } from "@/lib/graph/document";
import { PARTICIPANT_COOKIE } from "@/lib/run-cookies";

/**
 * Seam A for ticket 27's "begin and choose" action. The reducer it calls is
 * tested on its own in `src/lib/graph/begin.test.ts`; what is proved here is
 * the shell around it — which row is written, which cookie is set, and where
 * the Participant is sent — with the request context and the database
 * replaced by doubles. `redirect()` throws in Next.js, and the double does
 * the same, so nothing after a redirect is ever reached.
 */

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect to ${to}`);
  }
}

const doubles = vi.hoisted(() => ({
  cookieStore: {
    get: vi.fn<(name: string) => { value: string } | undefined>(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  runs: {
    getPublicJourney: vi.fn(),
    createRun: vi.fn(),
    saveRunState: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => doubles.cookieStore),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new RedirectSignal(to);
  }),
}));

vi.mock("@/db/runs", () => doubles.runs);

import { chooseFromStartAction, startOverAction } from "./actions";

const JOURNEY_ID = "journey-1";
const RUN_COOKIE = `journeys.run.${JOURNEY_ID}`;
const NOW = new Date("2026-09-22T10:00:00Z");

const emptyContent = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

function step(overrides: Partial<Step> & Pick<Step, "id">): Step {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    content: emptyContent,
    choices: overrides.choices ?? [],
    prompt: overrides.prompt ?? null,
    outcomeId: overrides.outcomeId ?? null,
    position: overrides.position ?? null,
  };
}

/** start --"Wait"--> queue --"Papers"--> done (Ending); start --"Leave"--> done */
function liveDocument(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: {
      start: step({
        id: "start",
        choices: [
          {
            id: "wait",
            label: "Wait",
            targetStepId: "queue",
            condition: null,
            effect: null,
          },
          {
            id: "leave",
            label: "Leave",
            targetStepId: "done",
            condition: null,
            effect: null,
          },
        ],
      }),
      queue: step({
        id: "queue",
        choices: [
          {
            id: "papers",
            label: "Papers",
            targetStepId: "done",
            condition: null,
            effect: null,
          },
        ],
      }),
      done: step({ id: "done", outcomeId: "reached-care" }),
    },
    outcomes: { "reached-care": { id: "reached-care", label: "Reached care" } },
    layoutDirection: "TB",
  };
}

function liveJourney() {
  return {
    kind: "live" as const,
    versionId: "version-1",
    title: "Border Crossing",
    description: "",
    document: liveDocument(),
  };
}

function cookiesPresent(present: Record<string, string>) {
  doubles.cookieStore.get.mockImplementation((name: string) =>
    Object.hasOwn(present, name) ? { value: present[name] } : undefined,
  );
}

function formChoosing(targetStepId: string): FormData {
  const formData = new FormData();
  formData.set("to", targetStepId);
  return formData;
}

async function redirectOf(action: Promise<void>): Promise<string> {
  try {
    await action;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.to;
    throw error;
  }
  throw new Error("expected the action to redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  doubles.runs.getPublicJourney.mockResolvedValue(liveJourney());
  doubles.runs.createRun.mockResolvedValue({ id: "run-new" });
  cookiesPresent({});
});

describe("chooseFromStartAction", () => {
  it("creates one Run holding the Start and the chosen Step, and lands on that Step", async () => {
    cookiesPresent({ [PARTICIPANT_COOKIE]: "participant-1" });

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("queue")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue`);
    expect(doubles.runs.createRun).toHaveBeenCalledTimes(1);
    expect(doubles.runs.createRun).toHaveBeenCalledWith({
      versionId: "version-1",
      participantId: "participant-1",
      state: {
        path: ["start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
    });
    expect(doubles.cookieStore.set).toHaveBeenCalledTimes(1);
    expect(doubles.cookieStore.set).toHaveBeenCalledWith(
      RUN_COOKIE,
      "run-new",
      expect.objectContaining({ path: `/j/${JOURNEY_ID}`, httpOnly: true }),
    );
  });

  it("starts a fresh Run while another is in progress, and leaves the old one as it was", async () => {
    cookiesPresent({
      [PARTICIPANT_COOKIE]: "participant-1",
      [RUN_COOKIE]: "run-old",
    });

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("done")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/done`);
    // A new row, ended at once because the Choice led to an Ending…
    expect(doubles.runs.createRun).toHaveBeenCalledTimes(1);
    expect(doubles.runs.createRun.mock.calls[0][0].state).toEqual({
      path: ["start", "done"],
      backtrackCount: 0,
      endedAt: NOW,
      outcomeId: "reached-care",
    });
    // …the old Run neither read nor written, abandoned exactly where it was…
    expect(doubles.runs.saveRunState).not.toHaveBeenCalled();
    // …and the cookie now names the new one.
    expect(doubles.cookieStore.set).toHaveBeenCalledWith(
      RUN_COOKIE,
      "run-new",
      expect.anything(),
    );
  });

  it("mints the participant cookie on a browser's first Run and keeps it afterwards", async () => {
    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("queue")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue`);
    const participantSet = doubles.cookieStore.set.mock.calls.find(
      ([name]) => name === PARTICIPANT_COOKIE,
    );
    expect(participantSet).toBeDefined();
    const [, participantId, options] = participantSet!;
    expect(participantId).toMatch(/^[0-9a-f-]{36}$/);
    expect(options).toEqual(expect.objectContaining({ path: "/j" }));
    expect(doubles.runs.createRun.mock.calls[0][0].participantId).toBe(
      participantId,
    );
  });

  it("refuses a Choice the Start Step does not offer and records nothing", async () => {
    cookiesPresent({ [PARTICIPANT_COOKIE]: "participant-1" });

    // A real Step, reachable only through the queue.
    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("done-by-another-route")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}`);
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
    expect(doubles.cookieStore.set).not.toHaveBeenCalled();
  });

  it("refuses a form with no Choice in it", async () => {
    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, new FormData()),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}`);
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
    expect(doubles.cookieStore.set).not.toHaveBeenCalled();
  });

  it("sends a Journey that is not live back to its start screen", async () => {
    doubles.runs.getPublicJourney.mockResolvedValue({ kind: "unavailable" });

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("queue")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}`);
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
    expect(doubles.cookieStore.set).not.toHaveBeenCalled();
  });
});

describe("startOverAction", () => {
  it("drops the Run cookie, touches no Run, and shows the Start Step fresh", async () => {
    cookiesPresent({
      [PARTICIPANT_COOKIE]: "participant-1",
      [RUN_COOKIE]: "run-old",
    });

    const to = await redirectOf(startOverAction(JOURNEY_ID));

    expect(to).toBe(`/j/${JOURNEY_ID}`);
    expect(doubles.cookieStore.delete).toHaveBeenCalledWith({
      name: RUN_COOKIE,
      path: `/j/${JOURNEY_ID}`,
    });
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
    expect(doubles.runs.saveRunState).not.toHaveBeenCalled();
  });
});
