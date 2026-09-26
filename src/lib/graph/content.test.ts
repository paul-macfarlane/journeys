import { describe, expect, it } from "vitest";

import {
  contentPreview,
  contentSchema,
  isBlankContent,
  PREVIEW_LIMIT,
  readStoredImageAttrs,
  sanitizeContent,
  textPreview,
  type Content,
} from "@/lib/graph/content";
import { graphDocumentSchema } from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";

import case1Document from "../../../scripts/seed/journey-stories/case-1.json";
import case2Document from "../../../scripts/seed/journey-stories/case-2.json";
import case3Document from "../../../scripts/seed/journey-stories/case-3.json";

/**
 * A Step's rich text that already satisfies every rule. The sanitizer has
 * nothing to remove, so it must hand the same structure back.
 */
const cleanContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "The lamp room" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "The wick is ", marks: [{ type: "bold" }] },
        { type: "text", text: "already", marks: [{ type: "italic" }] },
        { type: "text", text: " trimmed." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Never", marks: [{ type: "underline" }] },
        { type: "text", text: " leave it", marks: [{ type: "strike" }] },
        { type: "hardBreak" },
        { type: "text", text: "unattended." },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Keep the light." }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The keeper", marks: [{ type: "italic" }] },
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Oil" }] },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Climb the stair" }],
            },
          ],
        },
      ],
    },
    {
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        alt: "",
        caption: "Trinity House",
      },
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "The keeper's log",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://example.test/log",
                rel: "noopener noreferrer",
              },
            },
          ],
        },
      ],
    },
  ],
};

/** Wraps blocks so a test only has to state the interesting part. */
function docOf(...blocks: unknown[]) {
  return { type: "doc", content: blocks };
}

/** Unwraps a successful result, failing loudly when it is not one. */
function sanitized(input: unknown) {
  const result = sanitizeContent(input);
  if (!result.ok) {
    throw new Error(`Expected sanitizing to succeed, got: ${result.error}`);
  }
  return result.content;
}

