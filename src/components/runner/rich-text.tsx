import { generateHTML } from "@tiptap/html";

import type {
  Block,
  Content,
  ListItem,
  TextElement,
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
function hardenInline(elements: TextElement[] | undefined) {
  return elements?.map((element) => ({
    ...element,
    marks: element.marks?.filter(
      (mark) => mark.type !== "link" || isHttpUrl(mark.attrs.href),
    ),
  }));
}

function hardenListItem(item: ListItem): ListItem {
  return {
    ...item,
    content: item.content
      ?.map((child) => hardenBlock(child))
      .filter((child): child is NonNullable<typeof child> => child !== null),
  } as ListItem;
}

/** An image the rule refuses is dropped whole, credit included. */
function hardenBlock(block: Block): Block | null {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return { ...block, content: hardenInline(block.content) };
    case "bulletList":
    case "orderedList":
      return { ...block, content: block.content.map(hardenListItem) };
    case "image":
      return isHttpUrl(block.attrs.src) ? block : null;
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
      className="flex flex-col gap-4 [&_a]:underline [&_a]:underline-offset-4 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
