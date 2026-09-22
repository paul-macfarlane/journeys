import { describe, expect, it } from "vitest";

import { editProjectSchema } from "@/lib/validation/project";

/**
 * Seam A for ticket 28: the Settings tab's fields. A Project's description
 * is optional and trimmed; its title is still required.
 */
describe("editProjectSchema", () => {
  it("trims the title and description", () => {
    expect(
      editProjectSchema.parse({
        title: "  Refugee Health  ",
        description: "  Clinics near the border.  ",
      }),
    ).toEqual({
      title: "Refugee Health",
      description: "Clinics near the border.",
    });
  });

  it("accepts an empty description", () => {
    const result = editProjectSchema.safeParse({
      title: "Refugee Health",
      description: "",
    });
    expect(result.success).toBe(true);
  });

  it("requires a description field", () => {
    const result = editProjectSchema.safeParse({ title: "Refugee Health" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank title", () => {
    const result = editProjectSchema.safeParse({
      title: "   ",
      description: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a title");
  });

  it("caps the description at 500 characters", () => {
    const result = editProjectSchema.safeParse({
      title: "Refugee Health",
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Use 500 characters or fewer",
    );
  });
});
