// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ErrorPage from "./error";

/**
 * Ticket 83, AC3: no route in the app can be made to throw without a
 * test-only hook (the ticket allows proving the criterion with a unit
 * render instead). What the segment error boundary shows a Participant or
 * an Author never includes the thrown error's own message or stack — only
 * "Try again" (`reset`) and a way home.
 */
describe("error.tsx", () => {
  it("offers Try again and never renders the error's own message", () => {
    const secret = "a secret the error carried, never shown to anyone";
    const error = Object.assign(new Error(secret), { digest: "digest-1" });

    const markup = renderToStaticMarkup(
      <ErrorPage error={error} reset={() => {}} />,
    );

    expect(markup).toContain("Try again");
    expect(markup).not.toContain(secret);
  });
});
