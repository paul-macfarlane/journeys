# ADR-0002: Allow cycles; keep every visit on the Run's path

- Status: Accepted
- Decided: 2026-09-21 by Paul Macfarlane
- Deciders: Paul Macfarlane

## Context

ADR-0001 set the rule that publish-time validation rejects a graph with a
cycle — a Choice may not target a Step that can reach it. Two things leaned on
that rule once it existed.

- **Back navigation was defined against a Step appearing at most once.** A
  Run's path was "the participant's current linear route": choosing a Choice
  always led to a Step not yet on the path, and any navigation to a Step
  already on the path was unambiguously a backtrack. With no cycles, a Step
  can only ever be reached once per Run, so "is this Step already on the
  path" answers "is this a backtrack" with no further work.
- **Ticket 06's cached-page rule leaned on it again.** A browser can serve a
  Back navigation from its own cache without asking the server, so a
  Participant can choose from a page the server never saw as current. Ticket
  06 resolves that by taking the Choice from the latest Step on the path that
  offers it — a resolution that is only safe because the graph has no cycles
  to make "latest" ambiguous.

The rule cost something on the way in. Porting the three legacy journeys from
`paul-macfarlane/journey` in ticket 04, four Choices looped back to a Step
already reachable from where they pointed — case 1's "Yes" on "Detention 1"
(back to the Preface), and case 2's "Call the legal organization" on "Call
Sponsor", "Call your bunkmate's cousin's friend" on "I quit!", and "Go home,
and try again later" on "ER" (all three looping into earlier parts of the
graph). All four were dropped rather than ported, because publishing either
document would otherwise have failed the no-cycles rule outright.

Having built the canvas (ticket 09) and used it, Paul reversed the rule:

> As long as we have a fix, we shouldn't limit users.

A journey author should be free to write a Step that loops — "try again",
"ask once more", "go back to the waiting room" — without the platform second-
guessing the shape of the story. The fix is what this ADR records.

## Decision

**Cycles are allowed at publish time.** `validateForPublish` drops the
no-cycles rule entirely; a Choice may target any Step, including one that can
reach it. The canvas stops marking a loop as a problem — `problemsByAddress`
needed no change, since the cycle check is simply gone from what it renders.

**A Run's path keeps every visit, repeats included.** "Current" is no longer
"the one entry that happens to hold this Step's id" — with a loop, a Step id
can now appear more than once — but simply the path's last entry. This is the
one substantive change to `src/lib/graph/run.ts`'s contract; the reducer's
own doc comment says so directly rather than continuing to cite a no-cycles
guarantee that no longer holds.

**Resolution order for a navigation to Step X:**

1. X is a Choice of the current Step → forward: append X. Checked first, so
   closing a loop by choosing is always a forward move, never mistaken for a
   backtrack.
2. X is already on the path → backtrack to its **latest** occurrence:
   truncate the path there and count one backtrack.
3. X is offered by an earlier Step on the path (ticket 06's cached-page
   rule) → truncate to that Step, count a backtrack, then append X.
4. Otherwise → refused; the Participant is redirected to the current Step.

**The one genuinely ambiguous case is disambiguated by an index, not
content.** Browser Back on a loop-closing Step — where the Step behind the
Participant is both the previous path entry and a Choice of the Step they are
on — cannot be told apart by X alone: it is simultaneously "the target of
rule 1" and "the target of rule 2". The runner writes the path's index into
`history.state` on every step page render (`RunHistory`, replacing
`ReloadOnRestore`); a restored page (a `pageshow` with `persisted`, or a
navigation of type `back_forward`) sends that index back to the server as
`?at=<n>` instead of reloading plainly. A request that carries `at` naming an
index earlier than the current one, for a Step that path already holds at
that index, is a backtrack to that index and skips rules 1–3 entirely. The
in-app Back link also carries `?at=<current index − 1>`, for the same reason.
An entry from before this shipped carries no usable index and falls back to
the plain reload — still correct for every Journey that has no loop, and the
one case where a loop-closing Back might briefly read as a fresh Choice
instead.

