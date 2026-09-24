import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GraphDocument, Prompt, Step } from "@/lib/graph/document";

import {
  liveDecision,
  previewDecision,
  StepView,
  type DecisionView,
} from "./step-view";

/**
 * Seam A for ticket 43's deciding form: `StepView` rendered to markup, the
 * way the runner's pages render it on the server with no client bundle.
 * Expected strings are written out from the ticket's wording, never derived
 * the way the component derives them.
 */

const content = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

function queueStep(prompt: Prompt | null): Step {
  return {
    id: "queue",
    title: "Still waiting",
    content,
    choices: [
      {
        id: "choice-papers",
        label: "Show your papers",
        targetStepId: "waved-through",
        condition: null,
        effect: null,
      },
      {
        id: "choice-give-up",
        label: "Leave the queue",
        targetStepId: "turned-back",
        condition: null,
        effect: null,
      },
    ],
    prompt,
    outcomeId: null,
    position: null,
  };
}

const decidingPrompt: Prompt = {
  type: "free_text",
  label: "What do you do when the officer looks up?",
  required: true,
  decides: true,
};

function documentWith(step: Step): GraphDocument {
  const ending = (id: string): Step => ({
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
    startStepId: step.id,
    allowBack: true,
    steps: {
      [step.id]: step,
      "waved-through": ending("waved-through"),
      "turned-back": ending("turned-back"),
    },
    outcomes: {},
    layoutDirection: "TB",
  };
}

async function noop() {}

function render(step: Step, decision?: DecisionView): string {
  const html = renderToStaticMarkup(
    <StepView
      step={step}
      document={documentWith(step)}
      choices={{ kind: "form", action: noop, decision }}
      startOver={null}
    />,
  );
  // Text content comes back entity-escaped; the assertions read it as a
  // Participant would.
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

describe("StepView with a deciding Prompt", () => {
  it("offers the textbox and one Continue button, and no Choices, before anything is judged", () => {
    const html = render(queueStep(decidingPrompt));

    expect(html).toContain('aria-required="true"');
    expect(html).toMatch(/<button type="submit"[^>]*>Continue<\/button>/);
    // Idle until the form is submitted (ticket 49): the button is enabled
    // and reads Continue, never "Deciding…", in the markup the server sends.
    expect(html).not.toContain(' disabled=""');
    expect(html).not.toContain("Deciding…");
    expect(html).not.toContain('name="to"');
    expect(html).not.toContain('aria-label="Choices"');
    expect(html).not.toContain("Show your papers");
    expect(html).not.toContain("Choose for yourself");
  });

  it("marks the judge's pick among the Choices once a live Run was asked", () => {
    const html = render(queueStep(decidingPrompt), {
      pick: "choice-papers",
      probability: null,
    });

    expect(html).toContain("Choose for yourself");
    expect(html).toContain('aria-label="Choices"');
    expect(html).not.toContain(">Continue<");
    expect(html).toContain(
      'We think "Show your papers" fits your response — or choose another.',
    );
    expect(html).toContain("Suggested for your response");
    // Exactly one button is suggested, and it is the pick.
    expect(html.match(/data-suggested="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<button[^>]*data-suggested="true"[^>]*value="waved-through"|<button[^>]*value="waved-through"[^>]*data-suggested="true"/,
    );
    expect(html).toMatch(
      /aria-describedby="[^"]+"[^>]*>Show your papers<\/button>/,
    );
  });

  it("marks nothing and asks the Participant to choose when the judge had no answer", () => {
    const html = render(queueStep(decidingPrompt), {
      pick: null,
      probability: null,
    });

    expect(html).toContain("Choose for yourself");
    expect(html).toContain("Choose the step that fits your response.");
    expect(html).not.toContain("data-suggested");
    expect(html).not.toContain("Suggested for your response");
    expect(html).toContain("Show your papers");
    expect(html).toContain("Leave the queue");
  });

  it("tells an Author in Preview what the judge picked and that a live Run would have advanced", () => {
    const html = render(queueStep(decidingPrompt), {
      pick: "choice-give-up",
      probability: 0.72,
    });

    expect(html).toContain(
      'The judge picked "Leave the queue" (72%) — a live run would have advanced',
    );
    expect(html.match(/data-suggested="true"/g)).toHaveLength(1);
  });

  it("tells an Author in Preview that a weak pick would have asked", () => {
    const html = render(queueStep(decidingPrompt), {
      pick: "choice-papers",
      probability: 0.3,
    });

    expect(html).toContain(
      'The judge picked "Show your papers" (30%) — a live run would have asked',
    );
  });

  it("tells an Author in Preview when the judge could not pick", () => {
    const html = render(queueStep(decidingPrompt), {
      pick: null,
      probability: 0,
    });

    expect(html).toContain(
      "The judge couldn't pick a choice (no key, a failed call, or an unclear answer) — a live run would ask.",
    );
    expect(html).not.toContain("data-suggested");
  });
});

describe("StepView with a Prompt that does not decide", () => {
  it("renders the Choices as the form's buttons, as before", () => {
    const html = render(
      queueStep({ ...decidingPrompt, decides: false, required: false }),
    );

    expect(html).toContain('aria-label="Choices"');
    expect(html).toContain('name="to"');
    expect(html).toContain("Show your papers");
    expect(html).not.toContain(">Continue<");
    expect(html).not.toContain("Choose for yourself");
  });
});

describe("liveDecision", () => {
  const step = queueStep(decidingPrompt);

  it("is undefined when nothing was judged", () => {
    expect(liveDecision(step, undefined)).toBeUndefined();
    expect(liveDecision(step, ["a", "b"])).toBeUndefined();
  });

  it("reads a Choice id of the Step as the pick, with no probability", () => {
    expect(liveDecision(step, "choice-papers")).toEqual({
      pick: "choice-papers",
      probability: null,
    });
  });

  it("reads none, and any id the Step does not have, as no pick", () => {
    expect(liveDecision(step, "none")).toEqual({
      pick: null,
      probability: null,
    });
    expect(liveDecision(step, "choice-elsewhere")).toEqual({
      pick: null,
      probability: null,
    });
  });
});

describe("previewDecision", () => {
  const step = queueStep(decidingPrompt);

  it("reads the confidence as a probability", () => {
    expect(previewDecision(step, "choice-papers", "72")).toEqual({
      pick: "choice-papers",
      probability: 0.72,
    });
  });

  it("reads a missing or malformed confidence as zero, so Preview still says what happened", () => {
    expect(previewDecision(step, "none", undefined)).toEqual({
      pick: null,
      probability: 0,
    });
    expect(previewDecision(step, "choice-papers", "lots")).toEqual({
      pick: "choice-papers",
      probability: 0,
    });
  });

  it("is undefined when nothing was judged", () => {
    expect(previewDecision(step, undefined, "72")).toBeUndefined();
  });
});
