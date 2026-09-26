import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import {
  changedFields,
  guardedWrite,
  stillHoldsOrRetired,
} from "./guarded-write";
import { journey, project } from "./schema";

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

/**
 * A Theme preset guard (ticket 73): a row still holding a preset id the app
 * no longer offers reads back as the default, which is the baseline the
 * Member then sends — so the guard also passes a row whose preset is not
 * one of the offered ids, or that Member could never change the Theme.
 */
describe("stillHoldsOrRetired", () => {
  const dialect = new PgDialect();

  it("passes the row that still holds the baseline, or holds an id no longer offered", () => {
    const query = dialect.sqlToQuery(
      stillHoldsOrRetired(project.themePreset, "trail", ["trail", "dusk"]),
    );

    expect(query.sql).toBe(
      '("project"."theme_preset" IS NOT DISTINCT FROM $1 or "project"."theme_preset" not in ($2, $3))',
    );
    expect(query.params).toEqual(["trail", "trail", "dusk"]);
  });

  it("leaves a null override to the null-safe half", () => {
    const query = dialect.sqlToQuery(
      stillHoldsOrRetired(journey.themePreset, null, ["trail"]),
    );

    expect(query.sql).toBe(
      '("journey"."theme_preset" IS NOT DISTINCT FROM $1 or "journey"."theme_preset" not in ($2))',
    );
    expect(query.params).toEqual([null, "trail"]);
  });
});
