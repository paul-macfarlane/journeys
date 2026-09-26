// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reloadOnceInBrowser = vi.fn();
vi.mock("@/components/chunk-load-recovery", () => ({
  reloadOnceInBrowser: () => reloadOnceInBrowser(),
}));

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

/**
 * Ticket 74: same reload-once path as `error.tsx`, for an error thrown
 * above every other boundary.
 */
describe("global-error.tsx chunk-load recovery", () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    reloadOnceInBrowser.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reloads once for a chunk-load error", () => {
    const root = createRoot(document.createElement("div"));
    const error = Object.assign(new Error("Loading chunk 4 failed."), {
      digest: "digest-1",
    });

    act(() => {
      root.render(<GlobalErrorPage error={error} reset={() => {}} />);
    });

    expect(reloadOnceInBrowser).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
  });

  it("does not reload for an ordinary error", () => {
    const root = createRoot(document.createElement("div"));
    const error = Object.assign(new Error("something else broke"), {
      digest: "digest-2",
    });

    act(() => {
      root.render(<GlobalErrorPage error={error} reset={() => {}} />);
    });

    expect(reloadOnceInBrowser).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
