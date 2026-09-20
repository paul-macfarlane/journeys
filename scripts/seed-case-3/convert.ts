import { z } from "zod";

import type {
  Block,
  BulletList,
  Content,
  ImageBlock,
  ListItem,
  Mark,
  OrderedList,
  Paragraph,
  TextElement,
} from "@/lib/graph/content";
import type { Choice, GraphDocument, Step } from "@/lib/graph/document";

/**
 * Legacy case page HTML in, the pieces of a graph document out.
 *
 * Throwaway by design. This reads the markup the legacy site's Astro build
 * emits *today* — `<div class="narrative">`, `<figure>` with a `<figcaption>`
 * credit, `<section aria-labelledby="decision-heading">`, and the "Next" link
 * in the case navigation — with a small hand-written tokenizer rather than a
 * parser dependency, because the lockfile is human-only and this script is
 * run a handful of times and then forgotten. When that markup changes, the
 * tests beside this file fail and the script is rewritten or deleted.
 *
 * Vocabulary is the graph's: Step, Choice, Start, Ending, Outcome. The
 * legacy site's own words for those things are not used here.
 */

/**
 * The Step title cap. `src/lib/graph/document.ts` is the source of truth
 * (`title: z.string().max(200)`); this restates it so a converted title is
 * trimmed here rather than rejected there. Legacy titles are far shorter.
 */
const MAX_TITLE_LENGTH = 200;

/** Legacy step hrefs, with or without the trailing slash the host redirects to. */
const STEP_HREF = /^\/journeys\/case-3\/(\d+)\/?$/;

// ---------------------------------------------------------------------------
// A very small HTML tokenizer
// ---------------------------------------------------------------------------

type HtmlText = { kind: "text"; text: string };

type HtmlElement = {
  kind: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
};

type HtmlNode = HtmlText | HtmlElement;

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Elements whose contents are text, never markup. */
const RAW_TEXT_TAGS = new Set(["script", "style"]);

type OpenTag = {
  tag: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  end: number;
};

/**
 * Reads one `<tag …>` starting at `start`. Scans attributes properly rather
 * than looking for the next `>`, so a `>` inside a quoted attribute value
 * does not end the tag early.
 */
function readOpenTag(html: string, start: number): OpenTag | null {
  let index = start + 1;
  const nameStart = index;
  while (index < html.length && /[^\s/>]/.test(html[index])) {
    index += 1;
  }
  const tag = html.slice(nameStart, index).toLowerCase();
  if (tag.length === 0 || !/^[a-z][a-z0-9-]*$/.test(tag)) {
    return null;
  }

  const attrs: Record<string, string> = {};
  while (index < html.length) {
    while (index < html.length && /\s/.test(html[index])) {
      index += 1;
    }
    if (index >= html.length) {
      return { tag, attrs, selfClosing: false, end: html.length };
    }
    if (html[index] === ">") {
      return { tag, attrs, selfClosing: false, end: index + 1 };
    }
    if (html[index] === "/" && html[index + 1] === ">") {
      return { tag, attrs, selfClosing: true, end: index + 2 };
    }
    if (html[index] === "/") {
      index += 1;
      continue;
    }

    const attrStart = index;
    while (index < html.length && /[^\s=/>]/.test(html[index])) {
      index += 1;
    }
    const name = html.slice(attrStart, index).toLowerCase();
    while (index < html.length && /\s/.test(html[index])) {
      index += 1;
    }
    if (html[index] !== "=") {
      if (name.length > 0) attrs[name] = "";
      continue;
    }
    index += 1;
    while (index < html.length && /\s/.test(html[index])) {
      index += 1;
    }

    const quote = html[index];
    if (quote === '"' || quote === "'") {
      const close = html.indexOf(quote, index + 1);
      const valueEnd = close === -1 ? html.length : close;
      attrs[name] = decodeEntities(html.slice(index + 1, valueEnd));
      index = valueEnd + 1;
      continue;
    }
    const valueStart = index;
    while (index < html.length && /[^\s>]/.test(html[index])) {
      index += 1;
    }
    attrs[name] = decodeEntities(html.slice(valueStart, index));
  }

  return { tag, attrs, selfClosing: false, end: html.length };
}

