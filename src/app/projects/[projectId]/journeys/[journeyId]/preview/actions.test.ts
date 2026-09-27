import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GraphDocument } from "@/lib/graph/document";

/**
 * Seam A: the shell around Preview's one action — what it does with a
 * Response and a chosen Step — with the session and the Draft replaced by
 * doubles. Modeled on `src/app/j/[journeyId]/actions.test.ts`.
 */

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect to ${to}`);
  }
}

const doubles = vi.hoisted(() => ({
  session: { user: { id: "author-1" } },
  access: { journeyForMember: vi.fn() },
  drafts: { getDraft: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new RedirectSignal(to);
  }),
}));

vi.mock("@/db/access", () => doubles.access);
vi.mock("@/db/drafts", () => doubles.drafts);
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
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

/** A queue Step with a required Prompt and two Choices, to Endings "done" and "turned". */
function promptedDraft(): GraphDocument {
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
  doubles.access.journeyForMember.mockResolvedValue({ id: JOURNEY_ID });
  doubles.drafts.getDraft.mockResolvedValue({
    kind: "ok",
    document: promptedDraft(),
  });
});

describe("previewChooseAction for an Author who is not a Member", () => {
  it("sends them to the Journey page, which 404s, reading no Draft", async () => {
    doubles.access.journeyForMember.mockResolvedValue(null);

    const to = await redirectOf(
      previewChooseAction(
        PROJECT_ID,
        JOURNEY_ID,
        "queue",
        formResponding(RESPONSE),
      ),
    );

    expect(to).toBe(`/projects/${PROJECT_ID}/journeys/${JOURNEY_ID}`);
    expect(doubles.access.journeyForMember).toHaveBeenCalledWith(
      PROJECT_ID,
      JOURNEY_ID,
      "author-1",
    );
    expect(doubles.drafts.getDraft).not.toHaveBeenCalled();
  });
});

describe("previewChooseAction on a Step with a required Prompt", () => {
  it("follows the pressed Choice and comes back with nothing recorded", async () => {
    const formData = formResponding(RESPONSE);
    formData.set("to", "turned");

    const to = await redirectOf(
      previewChooseAction(PROJECT_ID, JOURNEY_ID, "queue", formData),
    );

    expect(to).toBe(`${BASE}/turned`);
  });

  it("refuses a blank Response and moves nothing", async () => {
    const formData = formResponding("   ");
    formData.set("to", "turned");

    const to = await redirectOf(
      previewChooseAction(PROJECT_ID, JOURNEY_ID, "queue", formData),
    );

    expect(to).toBe(`${BASE}/queue?notice=response-required`);
  });

  it("tells the Author nothing was recorded when a Response is saved with no Choice pressed", async () => {
    const to = await redirectOf(
      previewChooseAction(
        PROJECT_ID,
        JOURNEY_ID,
        "queue",
        formResponding(RESPONSE),
      ),
    );

    expect(to).toBe(`${BASE}/queue?notice=response-preview`);
  });
});
