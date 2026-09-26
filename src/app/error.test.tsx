// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reloadOnceInBrowser = vi.fn();
vi.mock("@/components/chunk-load-recovery", () => ({
  reloadOnceInBrowser: () => reloadOnceInBrowser(),
}));

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

/**
 * Ticket 74: a `ChunkLoadError` reaching this boundary (a tab open across a
 * deploy, its first client-side navigation after the old build's assets
 * are gone) gets the reload-once path instead of just this page.
 */
describe("error.tsx chunk-load recovery", () => {
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
      root.render(<ErrorPage error={error} reset={() => {}} />);
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
      root.render(<ErrorPage error={error} reset={() => {}} />);
    });

    expect(reloadOnceInBrowser).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
