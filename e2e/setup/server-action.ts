import type { Page, Request } from "@playwright/test";

/**
 * A server action held in flight, so a state that lasts only as long as the
 * write does ("Saving…", "Deciding…", the leave guard) can be read for as
 * long as a spec needs, and a race with the write can be made certain.
 */
export type HeldServerAction = {
  /** Settles once the first held action's POST has reached the browser's network layer. */
  request: Promise<Request>;
  /**
   * Lets every held action through and takes the route away, waiting for
   * the handler to finish its `route.continue()` so nothing held leaks into
   * the next step (unrouting under it would hand the request to the
   * network and make that call throw).
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
): Promise<HeldServerAction> {
  let letThrough = () => {};
  const held = new Promise<void>((resolve) => {
    letThrough = resolve;
  });
  let arrived: (request: Request) => void = () => {};
  const request = new Promise<Request>((resolve) => {
    arrived = resolve;
  });

  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      const posted = route.request();
      if (posted.method() === "POST" && "next-action" in posted.headers()) {
        arrived(posted);
        await held;
      }
      await route.continue();
    },
  );

  return {
    request,
    release: async () => {
      letThrough();
      await page.unrouteAll({ behavior: "wait" });
    },
  };
}
