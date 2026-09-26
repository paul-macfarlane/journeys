import { describe, expect, it, vi } from "vitest";

import { changedFields, guardedWrite } from "./guarded-write";

/**
 * The data layer's one conditional write (ticket 73): the guarded statement
 * either hands back the row it wrote, or nothing, and nothing is told apart
 * — a guard that failed, or a row that went away — by reading the row again.
 */
describe("guardedWrite", () => {
  it("answers the row the guarded statement wrote, without re-reading", async () => {
    const exists = vi.fn(async () => true);

    const result = await guardedWrite(async () => [{ version: 4 }], exists);

    expect(result).toEqual({ ok: true, row: { version: 4 } });
    expect(exists).not.toHaveBeenCalled();
  });

  it("answers stale when nothing was written and the row is still there", async () => {
    const result = await guardedWrite(
      async () => [],
      async () => true,
    );

    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("answers not-found when nothing was written because the row is gone", async () => {
    const result = await guardedWrite(
      async () => [],
      async () => false,
    );

    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("changedFields", () => {
  it("names only the fields whose value differs from the baseline", () => {
    expect(
      changedFields(
        { title: "Night", themeAccent: null, themePreset: "dusk" },
        { title: "Border", themeAccent: null, themePreset: "dusk" },
      ),
    ).toEqual(["title"]);
  });

  it("compares rich text by what it holds, not by reference", () => {
    const doc = () => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    });

    expect(
      changedFields(
        { descriptionContent: doc() },
        { descriptionContent: doc() },
      ),
    ).toEqual([]);
    expect(
      changedFields(
        { descriptionContent: doc(), themeAccent: "#095b41" },
        { descriptionContent: { type: "doc", content: [] }, themeAccent: null },
      ),
    ).toEqual(["descriptionContent", "themeAccent"]);
  });
});
