# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

<!-- atlas-v3:tracker:start -->
# Issue tracker

Tracker type: **local**.

This document is the authoritative repository policy for tracker reads, writes,
readiness, availability, claims, ownership, transitions, human-only actions,
and planning-artifact publication.

## States

| State | Meaning |
|---|---|
| `needs-triage` | Intake. Captured but not yet evaluated by a maintainer. |
| `needs-info` | Blocked awaiting more information from the reporter. |
| `planning` | A plan is being written for this issue. |
| `plan-review` | The plan awaits review before implementation starts. |
| `in-progress` | Implementation is underway in a worktree. |
| `ai-review` | Implementation is complete and under automated review. |
| `ready-for-human` | Awaiting human review or human implementation. |
| `done` | Accepted and complete. Set in the work package's own closeout commit on its PR; it becomes true on `staging` only when the human merges. |
| `wontfix` | Will not be actioned. |

Human-only states: `ready-for-human`, `done`, `wontfix`. A human enters `done` by merging the PR that carries it (see below).

Recommended lifecycle: `needs-triage` → `needs-info` → `planning` → `plan-review` → `in-progress` → `ai-review` → `ready-for-human` → `done` → `wontfix`.

## Read and write rules

- Read the complete ticket and comments before planning or implementation.
- Check for available work before claiming. Available work is ready to
  implement, unclaimed, in an eligible state, has no active impediment or
  blocking decision, and every `blocked by` ticket is in
  `done` on the current base branch (`staging`); read statuses there, never from an open PR's branch. A dependency that is not a `blocked by` edge does
  not make work unavailable.
- Claim before starting work and use one active owner. Enter
  `needs-triage` only when starting any work.
- Enter `planning` only when planning starts and
  `plan-review` only when the plan is ready for review.
- Enter `in-progress` only when implementation starts.
- Enter `ai-review` only when aggregate AI code review starts.
- Record blocks, approved scope changes, proof of work, and the PR URL.
- Enter `ready-for-human` only after verification and PR creation.
- Compare the next Atlas phase with the last-known tracker state from the
  initial ticket read or most recent successful transition. Do not fetch the
  ticket solely for this comparison. When both map to the same state, record
  the phase in its configured phase record or comment without requesting a
  same-status transition.
- At closeout, after verification and PR creation succeed, set `Status: done` in the closeout commit on the work-package branch and push it as the PR head, with the `[CLOSEOUT]` record naming the PR. Merging that PR is the human's acceptance and is what lands `done` on `staging`; an unmerged or closed PR leaves the ticket at its base-branch status. No follow-up PR is ever opened just to change a status. `ready-for-human` therefore appears only in the state log, never as the resting status of a delivered ticket. (Paul, 2026-09-21: mark done pre-emptively in the original PR.)
- When blocked, preserve work, record the exact reason and resume instructions,
  and follow the configured blocked-state behavior. On resume, reread the ticket
  and avoid duplicating claims, transitions, workers, commits, or comments.
- Planning artifact storage: **tracker**.
- Drafts before approval: **false**.
- Preview exact plan writes and transitions before publishing them. If drafts
  are not permitted, return the draft without presenting it as tracker state.
- Preserve stable ticket/spec requirements. Record evolving execution in
  `[EXECUTION PLAN]`, `[PROGRESS]`, `[SCOPE CHANGE]`, `[BLOCKED]`,
  `[AI CODE REVIEW]`, and `[CLOSEOUT]` records rather than silently rewriting
  the contract. Write the complete AI Code Review output to the ticket before
  entering `ready-for-human`.

Before creating, classifying, prioritizing, or decomposing tickets, also read
and follow `docs/agents/triage-labels.md`. Do not infer labels or priority from
this document.

## Readiness

Ready to plan: The issue file exists under .scratch/<feature-slug>/issues/ and carries Status: ready-for-agent or Status: needs-triage with a stated problem and outcome.

