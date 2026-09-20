import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

/**
 * The one Tiptap extension set the whole app shares: the runner renders
 * stored rich text with it, and the editor (ticket 08) will produce rich
 * text with it, so the two can never disagree about what a document holds.
 * Deliberately no `server-only` — both sides import it.
 *
 * The set is the closed one `@/lib/graph/content` describes: paragraph,
 * headings, bold, italic, bullet and ordered lists, links, and an image with
 * a required credit. Everything else StarterKit would bring is switched off.
 */

/**
 * An image with the credit line every image must carry, rendered as a
 * figure so the credit sits under the picture wherever the content shows.
 */
export const CreditedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      credit: {
        default: "",
        // The credit is a caption, not an attribute of the <img>.
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "figure",
      {},
      ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)],
      ["figcaption", {}, String(node.attrs.credit ?? "")],
    ];
  },
});

export const richTextExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    hardBreak: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    dropcursor: false,
    gapcursor: false,
    undoRedo: false,
    listKeymap: false,
    trailingNode: false,
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    },
  }),
  CreditedImage,
];
