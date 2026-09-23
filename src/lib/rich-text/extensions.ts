import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
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
 * paragraphs and line breaks, headings, quotes, bold, italic, underline,
 * strike, bullet and ordered lists, links, and an
 * image with alt text and a caption. Everything else StarterKit would bring is
 * switched off. `editorExtensions` additionally leaves undo/redo, the drop
 * cursor, and the gap cursor enabled — editing conveniences that emit no
 * content of their own, so the closed content set stays the same either way.
 */

/**
 * An image with its alt text and an optional caption, rendered as a figure
 * so the caption sits under the picture wherever the content shows. `alt` is
 * for assistive technology and is never displayed; the `<figcaption>` is
 * emitted only when there is a caption to show.
 *
 * `credit` is the caption's name in documents written before ticket 30. The
 * schema in `@/lib/graph/content` reads it as `caption` before anything
 * reaches these extensions, and the sanitizer never writes it back; it is
 * declared here only so a document that skipped the schema still shows its
 * caption instead of silently losing the attr.
 */
export const CaptionedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
      },
      caption: {
        default: "",
        // The caption is the figcaption, not an attribute of the <img>.
        renderHTML: () => ({}),
      },
      credit: {
        default: "",
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const caption = String(node.attrs.caption || node.attrs.credit || "");
    const img = [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        alt: String(node.attrs.alt ?? ""),
      }),
    ] as const;
    return caption.length > 0
      ? ["figure", {}, img, ["figcaption", {}, caption]]
      : ["figure", {}, img];
  },
});

/**
 * A quote that holds paragraphs and nothing else (ticket 40), the shape
 * `@/lib/graph/content` stores. StarterKit's quote holds any block, so a
 * heading, list, or second quote inside one would be dropped on save; with
 * this content rule the editor never makes one. Written here rather than
 * extended from `@tiptap/extension-blockquote`, which is only StarterKit's
 * dependency, not the app's; the commands and Mod-Shift-b are the same.
 */
export const ParagraphQuote = Node.create({
  name: "blockquote",
  group: "block",
  content: "paragraph+",
  defining: true,
  parseHTML() {
    return [{ tag: "blockquote" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["blockquote", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setBlockquote:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      toggleBlockquote:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
      unsetBlockquote:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-b": () => this.editor.commands.toggleBlockquote() };
  },
  addInputRules() {
    // "> " at the start of a paragraph quotes it, as in Tiptap's own.
    return [wrappingInputRule({ find: /^\s*>\s$/, type: this.type })];
  },
});

/**
 * The StarterKit options both extension sets share. `richTextExtensions`
 * additionally disables undo/redo, the drop cursor, and the gap cursor, since
 * the runner never edits.
 */
const sharedStarterKitOptions = {
  // StarterKit's own quote is swapped for `ParagraphQuote` below.
  blockquote: false,
  code: false,
  codeBlock: false,
  horizontalRule: false,
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
  ParagraphQuote,
  CaptionedImage,
];

export const editorExtensions = [
  StarterKit.configure({ ...sharedStarterKitOptions }),
  ParagraphQuote,
  CaptionedImage,
];

/**
 * What the Draft editor's own surface produces rich text with (ticket 23):
 * `editorExtensions` with Tiptap's undo/redo switched off, because the Draft
 * keeps one history over the whole document and a surface holding a second
 * one would take back its own last keystroke while the rest of the Draft
 * stood still. With it off, Cmd/Ctrl+Z inside the surface reaches the page's
 * listener like any other press.
 *
 * The Project description (ticket 07) keeps `editorExtensions`: its page has
 * no document history for the surface to join, so Tiptap's own is the undo
 * there is.
 */
export const draftEditorExtensions = [
  StarterKit.configure({ ...sharedStarterKitOptions, undoRedo: false }),
  ParagraphQuote,
  CaptionedImage,
];
