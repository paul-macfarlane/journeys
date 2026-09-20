import { describe, expect, it } from "vitest";

import { contentSchema, sanitizeContent } from "@/lib/graph/content";

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
        credit: "Trinity House",
        alt: null,
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

  it("removes a blockquote block together with everything inside it", () => {
    const input = docOf(
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hidden quote" }],
          },
        ],
      },
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

  it("removes a hardBreak from inside a paragraph and keeps the text", () => {
    const input = docOf({
      type: "paragraph",
      content: [
        { type: "text", text: "Before" },
        { type: "hardBreak" },
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

  it("drops strike, underline, and code marks but keeps the text", () => {
    const input = docOf({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Struck through",
          marks: [
            { type: "strike" },
            { type: "underline" },
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
          { type: "text", text: "Struck through", marks: [{ type: "bold" }] },
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
        attrs: { src: "data:image/svg+xml,<svg/>", credit: "Nobody" },
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
      attrs: { src: "/uploads/lamp.jpg", credit: "Trinity House" },
    });

    expect(sanitized(input)).toEqual(docOf());
  });

  it("refuses the whole write when an image has no credit", () => {
    const result = sanitizeContent(
      docOf({ type: "image", attrs: { src: "https://example.test/lamp.jpg" } }),
    );

    expect(result).toEqual({ ok: false, error: "Every image needs a credit" });
  });

  it("refuses the whole write when an image credit is only whitespace", () => {
    const result = sanitizeContent(
      docOf({
        type: "image",
        attrs: { src: "https://example.test/lamp.jpg", credit: "   " },
      }),
    );

    expect(result).toEqual({ ok: false, error: "Every image needs a credit" });
  });

  it("keeps a credited image and normalises a missing alt to null", () => {
    const input = docOf({
      type: "image",
      attrs: {
        src: "https://example.test/lamp.jpg",
        credit: "Trinity House",
        width: 800,
      },
    });

    expect(sanitized(input)).toEqual(
      docOf({
        type: "image",
        attrs: {
          src: "https://example.test/lamp.jpg",
          credit: "Trinity House",
          alt: null,
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
      { type: "image", attrs: { src: "//evil.test/x.png", credit: "Nobody" } },
    );

    expect(() => contentSchema.parse(sanitized(hostile))).not.toThrow();
  });
});
