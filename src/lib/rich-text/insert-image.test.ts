// @vitest-environment happy-dom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorExtensions } from "./extensions";

/**
 * Every way an image goes in (ticket 71): an image cannot live in a list
 * item or a quote, so aimed at one it goes directly after that list or
 * quote, whole, rather than splitting it where it was aimed. The Image
 * control, a paste, and a drop all place it the same way.
 */
const attrs = { src: "https://example.com/a.png", alt: "A key", caption: "" };
const figure =
  '<figure><img src="https://example.com/a.png" alt="A key"></figure>';
const imageHtml = '<img src="https://example.com/a.png" alt="A key">';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** An editor on `html` with the cursor inside `word`, after its first letter. */
function editorAt(html: string, word: string): Editor {
  editor = new Editor({ extensions: editorExtensions, content: html });
  const pos = positionOf(editor, word);
  editor.commands.setTextSelection(pos);
  return editor;
}

function positionOf(instance: Editor, word: string): number {
  let pos = -1;
  instance.state.doc.descendants((node, at) => {
    if (node.isText && node.text === word) {
      pos = at + 1;
    }
  });
  expect(pos).toBeGreaterThan(0);
  return pos;
}

function insertAt(html: string, word: string): string {
  const instance = editorAt(html, word);
  expect(instance.commands.insertImage(attrs)).toBe(true);
  return instance.getHTML();
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

  it("replaces selected text in a list item, as it does at the top", () => {
    const instance = editorAt("<ul><li><p>one</p></li></ul>", "one");
    // "ne" selected.
    const from = positionOf(instance, "one");
    instance.commands.setTextSelection({ from, to: from + 2 });
    expect(instance.commands.insertImage(attrs)).toBe(true);
    expect(instance.getHTML()).toBe(`<ul><li><p>o</p></li></ul>${figure}`);
  });

  it("inserts at the cursor in a top-level paragraph, as before", () => {
    expect(insertAt("<p>one</p><p>two</p>", "two")).toBe(
      `<p>one</p><p>t</p>${figure}<p>wo</p>`,
    );
  });
});

describe("pasting an image", () => {
  it("places a pasted image after the list the cursor is in", () => {
    const instance = editorAt(
      "<ul><li><p>one</p></li><li><p>two</p></li></ul>",
      "one",
    );
    instance.view.pasteHTML(imageHtml);
    expect(instance.getHTML()).toBe(
      `<ul><li><p>one</p></li><li><p>two</p></li></ul>${figure}`,
    );
  });

  it("keeps a pasted list item's words where they land and lifts its image", () => {
    const instance = editorAt("<ul><li><p>one</p></li></ul>", "one");
    instance.view.pasteHTML(`<ul><li>text${imageHtml}</li></ul>`);
    expect(instance.getHTML()).toBe(
      `<ul><li><p>otextne</p></li></ul>${figure}`,
    );
  });

  it("places a pasted image after the quote the cursor is in", () => {
    const instance = editorAt("<blockquote><p>said</p></blockquote>", "said");
    instance.view.pasteHTML(imageHtml);
    expect(instance.getHTML()).toBe(
      `<blockquote><p>said</p></blockquote>${figure}`,
    );
  });
});

describe("dropping an image", () => {
  it("places an image dropped on a list item after the list", () => {
    const instance = editorAt(
      `<p>top</p>${figure}<ul><li><p>one</p></li><li><p>two</p></li></ul>`,
      "top",
    );
    // The figure is moved: selected, dragged, and dropped inside "two".
    let imagePos = -1;
    instance.state.doc.forEach((node, offset) => {
      if (node.type.name === "image") imagePos = offset;
    });
    instance.commands.setNodeSelection(imagePos);
    const slice = instance.state.selection.content();
    const target = positionOf(instance, "two");
    vi.spyOn(instance.view, "posAtCoords").mockReturnValue({
      pos: target,
      inside: -1,
    });

    const handled = instance.view.someProp("handleDrop", (handleDrop) =>
      handleDrop(
        instance.view,
        new window.DragEvent("drop", {
          clientX: 1,
          clientY: 1,
        }) as unknown as DragEvent,
        slice,
        true,
      ),
    );

    expect(handled).toBe(true);
    expect(instance.getHTML()).toBe(
      `<p>top</p><ul><li><p>one</p></li><li><p>two</p></li></ul>${figure}`,
    );
  });
});
