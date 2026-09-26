# ADR-0001: Store each Draft and Published Version as one validated JSON graph document

- Status: Accepted
- Amended by: ADR-0002 (2026-09-21) — the "walk in circles" publish rule is withdrawn; cycles are allowed.
- Amended by: ticket 24 (2026-09-22; `spec.md` `[SCOPE CHANGE]` of that date) — the "Ending with no Outcome" publish rule is withdrawn; an Ending may carry an Outcome or not.
- Amended by: ticket 73 (2026-09-26) — writes are no longer last-write-wins: a Draft write is guarded by a version counter, and a Project or Journey settings write by the previous value of each field it changes; a stale write is refused, never merged.
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
  `startStepId`, `allowBack`, `layoutDirection` — which way round the editor
  draws the map, whose zod default keeps every document stored before it
  parseable — `steps` keyed by Step id, and `outcomes` keyed by Outcome id. A
  Step carries its title, its rich text, its ordered Choices, an optional
  Prompt, an Outcome id when it is an Ending, and a reserved canvas position.
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
  pointing nowhere, a Step unreachable from the Start, an Ending tagged with
  an Outcome that no longer exists (an Ending with no Outcome was a problem
  until ticket 24), and any Choice that lets a participant walk in circles. A Draft is allowed to be broken; a Published
  Version is not.
- **Rich text is sanitized on the way in.** `sanitizeContent` runs server-side
  at every write, allowing only the small set of blocks and marks the editor
  can produce, stripping any link or image whose URL is not an absolute
  `http(s)` address (the text of a stripped link stays). Nothing is refused:
  an image keeps whatever alt text and caption it has, empty included, so an
  Author can edit it into shape later (ticket 30; before it, an image without
  a credit refused the write).
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

- No relational rows for Steps. "Which Journeys mention this phrase" or "how
  many Steps have Prompts" means reading documents or querying them with
  `jsonb` operators and indexes, which is sufficient for the needs we can
  foresee; nothing asks for it today.
- Writes are whole-document, so two Members editing one Draft at once edit
  the same value. Since ticket 73 (2026-09-26) the second write is refused
  rather than overwriting the first: nothing is merged, the refused Member
  keeps their edit on screen, is told another Member changed it, and reloads
  to see the change. There is no presence, lock, or real-time editing.
  - **The Draft carries a version counter.** `draft.version` (migration
    0011, an additive column with a default so the code already deployed
    keeps working while Migrate runs) counts the Draft's writes. Every save,
    restore, and publish sends the version the Member read; the write is an
    upsert whose conflict branch updates only while `draft.version` still
    matches, incrementing it, and publish reads the Draft inside its
    transaction under `FOR SHARE` at that version. A counter rather than a
    compared value because the document can be large, and sending it twice
    per save would double the payload.
  - **Settings compare the previous value, per field.** A Project or Journey
    settings write (title, description, Theme, and the Journey's "use a
    different theme" checkbox) sends the values it was edited from and
    writes only the fields that differ from them, each guarded by
    `IS NOT DISTINCT FROM` its previous value. One counter per row would make
    a Member conflict with themselves — three loops write one Project row,
    and publish, unpublish, and move write the Journey row — while a
    per-field compare lets them all pass each other. The previous value is
    what the server stored (titles trimmed, content sanitized), never what
    the client sent, or every second save would be refused.
  - **What a value compare cannot see.** A field changed A → B → A by
    another Member passes the guard, because the value is what it was when
    the edit began. For a title or a Theme that is the right answer: nothing
    the Member overwrites differs from what they saw.
  - Both guards run through one data-layer helper (`src/db/guarded-write.ts`)
    that tells a failed guard (`stale`) from a row that went away
    (`not-found`) by reading the row again.
- Document size grows with the Journey. At 36–64 Steps of text this is
  comfortable; a Journey an order of magnitude larger would need revisiting.
- Changing the shape means bumping `schemaVersion` and writing an in-code
  upgrader, because documents already stored cannot be migrated by a `jsonb`
  column change alone. Published Versions in particular must stay readable
  forever, so upgraders accumulate rather than being replaced.

The Published Version boundary is where relational querying would be
introduced if it is ever genuinely needed: a published document could be
projected into query-friendly tables without touching how Authors edit.