describe("sanitizeContent", () => {
  it("returns already-valid content unchanged", () => {
    expect(sanitized(cleanContent)).toEqual(cleanContent);
  });

  it("always returns content that satisfies contentSchema", () => {
    expect(() => contentSchema.parse(sanitized(cleanContent))).not.toThrow();
  });

  it("refuses input that is not a document with a list of blocks", () => {
    expect(sanitizeContent(null).ok).toBe(false);
    expect(sanitizeContent("The lamp room").ok).toBe(false);
    expect(sanitizeContent({ type: "paragraph" }).ok).toBe(false);
    expect(sanitizeContent({ type: "doc" }).ok).toBe(false);
  });

  it("removes a blockquote nested inside a blockquote, keeping the outer one", () => {
    const input = docOf({
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Outer" }] },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Inner" }] },
          ],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Outer" }] },
        ],
      }),
    );
  });

  it("removes a blockquote nested inside a list item", () => {
    const input = docOf({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Oil" }] },
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Not here" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Oil" }] },
            ],
          },
        ],
      }),
    );
  });

  it("removes anything but paragraphs from a blockquote", () => {
    const input = docOf({
      type: "blockquote",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Not here" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Kept" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Nor here" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Kept" }] },
        ],
      }),
    );
  });

  it("removes a blockquote left with no paragraphs", () => {
    const input = docOf(
      { type: "blockquote", content: [{ type: "codeBlock" }] },
      { type: "blockquote" },
      { type: "paragraph", content: [{ type: "text", text: "Kept" }] },
    );

    expect(sanitized(input)).toEqual(
      docOf({ type: "paragraph", content: [{ type: "text", text: "Kept" }] }),
    );
  });

  it("removes a codeBlock block", () => {
    const input = docOf(
      { type: "codeBlock", content: [{ type: "text", text: "rm -rf /" }] },
      { type: "paragraph", content: [{ type: "text", text: "Kept" }] },
    );

    expect(sanitized(input)).toEqual(
      docOf({ type: "paragraph", content: [{ type: "text", text: "Kept" }] }),
    );
  });

  it("keeps a hardBreak in a paragraph or heading, dropping anything on it", () => {
    const input = docOf(
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Before" },
          { type: "hardBreak", marks: [{ type: "bold" }], attrs: { x: 1 } },
          { type: "text", text: "After" },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [
          { type: "text", text: "Lamp" },
          { type: "hardBreak" },
          { type: "text", text: "room" },
        ],
      },
    );

    expect(sanitized(input)).toEqual(
      docOf(
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before" },
            { type: "hardBreak" },
            { type: "text", text: "After" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "text", text: "Lamp" },
            { type: "hardBreak" },
            { type: "text", text: "room" },
          ],
        },
      ),
    );
  });

  it("removes inline elements other than text and line breaks", () => {
    const input = docOf({
      type: "paragraph",
      content: [
        { type: "text", text: "Before" },
        { type: "mention", attrs: { id: "keeper" } },
        { type: "text", text: "After" },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "paragraph",
        content: [
          { type: "text", text: "Before" },
          { type: "text", text: "After" },
        ],
      }),
    );
  });

  it("keeps strike and underline marks, drops code, and keeps the text", () => {
    const input = docOf({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Struck through",
          marks: [
            { type: "strike" },
            { type: "underline", attrs: { color: "red" } },
            { type: "code" },
            { type: "bold" },
          ],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Struck through",
            marks: [
              { type: "strike" },
              { type: "underline" },
              { type: "bold" },
            ],
          },
        ],
      }),
    );
  });

  it("strips a javascript: link and keeps the text", () => {
    const input = docOf({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Click me",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "paragraph",
        content: [{ type: "text", text: "Click me" }],
      }),
    );
  });

  it.each([
    ["a relative path", "/lighthouse"],
    ["a protocol-relative host", "//evil.test/lighthouse"],
    ["a mailto address", "mailto:keeper@example.test"],
    ["an inline data payload", "data:text/html,<script>alert(1)</script>"],
  ])("strips a link whose href is %s", (_label, href) => {
    const input = docOf({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Link",
          marks: [{ type: "link", attrs: { href } }],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({ type: "paragraph", content: [{ type: "text", text: "Link" }] }),
    );
  });

  it.each([["http://example.test/log"], ["https://example.test/log"]])(
    "keeps the link %s and forces rel on it",
    (href) => {
      const input = docOf({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Log",
            marks: [
              { type: "link", attrs: { href, target: "_blank", rel: "" } },
            ],
          },
        ],
      });

      expect(sanitized(input)).toEqual(
        docOf({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Log",
              marks: [
                { type: "link", attrs: { href, rel: "noopener noreferrer" } },
              ],
            },
          ],
        }),
      );
    },
  );

  it("removes an image whose src is a data: payload", () => {
    const input = docOf(
      {
        type: "image",
        attrs: { src: "data:image/svg+xml,<svg/>", caption: "Nobody" },
      },
      { type: "paragraph", content: [{ type: "text", text: "Kept" }] },
    );

    expect(sanitized(input)).toEqual(
      docOf({ type: "paragraph", content: [{ type: "text", text: "Kept" }] }),
    );
  });

  it("removes an image whose src is a relative path", () => {
    const input = docOf({
      type: "image",
      attrs: { src: "/uploads/lamp.jpg", caption: "Trinity House" },
    });

    expect(sanitized(input)).toEqual(docOf());
  });

  it("keeps an image without a caption, defaulting alt and caption to empty strings", () => {
    const result = sanitizeContent(
      docOf({ type: "image", attrs: { src: "https://example.test/lamp.jpg" } }),
    );

    expect(result).toEqual({
      ok: true,
      content: docOf({
        type: "image",
        attrs: { src: "https://example.test/lamp.jpg", alt: "", caption: "" },
      }),
    });
  });

  it("trims a caption that is only whitespace down to nothing", () => {
    const input = docOf({
      type: "image",
      attrs: { src: "https://example.test/lamp.jpg", caption: "   " },
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "image",
        attrs: { src: "https://example.test/lamp.jpg", alt: "", caption: "" },
      }),
    );
  });

  it("reads a stored credit as the caption when no caption is present", () => {
    const input = docOf({
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        credit: "Trinity House",
        alt: null,
      },
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "image",
        attrs: {
          src: "https://example.test/lamp.jpg",
          alt: "",
          caption: "Trinity House",
        },
      }),
    );
  });

  it("keeps a captioned image with its alt text and drops attrs it does not know", () => {
    const input = docOf({
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        alt: "The lamp",
        caption: "Trinity House",
        width: 800,
      },
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "image",
        attrs: {
          src: "https://example.test/lamp.jpg",
          alt: "The lamp",
          caption: "Trinity House",
        },
      }),
    );
  });

  it("drops attrs it does not understand", () => {
    const input = docOf(
      {
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [{ type: "text", text: "Centred" }],
      },
      {
        type: "orderedList",
        attrs: { start: 3, type: "a" },
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Third" }] },
            ],
          },
        ],
      },
    );

    expect(sanitized(input)).toEqual(
      docOf(
        { type: "paragraph", content: [{ type: "text", text: "Centred" }] },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Third" }],
                },
              ],
            },
          ],
        },
      ),
    );
  });

  it("coerces a heading level outside 1-6 to 1", () => {
    const input = docOf(
      {
        type: "heading",
        attrs: { level: 9 },
        content: [{ type: "text", text: "Too deep" }],
      },
      {
        type: "heading",
        attrs: {},
        content: [{ type: "text", text: "No level" }],
      },
    );

    expect(sanitized(input)).toEqual(
      docOf(
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Too deep" }],
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "No level" }],
        },
      ),
    );
  });

  it("drops empty text and leaves an emptied paragraph in Tiptap's shape", () => {
    const input = docOf({
      type: "paragraph",
      content: [{ type: "text", text: "" }],
    });

    expect(sanitized(input)).toEqual(docOf({ type: "paragraph" }));
  });

  it("removes a list left with no items", () => {
    const input = docOf(
      { type: "bulletList", content: [{ type: "tableRow" }] },
      { type: "paragraph", content: [{ type: "text", text: "Kept" }] },
    );

    expect(sanitized(input)).toEqual(
      docOf({ type: "paragraph", content: [{ type: "text", text: "Kept" }] }),
    );
  });

  it("keeps a list item that nests another list", () => {
    const input = docOf({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Oil" }] },
            {
              type: "orderedList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Paraffin" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(sanitized(input)).toEqual(input);
  });

  it("removes a heading nested inside a list item", () => {
    const input = docOf({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Not here" }],
            },
            { type: "paragraph", content: [{ type: "text", text: "Oil" }] },
          ],
        },
      ],
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Oil" }] },
            ],
          },
        ],
      }),
    );
  });

  it("produces schema-valid content even from unfriendly input", () => {
    const hostile = docOf(
      { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Tap",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
          { type: "hardBreak" },
        ],
      },
      { type: "image", attrs: { src: "//evil.test/x.png", caption: "Nobody" } },
    );

    expect(() => contentSchema.parse(sanitized(hostile))).not.toThrow();
  });
});