Ready to implement: An approved plan exists for the issue and its Status: line reads ready-for-agent.

Available to claim: Status: is not claimed, no Blocked by: line lists an unresolved issue file, and no owner is recorded on the Owner: line.

## Sources and pull requests

| Repository | Path | Source host | Base branch | PR creation command |
|---|---|---|---|---|
| `journeys` | `.` | github | `staging` | `gh pr create --base staging --head <feature-branch>` |

Open one PR per affected repository. PRs target `staging` first; a human promotes `staging` to `main` (production) with a separate human-opened PR. Never open a PR against `main`.

The tracker and source host may differ. Never infer tracker operations from the
source host.

## Atlas closeout record

Record every repository delivery, deliverable and worker/model, each DoD
outcome and evidence, deviations, verified run command, deployed smoke when
applicable, every PR URL, and the AI Code Review output.
<!-- atlas-v3:tracker:end -->

## Proportional records (team policy, Paul, 2026-09-21)

Every ticket carries a `Route:` line, `polish` or `contract`, defined in
`docs/agents/testing.md` ("Proportional verification"). The record ladder
above is the `contract` ladder. A `polish` ticket writes only the
`[CLOSEOUT]` record (PR URL, commands run, reviewer verdict, evidence paths)
and skips `[EXECUTION PLAN]` and `[PROGRESS]`; `[SCOPE CHANGE]` and
`[BLOCKED]` are still written whenever they happen. Both routes still set
`Status: done` in the closeout commit on the PR.

## Priority (team policy, Paul, 2026-09-26)

`.scratch/<feature-slug>/backlog.md` is the single source of truth for the
order of work. For this repository that is
`.scratch/journeys-platform/backlog.md`. Tickets never carry the order
themselves.

- **Choosing work.** The next ticket is the first row of the backlog's
  "Ordered" table that is not `done` and is available to claim (see
  "Readiness"). A `Blocked by:` ticket earlier in the same chunk counts as
  available once its closeout commit is on the chunk's branch. Never pick by ticket number, by a ticket's own text, or by a
  chat transcript. If the backlog and a ticket disagree, the backlog wins; say
  so in the ticket's first record.
- **Status column.** Each work package's closeout commit sets its row's status
  to `done`, with the PR number, in the same commit that sets the ticket's
  `Status: done`, so both land on `staging` when Paul merges. Any other
  transition an agent records on a ticket updates the row in the same commit.
- **New tickets.** A PR that creates a ticket adds it to "Awaiting a place in
  the order" unless Paul has already placed it. Only Paul orders, re-orders,
  parks, or withdraws. An agent may propose a place, but the row moves only on
  his word, recorded in the PR or the ticket.
- **Re-orders.** Change the table and the "Last re-ordered" line together. When
  a re-order changes scope, the reason goes in a spec `[SCOPE CHANGE]`, never
  in this file.
- **Chunks** (Paul, 2026-09-26). The "Ordered" table groups tickets into
  numbered chunks: runs of tickets that share code or depend on each other.
  One chunk is one thread and one pull request to `staging`, and it replaces
  the earlier "one ticket per thread" rule. The chunk takes the heaviest
  `Route:` among its tickets. Its tickets run in table order, each with its
  own records and `[CLOSEOUT]` (and its own row set to `done` in that
  closeout commit). Verification that the routes run once per work package,
  such as the full `pnpm test:e2e` and the AI review, runs once at the end
  of the chunk. A ticket's decisions that are Paul's are settled at the
  chunk's start, before any of its tickets begins. Only Paul forms, splits,
  or re-orders chunks.
- **Ticket files.** A ticket's `Priority:` line reads
  ``see `.scratch/<feature-slug>/backlog.md` `` plus, at most, a note that
  belongs to the ticket itself (for example "run in its own thread"). It never
  restates the order.

Wayfinder efforts (`map.md` and "Frontier" above) keep their own
first-by-number rule inside the effort. The backlog orders efforts and tickets
across the feature.
