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

/** Every image carries the credit its Author must supply. */
export type ImageBlock = {
  type: "image";
  attrs: { src: string; credit: string; alt?: string | null };
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

const imageSchema: z.ZodType<ImageBlock> = z.object({
  type: z.literal("image"),
  attrs: z.object({
    src: z.string().min(1),
    credit: z.string().min(1),
    alt: z.string().nullable().optional(),
  }),
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

/** The one condition that refuses a write outright rather than cleaning it. */
const MISSING_CREDIT = "Every image needs a credit";

/** Thrown from deep inside the walk to abort the whole sanitize. */
class SanitizeRefused extends Error {}

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

  // Source first: an image the participant's browser cannot safely load is
  // simply removed, credited or not.
  const src = absoluteHttpUrl(attrs.src);
  if (src === null) {
    return null;
  }

  const credit = typeof attrs.credit === "string" ? attrs.credit.trim() : "";
  if (credit.length === 0) {
    throw new SanitizeRefused(MISSING_CREDIT);
  }

  const alt = typeof attrs.alt === "string" ? attrs.alt : null;
  return { type: "image", attrs: { src, credit, alt } };
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
 * attrs it does not understand, strips links and images whose URL is not an
 * absolute http(s) address, and refuses the whole write when an image has no
 * credit. The returned content always satisfies `contentSchema`.
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

  try {
    const blocks = input.content
      .map((block) => sanitizeBlock(block))
      .filter((block): block is Block => block !== null);
    return { ok: true, content: { type: "doc", content: blocks } };
  } catch (error) {
    if (error instanceof SanitizeRefused) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
