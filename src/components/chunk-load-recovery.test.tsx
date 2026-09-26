// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

let pathname = "/projects";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";

/**
 * Ticket 74: the root layout's own listener for a chunk-load failure that
 * surfaces as a window `error` event or an `unhandledrejection` (a rejected
 * dynamic `import()`), rather than reaching a segment's `error.tsx`. The
 * browser is the boundary here: the real `sessionStorage` holds the
 * reload marker and only `location.reload` is stubbed.
 */
describe("ChunkLoadRecovery", () => {
  let reload: Mock<() => void>;
  let root: Root;

  function render() {
    act(() => {
      root.render(<ChunkLoadRecovery />);
    });
  }

  function failWithError(message: string) {
    const error = new Error(message);
    act(() => {
      window.dispatchEvent(new ErrorEvent("error", { error, message }));
    });
  }

  function failWithRejection(message: string) {
    const reason = new Error(message);
    act(() => {
      const event = new Event("unhandledrejection") as PromiseRejectionEvent & {
        reason: unknown;
      };
      Object.defineProperty(event, "reason", { value: reason });
      window.dispatchEvent(event);
    });
  }

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.sessionStorage.clear();
    pathname = "/projects";
    reload = vi.fn();
    vi.spyOn(window.location, "reload").mockImplementation(reload);
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.restoreAllMocks();
  });

  it("reloads once when a chunk-load error event fires", () => {
    render();

    failWithError("Loading chunk 4 failed.");

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload again for a second failure while the marker is present", () => {
    render();

    failWithError("Loading chunk 4 failed.");
    failWithError("Loading chunk 4 failed.");

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload after a fresh page load that still carries the marker", () => {
    render();
    failWithError("Loading chunk 4 failed.");
    reload.mockClear();

    // The reload itself: a new root on the same pathname, marker still set.
    act(() => {
      root.unmount();
    });
    root = createRoot(document.createElement("div"));
    render();
    failWithError("Loading chunk 4 failed.");

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads again once a client-side navigation has changed the pathname", () => {
    render();
    failWithError("Loading chunk 4 failed.");
    reload.mockClear();

    pathname = "/projects/p1";
    render();
    failWithError("Loading chunk 9 failed.");

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload for a normal error event", () => {
    render();

    failWithError("something else broke");

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once for an unhandledrejection carrying a chunk-load error", () => {
    render();

    failWithRejection("Failed to fetch dynamically imported module: /x.js");

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload for an unhandledrejection carrying a normal error", () => {
    render();

    failWithRejection("something else broke");

    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when sessionStorage throws", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    render();

    failWithError("Loading chunk 4 failed.");

    expect(reload).not.toHaveBeenCalled();
  });
});
