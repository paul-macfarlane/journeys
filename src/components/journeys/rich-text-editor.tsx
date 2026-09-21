"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeContent, type Content } from "@/lib/graph/content";
import { editorExtensions } from "@/lib/rich-text/extensions";

/**
 * The Step's rich text, and the small toolbar that shapes it: headings, bold,
 * italic, the two lists, links, and an image that must carry a credit.
 *
 * What the Author types goes through `sanitizeContent` before it leaves this
 * component, so the Draft in client state already holds the stored shape and
 * the server's own sanitize on write is a no-op rather than a second opinion.
 * The sanitized content is never fed back into the editor while the Author is
 * typing — only a change of Step replaces what is on screen.
 */

/** Both URL fields take the same absolute addresses the sanitizer keeps. */
const URL_HINT = "Start the address with http:// or https://";

const EDITOR_CLASS =
  "min-h-64 px-4 py-3 outline-none [&>*+*]:mt-4 [&_a]:underline [&_a]:underline-offset-4 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * `onMouseDown` is swallowed so the Author's selection survives the click:
 * without it the browser moves focus out of the editor first and the toggle
 * lands on nothing.
 */
function ToolbarButton({
  label,
  text,
  pressed,
  onClick,
}: {
  label: string;
  text: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {text}
    </Button>
  );
}

export function RichTextEditor({
  stepId,
  content,
  onChange,
  onRefused,
}: {
  stepId: string;
  content: Content;
  onChange: (content: Content) => void;
  onRefused: (error: string) => void;
}) {
  // The editor is created once and lives as long as the panel does, so its
  // callbacks read the current ones out of a ref rather than closing over the
  // first render's.
  const handlers = useRef({ onChange, onRefused });
  useEffect(() => {
    handlers.current = { onChange, onRefused };
  }, [onChange, onRefused]);

  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const editor = useEditor({
    extensions: editorExtensions,
    content,
    // The panel is server-rendered by Next; rendering the editor immediately
    // would produce markup the client then disagrees with.
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": "Step content", class: EDITOR_CLASS },
    },
    onUpdate: ({ editor: instance }) => {
      const sanitized = sanitizeContent(instance.getJSON());
      if (!sanitized.ok) {
        handlers.current.onRefused(sanitized.error);
        return;
      }
      handlers.current.onChange(sanitized.content);
    },
  });

  // Only a change of Step replaces what is in the editor, and it does so
  // without reporting an update: this is the Draft speaking, not the Author.
  useEffect(() => {
    editor?.commands.setContent(contentRef.current, { emitUpdate: false });
  }, [editor, stepId]);

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      heading1: instance?.isActive("heading", { level: 1 }) ?? false,
      heading2: instance?.isActive("heading", { level: 2 }) ?? false,
      heading3: instance?.isActive("heading", { level: 3 }) ?? false,
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      bulletList: instance?.isActive("bulletList") ?? false,
      orderedList: instance?.isActive("orderedList") ?? false,
      link: instance?.isActive("link") ?? false,
      image: instance?.isActive("image") ?? false,
    }),
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageCredit, setImageCredit] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);

  function openLink() {
    if (!editor) return;
    setLinkUrl(String(editor.getAttributes("link").href ?? ""));
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;

    const href = linkUrl.trim();
    // An emptied URL is how an Author takes a link off again.
    if (href.length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isHttpUrl(href)) {
      setLinkError(URL_HINT);
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }

  function openImage() {
    setImageUrl("");
    setImageCredit("");
    setImageError(null);
    setImageOpen(true);
  }

  function insertImage() {
    if (!editor) return;

    const src = imageUrl.trim();
    const credit = imageCredit.trim();
    // The credit rule is the server sanitizer's, said here before the image
    // ever reaches the Draft rather than after the save is refused.
    if (credit.length === 0) {
      setImageError("Every image needs a credit");
      return;
    }
    if (!isHttpUrl(src)) {
      setImageError(URL_HINT);
      return;
    }

    // `insertContent` rather than `setImage`: the credit is an attribute of
    // this app's image node, which `setImage`'s own options do not carry.
    editor
      .chain()
      .focus()
      .insertContent({ type: "image", attrs: { src, credit } })
      .run();
    setImageOpen(false);
  }

  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-1 border-b border-foreground/10 px-2 py-1.5">
        <ToolbarButton
          label="Heading 1"
          text="H1"
          pressed={active?.heading1 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          label="Heading 2"
          text="H2"
          pressed={active?.heading2 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="Heading 3"
          text="H3"
          pressed={active?.heading3 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <ToolbarButton
          label="Bold"
          text="B"
          pressed={active?.bold ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          text="I"
          pressed={active?.italic ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Bullet list"
          text="•"
          pressed={active?.bulletList ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered list"
          text="1."
          pressed={active?.orderedList ?? false}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Link"
          text="Link"
          pressed={active?.link ?? false}
          onClick={openLink}
        />
        <ToolbarButton
          label="Image"
          text="Image"
          pressed={active?.image ?? false}
          onClick={openImage}
        />
      </div>

      <EditorContent editor={editor} />

      <Dialog
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (!open) setLinkError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rich-text-link-url">URL</Label>
            <Input
              id="rich-text-link-url"
              autoComplete="off"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
            />
            {linkError ? (
              <p role="alert" className="text-sm text-destructive">
                {linkError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="button" onClick={applyLink}>
              Apply link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageOpen}
        onOpenChange={(open) => {
          setImageOpen(open);
          if (!open) setImageError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add image</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rich-text-image-url">Image URL</Label>
            <Input
              id="rich-text-image-url"
              autoComplete="off"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rich-text-image-credit">Credit</Label>
            <Input
              id="rich-text-image-credit"
              autoComplete="off"
              value={imageCredit}
              onChange={(event) => setImageCredit(event.target.value)}
            />
            {imageError ? (
              <p role="alert" className="text-sm text-destructive">
                {imageError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="button" onClick={insertImage}>
              Insert image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
