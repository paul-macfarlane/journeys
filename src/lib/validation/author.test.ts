import { describe, expect, it } from "vitest";

import { confirmsAccountEmail } from "@/lib/validation/author";

/**
 * Seam A for ticket 77's confirmation rule: the one comparison both the
 * "Delete account" dialog and `deleteAccountAction` make.
 */
describe("confirmsAccountEmail", () => {
  it("accepts the account's email typed exactly", () => {
    expect(
      confirmsAccountEmail("author@example.com", "author@example.com"),
    ).toBe(true);
  });

  it("accepts it padded and in another case, either side", () => {
    expect(
      confirmsAccountEmail("  AUTHOR@Example.com ", "Author@example.COM"),
    ).toBe(true);
  });

  it("refuses a different email", () => {
    expect(
      confirmsAccountEmail("someone-else@example.com", "author@example.com"),
    ).toBe(false);
  });

  it("refuses a blank field", () => {
    expect(confirmsAccountEmail("", "author@example.com")).toBe(false);
    expect(confirmsAccountEmail("   ", "author@example.com")).toBe(false);
  });

  it("refuses a prefix of the email", () => {
    expect(confirmsAccountEmail("author@example", "author@example.com")).toBe(
      false,
    );
  });
});
