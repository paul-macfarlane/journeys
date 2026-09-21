import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

/**
 * The two Tiptap extension sets the app shares: `richTextExtensions` is what
 * the runner renders stored rich text with, and `editorExtensions` is what
 * the editor (ticket 08) produces rich text with, so the two can never
 * disagree about what a document holds. Deliberately no `server-only` — both
 * sides import this file.
 *
 * Both close over the same allowed set `@/lib/graph/content` describes:
 * paragraph, headings, bold, italic, bullet and ordered lists, links, and an
 * image with a required credit. Everything else StarterKit would bring is
 * switched off. `editorExtensions` additionally leaves undo/redo, the drop
 * cursor, and the gap cursor enabled — editing conveniences that emit no
 * content of their own, so the closed content set stays the same either way.
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

/**
 * The StarterKit options both extension sets share. `richTextExtensions`
 * additionally disables undo/redo, the drop cursor, and the gap cursor, since
 * the runner never edits.
 */
const sharedStarterKitOptions = {
  blockquote: false,
  code: false,
  codeBlock: false,
  hardBreak: false,
  horizontalRule: false,
  strike: false,
  underline: false,
  listKeymap: false,
  trailingNode: false,
  link: {
    openOnClick: false,
    HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
  },
} as const;

export const richTextExtensions = [
  StarterKit.configure({
    ...sharedStarterKitOptions,
    dropcursor: false,
    gapcursor: false,
    undoRedo: false,
  }),
  CreditedImage,
];

export const editorExtensions = [
  StarterKit.configure({ ...sharedStarterKitOptions }),
  CreditedImage,
];
