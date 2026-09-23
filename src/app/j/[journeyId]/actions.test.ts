import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Judge } from "@/lib/ai/decide";
import type { GraphDocument, Prompt, Step } from "@/lib/graph/document";
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
    getRunForJourney: vi.fn(),
    createRun: vi.fn(),
    saveRunState: vi.fn(),
  },
  responses: {
    saveResponse: vi.fn(),
    deleteResponse: vi.fn(),
  },
  // Mutable, so a test can take the key away; never a real credential.
  env: { AI_GATEWAY_API_KEY: "test-key" as string | undefined },
  judge: vi.fn<Judge>(),
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
vi.mock("@/db/responses", () => doubles.responses);
vi.mock("@/lib/env", () => ({ env: doubles.env }));

// The gateway is a system boundary: only the judge that calls it is
// replaced, and `decideChoice` — what the action does with the answer —
// stays real.
vi.mock("@/lib/ai/decide", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/decide")>()),
  gatewayJudge: doubles.judge,
}));

import {
  chooseFromStartAction,
  respondAndChooseAction,
  startOverAction,
} from "./actions";

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
  doubles.env.AI_GATEWAY_API_KEY = "test-key";
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

    // An id the Start Step offers no Choice to.
    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("done-by-another-route")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}`);
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
    expect(doubles.cookieStore.set).not.toHaveBeenCalled();
  });

  it("begins nothing for a Choice back onto the Start, which is a stay", async () => {
    cookiesPresent({ [PARTICIPANT_COOKIE]: "participant-1" });
    const document = liveDocument();
    document.steps.start.choices.push({
      id: "stay",
      label: "Stay put",
      targetStepId: "start",
      condition: null,
      effect: null,
    });
    doubles.runs.getPublicJourney.mockResolvedValue({
      ...liveJourney(),
      document,
    });

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formChoosing("start")),
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

  it("sends a Journey that is not live back to its Start, which says why", async () => {
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

const DECIDING: Prompt = {
  type: "free_text",
  label: "What do you do?",
  required: true,
  decides: true,
};

/**
 * `liveDocument()` with a deciding Prompt on the Start and on the queue
 * Step, whose Choices lead to two different Endings.
 */
function decidingDocument(): GraphDocument {
  const document = liveDocument();
  document.steps.start.prompt = DECIDING;
  document.steps.queue.prompt = DECIDING;
  document.steps.queue.choices.push({
    id: "give-up",
    label: "Leave the queue",
    targetStepId: "turned",
    condition: null,
    effect: null,
  });
  document.steps.turned = step({ id: "turned", outcomeId: "turned-away" });
  document.outcomes["turned-away"] = {
    id: "turned-away",
    label: "Turned away",
  };
  return document;
}

let runSerial = 0;

/**
 * A Run standing on the queue Step of the deciding document. Each test gets
 * a Run id of its own: the action's rate limit lives for the module, and a
 * Run judged by one test must not be refused in the next.
 */
function runOnQueue(): string {
  runSerial += 1;
  const runId = `run-${runSerial}`;
  cookiesPresent({ [RUN_COOKIE]: runId });
  doubles.runs.getRunForJourney.mockResolvedValue({
    run: {
      id: runId,
      path: ["start", "queue"],
      backtrackCount: 0,
      endedAt: null,
      outcomeId: null,
    },
    version: {
      title: "Border Crossing",
      description: "",
      document: decidingDocument(),
    },
  });
  return runId;
}

function formResponding(text: string): FormData {
  const formData = new FormData();
  formData.set("response", text);
  return formData;
}

const RESPONSE = "I hand over the paper and smile.";

describe("respondAndChooseAction on a deciding Prompt", () => {
  it("advances the Run along a confident answer and records the Response, as a pressed Choice would", async () => {
    const runId = runOnQueue();
    doubles.judge.mockResolvedValue({ choiceId: "papers", probability: 0.9 });

    const to = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/done`);
    expect(doubles.responses.saveResponse).toHaveBeenCalledWith(
      runId,
      "queue",
      RESPONSE,
    );
    expect(doubles.runs.saveRunState).toHaveBeenCalledWith(runId, {
      path: ["start", "queue", "done"],
      backtrackCount: 0,
      endedAt: NOW,
      outcomeId: "reached-care",
    });
    // The judge saw this Step's Response, and nothing was judged twice.
    expect(doubles.judge).toHaveBeenCalledTimes(1);
    expect(doubles.judge.mock.calls[0][0].state.response).toBe(RESPONSE);
  });

  it("comes back with the judge's pick when its answer is weak, and moves nothing", async () => {
    const runId = runOnQueue();
    doubles.judge.mockResolvedValue({ choiceId: "give-up", probability: 0.3 });

    const to = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue?decide=give-up`);
    expect(doubles.responses.saveResponse).toHaveBeenCalledWith(
      runId,
      "queue",
      RESPONSE,
    );
    expect(doubles.runs.saveRunState).not.toHaveBeenCalled();
  });

  it("comes back with no pick when the judge fails", async () => {
    runOnQueue();
    doubles.judge.mockRejectedValue(new Error("gateway down"));

    const to = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue?decide=none`);
    expect(doubles.runs.saveRunState).not.toHaveBeenCalled();
  });

  it("comes back with no pick when the judge names a Choice the Step does not have", async () => {
    runOnQueue();
    doubles.judge.mockResolvedValue({ choiceId: "wait", probability: 0.99 });

    const to = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue?decide=none`);
    expect(doubles.runs.saveRunState).not.toHaveBeenCalled();
  });

  it("never calls the judge without a gateway key", async () => {
    const runId = runOnQueue();
    doubles.env.AI_GATEWAY_API_KEY = undefined;

    const to = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue?decide=none`);
    expect(doubles.judge).not.toHaveBeenCalled();
    // The Response is kept all the same.
    expect(doubles.responses.saveResponse).toHaveBeenCalledWith(
      runId,
      "queue",
      RESPONSE,
    );
  });

  it("judges a Run at most once a second, and falls back rather than failing", async () => {
    runOnQueue();
    doubles.judge.mockResolvedValue({ choiceId: "give-up", probability: 0.3 });

    await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );
    const second = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formResponding(RESPONSE)),
    );

    expect(second).toBe(`/j/${JOURNEY_ID}/queue?decide=none`);
    expect(doubles.judge).toHaveBeenCalledTimes(1);
  });

  it("follows a pressed Choice as before, without asking the judge", async () => {
    const runId = runOnQueue();
    const formData = formResponding(RESPONSE);
    formData.set("to", "turned");

    const to = await redirectOf(
      respondAndChooseAction(JOURNEY_ID, "queue", formData),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/turned`);
    expect(doubles.judge).not.toHaveBeenCalled();
    expect(doubles.runs.saveRunState).toHaveBeenCalledWith(runId, {
      path: ["start", "queue", "turned"],
      backtrackCount: 0,
      endedAt: NOW,
      outcomeId: "turned-away",
    });
  });
});

describe("chooseFromStartAction on a deciding Prompt", () => {
  let participantSerial = 0;

  /** A Participant of their own per test, for the same reason as `runOnQueue`. */
  function freshParticipant(): string {
    participantSerial += 1;
    const participantId = `participant-deciding-${participantSerial}`;
    cookiesPresent({ [PARTICIPANT_COOKIE]: participantId });
    doubles.runs.getPublicJourney.mockResolvedValue({
      ...liveJourney(),
      document: decidingDocument(),
    });
    return participantId;
  }

  it("creates the Run along a confident answer, holding the Response", async () => {
    const participantId = freshParticipant();
    doubles.judge.mockResolvedValue({ choiceId: "wait", probability: 0.8 });

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}/queue`);
    expect(doubles.runs.createRun).toHaveBeenCalledWith({
      versionId: "version-1",
      participantId,
      state: {
        path: ["start", "queue"],
        backtrackCount: 0,
        endedAt: null,
        outcomeId: null,
      },
      response: { stepId: "start", text: RESPONSE },
    });
  });

  it("comes back to the Start with the pick and the Response when the answer is weak, and creates no Run", async () => {
    freshParticipant();
    doubles.judge.mockResolvedValue({ choiceId: "leave", probability: 0.2 });

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );

    expect(to).toBe(
      `/j/${JOURNEY_ID}?decide=leave&response=I%20hand%20over%20the%20paper%20and%20smile.`,
    );
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
  });

  it("comes back with no pick and the Response when there is no key", async () => {
    freshParticipant();
    doubles.env.AI_GATEWAY_API_KEY = undefined;

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );

    expect(to).toBe(
      `/j/${JOURNEY_ID}?decide=none&response=I%20hand%20over%20the%20paper%20and%20smile.`,
    );
    expect(doubles.judge).not.toHaveBeenCalled();
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
  });

  it("refuses a blank Response before asking the judge", async () => {
    freshParticipant();

    const to = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding("   ")),
    );

    expect(to).toBe(`/j/${JOURNEY_ID}?notice=response-required`);
    expect(doubles.judge).not.toHaveBeenCalled();
    expect(doubles.runs.createRun).not.toHaveBeenCalled();
  });

  it("mints a Participant id before judging and keys the rate limit on it, so two first-time visitors judged in the same second are each judged (ticket 43 S8/F2)", async () => {
    doubles.runs.getPublicJourney.mockResolvedValue({
      ...liveJourney(),
      document: decidingDocument(),
    });
    doubles.judge.mockResolvedValue({ choiceId: "wait", probability: 0.8 });

    // Neither visitor carries a Participant cookie yet.
    cookiesPresent({});
    const first = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );
    cookiesPresent({});
    const second = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );

    expect(first).toBe(`/j/${JOURNEY_ID}/queue`);
    expect(second).toBe(`/j/${JOURNEY_ID}/queue`);
    expect(doubles.judge).toHaveBeenCalledTimes(2);
  });

  it("rate-limits a returning Participant re-submitting within a second, on their own id — never the Journey's", async () => {
    doubles.runs.getPublicJourney.mockResolvedValue({
      ...liveJourney(),
      document: decidingDocument(),
    });
    doubles.judge.mockResolvedValue({ choiceId: "wait", probability: 0.8 });

    cookiesPresent({});
    await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );
    const participantSet = doubles.cookieStore.set.mock.calls.find(
      ([name]) => name === PARTICIPANT_COOKIE,
    );
    const participantId = participantSet![1] as string;

    // The same Participant, cookie now present, submitting again at once.
    cookiesPresent({ [PARTICIPANT_COOKIE]: participantId });
    const second = await redirectOf(
      chooseFromStartAction(JOURNEY_ID, formResponding(RESPONSE)),
    );

    expect(second).toBe(
      `/j/${JOURNEY_ID}?decide=none&response=${encodeURIComponent(RESPONSE)}`,
    );
    expect(doubles.judge).toHaveBeenCalledTimes(1);
  });
});
