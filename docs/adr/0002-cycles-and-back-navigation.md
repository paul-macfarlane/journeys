# ADR-0002: Allow cycles; keep every visit on the Run's path

- Status: Accepted
- Decided: 2026-09-21 (canvas feedback)
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

**Resolution order for a navigation to Step X**, the rules
`src/lib/graph/run.ts` documents and applies, in the order it applies them:

1. X is not a Step of this document at all → refused.
2. The navigation carries a path index (`at`) naming an entry of the path
   that holds X → that entry. An earlier entry is a backtrack to it (the path
   truncates there, one backtrack counted); the last entry is a stay. Any
   other index — out of range, a different Step, not a whole number — is
   stale or made up, and is ignored from here on.
3. X is the current Step → stay. Because this is checked before rule 4, a
   Choice that targets its own Step is a stay too: the Participant never left
   the screen, so the path records no second visit for it.
4. X is a Choice of the current Step → forward: append X. Checked before
   rule 5, so closing a loop by choosing is always a forward move, never
   mistaken for a backtrack. With the path already at its cap there is
   nowhere to append, and the move is refused (see below).
5. X is already on the path → backtrack to its **latest** occurrence:
   truncate the path there and count one backtrack.
6. X is offered by an earlier Step on the path (ticket 06's cached-page
   rule), the **latest** such Step → truncate to that Step, count a
   backtrack, then append X.
7. Otherwise → refused; the Participant is redirected to the current Step.

**The one genuinely ambiguous case is disambiguated by an index, not
content.** Browser Back on a loop-closing Step — where the Step behind the
Participant is both the previous path entry and a Choice of the Step they are
on — cannot be told apart by X alone: it is simultaneously "the target of
rule 4" and "the target of rule 5". Every step page stores the path's index
in `history.state`, and a back navigation sends that index back to the server
as `?at=<n>`. A request that carries `at` naming an index earlier than the
current one, for a Step the path already holds at that index, is a backtrack
to that index and skips rules 3–6 entirely. The in-app Back link carries
`?at=<current index − 1>`, for the same reason.

As built, that is two pieces, split by **when** each has to run, not by what
it does. Both replace `ReloadOnRestore`.

- An **inline script** the step page renders at the top of its output
  (`RunHistoryScript`) runs while the browser is still parsing, before any
  bundle loads. It remembers the index, and it corrects a _fresh_ document
  built by a back/forward navigation whose URL carries no index — when either
  the document came from the browser's cache (the server never saw the
  navigation) or the index it was rendered with differs from the one this
  history entry remembers (the server saw it and resolved it as a Choice).
  Both jobs are here because both are lost if they wait: a Participant can
  leave a Step the instant it is readable, and on a busy server hydration can
  be minutes behind that. An entry left before hydration would remember no
  index at all, and the Back returning to it would read as a Choice.
- The **client component** (`RunHistory`) keeps what genuinely needs React: a
  document restored from the back/forward cache, which fires `pageshow` with
  `persisted` and makes no request at all, is always sent back to the server
  at the remembered index; and `?at` and `?notice`, read by the server and
  wanted nowhere else, are stripped from the URL through the `replaceState`
  Next.js patches, so the router's canonical URL stays in step.

An entry from before this shipped carries no usable index, and both pieces
fall back to a plain reload — still correct for every Journey that has no
loop, and the one case where a loop-closing Back might briefly read as a
fresh Choice instead.

**The path is capped at 500 entries.** A loop can be walked forever; the path
is one row's worth of JSON, so a forward move that would grow it past the cap
is refused with a short, Participant-facing notice — "This journey has gone
on too long to continue. Start over to keep going." — instead of growing
unbounded. The Start over control is rendered beside that notice, since the
Step a refused Participant is left on is never an Ending and would otherwise
offer no way to act on what it just told them.

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
- The index is a query parameter, so a Participant can forge one. `?at=<n>`
  naming an earlier occurrence of the Step they are on truncates their own
  path further than Back would have, and counts a backtrack that no Back
  took. The damage is self-inflicted analytics noise, confined to entries
  that Run already holds: the rule only accepts an index whose entry is the
  Step being navigated to, so a forged index can never add a Step, jump to
  one the Participant never reached, or touch another Participant's Run.
- 500 is an arbitrary cap, chosen to bound the JSON one `run` row stores
  without ever being visibly reachable by a legitimate walk through a
  36–64-Step legacy journey; a Participant (or a bot) who wants to hit it
  only has to keep choosing the same loop.
