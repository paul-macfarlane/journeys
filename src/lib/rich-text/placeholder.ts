import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { isBlankContent, type Content } from "@/lib/graph/content";

/**
 * A placeholder shown over the first block while the Step content editor's
 * document is empty (ticket 57). A decoration only: it never touches the
 * document, so it can never appear in `editor.getJSON()` or reach the
 * stored shape. `isBlankContent` is the same "shows nothing at all" check
 * `@/lib/graph/content` already makes of a stored document, read here off
 * the live ProseMirror doc's own JSON so the two can never disagree about
 * what counts as empty.
 */
export interface PlaceholderOptions {
  placeholder: string;
}

export const Placeholder = Extension.create<PlaceholderOptions>({
  name: "placeholder",

  addOptions() {
    return { placeholder: "" };
  },

  addProseMirrorPlugins() {
    const { placeholder } = this.options;

    return [
      new Plugin({
        key: new PluginKey("placeholder"),
        props: {
          decorations(state) {
            if (placeholder === "") return null;
            if (!isBlankContent(state.doc.toJSON() as Content)) return null;

            const first = state.doc.firstChild;
            if (!first) return null;

            return DecorationSet.create(state.doc, [
              Decoration.node(0, first.nodeSize, {
                class: "is-empty",
                "data-placeholder": placeholder,
              }),
            ]);
          },
        },
      }),
    ];
  },
});
