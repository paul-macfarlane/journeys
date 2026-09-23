import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Judge } from "@/lib/ai/decide";
import type { GraphDocument } from "@/lib/graph/document";

/**
 * Seam A for ticket 43's Preview judge path: the shell around `judgeResponse`
 * — what Preview's action does with a judge's answer — with the session, the
 * Draft, and the gateway replaced by doubles. Modeled on
 * `src/app/j/[journeyId]/actions.test.ts`.
 */

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect to ${to}`);
  }
}

const doubles = vi.hoisted(() => ({
  session: { user: { id: "author-1" } },
  drafts: { getDraftForMember: vi.fn() },
  // Mutable, so a test can take the key away; never a real credential.
  env: { AI_GATEWAY_API_KEY: "test-key" as string | undefined },
  judge: vi.fn<Judge>(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new RedirectSignal(to);
  }),
}));

vi.mock("@/db/drafts", () => doubles.drafts);
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
}));
vi.mock("@/lib/env", () => ({ env: doubles.env }));

// The gateway is a system boundary: only the judge that calls it is
// replaced, and `decideChoice` — what the action does with the answer —
// stays real.
vi.mock("@/lib/ai/decide", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/decide")>()),
  gatewayJudge: doubles.judge,
}));

import { previewChooseAction } from "./actions";

const PROJECT_ID = "project-1";
const JOURNEY_ID = "journey-1";
const RESPONSE = "I hand over the paper and smile.";

const emptyContent = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

function endingStep(id: string) {
  return {
    id,
    title: id,
    content: emptyContent,
    choices: [],
    prompt: null,
    outcomeId: null,
    position: null,
  };
}

/** A deciding queue Step with two Choices, to Endings "done" and "turned". */
function decidingDraft(): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "queue",
    allowBack: true,
    steps: {
      queue: {
        id: "queue",
        title: "Still waiting",
        content: emptyContent,
        choices: [
          {
            id: "papers",
            label: "Papers",
            targetStepId: "done",
            condition: null,
            effect: null,
          },
          {
            id: "give-up",
            label: "Leave the queue",
            targetStepId: "turned",
            condition: null,
            effect: null,
          },
        ],
        prompt: {
          type: "free_text",
          label: "What do you do?",
          required: true,
          decides: true,
        },
        outcomeId: null,
        position: null,
      },
      done: endingStep("done"),
      turned: endingStep("turned"),
    },
    outcomes: {},
    layoutDirection: "TB",
  };
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

function formResponding(text: string): FormData {
  const formData = new FormData();
  formData.set("response", text);
  return formData;
}

const BASE = `/projects/${PROJECT_ID}/journeys/${JOURNEY_ID}/preview`;

beforeEach(() => {
  vi.clearAllMocks();
  doubles.drafts.getDraftForMember.mockResolvedValue({
    document: decidingDraft(),
  });
  doubles.env.AI_GATEWAY_API_KEY = "test-key";
});

describe("previewChooseAction on a deciding Prompt", () => {
  it("floors the probability, so 0.496 never reads as the 50 a live Run needs (ticket 43 F4)", async () => {
    doubles.judge.mockResolvedValue({ choiceId: "papers", probability: 0.496 });

    const to = await redirectOf(
      previewChooseAction(
        PROJECT_ID,
        JOURNEY_ID,
        "queue",
        formResponding(RESPONSE),
      ),
    );

    expect(to).toBe(
      `${BASE}/queue?decide=papers&confidence=49&response=${encodeURIComponent(RESPONSE)}`,
    );
  });

  it("comes back with no pick and the Response when there is no gateway key", async () => {
    doubles.env.AI_GATEWAY_API_KEY = undefined;

    const to = await redirectOf(
      previewChooseAction(
        PROJECT_ID,
        JOURNEY_ID,
        "queue",
        formResponding(RESPONSE),
      ),
    );

    expect(to).toBe(
      `${BASE}/queue?decide=none&response=${encodeURIComponent(RESPONSE)}`,
    );
    expect(doubles.judge).not.toHaveBeenCalled();
  });

  it("follows a pressed Choice as before, without asking the judge", async () => {
    const formData = formResponding(RESPONSE);
    formData.set("to", "turned");

    const to = await redirectOf(
      previewChooseAction(PROJECT_ID, JOURNEY_ID, "queue", formData),
    );

    expect(to).toBe(`${BASE}/turned`);
    expect(doubles.judge).not.toHaveBeenCalled();
  });
});
