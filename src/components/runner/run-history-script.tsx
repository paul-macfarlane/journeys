/**
 * The half of the runner's history handling that cannot wait for React: an
 * inline script the browser runs while it is still parsing the page.
 *
 * It is inline — and a Server Component rather than part of `RunHistory` —
 * because of *when* both of its jobs have to happen.
 *
 * **It remembers this page's path index.** The index in `history.state` is
 * what later tells a Back apart from a Choice, and it is only ever read by a
 * navigation *away* from this page — which a Participant may make the instant
 * the text is on screen, long before a busy server has finished sending the
 * bundle that would hydrate a React effect. An entry that was left before
 * hydration ran would remember nothing, and the Back returning to it would be
 * resolved as a Choice. Written during parsing, the index is there from the
 * moment the Participant can read the Step. The URL is deliberately left
 * alone here; `RunHistory` strips `?at` and `?notice` from it after
 * hydration, through the `replaceState` Next.js patches, so the router's own
 * canonical URL is kept in step.
 *
 * **It corrects a back navigation the server has already misread.** A Back
 * that reaches the server without an index can be resolved by the reducer as
 * a Choice: on a loop-closing Step the Step behind the Participant is also a
 * Choice of the Step they are on, and a Choice is resolved first. Asking
 * again with the index (`?at=`) is what puts the Run's path back to the entry
 * the Participant actually returned to. That correction acts only on a
 * *fresh* document whose navigation type is `back_forward` and whose URL
 * carries no index yet, and only when one of two things is true: the document
 * came from the browser's own cache, so the server never saw the navigation
 * at all (`transferSize === 0`); or the index this page was rendered with
 * differs from the one this history entry remembers, which is exactly what a
 * Back read as a Choice looks like. With an index remembered it asks again at
 * `?at=<that index>`; with none (an entry from before this shipped) it falls
 * back to a plain reload, still right for every Journey without a loop.
 *
 * The correction is idempotent, so it is safe beside `RunHistory` on the same
 * page: the document it replaces has navigation type `navigate`, and a
 * reloaded one has type `reload`, so neither re-triggers it.
 *
 * The script is dependency-free, ES5-ish JavaScript — it runs before any
 * bundle — and the only value interpolated into it is the server's own
 * `pathIndex`, a number, never a string taken from a request.
 */
export function RunHistoryScript({ pathIndex }: { pathIndex: number }) {
  return (
    <script dangerouslySetInnerHTML={{ __html: historyScript(pathIndex) }} />
  );
}

/** The script itself, with the rendered path index as a number literal. */
function historyScript(pathIndex: number): string {
  return `(function () {
  var rendered = ${Number(pathIndex)};
  var remembered = window.history.state ? window.history.state.pathIndex : null;
  var known = typeof remembered === "number";
  var timing =
    window.performance && window.performance.getEntriesByType
      ? window.performance.getEntriesByType("navigation")[0]
      : null;
  var wentBack = !!timing && timing.type === "back_forward";
  var carriesIndex = new URLSearchParams(window.location.search).has("at");
  var serverNeverSawIt = !!timing && timing.transferSize === 0;

  if (
    wentBack &&
    !carriesIndex &&
    (serverNeverSawIt || (known && remembered !== rendered))
  ) {
    if (known) {
      window.location.replace(window.location.pathname + "?at=" + remembered);
    } else {
      window.location.reload();
    }
    return;
  }

  window.history.replaceState(
    { pathIndex: rendered },
    "",
    window.location.href,
  );
})();`;
}
