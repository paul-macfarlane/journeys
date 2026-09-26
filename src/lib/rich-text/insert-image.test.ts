// @vitest-environment happy-dom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { editorExtensions } from "./extensions";

/**
 * The Image control's insertion (ticket 71): an image cannot live in a list
 * item or a quote, so with the cursor in one it goes directly after that
 * list or quote, whole, rather than splitting it at the cursor.
 */
const attrs = { src: "https://example.com/a.png", alt: "A key", caption: "" };
const figure =
  '<figure><img src="https://example.com/a.png" alt="A key"></figure>';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function insertAt(html: string, word: string) {
  editor = new Editor({ extensions: editorExtensions, content: html });
  let pos = -1;
  editor.state.doc.descendants((node, at) => {
    if (node.isText && node.text === word) {
      pos = at + 1;
    }
  });
  expect(pos).toBeGreaterThan(0);
  editor.commands.setTextSelection(pos);
  expect(editor.commands.insertImage(attrs)).toBe(true);
  return editor.getHTML();
}

describe("insertImage", () => {
  it("places the image after a bullet list, leaving the list whole", () => {
    expect(
      insertAt(
        "<ul><li><p>one</p></li><li><p>two</p></li></ul><p>after</p>",
        "one",
      ),
    ).toBe(
      `<ul><li><p>one</p></li><li><p>two</p></li></ul>${figure}<p>after</p>`,
    );
  });

  it("places the image after a numbered list from a nested item", () => {
    expect(
      insertAt(
        "<ol><li><p>one</p><ul><li><p>nested</p></li></ul></li></ol>",
        "nested",
      ),
    ).toBe(
      `<ol><li><p>one</p><ul><li><p>nested</p></li></ul></li></ol>${figure}`,
    );
  });

  it("places the image after a quote", () => {
    expect(insertAt("<blockquote><p>said</p></blockquote>", "said")).toBe(
      `<blockquote><p>said</p></blockquote>${figure}`,
    );
  });

  it("inserts at the cursor in a top-level paragraph, as before", () => {
    expect(insertAt("<p>one</p><p>two</p>", "two")).toBe(
      `<p>one</p><p>t</p>${figure}<p>wo</p>`,
    );
  });
});
