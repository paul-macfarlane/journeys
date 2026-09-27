import { generateHTML } from "@tiptap/html";

import {
  readStoredImageAttrs,
  type Block,
  type Content,
  type InlineElement,
  type ListItem,
  type Paragraph,
} from "@/lib/graph/content";
import { richTextExtensions } from "@/lib/rich-text/extensions";

/**
 * Renders a Step's rich text with Tiptap's own renderer over the same
 * extension set the editor uses, so what an Author sees while writing is
 * what a participant reads.
 *
 * Content reaching this component was sanitized on write (`sanitizeContent`
 * in `@/lib/graph/content`): only http(s) URLs and the closed node/mark set
 * ever reach storage. `harden` applies the URL rule once more here, so a
 * document that reached storage some other way still cannot render a
 * `javascript:` link or a `data:` image. Text itself is escaped by Tiptap's
 * renderer, the way a browser would escape a text node.
 */

/**
 * The write-path sanitizer already limits link and image URLs to absolute
 * http(s) addresses; this is the same rule applied once more where the URL
 * becomes an attribute.
 */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** A link the rule refuses keeps its text and loses its mark. */
function hardenInline(
  elements: InlineElement[] | undefined,
): InlineElement[] | undefined {
  return elements?.map((element) =>
    element.type === "text"
      ? {
          ...element,
          marks: element.marks?.filter(
            (mark) => mark.type !== "link" || isHttpUrl(mark.attrs.href),
          ),
        }
      : element,
  );
}

function hardenListItem(item: ListItem): ListItem {
  return {
    ...item,
    content: item.content
      ?.map((child) => hardenBlock(child))
      .filter((child): child is NonNullable<typeof child> => child !== null),
  } as ListItem;
}

/**
 * The runner renders a Step's content one heading level below what it was
 * written at (ticket 78): H1 → `h2`, H2 → `h3`, H3 → `h4`. A Step's own
 * title is already the page's `h1` (`step-view.tsx`), so an H1 opening a
 * Step's content rendered a second one; shifting every heading down avoids
 * it without asking Authors to write one level higher than they mean.
 * Clamped to 6 — Tiptap's Heading recognizes no level past it
 * (`@/lib/rich-text/extensions`) — though the editor's toolbar only ever
 * writes 1–3.
 */
function shiftHeadingLevel(level: number): number {
  return Math.min(level + 1, 6);
}

/**
 * An image the rule refuses is dropped whole, caption included. One that
 * passes is read with the schema's own compatibility rule, in case a
 * Published Version written before ticket 30 (caption named `credit`, alt
 * `null`) reaches here without passing through the schema.
 */
function hardenBlock(block: Block): Block | null {
  switch (block.type) {
    case "paragraph":
      return { ...block, content: hardenInline(block.content) };
    case "heading":
      return {
        ...block,
        attrs: { level: shiftHeadingLevel(block.attrs.level) },
        content: hardenInline(block.content),
      };
    case "blockquote":
      return {
        ...block,
        content: block.content.map(
          (paragraph) => hardenBlock(paragraph) as Paragraph,
        ),
      };
    case "bulletList":
    case "orderedList":
      return { ...block, content: block.content.map(hardenListItem) };
    case "image": {
      if (!isHttpUrl(block.attrs.src)) {
        return null;
      }
      const { alt, caption } = readStoredImageAttrs(block.attrs);
      return { type: "image", attrs: { src: block.attrs.src, alt, caption } };
    }
  }
}

function harden(content: Content): Content {
  return {
    type: "doc",
    content: content.content
      .map(hardenBlock)
      .filter((block): block is Block => block !== null),
  };
}

export function RichText({ content }: { content: Content }) {
  // Tiptap's renderer runs on the server over a virtual DOM; the HTML it
  // returns comes from the closed extension set above and the hardened
  // document, never from a raw string an Author supplied.
  const html = generateHTML(harden(content), richTextExtensions);

  return (
    <div
      // `[&_img]` keeps a picture inside the reading column whatever its own
      // dimensions are, and `break-words` (inherited by every descendant)
      // breaks the long bare URLs image captions are full of — without both, a
      // phone scrolls sideways to reach the text. A quote is set off by a
      // rule in the Theme's muted colour and stays upright, so an Author's
      // own italics inside it still read as emphasis.
      // No `[&_h1]`: every stored heading is shifted down at least one
      // level (`shiftHeadingLevel` above), so the top level this renders is
      // `h2` — a Step's title is the page's own `h1`. The size ladder shifts
      // with it — what an Author wrote as an H1 now sits on an `h2` tag, so
      // it takes the size the `h2` tag read at before this change, and so on
      // down to the new `[&_h4]` for what was an H3.
      className="flex flex-col gap-4 break-words [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:not-italic [&_blockquote>*+*]:mt-4 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
