import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Content } from "@/lib/graph/content";

import { RichText } from "./rich-text";

/**
 * Seam A for ticket 05: the closed `Content` type rendered to markup with no
 * `dangerouslySetInnerHTML`. Every case below is a document
 * `sanitizeContent` could have produced, so nothing here needs to exercise
 * the sanitizer itself. Expected substrings are written out, not derived the
 * way the renderer derives them.
 */
describe("RichText", () => {
  it("renders a paragraph with bold, italic, and link marks, and escapes text", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Plain " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "<script>",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com",
                    rel: "noopener noreferrer",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders a heading at its level", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<h3");
    expect(html).toContain("Section</h3>");
  });

  it("renders a bullet list with two items", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<ul");
    expect((html.match(/<li/g) ?? []).length).toBe(2);
    expect(html).toContain("First");
    expect(html).toContain("Second");
  });

  it("renders an ordered list with its start attribute", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 5 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Fifth" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<ol");
    expect(html).toContain('start="5"');
  });

  it("renders an image with its credit in a figcaption", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.com/photo.jpg",
            credit: "Photo by Jane Doe",
            alt: "A queue at a border post",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<figure");
    expect(html).toContain('src="https://example.com/photo.jpg"');
    expect(html).toContain('alt="A queue at a border post"');
    expect(html).toContain("<figcaption");
    expect(html).toContain("Photo by Jane Doe");
  });
});
