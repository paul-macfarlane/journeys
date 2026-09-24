import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { nextSegmentValue, SegmentedControl } from "./segmented-control";

/**
 * Ticket 51's shared segmented control, at its two seams: the pure answer
 * to "which segment does this key move to", and the markup the control
 * renders — the radio group and radios an assistive technology reads, and
 * the one tab stop a radio group has. Expected strings are written out from
 * the ticket, never derived the way the component derives them.
 */

const THEMES = ["light", "dark", "system"] as const;

describe("nextSegmentValue", () => {
  it("moves right and left along the row, wrapping at both ends", () => {
    expect(nextSegmentValue(THEMES, "light", "ArrowRight")).toBe("dark");
    expect(nextSegmentValue(THEMES, "dark", "ArrowRight")).toBe("system");
    expect(nextSegmentValue(THEMES, "system", "ArrowRight")).toBe("light");
    expect(nextSegmentValue(THEMES, "light", "ArrowLeft")).toBe("system");
    expect(nextSegmentValue(THEMES, "system", "ArrowLeft")).toBe("dark");
  });

  it("ignores the vertical arrows unless asked to take them", () => {
    expect(nextSegmentValue(THEMES, "light", "ArrowDown")).toBeNull();
    expect(nextSegmentValue(THEMES, "light", "ArrowUp")).toBeNull();
    expect(nextSegmentValue(THEMES, "light", "ArrowDown", "all")).toBe("dark");
    expect(nextSegmentValue(THEMES, "light", "ArrowUp", "all")).toBe("system");
  });

  it("ignores every other key and a value that is not a segment", () => {
    expect(nextSegmentValue(THEMES, "light", "Enter")).toBeNull();
    expect(nextSegmentValue(THEMES, "light", "Tab")).toBeNull();
    expect(nextSegmentValue(THEMES, "sepia", "ArrowRight")).toBeNull();
  });
});

describe("SegmentedControl markup", () => {
  const html = renderToStaticMarkup(
    <SegmentedControl
      label="Theme"
      value="dark"
      onValueChange={() => {}}
      options={[
        { value: "light", label: "Light", icon: <svg data-icon="sun" /> },
        { value: "dark", label: "Dark", icon: <svg data-icon="moon" /> },
        {
          value: "system",
          label: "System",
          icon: <svg data-icon="monitor" />,
        },
      ]}
    />,
  );

  it("is a labelled radio group of radios, the checked one marked", () => {
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Theme"');
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
    expect(html).toMatch(
      /<button[^>]*aria-checked="true"[^>]*aria-label="Dark"/,
    );
  });

  it("makes the checked segment the group's one tab stop", () => {
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toMatch(/<button[^>]*tabindex="0"[^>]*aria-checked="true"/);
  });

  it("names an icon-only segment and hides its icon from the reader", () => {
    expect(html).toContain('aria-label="Light"');
    expect(html).toContain('aria-label="System"');
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><svg data-icon="sun"/);
    expect(html).not.toContain(">Light<");
  });

  it("keeps one tab stop, the first segment, when nothing is checked", () => {
    const none = renderToStaticMarkup(
      <SegmentedControl
        label="Theme"
        value={"sepia" as "light"}
        onValueChange={() => {}}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />,
    );
    expect(none.match(/aria-checked="true"/g)).toBeNull();
    expect(none.match(/tabindex="0"/g)).toHaveLength(1);
    expect(none).toMatch(/<button[^>]*tabindex="0"[^>]*data-segment="light"/);
  });

  it("writes a text segment's label out when it has no icon", () => {
    const text = renderToStaticMarkup(
      <SegmentedControl
        label="Layout direction"
        value="TB"
        onValueChange={() => {}}
        options={[
          { value: "TB", label: "Top to bottom" },
          { value: "LR", label: "Left to right" },
        ]}
      />,
    );
    expect(text).toContain(">Top to bottom<");
    expect(text).toContain(">Left to right<");
    expect(text).not.toContain('aria-label="Top to bottom"');
    expect(text.match(/role="radio"/g)).toHaveLength(2);
  });
});
