import { describe, expect, it } from "vitest";

import { addMemberSchema } from "@/lib/validation/member";

/**
 * Seam A for ticket 13: the schema behind the "Add member" form. Expected
 * values are written out rather than derived the way the schema derives
 * them.
 */
describe("addMemberSchema", () => {
  it("trims and lowercases a padded, mixed-case email", () => {
    const result = addMemberSchema.parse({
      email: "  Author@Example.com  ",
    });
    expect(result.email).toBe("author@example.com");
  });

  it("rejects a blank email", () => {
    const result = addMemberSchema.safeParse({ email: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter an email address");
  });

  it("rejects a non-address", () => {
    const result = addMemberSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter an email address");
  });
});
