# Journeys

A platform for authoring and running branching, text-based journeys: a participant reads a step, makes a decision, and lives with the consequence. The migrant-healthcare empathy cases on the legacy site are one example use, not the domain.

## Language

**Journey**:
A single branching, text-based experience a participant walks through from a start to one of several endings. Belongs to exactly one project.
_Avoid_: Story, case, module, game

**Project**:
A named grouping of journeys that is owned and collaborated on as a unit, and presented to participants as a set through its public page.
_Avoid_: Collection, workspace, case set, course

**Author**:
A signed-in person who creates and edits journeys within a project they belong to.
_Avoid_: Admin, editor, creator, user

**Participant**:
An anonymous person walking through a published journey. Never has an account.
_Avoid_: User, player, reader, visitor

## Journey structure

**Step**:
One screen a participant reads within a journey. Has rich-text content and zero or more choices.
_Avoid_: Node, passage, page, scene

**Choice**:
One option shown on a step that leads the participant to another step.
_Avoid_: Decision, link, edge, option

**Start**:
The single step a journey begins on. Every journey has exactly one.
_Avoid_: Root, entry node

**Ending**:
A step with no choices. Every ending is tagged with exactly one outcome.
_Avoid_: Terminal, leaf, end node, dead end

**Outcome**:
An author-defined, journey-scoped label that groups endings for analysis (e.g. "Reached care", "Death"). Identified by a stable id so its text can be renamed.
_Avoid_: Result, ending type, category

## Publishing

**Canvas**:
The editor's map of a draft: every step drawn as a box, every choice as an arrow between boxes, laid out automatically and never by hand, top to bottom or left to right — a choice stored on the draft and shared by the project's members. Clicking a box opens that step in the panel, which can be hidden to give the map the whole width; hiding it is remembered per browser, never on the journey.
_Avoid_: Graph view, diagram, board, flowchart

**Draft**:
The single mutable working copy of a journey that authors edit. Never visible to participants.
_Avoid_: Working version, unpublished version

**Published Version**:
An immutable snapshot of a journey's draft created by publishing. At most one is live to participants at a time; earlier ones are retained for run history and restore.
_Avoid_: Release, revision, snapshot

**Run**:
One participant's walk through one published version, from start to an ending or abandonment. Pinned to the version it began on; its path is the participant's current route, not every detour.
_Avoid_: Session, playthrough, attempt

**Backtrack**:
A participant returning to an earlier step in their run to choose differently.
_Avoid_: Undo, rewind

## Participation

**Prompt**:
An optional free-text question attached to a step that a participant may answer before choosing.
_Avoid_: Input, form, field, question

**Response**:
A participant's answer to a prompt within one run. Readable by authors, never shown to participants.
_Avoid_: Answer, submission, feedback

**Preview**:
An author walking the draft in the participant runner. Records no run.
_Avoid_: Test mode, dry run

## Collaboration

**Member**:
An author who belongs to a project and may do everything within it. All members are equal.
_Avoid_: Owner, editor, collaborator, admin

**Theme**:
A small set of visual tokens (colors, font) applied to the participant runner. Set per project, optionally overridden per journey.
_Avoid_: Skin, style, palette, brand
