// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reloadOnceInBrowser = vi.fn();
vi.mock("@/lib/chunk-load-browser", () => ({
  reloadOnceInBrowser: () => reloadOnceInBrowser(),
}));

import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";

/**
 * Ticket 74: the root layout's own listener for a chunk-load failure that
 * surfaces as a window `error` event or an `unhandledrejection` (a rejected
 * dynamic `import()`), rather than reaching a segment's `error.tsx`.
 */
describe("ChunkLoadRecovery", () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    reloadOnceInBrowser.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reloads once when a chunk-load error event fires", () => {
    const root = createRoot(document.createElement("div"));
    act(() => {
      root.render(<ChunkLoadRecovery />);
    });

    const error = new Error("Loading chunk 4 failed.");
    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", { error, message: error.message }),
      );
    });

    expect(reloadOnceInBrowser).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
  });

  it("does not reload for a normal error event", () => {
    const root = createRoot(document.createElement("div"));
    act(() => {
      root.render(<ChunkLoadRecovery />);
    });

    const error = new Error("something else broke");
    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", { error, message: error.message }),
      );
    });

    expect(reloadOnceInBrowser).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("reloads once for an unhandledrejection carrying a chunk-load error", () => {
    const root = createRoot(document.createElement("div"));
    act(() => {
      root.render(<ChunkLoadRecovery />);
    });

    const reason = new Error(
      "Failed to fetch dynamically imported module: /x.js",
    );
    act(() => {
      const event = new Event("unhandledrejection") as PromiseRejectionEvent & {
        reason: unknown;
      };
      Object.defineProperty(event, "reason", { value: reason });
      window.dispatchEvent(event);
    });

    expect(reloadOnceInBrowser).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
  });

  it("does not reload for an unhandledrejection carrying a normal error", () => {
    const root = createRoot(document.createElement("div"));
    act(() => {
      root.render(<ChunkLoadRecovery />);
    });

    const reason = new Error("something else broke");
    act(() => {
      const event = new Event("unhandledrejection") as PromiseRejectionEvent & {
        reason: unknown;
      };
      Object.defineProperty(event, "reason", { value: reason });
      window.dispatchEvent(event);
    });

    expect(reloadOnceInBrowser).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