/** The same wrapper as `docOf`, typed for the reader rather than the sanitizer. */
function contentOf(...blocks: unknown[]): Content {
  return contentSchema.parse({ type: "doc", content: blocks });
}

/** One paragraph, which is what an Author who typed a sentence has. */
function sentence(text: string): Content {
  return contentOf({ type: "paragraph", content: [{ type: "text", text }] });
}

describe("contentSchema", () => {
  it("reads a stored image whose caption is still named credit", () => {
    const parsed = contentSchema.parse({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.test/lamp.jpg",
            credit: "Trinity House",
            alt: null,
          },
        },
      ],
    });

    expect(parsed.content[0]).toEqual({
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        alt: "",
        caption: "Trinity House",
      },
    });
  });

  it("reads an image with a caption and alt text unchanged", () => {
    const image = {
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        alt: "The lamp",
        caption: "Trinity House",
      },
    };

    expect(contentSchema.parse({ type: "doc", content: [image] })).toEqual({
      type: "doc",
      content: [image],
    });
  });

  it("prefers a present caption over a stale credit", () => {
    const parsed = contentSchema.parse({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.test/lamp.jpg",
            credit: "Old",
            caption: "New",
          },
        },
      ],
    });

    expect(parsed.content[0]).toEqual({
      type: "image",
      attrs: { src: "https://example.test/lamp.jpg", alt: "", caption: "New" },
    });
  });
});

describe("contentPreview", () => {
  it("reads the paragraphs, headings, and list items in document order", () => {
    // The whole of `cleanContent`, in the order it is written, with the image
    // contributing nothing: what an Author peeking at the box would read.
    expect(contentPreview(contentSchema.parse(cleanContent))).toBe(
      "The lamp room The wick is already trimmed. Never leave it unattended. Keep the light. The keeper Oil Climb the stair The keeper's log",
    );
  });

  it("collapses the whitespace inside and between blocks", () => {
    const content = contentOf(
      {
        type: "paragraph",
        content: [{ type: "text", text: "  The wick\n\n" }],
      },
      { type: "paragraph" },
      {
        type: "paragraph",
        content: [{ type: "text", text: "\tis   already trimmed.  " }],
      },
    );

    expect(contentPreview(content)).toBe("The wick is already trimmed.");
  });

  it("reads a line break as a space, so the words either side stay apart", () => {
    const content = contentOf({
      type: "paragraph",
      content: [
        { type: "text", text: "The lamp is lit." },
        { type: "hardBreak" },
        { type: "text", text: "The wind is west." },
      ],
    });

    expect(contentPreview(content)).toBe("The lamp is lit. The wind is west.");
  });

  it("has nothing to show for a Step whose content is only an image", () => {
    const content = contentOf({
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        alt: "The lamp",
        caption: "Trinity House",
      },
    });

    expect(contentPreview(content)).toBe("");
  });

  it("leaves content exactly the length of the limit whole", () => {
    const exact = "x".repeat(PREVIEW_LIMIT);

    expect(contentPreview(sentence(exact))).toBe(exact);
    expect(contentPreview(sentence(exact))).toHaveLength(PREVIEW_LIMIT);
  });

  it("cuts content one character past the limit and marks the cut", () => {
    const overLong = "x".repeat(PREVIEW_LIMIT + 1);

    expect(contentPreview(sentence(overLong))).toBe(
      `${"x".repeat(PREVIEW_LIMIT)}…`,
    );
    expect(contentPreview(sentence(overLong))).toHaveLength(PREVIEW_LIMIT + 1);
  });

  it("cuts at the limit it is given", () => {
    expect(contentPreview(sentence("The lamp room is dark"), 10)).toBe(
      "The lamp r…",
    );
  });
});

