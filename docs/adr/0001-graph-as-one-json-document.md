# ADR-0001: Store each Draft and Published Version as one validated JSON graph document

- Status: Accepted
- Decided: 2026-09-18 (grilling session); written up 2026-09-19
- Deciders: Paul Macfarlane

## Context

A Journey is a graph of Steps joined by Choices. The journeys we are porting
run to roughly 36–64 Steps each, and an Author works on the whole of one in a
single sitting: they rename an Outcome, re-point three Choices, and rewrite a
paragraph, all before they publish anything.

Four facts shape how that graph is stored.

- **A Draft is one working copy.** Every Journey has exactly one Draft, edited
  by the Members of its Project. It is never visible to participants.
- **A Published Version is immutable.** Publishing takes a snapshot of the
  Draft. Editing the Draft afterwards must not change what a participant
  walking the published Journey sees, and restoring an earlier Published
  Version must be possible.
- **A Run is pinned to the Published Version it began on.** A Run's path is a
  list of Step ids, and analytics read those paths back against the version
  they belong to — including the Outcome labels as they read on the day the
  Run happened, not as they read today.
- **The build is a hackathon-sized effort.** Every hour spent on storage
  machinery is an hour not spent on the editor, the runner, or the analytics
  that are the point of the product.

Nothing in the product queries across Steps in SQL. The editor loads a whole
Journey, the runner loads a whole Published Version, the AI authoring feature
projects a whole Journey, and analytics aggregate Runs, not Steps.

## Decision

Each Draft and each Published Version stores its whole graph as one `jsonb`
document.

- The shape is owned by `src/lib/graph/document.ts`: `schemaVersion`,
  `startStepId`, `allowBack`, `steps` keyed by Step id, and `outcomes` keyed by
  Outcome id. A Step carries its title, its rich text, its ordered Choices, an
  optional Prompt, an Outcome id when it is an Ending, and a reserved canvas
  position.
- **Structural validation runs at every write.** Every document that arrives
  from outside enters storage through `graphDocumentSchema`; the two writes the
  application makes on its own — a new Journey's Draft and migration 0002's
  backfill — write the shape `createDraftDocument()` builds. A stored document
  is therefore always a well-formed one. A write from the editor goes through
  `prepareDocumentForWrite`, which reads
  the incoming document loosely, sanitizes every Step's rich text, and then
  parses the result strictly, so what is stored is always the sanitized shape
  even when the editor or a paste hands us something the contract does not
  keep.
- **Graph rules run at publish time.** `validateForPublish` returns a list of
  problems carrying Step and Choice ids: a Start that names no Step, a Choice
  pointing nowhere, a Step unreachable from the Start, an Ending with no
  Outcome or an Outcome that no longer exists, and any Choice that lets a
  participant walk in circles. A Draft is allowed to be broken; a Published
  Version is not.
- **Rich text is sanitized on the way in.** `sanitizeContent` runs server-side
  at every write, allowing only the small set of blocks and marks the editor
  can produce, stripping any link or image whose URL is not an absolute
  `http(s)` address (the text of a stripped link stays), and refusing the write
  outright only when an image has no credit.
- **Outcomes live inside the document.** A Published Version therefore carries
  its own Outcome labels, so a Run analysed a year later is grouped by the
  labels that were true when it was walked.

`startStepId` is a single pointer, which makes "a Journey with two Starts"
impossible to write down at all rather than something to validate against.

## Considered alternatives

### Relational `step` / `choice` / `outcome` rows per version

Give each Step, Choice, and Outcome its own row, with a version id on each.

Rejected. Publishing would mean copying three tables and rewriting every
foreign key to the copied rows, and restoring a version would mean doing it
again in reverse. Immutability would have to be enforced by application code on
every one of those tables rather than being a property of a single row. Loading
a Journey for the editor would be three queries and a reassembly step, and
every edit an Author makes would become an insert/update/delete diff across
three tables. The price buys SQL queries over Steps, which nothing in the
product asks for.

### Event-sourced graph (an append-only log of edits)

Store the Draft as a stream of edit events and fold them to get the current
graph.

Rejected. It answers a question we are not asking — who changed what, when —
at the cost of a fold on every read, a snapshot-and-compaction strategy to keep
that fold cheap, and an event vocabulary that has to be versioned as carefully
as the document would have been. It is also a poor fit for the editor we are
building, where the canvas lays itself out and an Author edits a Step and its
Choices in a side panel, expecting the whole Draft saved.

## Consequences

**Positive**

- Publishing is a copy of one value, and restoring a Published Version is the
  same copy in the other direction. Immutability is a property of a row nobody
  updates.
- One schema describes the Draft, every Published Version, the fixture the
  tests run against, the seeded content, and the shape the AI authoring feature
  projects into. There is one place to change when the graph changes.
- The whole graph is available to the editor and the runner in one read, which
  is what both of them want.
- Publish-time rules are a pure function over a plain value, so they are
  testable without a database and callable from anywhere.

**Negative**

- No SQL over Steps. "Which Journeys mention this phrase" or "how many Steps
  have Prompts" means reading documents, or reaching for `jsonb` operators that
  the schema is not designed for.
- Writes are whole-document and last-write-wins. Two Members editing one Draft
  at the same time will overwrite each other. Acceptable while Projects are
  small; if it stops being acceptable, the fix is per-Step patching or
  optimistic concurrency on the Draft row, not a different storage shape.
- Document size grows with the Journey. At 36–64 Steps of text this is
  comfortable; a Journey an order of magnitude larger would need revisiting.
- Changing the shape means bumping `schemaVersion` and writing an in-code
  upgrader, because documents already stored cannot be migrated by a `jsonb`
  column change alone. Published Versions in particular must stay readable
  forever, so upgraders accumulate rather than being replaced.

The Published Version boundary is where relational querying would be
introduced if it is ever genuinely needed: a published document could be
projected into query-friendly tables without touching how Authors edit.
