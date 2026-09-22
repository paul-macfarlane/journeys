import { describe, expect, it } from "vitest";

import { readTab, withTab } from "@/lib/tabs";

const tabs = ["editor", "versions"] as const;

describe("readTab", () => {
  it("returns the named tab when it is one of the page's", () => {
    expect(readTab(tabs, "versions")).toBe("versions");
  });

  it("falls back to the first tab when nothing is named", () => {
    expect(readTab(tabs, undefined)).toBe("editor");
  });

  it("falls back to the first tab for a name the page does not have", () => {
    expect(readTab(tabs, "settings")).toBe("editor");
  });

  it("takes the first value when the parameter is repeated", () => {
    expect(readTab(tabs, ["versions", "editor"])).toBe("versions");
  });
});

describe("withTab", () => {
  it("names a tab other than the default in the query", () => {
    expect(
      withTab("http://localhost:3000/projects/p/journeys/j", tabs, "versions"),
    ).toBe("http://localhost:3000/projects/p/journeys/j?tab=versions");
  });

  it("drops the parameter for the default tab so the plain address is the default", () => {
    expect(
      withTab(
        "http://localhost:3000/projects/p/journeys/j?tab=versions",
        tabs,
        "editor",
      ),
    ).toBe("http://localhost:3000/projects/p/journeys/j");
  });

  it("leaves other parameters alone", () => {
    expect(
      withTab(
        "http://localhost:3000/projects/p/journeys/j?from=list",
        tabs,
        "versions",
      ),
    ).toBe(
      "http://localhost:3000/projects/p/journeys/j?from=list&tab=versions",
    );
  });
});
