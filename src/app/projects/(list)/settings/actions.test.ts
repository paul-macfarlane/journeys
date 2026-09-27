import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Seam A for ticket 77's "Delete account" action: what it refuses before the
 * database is touched, what it asks the data layer, and what happens once
 * the account is gone — with the session, the database, better-auth, and
 * Next's request APIs replaced by doubles.
 */

const doubles = vi.hoisted(() => ({
  session: { user: { id: "author-1", email: "Author@Example.com" } },
  db: {},
  account: { deleteAccount: vi.fn() },
  signOut: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("next/headers", () => ({ headers: doubles.headers }));
vi.mock("next/navigation", () => ({ redirect: doubles.redirect }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => doubles.session),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { signOut: doubles.signOut } } }));
vi.mock("@/db", () => ({ db: doubles.db }));
vi.mock("@/db/account", () => doubles.account);
vi.mock("@/db/users", () => ({ updateAuthorSettings: vi.fn() }));

import { deleteAccountAction } from "./actions";

const REFUSED = { ok: false, error: "Type your account's email to confirm" };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.headers.mockResolvedValue(new Headers());
  doubles.account.deleteAccount.mockResolvedValue({
    ok: true,
    deletedProjectIds: [],
  });
});

describe("deleteAccountAction", () => {
  it("refuses a wrong email without deleting anything", async () => {
    expect(
      await deleteAccountAction({ email: "someone-else@example.com" }),
    ).toEqual(REFUSED);
    expect(doubles.account.deleteAccount).not.toHaveBeenCalled();
    expect(doubles.signOut).not.toHaveBeenCalled();
  });

  it("refuses a missing or blank email without deleting anything", async () => {
    expect(await deleteAccountAction({})).toEqual(REFUSED);
    expect(await deleteAccountAction(undefined)).toEqual(REFUSED);
    expect(await deleteAccountAction({ email: "   " })).toEqual(REFUSED);
    expect(doubles.account.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the session's own account for its email in another case, signs out, then lands on / with the notice", async () => {
    await deleteAccountAction({ email: "  author@example.COM " });

    expect(doubles.account.deleteAccount).toHaveBeenCalledWith(
      doubles.db,
      "author-1",
    );
    expect(doubles.signOut).toHaveBeenCalledTimes(1);
    expect(doubles.redirect).toHaveBeenCalledWith("/?notice=account-deleted");

    const [deleted] = doubles.account.deleteAccount.mock.invocationCallOrder;
    const [signedOut] = doubles.signOut.mock.invocationCallOrder;
    const [redirected] = doubles.redirect.mock.invocationCallOrder;
    expect(deleted).toBeLessThan(signedOut);
    expect(signedOut).toBeLessThan(redirected);
  });

  it("answers an account already gone without signing out", async () => {
    doubles.account.deleteAccount.mockResolvedValue({
      ok: false,
      reason: "not-found",
    });

    expect(await deleteAccountAction({ email: "author@example.com" })).toEqual({
      ok: false,
      error: "Your account could not be found",
    });
    expect(doubles.signOut).not.toHaveBeenCalled();
    expect(doubles.redirect).not.toHaveBeenCalled();
  });
});
