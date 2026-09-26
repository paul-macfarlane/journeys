import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import {
  Fragment,
  Slice,
  type Node as ProseMirrorNode,
  type NodeType,
} from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type Transaction,
} from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";

/** What the Image control writes onto an image. */
export type ImageAttrs = { src: string; alt: string; caption: string };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    captionedImage: {
      /**
       * Inserts an image in place of the selection, or directly after the
       * list or quote the selection sits in, since an image cannot live
       * inside either.
       */
      insertImage: (attrs: ImageAttrs) => ReturnType;
    };
  }
}

/**
 * The two Tiptap extension sets the app shares: `richTextExtensions` is what
 * the runner renders stored rich text with, and `editorExtensions` is what
 * the editor (ticket 08) produces rich text with, so the two can never
 * disagree about what a document holds. Deliberately no `server-only` — both
 * sides import this file.
 *
 * Both close over the same allowed set `@/lib/graph/content` describes:
 * paragraphs and line breaks, headings, quotes, bold, italic, underline,
 * strike, bullet and ordered lists, links, and an image with alt text and a
 * caption. Everything else StarterKit would bring is switched off. `editorExtensions` additionally leaves undo/redo, the drop
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
 *
 * Like `ParagraphQuote`, it sits in a group of its own that only
 * `QuoteDocument` admits (ticket 71): the stored shape gives a list item and
 * a quote paragraphs only, so an image the editor let into either vanished
 * at the next save. Inserted, pasted, or dropped there, it goes directly
 * after that list or quote instead (`replaceLiftingImages`).
 */
export const CaptionedImage = Image.extend({
  group: "figure",

  addCommands() {
    return {
      ...this.parent?.(),
      insertImage:
        (attrs) =>
        ({ state, tr, dispatch, commands }) => {
          const image = this.type.create(attrs);
          const { from, to } = state.selection;
          if (!dispatch) return true;
          return (
            replaceLiftingImages(
              tr,
              from,
              to,
              new Slice(Fragment.from(image), 0, 0),
              this.type,
            ) || commands.insertContent(image.toJSON())
          );
        },
    };
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey("liftImages"),
        props: {
          handlePaste(view, _event, slice) {
            const { from, to } = view.state.selection;
            const tr = view.state.tr;
            if (!replaceLiftingImages(tr, from, to, slice, type)) return false;
            view.dispatch(tr.scrollIntoView().setMeta("uiEvent", "paste"));
            return true;
          },
          handleDrop(view, event, slice, moved) {
            const target = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            if (!target) return false;
            const tr = view.state.tr;
            // A moved image leaves where it was, as ProseMirror's own drop
            // does; an unhandled drop discards this transaction.
            if (moved) tr.deleteSelection();
            const pos = tr.mapping.map(target.pos);
            if (!replaceLiftingImages(tr, pos, pos, slice, type)) return false;
            view.dispatch(tr.setMeta("uiEvent", "drop"));
            return true;
          },
        },
      }),
    ];
  },

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
 * Replaces `from`–`to` with `slice` when the range sits inside a list or a
 * quote and the slice carries an image (ticket 71): the rest of the slice
 * goes in where it was aimed and every image goes directly after that whole
 * list or quote, selected, so neither is split around it. Returns false,
 * touching nothing, for any other range or slice — ProseMirror's own fitting
 * is right there. Only lists and quotes nest a block, so "inside one" is a
 * depth past the document's own children.
 */
export function replaceLiftingImages(
  tr: Transaction,
  from: number,
  to: number,
  slice: Slice,
  imageType: NodeType,
): boolean {
  const $from = tr.doc.resolve(from);
  if ($from.depth <= 1) return false;
  const images: ProseMirrorNode[] = [];
  const rest = withoutImages(slice.content, imageType, images);
  if (images.length === 0) return false;

  const after = $from.after(1);
  // A side the slice closed only because an image stood there opens as far
  // as what is left allows, so pasted words join the item they land in; any
  // other side keeps the openness it had, within what is left.
  const most = Slice.maxOpen(rest);
  const openStart =
    slice.content.firstChild?.type === imageType
      ? most.openStart
      : Math.min(slice.openStart, most.openStart);
  const openEnd =
    slice.content.lastChild?.type === imageType
      ? most.openEnd
      : Math.min(slice.openEnd, most.openEnd);
  tr.replaceRange(from, to, new Slice(rest, openStart, openEnd));
  const $at = tr.doc.resolve(tr.mapping.map(after));
  const at = $at.depth === 0 ? $at.pos : $at.after(1);
  tr.insert(at, images);
  const last = images[images.length - 1];
  tr.setSelection(
    NodeSelection.create(
      tr.doc,
      at + Fragment.from(images).size - last.nodeSize,
    ),
  );
  return true;
}

/** `fragment` with every image taken out, at any depth, into `images`. */
function withoutImages(
  fragment: Fragment,
  imageType: NodeType,
  images: ProseMirrorNode[],
): Fragment {
  const kept: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    if (node.type === imageType) {
      images.push(node);
    } else {
      kept.push(
        node.isLeaf
          ? node
          : node.copy(withoutImages(node.content, imageType, images)),
      );
    }
  });
  return Fragment.fromArray(kept);
}

/**
 * A quote that holds paragraphs and nothing else (ticket 40), the shape
 * `@/lib/graph/content` stores. StarterKit's quote holds any block and sits
 * anywhere a block can — a list item among them — so a heading or list in a
 * quote, or a quote in a list, would lose its words on save. Here it holds
 * paragraphs, and it is in a group of its own that only `QuoteDocument`
 * admits, so the editor never makes either shape and a paste of one is
 * lifted into what fits. Written here rather than extended from
 * `@tiptap/extension-blockquote`, which is only StarterKit's dependency, not
 * the app's; the commands and Mod-Shift-b are the same.
 */
export const ParagraphQuote = Node.create({
  name: "blockquote",
  group: "quote",
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
    return {
      // Answered even where no quote can go, so the press never falls
      // through to Bold's Mod-b.
      "Mod-Shift-b": () => {
        this.editor.commands.toggleBlockquote();
        return true;
      },
    };
  },
  addInputRules() {
    // "> " at the start of a paragraph quotes it, as in Tiptap's own.
    return [wrappingInputRule({ find: /^\s*>\s$/, type: this.type })];
  },
});

/**
 * StarterKit's document, admitting a quote and an image beside the blocks at
 * its top.
 */
export const QuoteDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "(block|quote|figure)+",
});

/**
 * The StarterKit options both extension sets share. `richTextExtensions`
 * additionally disables undo/redo, the drop cursor, and the gap cursor, since
 * the runner never edits.
 */
const sharedStarterKitOptions = {
  // StarterKit's own document and quote are swapped for `QuoteDocument`
  // and `ParagraphQuote` below.
  document: false,
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
  QuoteDocument,
  ParagraphQuote,
  CaptionedImage,
];

export const editorExtensions = [
  StarterKit.configure({ ...sharedStarterKitOptions }),
  QuoteDocument,
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
  QuoteDocument,
  ParagraphQuote,
  CaptionedImage,
];
