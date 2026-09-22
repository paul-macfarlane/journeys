import { z } from "zod";

/**
 * A Step's rich text, stored exactly as Tiptap/ProseMirror emits it: a `doc`
 * holding a list of blocks. Deliberately no `server-only` — the editor, the
 * participant runner, the seed script, and the e2e specs all read this shape.
 *
 * The allowed set is small and closed. The editor is configured with only
 * these extensions, so it never produces anything else; `sanitizeContent`
 * defends the same boundary against writes that do not come from the editor.
 *
 * Vocabulary: the pieces of rich text are "blocks", "inline elements", and
 * "marks". Step, Choice, Start, Ending, and Outcome are the graph's words.
 */

/** Inline emphasis and links carried by a run of text. */
export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string; rel: "noopener noreferrer" } };

/** The only inline element: a run of text with optional marks. */
export type TextElement = { type: "text"; text: string; marks?: Mark[] };

export type Paragraph = { type: "paragraph"; content?: TextElement[] };

/** `level` is constrained to 1–6 by the schema; the sanitizer coerces. */
export type Heading = {
  type: "heading";
  attrs: { level: number };
  content?: TextElement[];
};

export type ListItem = {
  type: "listItem";
  content?: Array<Paragraph | BulletList | OrderedList>;
};

export type BulletList = { type: "bulletList"; content: ListItem[] };

export type OrderedList = {
  type: "orderedList";
  attrs?: { start: number };
  content: ListItem[];
};

/**
 * An image with its alt text (for assistive technology, never displayed,
 * `""` until the Author writes one) and its caption (the visible line under
 * the picture, `""` when there is none; a credit is simply written into it).
 * Documents stored before ticket 30 named the caption `credit`; the schema
 * reads that name as `caption` so nothing stored has to be rewritten.
 */
export type ImageBlock = {
  type: "image";
  attrs: { src: string; alt: string; caption: string };
};

export type Block = Paragraph | Heading | BulletList | OrderedList | ImageBlock;

export type Content = { type: "doc"; content: Block[] };

const markSchema: z.ZodType<Mark> = z.union([
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      href: z.string().min(1),
      // Rendered links always carry this; the sanitizer sets it.
      rel: z.literal("noopener noreferrer"),
    }),
  }),
]);

const textSchema: z.ZodType<TextElement> = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(markSchema).optional(),
});

const paragraphSchema: z.ZodType<Paragraph> = z.object({
  type: z.literal("paragraph"),
  content: z.array(textSchema).optional(),
});

const headingSchema: z.ZodType<Heading> = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.number().int().min(1).max(6) }),
  content: z.array(textSchema).optional(),
});

// Lists and list items refer to each other, so the inner schemas are reached
// lazily. Tiptap omits `content` on an empty list item.
const listItemSchema: z.ZodType<ListItem> = z.object({
  type: z.literal("listItem"),
  content: z
    .array(
      z.lazy(() =>
        z.union([paragraphSchema, bulletListSchema, orderedListSchema]),
      ),
    )
    .optional(),
});

const bulletListSchema: z.ZodType<BulletList> = z.object({
  type: z.literal("bulletList"),
  content: z.array(z.lazy(() => listItemSchema)),
});

const orderedListSchema: z.ZodType<OrderedList> = z.object({
  type: z.literal("orderedList"),
  attrs: z.object({ start: z.number().int() }).optional(),
  content: z.array(z.lazy(() => listItemSchema)),
});

/**
 * The one compatibility read every reader of a stored image shares: an attr
 * named `credit` is the caption when no `caption` is present, and an alt
 * that is not a string (the `null` documents before ticket 30 stored) is
 * `""`. Published Versions are immutable and keep the old name forever; a
 * Draft writes `caption` on its next save. Values are passed through as they
 * are — trimming is the sanitizer's job, on the way in.
 */
export function readStoredImageAttrs(attrs: unknown): {
  src: unknown;
  alt: string;
  caption: string;
} {
  const record = isRecord(attrs) ? attrs : {};
  return {
    src: record.src,
    alt: typeof record.alt === "string" ? record.alt : "",
    caption:
      typeof record.caption === "string"
        ? record.caption
        : typeof record.credit === "string"
          ? record.credit
          : "",
  };
}

