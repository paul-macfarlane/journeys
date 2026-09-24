import { describe, expect, it } from "vitest";

import { createJourneySchema } from "@/lib/validation/journey";

/**
 * Ticket 47: the New Journey dialog asks for a title only, so the create
 * schema has to stand in for the description the dialog no longer sends.
 * The action's contract is unchanged: `description` is still a string on
 * the way out, whether or not the caller supplied one.
 */
describe("createJourneySchema", () => {
  it("defaults a missing description to the empty string", () => {
    expect(createJourneySchema.parse({ title: "Border Crossing" })).toEqual({
      title: "Border Crossing",
      description: "",
    });
  });

  it("keeps a description a caller does send, trimmed", () => {
    expect(
      createJourneySchema.parse({
        title: "Border Crossing",
        description: "  A family decides.  ",
      }),
    ).toEqual({ title: "Border Crossing", description: "A family decides." });
  });

  it("still caps a supplied description at 500 characters", () => {
    const result = createJourneySchema.safeParse({
      title: "Border Crossing",
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Use 500 characters or fewer",
    );
  });

  it("rejects a blank title", () => {
    const result = createJourneySchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a title");
  });
});