**The path is capped at 500 entries.** A loop can be walked forever; the path
is one row's worth of JSON, so a forward move that would grow it past the cap
is refused with a short, Participant-facing notice ("This journey has gone on
too long to continue; start over to keep going") instead of growing
unbounded.

**The four legacy Choices are restored.** `scripts/seed/journey-stories/`
case-1 and case-2 regain the Choices dropped in ticket 04, in their legacy
position among each Step's Choices, renumbered `step-<N>-choice-<i>` in that
order (the seed's existing convention; Drafts are replaced wholesale on
reseed, so no stored Choice id is load-bearing elsewhere). Case-1's "Detention"
Step stays omitted — nothing in the legacy data links to it, which has
nothing to do with cycles.

**Analytics contract for ticket 10**, since a path is no longer "the set of
Steps visited":

- A path may repeat a Step; counting distinct Steps visited is a set
  operation over the path's _values_, not its length.
- Abandonment reads a Run's **last** path entry only — the Step the
  Participant was last on — never an earlier occurrence of the same Step
  earlier in the path.
- A Choice's take-rate counts every traversal of it across every Run, so a
  Choice walked twice in one Run (once each way around a loop) counts twice.

## Considered alternatives

### Keep the no-cycles rule; seed case 1 and case 2 as Drafts that never publish

Leave `validateForPublish` as ADR-0001 wrote it, and stop pretending the two
legacy cases with a loop in their source data can be Published Versions at
all — seed them as Drafts an Author could in principle publish once they
manually removed the looping Choices.

Rejected. It does not solve the problem Paul named; it just relocates it from
"four Choices silently dropped" to "two of three demo journeys silently
non-publishable", which is worse for the hackathon demo, not better. It also
leaves every future author who writes a genuinely useful loop — "try again",
"ask once more" — with no path to publishing at all.

### An event table instead of paths

Record every navigation as its own row (Step entered, timestamp, kind) and
compute a Run's route by folding the event log, rather than storing an
ordered array on the `run` row.

Rejected on the same grounds ADR-0001 rejected an event-sourced graph: it
answers a question nothing here is asking (a full audit trail of every
navigation, including refused ones) at the cost of a fold on every analytics
read and a second schema to keep in step with the reducer. The path array
already answers every question ticket 10 needs — repeats and all — once
"current" is redefined as the last entry instead of assumed-unique.

### A per-visit token in every step URL

Give each visit to a Step its own opaque token, carried in the step URL
(`/j/{journey}/steps/{token}`) instead of a bare Step id, so the URL itself
disambiguates which visit a Back is returning to.

Rejected. It replaces one small, local piece of state (an index the runner
already needs to carry somewhere) with a URL scheme every existing bookmark,
QR code, and the `runner-pinned-version` test's assumptions about
`/j/{journeyId}/{stepId}` would have to change to accommodate, for a problem
`history.state` already solves without touching the address a Participant
sees or shares.

## Consequences

**Positive**

- Authors write loops without the platform refusing to publish them, which
  is the whole of what Paul asked for.
- The four legacy Choices ticket 04 dropped are back, so the seeded case-1
  and case-2 journeys read as the legacy site actually wrote them.
- The disambiguation lives in one small, testable place — an index carried
  in `history.state` and echoed back as `?at=` — rather than spreading
  cycle-awareness through the runner's every navigation handler.

**Negative**

- A Run's path is no longer safely treated as a set. Any code (present or
  future) that assumed "is this Step in the path" meant "has the Participant
  been here" already needs to mean "is this Step the path's current or a
  past entry, possibly more than once" — the analytics contract above exists
  because this stopped being free.
- The disambiguating index lives in browser history state, which is
  ephemeral in ways a database row is not: a very old back/forward-cache
  entry, or one from before this shipped, carries no index and falls back to
  a plain reload. That fallback is correct for a loop-free Journey and only
  slightly wrong for a loop-closing Back on a very stale cached page — an
  acceptable edge over building anything sturdier for it.
- 500 is an arbitrary cap, chosen to bound the JSON one `run` row stores
  without ever being visibly reachable by a legitimate walk through a
  36–64-Step legacy journey; a Participant (or a bot) who wants to hit it
  only has to keep choosing the same loop.
