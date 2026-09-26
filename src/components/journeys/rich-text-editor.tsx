import { getMarkAttributes } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type React from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sanitizeContent, type Content } from "@/lib/graph/content";
import {
  draftEditorExtensions,
  editorExtensions,
} from "@/lib/rich-text/extensions";
import { formatShortcut, isApplePlatform } from "@/lib/rich-text/shortcuts";

/**
 * The Step's rich text — and, since ticket 07, the Project's description,
 * which is the same closed content shape — and the small toolbar that
 * shapes it: headings, bold, italic, underline, strikethrough, quotes, the
 * two lists, links, and an image with alt text and an optional caption.
 * Shift+Enter breaks a line inside a block; it has no button. A selected
 * image shows a ring and a small floating toolbar to edit or remove it;
 * every toolbar button carries a tooltip with its name and, where the
 * editor binds one, its shortcut.
 *
 * What the Author types goes through `sanitizeContent` before it leaves this
 * component, so the Draft in client state already holds the stored shape and
 * the server's own sanitize on write is a no-op rather than a second opinion.
 * The sanitized content is never fed back into the editor while the Author is
 * typing — only a change of `resetKey` replaces what is on screen.
 */

/**
 * What the editor is given to show. A document with no blocks at all — the
 * empty description a new Project holds — is a document ProseMirror can
 * render but not edit into: with no text block under the cursor, a heading
 * toggle has nothing to change and the first keystroke makes a paragraph on
 * its own. One empty paragraph, the shape a new Step's content already has,
 * is what "nothing" looks like on the surface.
 */
function withTextBlock(content: Content): Content {
  return content.content.length > 0
    ? content
    : { type: "doc", content: [{ type: "paragraph" }] };
}

/** Both URL fields take the same absolute addresses the sanitizer keeps. */
const URL_HINT = "Start the address with http:// or https://";

/**
 * `.ProseMirror-selectednode` is the class ProseMirror puts on a selected
 * block node — here, the figure around an image — so the focus ring makes a
 * selected image tell apart from an unselected one. The figure hugs its
 * picture so the ring does.
 */
const EDITOR_CLASS =
  "min-h-64 px-4 py-3 outline-none [&>*+*]:mt-4 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:not-italic [&_blockquote>*+*]:mt-4 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_figure]:w-fit [&_figure]:rounded-lg [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_.ProseMirror-selectednode]:ring-offset-2 [&_.ProseMirror-selectednode]:ring-offset-background";

/**
 * The floating image toolbar shows while the selection is an image node.
 * Both values are module constants on purpose: `BubbleMenu` dispatches an
 * options update into the editor whenever either changes identity, so an
 * inline function or object here would dispatch one on every render.
 */
const showImageTools: NonNullable<
  React.ComponentProps<typeof BubbleMenu>["shouldShow"]
> = ({ editor: instance }) => instance.isActive("image");
const IMAGE_TOOLS_PLACEMENT = { placement: "top", offset: 8 } as const;

/** The help line under the alt text field, the one field the dialog insists on. */
const ALT_HELP = "Describe the image for people who cannot see it";
const MISSING_ALT = "Every image needs alt text";

/**
 * Whether ⌘ or Ctrl is the platform's modifier. Read once on the client and
 * `false` for the server render, so the tooltips never hydrate differently
 * from what the server sent — they are not open at that point anyway.
 */
function subscribeToNothing() {
  return () => {};
}
function useApplePlatform(): boolean {
  return useSyncExternalStore(subscribeToNothing, isApplePlatform, () => false);
}

/** The same test the write-path sanitizer applies, so nothing the dialogs
 * accept is later dropped on its way into the Draft. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * `onMouseDown` is swallowed so the Author's selection survives the click:
 * without it the browser moves focus out of the editor first and the toggle
 * lands on nothing.
 *
 * The tooltip reads the button's name and the shortcut the editor binds for
 * it, in the platform's own keys. The `aria-label` already names the button;
 * the tooltip is not wired into `aria-describedby`, so a screen reader hears
 * the name once.
 */
