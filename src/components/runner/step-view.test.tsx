import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GraphDocument, Prompt, Step } from "@/lib/graph/document";

import { StepView } from "./step-view";

/**
 * Seam A: `StepView` rendered to markup, the way the runner's pages render
 * it on the server with no client bundle. Expected strings are written out
 * from the component's own contract, never derived the way it derives them.
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

const requiredPrompt: Prompt = {
  type: "free_text",
  label: "What do you do when the officer looks up?",
  required: true,
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

function render(step: Step): string {
  const html = renderToStaticMarkup(
    <StepView
      step={step}
      document={documentWith(step)}
      choices={{ kind: "form", action: noop }}
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

describe("StepView with a required Prompt", () => {
  it("renders the textbox and the Choices as the form's buttons", () => {
    const html = render(queueStep(requiredPrompt));

    expect(html).toContain('aria-required="true"');
    expect(html).toContain('aria-label="Choices"');
    expect(html).toContain('name="to"');
    expect(html).toContain("Show your papers");
    expect(html).toContain("Leave the queue");
  });
});

describe("StepView with an optional Prompt", () => {
  it("marks the field optional and still renders the Choices", () => {
    const html = render(queueStep({ ...requiredPrompt, required: false }));

    expect(html).toContain("(optional)");
    expect(html).toContain('aria-label="Choices"');
    expect(html).toContain('name="to"');
  });
});

describe("StepView with no Prompt", () => {
  it("renders only the Choices, with no textbox", () => {
    const html = render(queueStep(null));

    expect(html).not.toContain("<textarea");
    expect(html).toContain('aria-label="Choices"');
  });
});

describe("StepView with an untitled Step", () => {
  it("heads the page with the name an Author sees, never an empty h1", () => {
    const html = render({ ...queueStep(null), title: "" });

    expect(html).toContain(">Untitled step</h1>");
  });

  it("heads a whitespace-only title the same way", () => {
    const html = render({ ...queueStep(null), title: "   " });

    expect(html).toContain(">Untitled step</h1>");
  });
});
