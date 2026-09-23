import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { editorExtensions } from "./extensions";

/**
 * The editor's own schema must refuse every shape the stored contract drops,
 * or an Author could write words the next save silently removes. A quote
 * lives only at the top of a document and holds only paragraphs (ticket 40).
 */
const schema = getSchema(editorExtensions);

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function quote(...content: unknown[]) {
  return { type: "blockquote", content };
}

function check(doc: unknown) {
  return () => schema.nodeFromJSON(doc).check();
}

describe("editorExtensions schema", () => {
  it("accepts a quote of paragraphs at the top of a document", () => {
    expect(
      check({ type: "doc", content: [quote(paragraph("a"), paragraph("b"))] }),
    ).not.toThrow();
  });

  it("refuses a quote inside a list item", () => {
    expect(
      check({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [paragraph("a"), quote(paragraph("b"))],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("refuses a quote inside a quote, and a heading inside a quote", () => {
    expect(
      check({ type: "doc", content: [quote(quote(paragraph("a")))] }),
    ).toThrow();
    expect(
      check({
        type: "doc",
        content: [
          quote({
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "a" }],
          }),
        ],
      }),
    ).toThrow();
  });
});
