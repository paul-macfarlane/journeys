// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GlobalErrorPage from "./global-error";

/**
 * `global-error.tsx` replaces the root layout itself, so it renders its own
 * `<html>` and `<body>` and never assumes the layout's fonts or providers
 * are there — the last-resort page for an error thrown above every other
 * boundary. Same rule as `error.tsx`: "Try again", a way home, never the
 * error's own message.
 */
describe("global-error.tsx", () => {
  it("offers Try again and never renders the error's own message", () => {
    const secret = "a secret the error carried, never shown to anyone";
    const error = Object.assign(new Error(secret), { digest: "digest-1" });

    const markup = renderToStaticMarkup(
      <GlobalErrorPage error={error} reset={() => {}} />,
    );

    expect(markup).toContain("Try again");
    expect(markup).toContain("Journeys");
    expect(markup).not.toContain(secret);
  });
});