/**
 * Parses a whole page into a tree. Mismatched close tags pop to the nearest
 * matching open tag and are otherwise ignored, which is all the recovery a
 * prerendered page ever needs.
 */
function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = {
    kind: "element",
    tag: "#root",
    attrs: {},
    children: [],
  };
  const stack: HtmlElement[] = [root];
  const addText = (text: string): void => {
    if (text.length > 0) {
      stack[stack.length - 1].children.push({ kind: "text", text });
    }
  };

  let index = 0;
  while (index < html.length) {
    const next = html.indexOf("<", index);
    if (next === -1) {
      addText(html.slice(index));
      break;
    }
    addText(html.slice(index, next));

    if (html.startsWith("<!--", next)) {
      const close = html.indexOf("-->", next + 4);
      index = close === -1 ? html.length : close + 3;
      continue;
    }
    if (html.startsWith("<!", next) || html.startsWith("<?", next)) {
      const close = html.indexOf(">", next);
      index = close === -1 ? html.length : close + 1;
      continue;
    }
    if (html.startsWith("</", next)) {
      const close = html.indexOf(">", next);
      const end = close === -1 ? html.length : close;
      const tag = html
        .slice(next + 2, end)
        .trim()
        .toLowerCase();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].tag === tag) {
          stack.length = depth;
          break;
        }
      }
      index = close === -1 ? html.length : close + 1;
      continue;
    }

    const open = readOpenTag(html, next);
    if (open === null) {
      addText("<");
      index = next + 1;
      continue;
    }

    const element: HtmlElement = {
      kind: "element",
      tag: open.tag,
      attrs: open.attrs,
      children: [],
    };
    stack[stack.length - 1].children.push(element);
    index = open.end;

    if (RAW_TEXT_TAGS.has(open.tag)) {
      const close = html.toLowerCase().indexOf(`</${open.tag}`, index);
      index = close === -1 ? html.length : close;
      continue;
    }
    if (!open.selfClosing && !VOID_TAGS.has(open.tag)) {
      stack.push(element);
    }
  }

  return root.children;
}

function isElement(node: HtmlNode): node is HtmlElement {
  return node.kind === "element";
}

/** Depth-first, document order. */
function findElements(
  nodes: HtmlNode[],
  matches: (element: HtmlElement) => boolean,
): HtmlElement[] {
  const found: HtmlElement[] = [];
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (matches(node)) found.push(node);
    found.push(...findElements(node.children, matches));
  }
  return found;
}

function findElement(
  nodes: HtmlNode[],
  matches: (element: HtmlElement) => boolean,
): HtmlElement | null {
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (matches(node)) return node;
    const inside = findElement(node.children, matches);
    if (inside !== null) return inside;
  }
  return null;
}

function byTag(tag: string): (element: HtmlElement) => boolean {
  return (element) => element.tag === tag;
}

function hasClass(element: HtmlElement, name: string): boolean {
  return (element.attrs.class ?? "").split(/\s+/).includes(name);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, body: string) => {
      if (body.startsWith("#")) {
        const code = body.startsWith("#x")
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
        return Number.isInteger(code) && code > 0
          ? String.fromCodePoint(code)
          : match;
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

/** Every run of whitespace becomes one space; the ends are trimmed. */
function collapseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** All the text inside an element, with `<br>` reading as a space. */
function textOf(node: HtmlNode): string {
  if (!isElement(node)) return decodeEntities(node.text);
  if (node.tag === "br") return " ";
  return node.children.map((child) => textOf(child)).join("");
}

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

function run(text: string, marks: Mark[]): TextElement {
  return marks.length > 0
    ? { type: "text", text, marks: marks.map((mark) => ({ ...mark })) }
    : { type: "text", text };
}

function sameMarks(left: TextElement, right: TextElement): boolean {
  return JSON.stringify(left.marks ?? []) === JSON.stringify(right.marks ?? []);
}

/**
 * Collapses whitespace across the whole sequence of runs: a space never
 * doubles where two runs meet, the sequence never opens or closes on one, and
 * a run that was nothing but whitespace disappears.
 */
function collapseRuns(runs: TextElement[]): TextElement[] {
  const collapsed: TextElement[] = [];
  let previousEndsWithSpace = true;

  for (const candidate of runs) {
    let text = candidate.text.replace(/\s+/g, " ");
    if (previousEndsWithSpace && text.startsWith(" ")) {
      text = text.slice(1);
    }
    if (text.length === 0) continue;
    previousEndsWithSpace = text.endsWith(" ");
    collapsed.push(run(text, candidate.marks ?? []));
  }

  // Runs that read the same way are one run: the legacy `<br>` between two
  // sentences should not split a paragraph into three pieces of storage.
  const merged: TextElement[] = [];
  for (const candidate of collapsed) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && sameMarks(previous, candidate)) {
      merged[merged.length - 1] = run(
        previous.text + candidate.text,
        previous.marks ?? [],
      );
      continue;
    }
    merged.push(candidate);
  }

  const last = merged[merged.length - 1];
  if (last !== undefined) {
    const trimmed = last.text.replace(/ +$/, "");
    if (trimmed.length === 0) {
      merged.pop();
    } else {
      merged[merged.length - 1] = run(trimmed, last.marks ?? []);
    }
  }

  return merged;
}

