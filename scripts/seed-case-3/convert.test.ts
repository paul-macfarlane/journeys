import { describe, expect, it } from "vitest";

import { buildGraphDocument, convertStepPage } from "./convert";
import type { OutcomeMapping, StepPage } from "./convert";

/**
 * The converter's seam: legacy page HTML in, the pieces of a graph document
 * out. Every snippet here is shaped like the real Astro markup — the wrapper
 * classes, the trailing space inside `img src`, the `<span>`-inside-`<a>`
 * choice links — so a change in that markup fails here rather than silently
 * seeding an empty Journey.
 */

function stepPage(body: string): string {
  return `<!doctype html><html><head><title>Case 3</title></head><body><header class="site-header">Journey Stories</header><main id="main" class="mx-auto w-full px-5"><article class="space-y-8 lg:space-y-10">${body}</article></main></body></html>`;
}

function header(title: string): string {
  return `<header class="space-y-2"><p class="text-accent uppercase">Case 3</p><h1 class="font-serif text-balance">${title}</h1></header>`;
}

function narrative(inner: string): string {
  return `<div class="narrative space-y-5 lg:space-y-6">${inner}</div>`;
}

function figures(inner: string): string {
  return `<div class="grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">${inner}</div>`;
}

function decision(...links: Array<[string, number]>): string {
  const items = links
    .map(
      ([label, target]) =>
        `<li><a href="/journeys/case-3/${target}" class="group flex items-center"><span>${label}</span><svg width="16" height="16" aria-hidden="true" focusable="false"><path d="M4.5 12h15"></path></svg></a></li>`,
    )
    .join("");
  return `<section aria-labelledby="decision-heading" class="border-rule rounded-lg border p-4"><h2 id="decision-heading" class="text-muted uppercase">Your decision</h2><ul class="flex flex-col gap-2">${items}</ul></section>`;
}

function caseNav(next: number | null): string {
  const link =
    next === null
      ? ""
      : `<a class="inline-flex items-center" href="/journeys/case-3/${next}">Next</a>`;
  return `<nav aria-label="Case navigation" class="border-rule flex items-center"><button type="button" id="layout-back">Back</button>${link}</nav>`;
}

describe("convertStepPage", () => {
  it("reads the Step title and turns the narrative into paragraph blocks", () => {
    const converted = convertStepPage(
      stepPage(
        header("Preface") +
          narrative(
            "<p>Welcome. This is an activity meant to cultivate empathy.</p><p>Your GOAL is to maintain your health condition.</p>",
          ) +
          caseNav(1),
      ),
    );

    expect(converted.title).toBe("Preface");
    expect(converted.content).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Welcome. This is an activity meant to cultivate empathy.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Your GOAL is to maintain your health condition.",
            },
          ],
        },
      ],
    });
  });

  it("keeps italic, bold, and link marks on the runs of text that carry them", () => {
    const converted = convertStepPage(
      stepPage(
        header("Undocumented") +
          narrative(
            '<p>You feel <em>tired</em> and <strong>dizzy</strong>, so you read <a href="https://example.test/handout">the handout</a>.</p>',
          ),
      ),
    );

    expect(converted.content.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "You feel " },
        { type: "text", text: "tired", marks: [{ type: "italic" }] },
        { type: "text", text: " and " },
        { type: "text", text: "dizzy", marks: [{ type: "bold" }] },
        { type: "text", text: ", so you read " },
        {
          type: "text",
          text: "the handout",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://example.test/handout",
                rel: "noopener noreferrer",
              },
            },
          ],
        },
        { type: "text", text: "." },
      ],
    });
  });

  it("decodes entities, collapses whitespace, and reads a line break as a space", () => {
    const converted = convertStepPage(
      stepPage(
        header("Appt at Local Clinic") +
          narrative(
            "<p>\n  You can&#39;t read it &amp; you&rsquo;re   embarrassed.<br>Take the handout anyway.\n</p>",
          ),
      ),
    );

    expect(converted.content.content[0]).toEqual({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "You can't read it & you’re embarrassed. Take the handout anyway.",
        },
      ],
    });
  });

  it("decodes entities in the Step title too", () => {
    const converted = convertStepPage(
      stepPage(header("Doc &amp; pharmacy") + narrative("<p>A day.</p>")),
    );

    expect(converted.title).toBe("Doc & pharmacy");
  });

  it("turns a figure into an image block, trimming the trailing space in its src", () => {
    const converted = convertStepPage(
      stepPage(
        header("The Horses") +
          narrative("<p>Ten years ago you set out.</p>") +
          figures(
            '<figure class="m-0 flex flex-col gap-2.5"><img src="https://example.test/horses.jpg " loading="lazy" decoding="async" class="w-full rounded-lg"><figcaption class="text-faint">Photo - Image by Steven Lilley,\n  CC BY-SA 2.0</figcaption></figure>',
          ) +
          caseNav(8),
      ),
    );

    // The image goes after the narrative, which is where the legacy page puts
    // it and where a participant reads it.
    expect(converted.content.content).toHaveLength(2);
    expect(converted.content.content[1]).toEqual({
      type: "image",
      attrs: {
        src: "https://example.test/horses.jpg",
        credit: "Photo - Image by Steven Lilley, CC BY-SA 2.0",
        alt: null,
      },
    });
  });

  it("reads the Choices out of the decision section in page order", () => {
    const converted = convertStepPage(
      stepPage(
        header("Appt at Local Clinic") +
          narrative("<p>What do you do?</p>") +
          decision(
            ["Take the medications only when you feel sick", 22],
            ["Take the medications all at once in the morning", 22],
            ["Take the medications whenever you remember", 22],
          ) +
          caseNav(null),
      ),
    );

    // Three Choices that all lead to the same Step stay three Choices.
    expect(converted.choices).toEqual([
      {
        label: "Take the medications only when you feel sick",
        targetStep: 22,
      },
      {
        label: "Take the medications all at once in the morning",
        targetStep: 22,
      },
      { label: "Take the medications whenever you remember", targetStep: 22 },
    ]);
  });

  it("reads a lone Next link as a single Choice", () => {
    const converted = convertStepPage(
      stepPage(
        header("The Horses") +
          narrative("<p>Ten years ago you set out.</p>") +
          caseNav(8),
      ),
    );

    expect(converted.choices).toEqual([{ label: "Next", targetStep: 8 }]);
  });

  it("reads a page with no onward link as an Ending", () => {
    const converted = convertStepPage(
      stepPage(
        header("Wow") +
          narrative("<p>Congratulations! You've acheived good control.</p>") +
          caseNav(null),
      ),
    );

    expect(converted.choices).toEqual([]);
    expect(converted.title).toBe("Wow");
  });

  it("keeps headings and lists the other legacy cases use", () => {
    const converted = convertStepPage(
      stepPage(
        header("Healthcare in detention") +
          narrative(
            "<h2>What you are told</h2><ul><li>Drink water</li><li>Wait your turn</li></ul><ol><li>Sign here</li></ol>",
          ),
      ),
    );

    expect(converted.content.content).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "What you are told" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Drink water" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Wait your turn" }],
              },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Sign here" }],
              },
            ],
          },
        ],
      },
    ]);
  });
});

