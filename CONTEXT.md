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

**Caption**:
The visible line under an image in a step's content. Optional; a credit or attribution is simply written into it. Stored as the image's `caption` (documents written before ticket 30 named it `credit`, which is read as the caption).
_Avoid_: Credit, subtitle, figcaption

**Alt text**:
The description of an image for people who cannot see it, read by assistive technology and never displayed. Required by the image dialog; a stored image without it is kept and can be edited into shape.
_Avoid_: Caption, title, description

**Start**:
The single step a journey begins on. Every journey has exactly one.
_Avoid_: Root, entry node

**Ending**:
A step with no choices. It may carry an outcome that groups it for analysis; one without is an ending on its own.
_Avoid_: Terminal, leaf, end node, dead end

**Outcome**:
An author-defined, journey-scoped label that groups endings for analysis (e.g. "Reached care", "Death"). Identified by a stable id so its text can be renamed. Made, chosen, and renamed from an ending's panel, and removed from the journey when the last ending drops it.
_Avoid_: Result, ending type, category

## Publishing

**Canvas**:
The editor's map of a draft: every step drawn as a box, every choice as an arrow between boxes, laid out automatically and never by hand, top to bottom or left to right — a choice stored on the draft and shared by the project's members. Clicking a box opens that step in the panel, which can be hidden to give the map the whole width; hiding it is remembered per browser, never on the journey. The view is the author's and moves only when they ask for it, and the box they click carries "Step actions", which opens onto the moves that shape the journey around that step. The journey is built here as well as read here: a choice dragged onto bare map makes the step it leads to along with it, only the arrow in hand has a head to take hold of and move, and clicking an arrow opens its step with that choice's row marked. The Analytics tab draws a published version the same way, read-only, with the numbers of its runs on every box and arrow.
_Avoid_: Graph view, diagram, board, flowchart

**Draft**:
The single mutable working copy of a journey that authors edit. Never visible to participants.
_Avoid_: Working version, unpublished version

**Published Version**:
An immutable snapshot of a journey's draft created by publishing. At most one is live to participants at a time; earlier ones are retained for run history and restore.
_Avoid_: Release, revision, snapshot

**Run**:
One participant's walk through one published version, from start to an ending or abandonment. Created when a participant takes their first choice, never by merely opening the journey; pinned to the version it began on; its path is the participant's current route, not every detour.
_Avoid_: Session, playthrough, attempt

**Completion**:
A run that has reached an ending at least once. Backtracking from the ending afterwards does not undo it; a run that never reaches an ending is abandoned. The run's outcome is that of the latest ending it reached.
_Avoid_: Finish, success

**Backtrack**:
A participant returning to an earlier step in their run to choose differently.
_Avoid_: Undo, rewind

## Participation

**Judge**:
The AI reader that picks a choice for a deciding prompt's response. Sees only the step it is asked about, never an ending, an outcome, another step, or another participant's response; may find a response unclear; when it does, or has no answer, the participant chooses instead.
_Avoid_: AI, judge model, evaluator

**Preview**:
An author walking the draft in the participant runner. Records no run.
_Avoid_: Test mode, dry run

**Prompt**:
An optional free-text question attached to a step that a participant may answer before choosing. A prompt may decide the next step: a deciding prompt is required, and its response is judged against the step's choices instead of the participant picking one directly.
_Avoid_: Input, form, field, question

**Response**:
A participant's answer to a prompt within one run. Readable by authors, never shown to participants.
_Avoid_: Answer, submission, feedback

## Collaboration

**Member**:
An author who belongs to a project and may do everything within it. All members are equal.
_Avoid_: Owner, editor, collaborator, admin

**Theme**:
A small set of visual tokens (colors, font) applied to the participant runner. Set per project, optionally overridden per journey.
_Avoid_: Skin, style, palette, brand