function collectInline(
  nodes: HtmlNode[],
  marks: Mark[],
  out: TextElement[],
): void {
  for (const node of nodes) {
    if (!isElement(node)) {
      out.push(run(decodeEntities(node.text), marks));
      continue;
    }
    switch (node.tag) {
      case "br":
        out.push(run(" ", marks));
        break;
      case "em":
      case "i":
        collectInline(node.children, [...marks, { type: "italic" }], out);
        break;
      case "strong":
      case "b":
        collectInline(node.children, [...marks, { type: "bold" }], out);
        break;
      case "a": {
        const href = (node.attrs.href ?? "").trim();
        collectInline(
          node.children,
          href.length > 0
            ? [
                ...marks,
                {
                  type: "link",
                  attrs: { href, rel: "noopener noreferrer" },
                },
              ]
            : marks,
          out,
        );
        break;
      }
      default:
        // An element the contract has no place for contributes its text and
        // nothing else.
        collectInline(node.children, marks, out);
    }
  }
}

function inlineFrom(nodes: HtmlNode[]): TextElement[] {
  const runs: TextElement[] = [];
  collectInline(nodes, [], runs);
  return collapseRuns(runs);
}

function paragraphFrom(nodes: HtmlNode[]): Paragraph | null {
  const inline = inlineFrom(nodes);
  return inline.length > 0 ? { type: "paragraph", content: inline } : null;
}

function listItemsFrom(list: HtmlElement): ListItem[] {
  const items: ListItem[] = [];
  for (const child of list.children) {
    if (!isElement(child) || child.tag !== "li") continue;

    const nested = child.children.filter(
      (node) => isElement(node) && (node.tag === "ul" || node.tag === "ol"),
    );
    const direct = child.children.filter((node) => !nested.includes(node));

    const content: Array<Paragraph | BulletList | OrderedList> = [];
    const paragraph = paragraphFrom(direct);
    if (paragraph !== null) content.push(paragraph);
    for (const node of nested) {
      if (!isElement(node)) continue;
      const items = listItemsFrom(node);
      if (items.length === 0) continue;
      content.push(
        node.tag === "ul"
          ? { type: "bulletList", content: items }
          : { type: "orderedList", content: items },
      );
    }

    items.push(
      content.length > 0 ? { type: "listItem", content } : { type: "listItem" },
    );
  }
  return items;
}

function blocksFrom(nodes: HtmlNode[]): Block[] {
  const blocks: Block[] = [];

  for (const node of nodes) {
    if (!isElement(node)) {
      const paragraph = paragraphFrom([node]);
      if (paragraph !== null) blocks.push(paragraph);
      continue;
    }

    const headingLevel = /^h([1-6])$/.exec(node.tag);
    if (headingLevel !== null) {
      const inline = inlineFrom(node.children);
      if (inline.length > 0) {
        blocks.push({
          type: "heading",
          attrs: { level: Number(headingLevel[1]) },
          content: inline,
        });
      }
      continue;
    }

    // A figure inside the narrative is already read as an image block by
    // `imageBlocksFrom`; reading it here too would repeat its credit line as
    // a paragraph.
    if (node.tag === "figure" || node.tag === "figcaption") {
      continue;
    }

    if (node.tag === "ul" || node.tag === "ol") {
      const items = listItemsFrom(node);
      if (items.length > 0) {
        blocks.push(
          node.tag === "ul"
            ? { type: "bulletList", content: items }
            : { type: "orderedList", content: items },
        );
      }
      continue;
    }

    // `p`, and anything else the narrative happens to hold, reads as one
    // paragraph of its text.
    const paragraph = paragraphFrom(node.children);
    if (paragraph !== null) blocks.push(paragraph);
  }

  return blocks;
}

