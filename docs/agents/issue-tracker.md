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
| `done` | Accepted and complete. Entered when the ticket's PR has merged; the merge is the human's acceptance. |
| `wontfix` | Will not be actioned. |

Human-only states: `ready-for-human`, `done`, `wontfix`. A human enters `done` by merging the PR; the agent records that transition (see below).

Recommended lifecycle: `needs-triage` → `needs-info` → `planning` → `plan-review` → `in-progress` → `ai-review` → `ready-for-human` → `done` → `wontfix`.

## Read and write rules

- Read the complete ticket and comments before planning or implementation.
- Check for available work before claiming. Available work is ready to
  implement, unclaimed, in an eligible state, has no active impediment or
  blocking decision, and every `blocked by` ticket is in
  `done` (after the run-start sweep above, a merged PR counts). A dependency that is not a `blocked by` edge does
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
- Enter `done` only when the ticket's PR has merged (`gh pr view <n> --json state` reads `MERGED`); merging is how the human accepts the work, and the agent records the transition with a dated `[CLOSEOUT]` comment naming the merge. At the start of every `/atlas-implement` run, before checking availability, move every `ready-for-human` ticket whose PR has merged to `done` the same way, so a merged blocker never has to be rediscovered. Never enter `done` on an open or closed-unmerged PR. (Paul, 2026-09-21: agents record `done` on merge evidence.)
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