const imageSchema: z.ZodType<ImageBlock> = z.object({
  type: z.literal("image"),
  attrs: z.preprocess(
    readStoredImageAttrs,
    z.object({
      src: z.string().min(1),
      alt: z.string(),
      caption: z.string(),
    }),
  ),
});

const blockSchema: z.ZodType<Block> = z.union([
  paragraphSchema,
  headingSchema,
  bulletListSchema,
  orderedListSchema,
  imageSchema,
]);

/** The whole of a Step's rich text. */
export const contentSchema: z.ZodType<Content> = z.object({
  type: z.literal("doc"),
  content: z.array(blockSchema),
});

export type SanitizeContentResult =
  { ok: true; content: Content } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the href when it is an absolute `http:` or `https:` URL, and null
 * otherwise. `javascript:`, `data:`, `mailto:`, relative paths, and
 * protocol-relative `//host` forms all return null.
 */
function absoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function sanitizeMarks(input: unknown): Mark[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const marks: Mark[] = [];
  for (const candidate of input) {
    if (!isRecord(candidate)) {
      continue;
    }
    if (candidate.type === "bold" || candidate.type === "italic") {
      marks.push({ type: candidate.type });
      continue;
    }
    if (candidate.type === "link") {
      const attrs = isRecord(candidate.attrs) ? candidate.attrs : {};
      const href = absoluteHttpUrl(attrs.href);
      // A link the participant cannot safely follow loses the mark; the
      // text it wrapped stays on the Step.
      if (href !== null) {
        marks.push({
          type: "link",
          attrs: { href, rel: "noopener noreferrer" },
        });
      }
    }
  }
  return marks;
}

function sanitizeInline(input: unknown): TextElement[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const inline: TextElement[] = [];
  for (const candidate of input) {
    // Anything that is not a run of text — a hardBreak, say — is removed
    // together with whatever it contains.
    if (!isRecord(candidate) || candidate.type !== "text") {
      continue;
    }
    if (typeof candidate.text !== "string" || candidate.text.length === 0) {
      continue;
    }
    const marks = sanitizeMarks(candidate.marks);
    inline.push(
      marks.length > 0
        ? { type: "text", text: candidate.text, marks }
        : { type: "text", text: candidate.text },
    );
  }
  return inline;
}

function headingLevel(attrs: unknown): number {
  const level = isRecord(attrs) ? attrs.level : undefined;
  const valid =
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 6;
  // An out-of-range or absent level becomes the top level rather than
  // failing the write.
  return valid ? level : 1;
}

function sanitizeImage(input: Record<string, unknown>): ImageBlock | null {
  const attrs = isRecord(input.attrs) ? input.attrs : {};

  // An image the participant's browser cannot safely load is simply removed,
  // captioned or not.
  const src = absoluteHttpUrl(attrs.src);
  if (src === null) {
    return null;
  }

  const stored = readStoredImageAttrs(attrs);
  return {
    type: "image",
    attrs: { src, alt: stored.alt.trim(), caption: stored.caption.trim() },
  };
}

function sanitizeListItems(input: unknown): ListItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const items: ListItem[] = [];
  for (const candidate of input) {
    if (!isRecord(candidate) || candidate.type !== "listItem") {
      continue;
    }
    const children = Array.isArray(candidate.content)
      ? candidate.content
          .map((child) => sanitizeBlock(child))
          .filter(
            (child): child is Paragraph | BulletList | OrderedList =>
              child !== null &&
              (child.type === "paragraph" ||
                child.type === "bulletList" ||
                child.type === "orderedList"),
          )
      : [];
    items.push(
      children.length > 0
        ? { type: "listItem", content: children }
        : { type: "listItem" },
    );
  }
  return items;
}

