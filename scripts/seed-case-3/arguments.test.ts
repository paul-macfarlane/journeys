import { describe, expect, it } from "vitest";

import { readArguments } from "./arguments";

/**
 * The seam a person actually touches: what they typed after
 * `pnpm seed:case-3`. Every rejection here is the exit-2 usage error.
 */
describe("readArguments", () => {
  it("reads the Author's email", () => {
    expect(readArguments(["author@example.test"])).toEqual({
      email: "author@example.test",
      writeFixture: false,
    });
  });

  it("reads --write-fixture in either position", () => {
    expect(readArguments(["author@example.test", "--write-fixture"])).toEqual({
      email: "author@example.test",
      writeFixture: true,
    });
    expect(readArguments(["--write-fixture", "author@example.test"])).toEqual({
      email: "author@example.test",
      writeFixture: true,
    });
  });

  it("refuses an unknown flag rather than ignoring it", () => {
    expect(
      readArguments(["author@example.test", "--write-fixtures"]),
    ).toBeNull();
    expect(readArguments(["--bogus", "author@example.test"])).toBeNull();
  });

  it("refuses a second email rather than picking one", () => {
    expect(readArguments(["one@example.test", "two@example.test"])).toBeNull();
  });

  it("refuses no email at all", () => {
    expect(readArguments([])).toBeNull();
    expect(readArguments(["--write-fixture"])).toBeNull();
    expect(readArguments([""])).toBeNull();
  });
});
