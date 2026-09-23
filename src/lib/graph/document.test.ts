import { describe, expect, it } from "vitest";

import {
  createDraftDocument,
  documentsEqual,
  graphDocumentSchema,
  isEnding,
  parseGraphDocument,
  prepareDocumentForWrite,
  type Prompt,
} from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";
import {
  dimmingDocument,
  loopDocument,
  promptDocument,
  publishableDocument,
  runnerDocument,
} from "../../../e2e/setup/documents";
import case1 from "../../../scripts/seed/journey-stories/case-1.json";
import case2 from "../../../scripts/seed/journey-stories/case-2.json";
import case3 from "../../../scripts/seed/journey-stories/case-3.json";

describe("createDraftDocument", () => {
  it("creates a Draft holding exactly one Step", () => {
    const document = createDraftDocument();

    expect(Object.keys(document.steps)).toHaveLength(1);
  });

  it("makes that one Step the Start, with no Choices and no Outcomes", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    expect(start).toBeDefined();
    expect(start.id).toBe(document.startStepId);
    expect(start.title).toBe("Start");
    expect(start.choices).toEqual([]);
    expect(start.prompt).toBeNull();
    expect(start.outcomeId).toBeNull();
    expect(start.position).toBeNull();
    expect(document.outcomes).toEqual({});
    expect(document.allowBack).toBe(true);
    expect(document.schemaVersion).toBe(1);
  });

  it("gives the Start an empty paragraph, exactly as the editor emits it", () => {
    const document = createDraftDocument();

    expect(document.steps[document.startStepId].content).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("gives each Draft its own Start id", () => {
    expect(createDraftDocument().startStepId).not.toBe(
      createDraftDocument().startStepId,
    );
  });

  it("parses unchanged, so what is stored is what was built", () => {
    const document = createDraftDocument();

    expect(graphDocumentSchema.parse(document)).toEqual(document);
  });

  it("survives a round trip through JSON unchanged", () => {
    const document = createDraftDocument();

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });
});

describe("the large journey fixture", () => {
  it("is a real-sized journey: 44 Steps, 6 Endings, 3 Outcomes", () => {
    const steps = Object.values(largeJourney.steps);

    expect(steps).toHaveLength(44);
    expect(steps.filter((step) => isEnding(step))).toHaveLength(6);
    expect(Object.keys(largeJourney.outcomes)).toHaveLength(3);
  });

  it("parses unchanged", () => {
    expect(graphDocumentSchema.parse(largeJourney)).toEqual(largeJourney);
  });

  it("survives a round trip through JSON unchanged", () => {
    expect(JSON.parse(JSON.stringify(largeJourney))).toEqual(largeJourney);
  });
});

describe("isEnding", () => {
  it("calls a Step with no Choices an Ending", () => {
    expect(isEnding(largeJourney.steps["step-39"])).toBe(true);
  });

  it("does not call a Step with Choices an Ending", () => {
    expect(isEnding(largeJourney.steps["step-01"])).toBe(false);
  });
});

describe("graphDocumentSchema", () => {
  it("rejects a steps key that disagrees with the Step's own id", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = graphDocumentSchema.safeParse({
      ...document,
      steps: { "step-elsewhere": start },
      startStepId: "step-elsewhere",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an outcomes key that disagrees with the Outcome's own id", () => {
    const result = graphDocumentSchema.safeParse({
      ...largeJourney,
      outcomes: {
        "outcome-renamed": largeJourney.outcomes["outcome-kept-the-light"],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a Prompt of any type other than free text", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = graphDocumentSchema.safeParse({
      ...document,
      steps: {
        [start.id]: {
          ...start,
          prompt: { type: "select", label: "Pick one", required: false },
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts a free-text Prompt", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = graphDocumentSchema.safeParse({
      ...document,
      steps: {
        [start.id]: {
          ...start,
          prompt: {
            type: "free_text",
            label: "What would you do?",
            required: false,
          },
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("defaults a Prompt's decides to false when the stored shape does not carry it (ticket 43)", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = graphDocumentSchema.safeParse({
      ...document,
      steps: {
        [start.id]: {
          ...start,
          prompt: {
            type: "free_text",
            label: "What would you do?",
            required: false,
          },
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.steps[start.id].prompt?.decides).toBe(false);
    }
  });

  it("round-trips a Prompt with decides: true", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];
    const withDecidingPrompt = {
      ...document,
      steps: {
        [start.id]: {
          ...start,
          prompt: {
            type: "free_text" as const,
            label: "Which way?",
            required: true,
            decides: true,
          },
        },
      },
    };

    expect(parseGraphDocument(withDecidingPrompt)).toEqual({
      ok: true,
      document: withDecidingPrompt,
    });
  });

  it("rejects a schema version it was not written for", () => {
    const result = graphDocumentSchema.safeParse({
      ...createDraftDocument(),
      schemaVersion: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty Step id", () => {
    const result = graphDocumentSchema.safeParse({
      ...createDraftDocument(),
      startStepId: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a title longer than 200 characters", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = graphDocumentSchema.safeParse({
      ...document,
      steps: { [start.id]: { ...start, title: "a".repeat(201) } },
    });

    expect(result.success).toBe(false);
  });

  it("accepts readable Step ids so the seed can use them", () => {
    expect(graphDocumentSchema.safeParse(largeJourney).success).toBe(true);
  });
});

describe("layoutDirection", () => {
  it('parses a document without the field as layoutDirection: "TB"', () => {
    const document = createDraftDocument();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { layoutDirection, ...withoutDirection } = document;

    const result = parseGraphDocument(withoutDirection);

    expect(result).toEqual({ ok: true, document });
  });

  it('round-trips "LR" through parseGraphDocument and prepareDocumentForWrite', () => {
    const document = {
      ...createDraftDocument(),
      layoutDirection: "LR" as const,
    };

    expect(parseGraphDocument(document)).toEqual({ ok: true, document });
    expect(prepareDocumentForWrite(document)).toEqual({
      ok: true,
      document,
    });
  });

  it('refuses a layoutDirection other than "TB" or "LR"', () => {
    const result = parseGraphDocument({
      ...createDraftDocument(),
      layoutDirection: "RL",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/layoutDirection/);
    }
  });
});

describe("parseGraphDocument", () => {
  it("returns the document when it is valid", () => {
    const document = createDraftDocument();
    const result = parseGraphDocument(document);

    expect(result).toEqual({ ok: true, document });
  });

  it("returns an error naming the field that failed instead of throwing", () => {
    const result = parseGraphDocument({
      ...createDraftDocument(),
      startStepId: 7,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/startStepId/);
    }
  });

  it("names a nested path", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = parseGraphDocument({
      ...document,
      steps: { [start.id]: { ...start, choices: "none" } },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/choices/);
    }
  });

  it("rejects something that is not a document at all", () => {
    expect(parseGraphDocument("a journey").ok).toBe(false);
  });
});

describe("prepareDocumentForWrite", () => {
  /** A Draft as it arrives from the editor: one Step, content unvalidated. */
  function rawDraftWith(content: unknown): unknown {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    return { ...document, steps: { [start.id]: { ...start, content } } };
  }

  function onlyStepContent(document: {
    steps: Record<string, { content: unknown }>;
  }): unknown {
    return Object.values(document.steps)[0].content;
  }

  it("stores the rel the contract requires, whatever the editor emitted", () => {
    const result = prepareDocumentForWrite(
      rawDraftWith({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "the keeper's log",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "https://example.test/keepers-log",
                      rel: "noopener noreferrer nofollow",
                      target: "_blank",
                      class: null,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(onlyStepContent(result.document)).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "the keeper's log",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "https://example.test/keepers-log",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    }
  });

  it("keeps a line break between the words around it (ticket 40)", () => {
    const result = prepareDocumentForWrite(
      rawDraftWith({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "The lamp is lit." },
              { type: "hardBreak" },
              { type: "text", text: "The wind is west." },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(onlyStepContent(result.document)).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "The lamp is lit." },
              { type: "hardBreak" },
              { type: "text", text: "The wind is west." },
            ],
          },
        ],
      });
    }
  });

  it("strips a javascript link and keeps the words it wrapped", () => {
    const result = prepareDocumentForWrite(
      rawDraftWith({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "press here",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "javascript:alert(1)",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(onlyStepContent(result.document)).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "press here" }],
          },
        ],
      });
    }
  });

  it("keeps an image with neither alt text nor caption, filling both with empty strings", () => {
    const result = prepareDocumentForWrite({
      schemaVersion: 1,
      startStepId: "step-first",
      allowBack: true,
      steps: {
        "step-first": {
          id: "step-first",
          title: "The lamp",
          content: {
            type: "doc",
            content: [
              {
                type: "image",
                attrs: { src: "https://example.test/images/lamp.jpg" },
              },
            ],
          },
          choices: [],
          prompt: null,
          outcomeId: null,
          position: null,
        },
      },
      outcomes: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.steps["step-first"].content.content).toEqual([
        {
          type: "image",
          attrs: {
            src: "https://example.test/images/lamp.jpg",
            alt: "",
            caption: "",
          },
        },
      ]);
    }
  });

  it("reports a broken envelope without ever reaching the sanitizer", () => {
    const result = prepareDocumentForWrite({
      ...(rawDraftWith({
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://example.test/images/lamp.jpg" },
          },
        ],
      }) as object),
      startStepId: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/startStepId/);
      expect(result.stepId).toBeUndefined();
    }
  });

  it("reports a steps key that disagrees with the Step's own id", () => {
    const document = createDraftDocument();
    const start = document.steps[document.startStepId];

    const result = prepareDocumentForWrite({
      ...document,
      steps: { "step-elsewhere": start },
      startStepId: "step-elsewhere",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/steps\.step-elsewhere\.id/);
    }
  });

  it("leaves a journey whose content is already clean unchanged", () => {
    const result = prepareDocumentForWrite(largeJourney);

    expect(result).toEqual({ ok: true, document: largeJourney });
  });

  it("leaves a brand-new Draft unchanged", () => {
    const document = createDraftDocument();

    expect(prepareDocumentForWrite(document)).toEqual({ ok: true, document });
  });
});

describe("documentsEqual", () => {
  it("calls a document equal to a copy of itself with keys in another order", () => {
    // Every object at every level gets its keys reversed, the way Postgres
    // or another writer might have stored them.
    const sortedNested = JSON.parse(
      JSON.stringify(largeJourney, (_key, value) =>
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value as Record<string, unknown>).sort(
                ([a], [b]) => b.localeCompare(a),
              ),
            )
          : value,
      ),
    ) as typeof largeJourney;

    expect(JSON.stringify(sortedNested)).not.toBe(JSON.stringify(largeJourney));
    expect(documentsEqual(largeJourney, sortedNested)).toBe(true);
  });

  it("tells a Draft that changed one Step title from the version it came from", () => {
    const edited = {
      ...largeJourney,
      steps: {
        ...largeJourney.steps,
        [largeJourney.startStepId]: {
          ...largeJourney.steps[largeJourney.startStepId],
          title: "A different opening",
        },
      },
    };

    expect(documentsEqual(largeJourney, edited)).toBe(false);
  });
});

describe("decides defaults to false on every stored Prompt (ticket 43)", () => {
  /** Every Prompt a document holds, walking every Step. */
  function promptsIn(document: {
    steps: Record<string, { prompt: unknown }>;
  }): Prompt[] {
    return Object.values(document.steps)
      .map((step) => step.prompt)
      .filter((prompt): prompt is Prompt => prompt !== null);
  }

  it.each([
    ["large-journey fixture", largeJourney],
    ["e2e publishableDocument()", publishableDocument()],
    ["e2e runnerDocument()", runnerDocument()],
    ["e2e promptDocument()", promptDocument()],
    ["e2e loopDocument()", loopDocument()],
    ["e2e dimmingDocument()", dimmingDocument()],
    ["legacy case-1.json", case1],
    ["legacy case-2.json", case2],
    ["legacy case-3.json", case3],
  ])(
    "%s still parses, with decides: false on every Prompt",
    (_name, document) => {
      const result = parseGraphDocument(document);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const prompts = promptsIn(result.document);
        for (const prompt of prompts) {
          expect(prompt.decides).toBe(false);
        }
      }
    },
  );
});