/**
 * Every `<figure>` on the page, in document order. The legacy `img src`
 * carries a trailing space, and the credit is the figcaption verbatim apart
 * from collapsed whitespace — an image with no credit is left credit-less on
 * purpose, so the sanitizer refuses the write rather than seeding an
 * uncredited image.
 */
function imageBlocksFrom(main: HtmlElement): ImageBlock[] {
  return findElements([main], byTag("figure"))
    .map((figure): ImageBlock => {
      const image = findElement(figure.children, byTag("img"));
      const caption = findElement(figure.children, byTag("figcaption"));
      return {
        type: "image",
        attrs: {
          src: (image?.attrs.src ?? "").trim(),
          credit: caption === null ? "" : collapseText(textOf(caption)),
          alt: null,
        },
      };
    })
    .filter((block) => block.attrs.src.length > 0);
}

// ---------------------------------------------------------------------------
// One page
// ---------------------------------------------------------------------------

/** A Choice as the legacy page states it, before Step ids exist. */
export type ScrapedChoice = { label: string; targetStep: number };

export type ConvertedStepPage = {
  title: string;
  content: Content;
  choices: ScrapedChoice[];
};

/** A converted Step that still knows which legacy step number it came from. */
export type ScrapedStep = ConvertedStepPage & { step: number };

function choicesFrom(main: HtmlElement): ScrapedChoice[] {
  const decision = findElement(
    main.children,
    (element) =>
      element.tag === "section" &&
      element.attrs["aria-labelledby"] === "decision-heading",
  );

  const scope = decision ?? main;
  const choices: ScrapedChoice[] = [];
  for (const link of findElements([scope], byTag("a"))) {
    const target = STEP_HREF.exec((link.attrs.href ?? "").trim());
    if (target === null) continue;
    const label = collapseText(textOf(link));
    choices.push({
      label: label.length > 0 ? label : "Next",
      targetStep: Number(target[1]),
    });
  }
  return choices;
}

export function convertStepPage(html: string): ConvertedStepPage {
  const nodes = parseHtml(html);
  const main = findElement(nodes, byTag("main"));
  if (main === null) {
    throw new Error("The legacy page has no <main>; its markup has changed");
  }

  const heading = findElement(main.children, byTag("h1"));
  if (heading === null) {
    throw new Error("The legacy page has no <h1>; its markup has changed");
  }

  const narrative = findElement(main.children, (element) =>
    hasClass(element, "narrative"),
  );
  if (narrative === null) {
    throw new Error(
      'The legacy page has no <div class="narrative">; its markup has changed',
    );
  }

  return {
    title: collapseText(textOf(heading)).slice(0, MAX_TITLE_LENGTH),
    content: {
      type: "doc",
      content: [...blocksFrom(narrative.children), ...imageBlocksFrom(main)],
    },
    choices: choicesFrom(main),
  };
}

// ---------------------------------------------------------------------------
// The whole document
// ---------------------------------------------------------------------------

/**
 * The hand-written mapping in `outcomes.json`, which a human edits. Parsed
 * rather than trusted: the file is edited by hand, so the seed says what is
 * wrong with it instead of failing somewhere further down.
 */
export const outcomeMappingSchema = z.object({
  outcomes: z.array(
    z.object({ id: z.string().min(1), label: z.string().min(1) }),
  ),
  endings: z.array(
    z.object({
      step: z.number().int().positive(),
      title: z.string(),
      outcomeId: z.string().min(1),
    }),
  ),
});

export type OutcomeMapping = z.infer<typeof outcomeMappingSchema>;

export type BuildResult =
  | { ok: true; document: GraphDocument; warnings: string[] }
  | { ok: false; problems: string[]; warnings: string[] };

