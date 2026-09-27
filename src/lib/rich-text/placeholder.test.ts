// @vitest-environment happy-dom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { editorExtensions } from "./extensions";
import { Placeholder, placeholderKey } from "./placeholder";

/**
 * The Step content editor's placeholder (ticket 57): a decoration on the
 * first block while the document is empty, never a change to the document
 * itself — an Author must never find a stored Step carrying the hint's own
 * words, and a screen reader must still be told what the hint says.
 */

const PLACEHOLDER_TEXT = "Write what the participant reads…";
const emptyDoc: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function editorWith(
  placeholder?: string,
  content: JSONContent = emptyDoc,
): Editor {
  editor = new Editor({
    extensions: [
      ...editorExtensions,
      ...(placeholder !== undefined
        ? [Placeholder.configure({ placeholder })]
        : []),
    ],
    content,
  });
  return editor;
}

describe("Placeholder", () => {
  it("never appears in getJSON on an empty document", () => {
    const instance = editorWith(PLACEHOLDER_TEXT);
    expect(instance.getJSON()).toEqual(emptyDoc);
  });

  it("leaves the serialized HTML of an empty document unchanged", () => {
    const withPlaceholder = editorWith(PLACEHOLDER_TEXT);
    const html = withPlaceholder.getHTML();
    withPlaceholder.destroy();

    const withoutPlaceholder = editorWith(undefined);
    expect(withoutPlaceholder.getHTML()).toBe(html);
  });

  it("decorates the first block with the placeholder while the doc is empty", () => {
    const instance = editorWith(PLACEHOLDER_TEXT);
    const first = instance.view.dom.querySelector("p");
    expect(first).not.toBeNull();
    expect(first!.classList.contains("is-empty")).toBe(true);
    expect(first!.getAttribute("data-placeholder")).toBe(PLACEHOLDER_TEXT);
  });

  it("drops the decoration once the Author types", () => {
    const instance = editorWith(PLACEHOLDER_TEXT);
    instance.commands.insertContent("Something");
    const first = instance.view.dom.querySelector("p");
    expect(first!.classList.contains("is-empty")).toBe(false);
    expect(first!.hasAttribute("data-placeholder")).toBe(false);
  });

  it("carries no decoration at all without the extension configured", () => {
    const instance = editorWith(undefined);
    const first = instance.view.dom.querySelector("p");
    expect(first!.classList.contains("is-empty")).toBe(false);
  });
});

describe("Placeholder over a first block that is not a paragraph", () => {
  it("decorates a blank heading that opens the document", () => {
    const instance = editorWith(PLACEHOLDER_TEXT, {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 } }],
    });
    const first = instance.view.dom.firstElementChild;
    expect(first?.tagName).toBe("H2");
    expect(first?.classList.contains("is-empty")).toBe(true);
    expect(first?.getAttribute("data-placeholder")).toBe(PLACEHOLDER_TEXT);
  });

  it("decorates a blank list that opens the document", () => {
    const instance = editorWith(PLACEHOLDER_TEXT, {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
        },
      ],
    });
    const first = instance.view.dom.firstElementChild;
    expect(first?.tagName).toBe("UL");
    expect(first?.classList.contains("is-empty")).toBe(true);
  });
});

describe("Placeholder's aria-placeholder", () => {
  it("names the hint only while the document is blank", () => {
    const instance = editorWith(PLACEHOLDER_TEXT);
    expect(instance.view.dom.getAttribute("aria-placeholder")).toBe(
      PLACEHOLDER_TEXT,
    );

    instance.commands.insertContent("Something");
    expect(instance.view.dom.hasAttribute("aria-placeholder")).toBe(false);

    instance.commands.clearContent();
    expect(instance.view.dom.getAttribute("aria-placeholder")).toBe(
      PLACEHOLDER_TEXT,
    );
  });

  it("is never set without the extension configured", () => {
    const instance = editorWith(undefined);
    expect(instance.view.dom.hasAttribute("aria-placeholder")).toBe(false);
  });
});

describe("Placeholder's blankness", () => {
  it("is worked out again only when a transaction changes the document", () => {
    const instance = editorWith(PLACEHOLDER_TEXT);
    const before = placeholderKey.getState(instance.state);
    expect(before).toEqual({ blank: true });

    // A selection move changes nothing the placeholder reads.
    instance.commands.setTextSelection(1);
    expect(placeholderKey.getState(instance.state)).toBe(before);

    instance.commands.insertContent("Something");
    expect(placeholderKey.getState(instance.state)).toEqual({ blank: false });
  });
});
