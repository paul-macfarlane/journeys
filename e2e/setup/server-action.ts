import type { Page, Request, Route } from "@playwright/test";

/**
 * A server action held in flight, so a state that lasts only as long as the
 * write does ("Saving…", "Deciding…", the leave guard) can be read for as
 * long as a spec needs, and a race with the write can be made certain.
 */
export type HeldServerAction = {
  /**
   * Settles once the first held action's POST has reached the browser's
   * network layer, and rejects with a message naming the address if none
   * has within the arrival timeout (10 s unless the caller says otherwise),
   * so a spec whose typing or click never posted fails with that reason
   * rather than hanging until the test's own timeout.
   */
  request: Promise<Request>;
  /**
   * Lets every held action through and takes this hold's own route away —
   * any other route on the page stays — waiting for every handler this
   * route started to finish its `route.continue()`, so nothing held leaks
   * into the next step. `page.unroute(url, handler)` does not wait for
   * handlers in flight the way `unrouteAll({ behavior: "wait" })` does
   * (Playwright's "default" behavior), so the hold keeps its own count and
   * waits on it before and after unrouting.
   */
  release: () => Promise<void>;
};

/**
 * Holds every server action posted to `pathname` — the POSTs carrying a
 * `next-action` header — until `release` is called. Any other request to the
 * same address goes straight through.
 */
export async function holdServerAction(
  page: Page,
  pathname: string,
  options: { arrivalTimeout?: number } = {},
): Promise<HeldServerAction> {
  const arrivalTimeout = options.arrivalTimeout ?? 10_000;
  let letThrough = () => {};
  const held = new Promise<void>((resolve) => {
    letThrough = resolve;
  });
  let arrived: (request: Request) => void = () => {};
  let timedOut: (error: Error) => void = () => {};
  const request = new Promise<Request>((resolve, reject) => {
    arrived = resolve;
    timedOut = reject;
  });
  // A spec that only releases never awaits `request`; its rejection must
  // not surface as an unhandled one.
  request.catch(() => {});
  const timer = setTimeout(
    () =>
      timedOut(
        new Error(
          `No server action was posted to ${pathname} within ${arrivalTimeout} ms`,
        ),
      ),
    arrivalTimeout,
  );

  const inFlight = new Set<Promise<void>>();
  const matcher = (url: URL) => url.pathname === pathname;
  const handler = async (route: Route) => {
    const handled = (async () => {
      const posted = route.request();
      if (posted.method() === "POST" && "next-action" in posted.headers()) {
        clearTimeout(timer);
        arrived(posted);
        await held;
      }
      await route.continue();
    })();
    inFlight.add(handled);
    try {
      await handled;
    } finally {
      inFlight.delete(handled);
    }
  };

  await page.route(matcher, handler);

  return {
    request,
    release: async () => {
      clearTimeout(timer);
      letThrough();
      await Promise.allSettled([...inFlight]);
      await page.unroute(matcher, handler);
      // A request that reached the handler while it was being removed.
      await Promise.allSettled([...inFlight]);
    },
  };
}
