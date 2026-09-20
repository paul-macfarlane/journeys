import { describe, expect, it } from "vitest";

import type { GraphDocument } from "@/lib/graph/document";

import { serializeFixture } from "./fixture";

/** The catch-all the commit-time secret scanners refuse. */
const LONG_RUN = /[A-Za-z0-9+/]{40,}/;

// Built from short pieces, so that this test file's own text never carries
// the run it exists to prove the serializer breaks up.
const longBase64 = [
  "cHJpdmF0ZS9sci9pbWFnZXMv",
  "d2Vic2l0ZS8yMDIzLTAzL2Zs",
  "NTEwNjYxODUxOTYtaW1hZ2UuanBn",
].join("");

function documentWithImage(src: string): GraphDocument {
  return {
    schemaVersion: 1,
    startStepId: "step-1",
    allowBack: true,
    steps: {
      "step-1": {
        id: "step-1",
        title: "A picture",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Look at this." }],
            },
            { type: "image", attrs: { src, credit: "Photo by someone" } },
          ],
        },
        choices: [],
        prompt: null,
        outcomeId: "outcome-1",
        position: null,
      },
    },
    outcomes: { "outcome-1": { id: "outcome-1", label: "Seen" } },
  };
}

describe("serializeFixture", () => {
  it("writes pretty JSON that parses back to the same document", () => {
    const document = documentWithImage("https://example.com/a.jpg");
    const text = serializeFixture(document);

    expect(text.endsWith("\n")).toBe(true);
    expect(text.startsWith("{\n  ")).toBe(true);
    expect(JSON.parse(text)).toEqual(document);
  });

  it("leaves no unbroken run of 40+ word characters in the file text", () => {
    const document = documentWithImage(
      `https://images.rawpixel.com/image_800/${longBase64}.jpg`,
    );
    const text = serializeFixture(document);

    expect(text).not.toMatch(LONG_RUN);
    // The escape is cosmetic: the parsed string is the real URL, untouched.
    expect(JSON.parse(text)).toEqual(document);
  });

  it("breaks runs of every length above the threshold", () => {
    for (const length of [40, 41, 64, 100, 257]) {
      const document = documentWithImage(
        `https://x.test/${"a".repeat(length)}`,
      );
      const text = serializeFixture(document);

      expect(text, `length ${length}`).not.toMatch(LONG_RUN);
      expect(JSON.parse(text)).toEqual(document);
    }
  });
});
