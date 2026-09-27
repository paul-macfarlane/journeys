import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { isBlankContent, type Content } from "@/lib/graph/content";

/**
 * A placeholder shown over the first block — whatever block that is — while
 * the Step content editor's document is empty (ticket 57), and named to
 * assistive technology as `aria-placeholder` for exactly as long. A
 * decoration and an attribute only: it never touches the document, so it
 * can never appear in `editor.getJSON()` or reach the stored shape.
 *
 * `isBlankContent` is the same "shows nothing at all" check
 * `@/lib/graph/content` already makes of a stored document, read here off
 * the live ProseMirror doc's own JSON so the two can never disagree about
 * what counts as empty. It is worked out in the plugin's state, once per
 * transaction that changes the document, rather than on every redraw.
 */
export interface PlaceholderOptions {
  placeholder: string;
}

/** Whether the document is blank, as last worked out. */
export type PlaceholderState = { blank: boolean };

export const placeholderKey = new PluginKey<PlaceholderState>("placeholder");

function blankness(doc: ProseMirrorNode): PlaceholderState {
  return { blank: isBlankContent(doc.toJSON() as Content) };
}

export const Placeholder = Extension.create<PlaceholderOptions>({
  name: "placeholder",

  addOptions() {
    return { placeholder: "" };
  },

  addProseMirrorPlugins() {
    const { placeholder } = this.options;
    if (placeholder === "") return [];

    return [
      new Plugin<PlaceholderState>({
        key: placeholderKey,
        state: {
          init: (_config, state) => blankness(state.doc),
          // Kept as it was — the same object — unless the document moved.
          apply: (tr, value) => (tr.docChanged ? blankness(tr.doc) : value),
        },
        props: {
          attributes(state): Record<string, string> {
            return placeholderKey.getState(state)?.blank
              ? { "aria-placeholder": placeholder }
              : {};
          },
          decorations(state) {
            if (!placeholderKey.getState(state)?.blank) return null;

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
