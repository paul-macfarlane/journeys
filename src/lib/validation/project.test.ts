import { describe, expect, it } from "vitest";

import { renameProjectSchema } from "@/lib/validation/project";

/**
 * Seam A for ticket 28's Settings tab, narrowed by ticket 07: the title is
 * the only plain-text field left on it. The description is rich text now,
 * cleaned by `sanitizeContent` rather than parsed by a schema (see
 * `src/app/projects/actions.test.ts`).
 */
describe("renameProjectSchema", () => {
  it("trims the title", () => {
    expect(renameProjectSchema.parse({ title: "  Refugee Health  " })).toEqual({
      title: "Refugee Health",
    });
  });

  it("rejects a blank title", () => {
    const result = renameProjectSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a title");
  });

  it("caps the title at 120 characters", () => {
    const result = renameProjectSchema.safeParse({ title: "x".repeat(121) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Use 120 characters or fewer",
    );
  });

  it("ignores a description: it is no longer part of a rename", () => {
    expect(
      renameProjectSchema.parse({
        title: "Refugee Health",
        description: "Clinics near the border.",
      }),
    ).toEqual({ title: "Refugee Health" });
  });
});
