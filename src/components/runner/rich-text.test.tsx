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

  it("renders underline, strike, a line break, and a quote (ticket 40)", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "under", marks: [{ type: "underline" }] },
            { type: "text", text: "struck", marks: [{ type: "strike" }] },
            { type: "hardBreak" },
            { type: "text", text: "next line" },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Keep the light." }],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);

    expect(html).toContain("<u>under</u>");
    expect(html).toContain("<s>struck</s>");
    expect(html).toContain("<br>next line");
    expect(html).toContain("<blockquote><p>Keep the light.</p></blockquote>");
  });

  it("renders H1 then H3 as h2 then h3, never skipping a level (ticket 92)", () => {
    // A Step's own title is already the page's h1, so an H1 opening a
    // Step's content would render a second one — the runner renders it as
    // h2 instead. The one-level fixed shift this replaced would have then
    // rendered the H3 as h4, an axe heading-order violation since nothing
    // renders the h3 in between; the later heading now goes no deeper than
    // one level past the one before it.
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Opening" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<h2");
    expect(html).toContain("Opening</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain("Section</h3>");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h4");
  });

  it("renders H2 then H3 as h2 then h3, with no h1 (ticket 92)", () => {
    // Content opening with an H2 previously rendered h3-then-h4 under the
    // fixed one-level shift — a heading-order violation, since nothing
    // rendered the h2 in between. The first heading now renders as h2
    // whatever level it was written at.
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Opening" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<h2");
    expect(html).toContain("Opening</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain("Section</h3>");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h4");
  });

  it("renders content opening with H3 as h2 (ticket 92)", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Opening" }],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<h2");
    expect(html).toContain("Opening</h2>");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h3");
  });

  it("renders H3 then H1 as h2 then h2 (ticket 92)", () => {
    // A later heading written shallower than the first never renders above
    // h2, the floor a Step's own h1 leaves it.
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Opening" }],
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect((html.match(/<h2/g) ?? []).length).toBe(2);
    expect(html).toContain("Opening</h2>");
    expect(html).toContain("Section</h2>");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h3");
  });

  it("never renders a heading more than one level deeper than the last, up to h6 (ticket 92)", () => {
    // Written levels 1 through 6 climb one rendered level at a time —
    // h2, h3, h4, h5, h6 — and a heading written deeper still stays at h6,
    // the level Tiptap's Heading stops recognizing past
    // (`@/lib/rich-text/extensions`).
    const content: Content = {
      type: "doc",
      content: [1, 2, 3, 4, 5, 6].map((level) => ({
        type: "heading" as const,
        attrs: { level },
        content: [{ type: "text" as const, text: `Level ${level}` }],
      })),
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<h2");
    expect(html).toContain("Level 1</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain("Level 2</h3>");
    expect(html).toContain("<h4");
    expect(html).toContain("Level 3</h4>");
    expect(html).toContain("<h5");
    expect(html).toContain("Level 4</h5>");
    expect((html.match(/<h6/g) ?? []).length).toBe(2);
    expect(html).toContain("Level 5</h6>");
    expect(html).toContain("Level 6</h6>");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h7");
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

  it("renders an image with its alt text and its caption in a figcaption", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.com/photo.jpg",
            alt: "A queue at a border post",
            caption: "Photo by Jane Doe",
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

  it("omits the figcaption when the caption is empty, and still emits alt", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.com/photo.jpg",
            alt: "",
            caption: "",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<figure");
    expect(html).toContain('alt=""');
    expect(html).not.toContain("<figcaption");
  });

  it("reads a Published Version's image whose caption is still named credit", () => {
    // Published Versions are immutable, so a document written before ticket
    // 30 reaches the renderer with the old name whenever it bypasses the
    // schema's own compatibility read.
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.com/photo.jpg",
            credit: "Photo by Jane Doe",
            alt: null,
          },
        },
      ],
    } as unknown as Content;

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("<figcaption");
    expect(html).toContain("Photo by Jane Doe");
    expect(html).toContain('alt=""');
  });

  it("keeps the text but not the anchor of a link whose URL is not http(s), and drops such an image", () => {
    const content: Content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click me",
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
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,AAAA",
            alt: "",
            caption: "Nobody",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<RichText content={content} />);
    expect(html).toContain("click me");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Nobody");
  });
});
