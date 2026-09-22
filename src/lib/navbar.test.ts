import { describe, expect, it } from "vitest";

import { initials, switcherProjects } from "./navbar";

describe("initials", () => {
  it("takes the first letter of the first and last words, upper-cased", () => {
    expect(initials("Test Author")).toBe("TA");
    expect(initials("ada lovelace")).toBe("AL");
  });

  it("uses only the first letter of a single-word name", () => {
    expect(initials("Cher")).toBe("C");
  });

  it("skips middle names and surrounding whitespace", () => {
    expect(initials("  Grace Brewster Murray Hopper ")).toBe("GH");
  });

  it("falls back to a question mark for an empty name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("switcherProjects", () => {
  const recent = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
    { id: "d", title: "D" },
    { id: "e", title: "E" },
  ];

  it("keeps the recent list as it is when there is no current Project", () => {
    expect(switcherProjects(recent, null)).toEqual(recent);
  });

  it("keeps the recent list as it is when the current Project is in it", () => {
    expect(switcherProjects(recent, { id: "c", title: "C" })).toEqual(recent);
  });

  it("puts a current Project the recent list misses first and drops the last", () => {
    expect(switcherProjects(recent, { id: "z", title: "Z" })).toEqual([
      { id: "z", title: "Z" },
      ...recent.slice(0, 4),
    ]);
  });

  it("never lists more than five, even when given more", () => {
    const six = [...recent, { id: "f", title: "F" }];
    expect(switcherProjects(six, null)).toEqual(recent);
    expect(switcherProjects(six, { id: "f", title: "F" })).toEqual([
      { id: "f", title: "F" },
      ...recent.slice(0, 4),
    ]);
  });

  it("does not pad a short list", () => {
    expect(switcherProjects([], null)).toEqual([]);
    expect(switcherProjects([], { id: "z", title: "Z" })).toEqual([
      { id: "z", title: "Z" },
    ]);
  });
});
