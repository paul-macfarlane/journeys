import { Fragment, type ReactNode } from "react";

import type {
  Block,
  Content,
  ListItem,
  Mark,
  TextElement,
} from "@/lib/graph/content";

/**
 * Renders a Step's rich text to React elements — never through
 * `dangerouslySetInnerHTML`. Every piece of text passes through JSX as a
 * plain string child, so React escapes it like any other text node; nothing
 * here can inject markup.
 *
 * Content reaching this component has already been sanitized on write
 * (`sanitizeContent` in `@/lib/graph/content`): only http(s) URLs and the
 * closed node/mark set defined there ever reach storage, so this component
 * trusts the shape it is handed rather than re-checking it.
 */

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** `attrs.level` is 1-6 by the schema; clamp defensively anyway. */
function clampHeadingLevel(level: number): HeadingLevel {
  return Math.min(6, Math.max(1, level)) as HeadingLevel;
}

/**
 * A literal switch rather than a dynamic `h${level}` tag: assigning a tag
 * name to a variable and rendering `<Tag>` reads to the React Compiler's
 * lint rule as a component defined during render, which this isn't.
 */
function Heading({
  level,
  children,
}: {
  level: HeadingLevel;
  children: ReactNode;
}) {
  switch (level) {
    case 1:
      return (
        <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      );
    case 2:
      return (
        <h2 className="text-xl font-semibold tracking-tight">{children}</h2>
      );
    case 3:
      return (
        <h3 className="text-lg font-semibold tracking-tight">{children}</h3>
      );
    case 4:
      return (
        <h4 className="text-base font-semibold tracking-tight">{children}</h4>
      );
    case 5:
      return (
        <h5 className="text-sm font-semibold tracking-tight">{children}</h5>
      );
    case 6:
      return <h6 className="text-sm font-medium tracking-tight">{children}</h6>;
  }
}

/**
 * The write-path sanitizer already limits link and image URLs to absolute
 * http(s) addresses; this is the same rule applied once more where the URL
 * becomes an attribute, so a document that reached storage some other way
 * still cannot render a `javascript:` link or a `data:` image.
 */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function applyMark(mark: Mark, node: ReactNode): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{node}</strong>;
    case "italic":
      return <em>{node}</em>;
    case "link":
      // A link the rule refuses keeps its text and loses its anchor, exactly
      // as the sanitizer would have stripped it.
      if (!isHttpUrl(mark.attrs.href)) return node;
      return (
        <a href={mark.attrs.href} rel="noopener noreferrer" target="_blank">
          {node}
        </a>
      );
  }
}

function renderText(el: TextElement): ReactNode {
  return (el.marks ?? []).reduce<ReactNode>(
    (node, mark) => applyMark(mark, node),
    el.text,
  );
}

function renderInline(content: TextElement[] | undefined): ReactNode {
  return (content ?? []).map((el, index) => (
    <Fragment key={index}>{renderText(el)}</Fragment>
  ));
}

function renderListItem(item: ListItem, index: number): ReactNode {
  return (
    <li key={index}>
      {(item.content ?? []).map((child, childIndex) => (
        <RenderBlock key={childIndex} block={child} />
      ))}
    </li>
  );
}

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "paragraph":
      return <p>{renderInline(block.content)}</p>;
    case "heading":
      return (
        <Heading level={clampHeadingLevel(block.attrs.level)}>
          {renderInline(block.content)}
        </Heading>
      );
    case "bulletList":
      return (
        <ul className="list-disc pl-6">
          {block.content.map((item, index) => renderListItem(item, index))}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="list-decimal pl-6" start={block.attrs?.start}>
          {block.content.map((item, index) => renderListItem(item, index))}
        </ol>
      );
    case "image":
      // An image the rule refuses is dropped whole, credit included.
      if (!isHttpUrl(block.attrs.src)) return null;
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              third-party, Author-supplied URL, not an asset next/image can
              optimize. */}
          <img src={block.attrs.src} alt={block.attrs.alt ?? ""} />
          <figcaption className="text-muted-foreground text-sm">
            {block.attrs.credit}
          </figcaption>
        </figure>
      );
  }
}

export function RichText({ content }: { content: Content }) {
  return (
    <div className="flex flex-col gap-4">
      {content.content.map((block, index) => (
        <RenderBlock key={index} block={block} />
      ))}
    </div>
  );
}
