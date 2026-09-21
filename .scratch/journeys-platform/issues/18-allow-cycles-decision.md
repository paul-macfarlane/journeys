# 18: Allow cycles? (decision)

Status: needs-triage
Type: grilling
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: a decision Paul makes alongside the graph tidy-up series; implementation, if approved, lands after 17.

**Why cycles are forbidden today (spec "Back navigation", lines 174 and 194):** a Run's path is a single linear route, and every navigation is classified by whether the target Step is already on the path: not on it → a forward Choice (append); on it → a backtrack (truncate to it). That classification only works if a Step can appear at most once on a path, which is exactly what "no Choice may target a Step that can reach it" guarantees. Ticket 06 leaned on it again: browsers serve Back from cache, so the server may see a Choice taken from a page it no longer considers current, and it resolves that by finding the latest Step on the path offering that Choice — unambiguous only without loops. The cost paid so far: four looping Choices dropped from legacy cases 1 and 2 during ticket 04 (with Paul's approval), and every author who wants "wait three months → back to the clinic" is refused at publish.

**What allowing cycles would take:**

1. Path model: the path keeps repeats; a Run gains a `position` (index into the path). The in-app Back button pops one entry. A step URL navigation is resolved as: a Choice of the current Step → forward; otherwise the latest earlier occurrence on the path → backtrack; otherwise refused. The one ambiguous case (the target is both a Choice of the current Step and earlier on the path, i.e. a loop closing) is disambiguated by history state: the runner stores the path index in `history.state`, so browser Back carries its index and a fresh click does not. Cap path length (e.g. 500) so a loop cannot grow a Run without bound.
2. Analytics (ticket 10, not built yet): choice take-rate and abandonment already work on ordered paths with repeats; ending counts unaffected. Define once whether a Step visited twice counts once or twice for abandonment.
3. Validation: drop the `cycle` rule (and its Seam A cases); the canvas stops marking cycles.
4. Restore the four dropped legacy Choices in the seed documents.

Estimated at roughly a day including runner tests and e2e (`runner-back-and-choose-again` gets a loop case).

**Recommendation:** worth allowing if authors want loops, and the legacy stories say they do. The unambiguous-path property the spec prized is preserved by the history-state index rather than by the graph shape. Keep the rule until this is decided; ticket 16 marks cycles as problems rather than refusing them at drop time so nothing has to be undone.

Decision needed from Paul: allow cycles (implement 1–4 as a ticket after 17) or keep the rule (close as `wontfix` and let ticket 16 refuse cycle-closing drops with a message).

## Comments