function ToolbarButton({
  label,
  shortcut,
  text,
  pressed,
  onClick,
}: {
  label: string;
  /** The Tiptap key name the editor binds, e.g. `Mod-b`; none for Image. */
  shortcut?: string;
  text: string;
  pressed: boolean;
  onClick: () => void;
}) {
  const apple = useApplePlatform();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={label}
            aria-pressed={pressed}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? (
          <kbd className="rounded-sm bg-background/20 px-1 font-sans">
            {formatShortcut(shortcut, apple)}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function RichTextEditor({
  resetKey,
  label = "Step content",
  content,
  history = true,
  onChange,
  onRefused,
  onBlur,
}: {
  /**
   * Changes whenever the surface must be replaced from `content`: another
   * Step was selected, or the Draft under the same Step was replaced by a
   * restore or another Member's write.
   */
  resetKey: string;
  /**
   * The surface's accessible name. A Step's content by default; the Project
   * description (ticket 07) names itself.
   */
  label?: string;
  content: Content;
  /**
   * Whether the surface keeps an undo of its own. The Draft editor says no
   * (ticket 23): the Draft has one history over the whole document, and
   * Cmd/Ctrl+Z inside the surface belongs to it. A caller with no history of
   * its own — the Project description — leaves it as it is.
   */
  history?: boolean;
  onChange: (content: Content) => void;
  onRefused: (error: string) => void;
  /**
   * Fired when the surface loses focus — for a caller that saves on blur the
   * way the Settings tab's fields do, rather than on every keystroke.
   */
  onBlur?: () => void;
}) {
  // The editor is created once and lives as long as the panel does, so its
  // callbacks read the current ones out of a ref rather than closing over the
  // first render's.
  const handlers = useRef({ onChange, onRefused, onBlur });
  useEffect(() => {
    handlers.current = { onChange, onRefused, onBlur };
  }, [onChange, onRefused, onBlur]);

  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    // Read once, as the editor is: whether the surface has its own undo is
    // the caller's shape, not something that changes under the Author.
    extensions: history ? editorExtensions : draftEditorExtensions,
    content: withTextBlock(content),
    // The panel is server-rendered by Next; rendering the editor immediately
    // would produce markup the client then disagrees with.
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": label, class: EDITOR_CLASS },
      // ⌘K on Apple platforms and Ctrl+K elsewhere — the platform's `Mod`,
      // exactly as Tiptap's own bindings and the tooltip read it; Ctrl+K on
      // a Mac is left to the system — opens the link dialog while the
      // editor has focus. Returning true prevents the default, which is
      // also how the page-level "Find step" shortcut knows to leave this
      // press alone. The dialog state setters are stable, so this closure
      // from the first render stays right.
      handleKeyDown: (view, event) => {
        const mod = isApplePlatform() ? event.metaKey : event.ctrlKey;
        if (!mod) return false;
        if (event.shiftKey || event.altKey) return false;
        if (event.key.toLowerCase() !== "k") return false;
        setLinkUrl(String(getMarkAttributes(view.state, "link").href ?? ""));
        setLinkError(null);
        setLinkOpen(true);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      const sanitized = sanitizeContent(instance.getJSON());
      if (!sanitized.ok) {
        handlers.current.onRefused(sanitized.error);
        return;
      }
      handlers.current.onChange(sanitized.content);
    },
    onBlur: () => {
      handlers.current.onBlur?.();
    },
  });

  // Only a change of `resetKey` replaces what is in the editor, and it does
  // so without reporting an update: this is the Draft speaking, not the
  // Author. The editor is created with `content` already in it, so the run
  // of this effect that its creation triggers has nothing to feed — and a
  // `setContent` there would replace the document and drop whatever the
  // Author had already selected in the moments after the page loaded.
  const creationResetKey = useRef(resetKey);
  const appliedResetKey = useRef<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    if (appliedResetKey.current === null) {
      appliedResetKey.current = creationResetKey.current;
    }
    if (appliedResetKey.current === resetKey) return;
    appliedResetKey.current = resetKey;
    editor.commands.setContent(withTextBlock(contentRef.current), {
      emitUpdate: false,
    });
  }, [editor, resetKey]);

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      heading1: instance?.isActive("heading", { level: 1 }) ?? false,
      heading2: instance?.isActive("heading", { level: 2 }) ?? false,
      heading3: instance?.isActive("heading", { level: 3 }) ?? false,
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      underline: instance?.isActive("underline") ?? false,
      strike: instance?.isActive("strike") ?? false,
      blockquote: instance?.isActive("blockquote") ?? false,
      bulletList: instance?.isActive("bulletList") ?? false,
      orderedList: instance?.isActive("orderedList") ?? false,
      link: instance?.isActive("link") ?? false,
      image: instance?.isActive("image") ?? false,
    }),
  });

  // One dialog for both jobs: `imageMode` says whether Save inserts a new
  // image at the cursor or rewrites the attrs of the selected one.
  const [imageOpen, setImageOpen] = useState(false);
  const [imageMode, setImageMode] = useState<"insert" | "edit">("insert");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageCaption, setImageCaption] = useState("");
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
    setImageMode("insert");
    setImageUrl("");
    setImageAlt("");
    setImageCaption("");
    setImageError(null);
    setImageOpen(true);
  }

  /** The same dialog, pre-filled from the selected image. */
  function openImageEdit() {
    if (!editor) return;
    const attrs = editor.getAttributes("image");
    setImageMode("edit");
    setImageUrl(String(attrs.src ?? ""));
    setImageAlt(String(attrs.alt ?? ""));
    setImageCaption(String(attrs.caption ?? ""));
    setImageError(null);
    setImageOpen(true);
  }

  function saveImage() {
    if (!editor) return;

    const src = imageUrl.trim();
    const alt = imageAlt.trim();
    const caption = imageCaption.trim();
    if (!isHttpUrl(src)) {
      setImageError(URL_HINT);
      return;
    }
    // Alt text is the dialog's rule, not the sanitizer's: a stored image
    // without it is kept, and this is where it gets written.
    if (alt.length === 0) {
      setImageError(MISSING_ALT);
      return;
    }

    const attrs = { src, alt, caption };
    if (imageMode === "edit") {
      editor.chain().focus().updateAttributes("image", attrs).run();
    } else {
      // `insertImage` rather than `setImage`: it carries the caption, and
      // it places the image after a list or quote the cursor sits in.
      editor.chain().focus().insertImage(attrs).run();
    }
    setImageOpen(false);
  }

  function removeImage() {
    editor?.chain().focus().deleteSelection().run();
  }

  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-1 border-b border-foreground/10 px-2 py-1.5">
          <ToolbarButton
            label="Heading 1"
            shortcut="Mod-Alt-1"
            text="H1"
            pressed={active?.heading1 ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          />
          <ToolbarButton
            label="Heading 2"
            shortcut="Mod-Alt-2"
            text="H2"
            pressed={active?.heading2 ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <ToolbarButton
            label="Heading 3"
            shortcut="Mod-Alt-3"
            text="H3"
            pressed={active?.heading3 ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />
          <ToolbarButton
            label="Bold"
            shortcut="Mod-b"
            text="B"
            pressed={active?.bold ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="Italic"
            shortcut="Mod-i"
            text="I"
            pressed={active?.italic ?? false}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="Underline"
            shortcut="Mod-u"
            text="U"
            pressed={active?.underline ?? false}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="Strikethrough"
            shortcut="Mod-Shift-s"
            text="S"
            pressed={active?.strike ?? false}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            label="Quote"
            shortcut="Mod-Shift-b"
            text="Quote"
            pressed={active?.blockquote ?? false}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="Bullet list"
            shortcut="Mod-Shift-8"
            text="•"
            pressed={active?.bulletList ?? false}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Numbered list"
            shortcut="Mod-Shift-7"
            text="1."
            pressed={active?.orderedList ?? false}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Link"
            shortcut="Mod-k"
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
      </TooltipProvider>

      <EditorContent editor={editor} />

      {/* The floating toolbar beside a selected image. `onMouseDown` is
          swallowed for the same reason as on the toolbar: the node selection
          must survive the click for Edit and Remove to have a target. */}
      {editor ? (
        <BubbleMenu
          editor={editor}
          shouldShow={showImageTools}
          options={IMAGE_TOOLS_PLACEMENT}
        >
          {/* The toolbar is a child rather than the menu element itself:
              `BubbleMenu` forwards only a fixed set of attributes to the
              element it positions, and `aria-label` is not among them. */}
          <div
            role="toolbar"
            aria-label="Image tools"
            className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-background p-1 shadow-md"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={openImageEdit}
            >
              Edit image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeImage}
            >
              Remove
            </Button>
          </div>
        </BubbleMenu>
      ) : null}

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
            <DialogTitle>
              {imageMode === "edit" ? "Edit image" : "Add image"}
            </DialogTitle>
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
            <Label htmlFor="rich-text-image-alt">Alt text</Label>
            <Input
              id="rich-text-image-alt"
              autoComplete="off"
              aria-describedby="rich-text-image-alt-help"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
            />
            <p
              id="rich-text-image-alt-help"
              className="text-sm text-muted-foreground"
            >
              {ALT_HELP}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rich-text-image-caption">Caption (optional)</Label>
            <Input
              id="rich-text-image-caption"
              autoComplete="off"
              value={imageCaption}
              onChange={(event) => setImageCaption(event.target.value)}
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
            <Button type="button" onClick={saveImage}>
              {imageMode === "edit" ? "Save image" : "Insert image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