function page(
  step: number,
  title: string,
  choices: Array<{ label: string; targetStep: number }>,
): StepPage {
  return {
    step,
    title,
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: title }] },
      ],
    },
    choices,
  };
}

const mapping: OutcomeMapping = {
  outcomes: [{ id: "outcome-good-control", label: "Achieved good control" }],
  endings: [{ step: 3, title: "Wow", outcomeId: "outcome-good-control" }],
};

const pages: StepPage[] = [
  page(1, "Preface", [{ label: "Next", targetStep: 2 }]),
  page(2, "In the ER", [
    { label: "Wait", targetStep: 3 },
    { label: "Leave", targetStep: 3 },
  ]),
  page(3, "Wow", []),
];

describe("buildGraphDocument", () => {
  it("gives every Step and Choice a readable id and names the Start", () => {
    const built = buildGraphDocument(pages, mapping, 1);

    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.document.startStepId).toBe("step-1");
    expect(Object.keys(built.document.steps)).toEqual([
      "step-1",
      "step-2",
      "step-3",
    ]);
    expect(built.document.steps["step-2"].choices).toEqual([
      {
        id: "step-2-choice-1",
        label: "Wait",
        targetStepId: "step-3",
        condition: null,
        effect: null,
      },
      {
        id: "step-2-choice-2",
        label: "Leave",
        targetStepId: "step-3",
        condition: null,
        effect: null,
      },
    ]);
  });

  it("tags each Ending with the Outcome the mapping gives it, and no other Step", () => {
    const built = buildGraphDocument(pages, mapping, 1);

    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.document.outcomes).toEqual({
      "outcome-good-control": {
        id: "outcome-good-control",
        label: "Achieved good control",
      },
    });
    expect(built.document.steps["step-3"].outcomeId).toBe(
      "outcome-good-control",
    );
    expect(built.document.steps["step-1"].outcomeId).toBeNull();
  });

  it("refuses to build when a scraped Ending is missing from the mapping", () => {
    const built = buildGraphDocument(pages, { ...mapping, endings: [] }, 1);

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems.join("\n")).toContain("Wow");
  });

  it("refuses to build when the mapping names a Step that is not an Ending", () => {
    const built = buildGraphDocument(
      pages,
      {
        ...mapping,
        endings: [
          ...mapping.endings,
          { step: 2, title: "In the ER", outcomeId: "outcome-good-control" },
        ],
      },
      1,
    );

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems.join("\n")).toContain("step 2");
  });

  it("refuses to build when the mapping names an Outcome that does not exist", () => {
    const built = buildGraphDocument(
      pages,
      {
        outcomes: mapping.outcomes,
        endings: [{ step: 3, title: "Wow", outcomeId: "outcome-typo" }],
      },
      1,
    );

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems.join("\n")).toContain("outcome-typo");
  });

  it("refuses to build when the Start names a Step that was not scraped", () => {
    const built = buildGraphDocument(pages, mapping, 7);

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems.join("\n")).toContain("step-7");
  });
});