describe("textPreview", () => {
  it("collapses whitespace and leaves text within the limit whole", () => {
    expect(textPreview("  Goal:\n cross   the border. ", 160)).toBe(
      "Goal: cross the border.",
    );
  });

  it("cuts text past the limit and marks the cut, as contentPreview does", () => {
    expect(textPreview("The lamp room is dark", 10)).toBe("The lamp r…");
    expect(textPreview("x".repeat(160), 160)).toHaveLength(160);
    expect(textPreview("x".repeat(161), 160)).toBe(`${"x".repeat(160)}…`);
  });

  it("is empty for blank text", () => {
    expect(textPreview("   \n", 160)).toBe("");
  });
});

describe("isBlankContent", () => {
  it("is blank with no blocks at all, which is what a new Project holds", () => {
    expect(isBlankContent({ type: "doc", content: [] })).toBe(true);
  });

  it("is blank when every block is empty or whitespace", () => {
    expect(
      isBlankContent(
        contentOf(
          { type: "paragraph" },
          { type: "heading", attrs: { level: 2 } },
          {
            type: "paragraph",
            content: [{ type: "text", text: "   " }],
          },
          {
            type: "bulletList",
            content: [{ type: "listItem" }, { type: "listItem", content: [] }],
          },
          {
            type: "blockquote",
            content: [{ type: "paragraph", content: [{ type: "hardBreak" }] }],
          },
        ),
      ),
    ).toBe(true);
  });

  it("is not blank once a quote holds a word", () => {
    expect(
      isBlankContent(
        contentOf({
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Wick" }] },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("is not blank once there is a word anywhere, even inside a list", () => {
    expect(isBlankContent(sentence("Oil"))).toBe(false);
    expect(
      isBlankContent(
        contentOf({
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Wick" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("is not blank with an image, which has no words to preview", () => {
    expect(
      isBlankContent(
        contentOf({
          type: "image",
          attrs: { src: "https://example.com/a.png", alt: "", caption: "" },
        }),
      ),
    ).toBe(false);
  });
});

/**
 * Ticket 40 widened the contract additively: every document stored before
 * it — the three legacy cases the seed writes and the large fixture the
 * canvas specs use — must still parse, and the sanitizer must hand each
 * Step's content back exactly as it is, so no Draft changes on its next save
 * and no Published Version reads differently.
 */
describe("documents stored before ticket 40", () => {
  it.each([
    ["case 1", case1Document],
    ["case 2", case2Document],
    ["case 3", case3Document],
    ["the large fixture", largeJourney],
  ])("%s parses and every Step's content sanitizes unchanged", (_name, raw) => {
    const document = graphDocumentSchema.parse(raw);
    const steps = Object.values(document.steps);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(sanitized(step.content)).toEqual(step.content);
    }
  });
});

describe("readStoredImageAttrs", () => {
  it("falls back to credit as the caption when no caption is present", () => {
    const attrs = readStoredImageAttrs({
      src: "https://example.com/a.png",
      alt: "A photo",
      credit: "Photo by A. Photographer",
    });

    expect(attrs).toEqual({
      src: "https://example.com/a.png",
      alt: "A photo",
      caption: "Photo by A. Photographer",
    });
  });

  it("prefers caption over credit when both are present", () => {
    const attrs = readStoredImageAttrs({
      src: "https://example.com/a.png",
      caption: "New caption",
      credit: "Old credit",
    });

    expect(attrs.caption).toBe("New caption");
  });

  it("reads a non-string alt (the null documents before ticket 30 stored) as an empty string", () => {
    const attrs = readStoredImageAttrs({
      src: "https://example.com/a.png",
      alt: null,
    });

    expect(attrs.alt).toBe("");
  });

  it("reads attrs that are not a record as entirely absent", () => {
    expect(readStoredImageAttrs(null)).toEqual({
      src: undefined,
      alt: "",
      caption: "",
    });
  });
});
