import { generateHTML } from "@tiptap/html";

import {
  readStoredImageAttrs,
  type Block,
  type BulletList,
  type Content,
  type InlineElement,
  type ListItem,
  type OrderedList,
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

function hardenParagraph(paragraph: Paragraph): Paragraph {
  return { ...paragraph, content: hardenInline(paragraph.content) };
}

/** A list, and every list nested in its items: paragraphs and lists only. */
function hardenList<List extends BulletList | OrderedList>(list: List): List {
  return {
    ...list,
    content: list.content.map((item): ListItem => ({
      ...item,
      content: item.content?.map((child) =>
        child.type === "paragraph" ? hardenParagraph(child) : hardenList(child),
      ),
    })),
  };
}

/**
 * The runner never renders a stored heading directly (ticket 78, revised by
 * ticket 92): a Step's own title is already the page's `h1`
 * (`step-view.tsx`), so an H1 opening a Step's content would render a
 * second one. Rather than shifting every heading down by a fixed one level
 * — which turned an H2-then-H3 document into `h3`-then-`h4`, an
 * axe `heading-order` violation, since nothing renders the `h2` in between —
 * headings are normalised in document order relative to one another:
 *
 * - the first heading renders as `h2`, whatever level it was written at;
 * - each later heading renders at its written level's distance from the
 *   first, but never more than one level deeper than the previous rendered
 *   heading, and never above `h2`.
 *
 * Headings are only ever top-level blocks in the stored shape — a quote
 * holds paragraphs only, and a list item paragraphs and nested lists, never
 * a heading — so this only needs to see the top level's headings in order;
 * `state` carries that order across the top-level blocks. Clamped to 6 —
 * Tiptap's Heading recognizes no level past it (`@/lib/rich-text/extensions`)
 * — though the editor's toolbar only ever writes 1–3.
 */
type HeadingState = { firstWritten: number | null; previousRendered: number };

function normalizeHeadingLevel(level: number, state: HeadingState): number {
  if (state.firstWritten === null) {
    state.firstWritten = level;
  }
  const distanceFromFirst = level - state.firstWritten + 2;
  const rendered = Math.min(
    Math.max(distanceFromFirst, 2),
    state.previousRendered + 1,
    6,
  );
  state.previousRendered = rendered;
  return rendered;
}

/**
 * An image the rule refuses is dropped whole, caption included. One that
 * passes is read with the schema's own compatibility rule, in case a
 * Published Version written before ticket 30 (caption named `credit`, alt
 * `null`) reaches here without passing through the schema.
 */
function hardenBlock(block: Block, state: HeadingState): Block | null {
  switch (block.type) {
    case "paragraph":
      return hardenParagraph(block);
    case "heading":
      return {
        ...block,
        attrs: { level: normalizeHeadingLevel(block.attrs.level, state) },
        content: hardenInline(block.content),
      };
    case "blockquote":
      return {
        ...block,
        content: block.content.map(hardenParagraph),
      };
    case "bulletList":
    case "orderedList":
      return hardenList(block);
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
  const state: HeadingState = { firstWritten: null, previousRendered: 1 };
  return {
    type: "doc",
    content: content.content
      .map((block) => hardenBlock(block, state))
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
      // No `[&_h1]`: the first stored heading always renders as `h2`
      // (`normalizeHeadingLevel` above) — a Step's title is the page's own
      // `h1`. Later headings render no more than one level deeper than the
      // one before them, so a document can still reach `h5`/`h6` a few
      // headings in; the size ladder covers that full range, shrinking one
      // step per level down to `[&_h6]`.
      className="flex flex-col gap-4 break-words [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:not-italic [&_blockquote>*+*]:mt-4 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:text-sm [&_h6]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