/** Readable ids, so a person can read the stored document and the fixture. */
function stepIdOf(step: number): string {
  return `step-${step}`;
}

function choiceIdOf(step: number, position: number): string {
  return `${stepIdOf(step)}-choice-${position}`;
}

/**
 * Assembles the scraped Steps and the hand-written Outcome mapping into one
 * graph document. Refuses rather than guesses: an Ending the mapping does not
 * cover, a mapped Step that still has Choices, an Outcome id naming nothing,
 * and a duplicated Outcome or Ending entry are all reported together so one
 * run shows every edit `outcomes.json` needs.
 */
export function buildGraphDocument(
  scrapedSteps: ScrapedStep[],
  mapping: OutcomeMapping,
  startStep: number,
): BuildResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  const ordered = [...scrapedSteps].sort(
    (left, right) => left.step - right.step,
  );
  const byStepNumber = new Map(
    ordered.map((scraped) => [scraped.step, scraped]),
  );

  // Built entry by entry rather than with `new Map(...)`, which would
  // silently keep only the last of a repeated id or step.
  const outcomeIds = new Set<string>();
  for (const outcome of mapping.outcomes) {
    if (outcomeIds.has(outcome.id)) {
      problems.push(
        `outcomes.json defines the outcome "${outcome.id}" more than once`,
      );
      continue;
    }
    outcomeIds.add(outcome.id);
  }

  const mapped = new Map<number, (typeof mapping.endings)[number]>();
  for (const entry of mapping.endings) {
    if (mapped.has(entry.step)) {
      problems.push(
        `outcomes.json maps step ${entry.step} more than once; one ending has one outcome`,
      );
      continue;
    }
    mapped.set(entry.step, entry);
  }

  if (!byStepNumber.has(startStep)) {
    problems.push(
      `The start ${stepIdOf(startStep)} was not scraped, so the journey has no start step`,
    );
  }

  for (const scraped of ordered) {
    if (scraped.choices.length === 0 && !mapped.has(scraped.step)) {
      problems.push(
        `Ending "${scraped.title}" (step ${scraped.step}) is missing from outcomes.json`,
      );
    }
    for (const choice of scraped.choices) {
      if (!byStepNumber.has(choice.targetStep)) {
        problems.push(
          `Step ${scraped.step} has a choice leading to step ${choice.targetStep}, which was not scraped`,
        );
      }
    }
  }

  for (const entry of mapped.values()) {
    const scraped = byStepNumber.get(entry.step);
    if (scraped === undefined) {
      problems.push(
        `outcomes.json maps step ${entry.step}, which was not scraped`,
      );
      continue;
    }
    if (scraped.choices.length > 0) {
      problems.push(
        `outcomes.json maps step ${entry.step} ("${scraped.title}"), which still has choices and so is not an ending`,
      );
    }
    if (!outcomeIds.has(entry.outcomeId)) {
      problems.push(
        `outcomes.json maps step ${entry.step} to the outcome "${entry.outcomeId}", which it does not define`,
      );
    }
    if (scraped.choices.length === 0 && scraped.title !== entry.title) {
      warnings.push(
        `outcomes.json calls step ${entry.step} "${entry.title}"; the legacy site now calls it "${scraped.title}"`,
      );
    }
  }

  if (problems.length > 0) {
    return { ok: false, problems, warnings };
  }

  const steps: Record<string, Step> = {};
  for (const scraped of ordered) {
    const choices: Choice[] = scraped.choices.map((choice, index) => ({
      id: choiceIdOf(scraped.step, index + 1),
      label: choice.label,
      targetStepId: stepIdOf(choice.targetStep),
      condition: null,
      effect: null,
    }));

    steps[stepIdOf(scraped.step)] = {
      id: stepIdOf(scraped.step),
      title: scraped.title,
      content: scraped.content,
      choices,
      prompt: null,
      outcomeId: mapped.get(scraped.step)?.outcomeId ?? null,
      position: null,
    };
  }

  return {
    ok: true,
    warnings,
    document: {
      schemaVersion: 1,
      startStepId: stepIdOf(startStep),
      allowBack: true,
      steps,
      outcomes: Object.fromEntries(
        mapping.outcomes.map((outcome) => [outcome.id, { ...outcome }]),
      ),
    },
  };
}