/** Returns the cleaned block, or null when the block itself is not allowed. */
function sanitizeBlock(input: unknown): Block | null {
  if (!isRecord(input)) {
    return null;
  }

  switch (input.type) {
    case "paragraph": {
      const inline = sanitizeInline(input.content);
      return inline.length > 0
        ? { type: "paragraph", content: inline }
        : { type: "paragraph" };
    }
    case "heading": {
      const attrs = { level: headingLevel(input.attrs) };
      const inline = sanitizeInline(input.content);
      return inline.length > 0
        ? { type: "heading", attrs, content: inline }
        : { type: "heading", attrs };
    }
    case "bulletList": {
      const items = sanitizeListItems(input.content);
      return items.length > 0 ? { type: "bulletList", content: items } : null;
    }
    case "orderedList": {
      const items = sanitizeListItems(input.content);
      if (items.length === 0) {
        return null;
      }
      const start = isRecord(input.attrs) ? input.attrs.start : undefined;
      return typeof start === "number" && Number.isInteger(start)
        ? { type: "orderedList", attrs: { start }, content: items }
        : { type: "orderedList", content: items };
    }
    case "image":
      return sanitizeImage(input);
    default:
      // Unknown blocks go, and their whole subtree goes with them.
      return null;
  }
}

/**
 * Cleans rich text on its way into storage. Runs server-side at every write,
 * because the editor is not the only thing that can reach the write path.
 *
 * Removes blocks and inline elements outside the allowed set, drops marks and
 * attrs it does not understand, and strips links and images whose URL is not
 * an absolute http(s) address. Nothing is refused: an image with no alt text
 * or caption is kept as it is, so an Author can edit it into shape later.
 * The returned content always satisfies `contentSchema`. The only `ok: false`
 * is input that is not a document at all.
 */
export function sanitizeContent(input: unknown): SanitizeContentResult {
  if (
    !isRecord(input) ||
    input.type !== "doc" ||
    !Array.isArray(input.content)
  ) {
    return {
      ok: false,
      error: "Content must be a document with a list of blocks",
    };
  }

  const blocks = input.content
    .map((block) => sanitizeBlock(block))
    .filter((block): block is Block => block !== null);
  return { ok: true, content: { type: "doc", content: blocks } };
}

/** How much of a Step's content a peek at its box on the map shows. */
export const PREVIEW_LIMIT = 140;

/** The mark a cut preview ends with, so a glance reads as an opening. */
const ELLIPSIS = "…";

/** Every block's words, in the order the Step is written. */
function collectText(blocks: Array<Block | ListItem>, into: string[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
      case "heading":
        into.push((block.content ?? []).map((run) => run.text).join(""));
        break;
      case "bulletList":
      case "orderedList":
        collectText(block.content, into);
        break;
      case "listItem":
        collectText(block.content ?? [], into);
        break;
      case "image":
        // An image's words are its caption and its alt text, and both are
        // about the image rather than about the Step.
        break;
    }
  }
}

/** Whether any of these blocks shows a Participant something. */
function showsAnything(blocks: Array<Block | ListItem>): boolean {
  return blocks.some((block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
        return (block.content ?? []).some((run) => run.text.trim() !== "");
      case "bulletList":
      case "orderedList":
        return showsAnything(block.content);
      case "listItem":
        return showsAnything(block.content ?? []);
      case "image":
        // A picture is something to see whether or not it is captioned.
        return true;
    }
  });
}

/**
 * Whether rich text shows nothing at all: no blocks, or only paragraphs,
 * headings, and lists with no words in them. A Project's description starts
 * this way and returns to it when an Author clears the editor — which
 * leaves one empty paragraph behind, so counting blocks would not do — and
 * the public Project page renders nothing rather than an empty block.
 */
export function isBlankContent(content: Content): boolean {
  return !showsAnything(content.content);
}

/**
 * The opening of a Step's content as plain text: what a box on the map shows
 * when an Author hovers or focuses it, so the map can be skimmed without
 * opening every Step.
 *
 * Every paragraph, heading, and list item in document order, joined by single
 * spaces with the whitespace collapsed; content longer than `limit` is cut
 * there and marked with an ellipsis. Pure — no DOM — so the map and a test
 * read the same thing.
 */
export function contentPreview(
  content: Content,
  limit = PREVIEW_LIMIT,
): string {
  const pieces: string[] = [];
  collectText(content.content, pieces);

  const text = pieces.join(" ").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}${ELLIPSIS}` : text;
}
