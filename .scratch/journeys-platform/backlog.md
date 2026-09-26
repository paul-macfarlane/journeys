# Backlog

The single source of truth for **what to work on next**. The order below is Paul's. Tickets hold the what and the why. The spec's `[SCOPE CHANGE]` records hold the reasons for a re-order. This file holds only the order and each ticket's current status. Maintenance rules are in `docs/agents/issue-tracker.md` ("Priority").

Last re-ordered: 2026-09-26, grouped into chunks (Paul). Direction: polish, bug fixes, stability, and a clean technical design, with no feature bloat and no AI authoring. Ticket 72's proposed order, with three moves: 83 joins 81 and 73, 76 runs before 75, and 57 runs before 86 and 53.

## Ordered

Work top to bottom, **one chunk per thread**, each chunk one pull request. Chunk rules are in `docs/agents/issue-tracker.md` ("Priority", "Chunks").

| # | Chunk | Ticket | Route | Status | Note |
|---|---|---|---|---|---|
| – | – | [71 An image inside a list item is never silently dropped](issues/71-image-in-list-item.md) | contract | done | PR #97 |
| – | – | [72 Codebase design review](issues/72-codebase-design-review.md) | polish | done | PR #99 |
| 1 | **1 Saves and unreadable rows** (contract) | [81 One autosave loop](issues/81-one-autosave-loop.md) | polish | done | PR #101 |
| 2 | 1 | [73 Stale saves are refused](issues/73-stale-saves-refused.md) | contract | done | PR #101 |
| 3 | 1 | [83 Error pages and unreadable Published Versions](issues/83-error-surfaces.md) | contract | done | PR #101 |
| 4 | **2 Cleanup and stability** (contract) | [85 Leftovers sweep](issues/85-leftovers-sweep.md) | contract | in-progress | Drop-migration follow-up after promotion; lockfile commit is Paul's |
| 5 | 2 | [74 Deploy and test stability](issues/74-deploy-and-test-stability.md) | polish | in-progress | Paul turns on Skew Protection |
| 6 | **3 Runs and the Judge** (contract) | [84 Abuse limits on Runs and the Judge](issues/84-run-and-judge-abuse.md) | contract | needs-triage | Paul settles its two decisions at the chunk's start |
| 7 | 3 | [76 The Judge can find a Response unclear](issues/76-judge-unclear.md) | contract | ready-for-agent | |
| 8 | 3 | [75 Completion survives a backtrack](issues/75-completion-sticks.md) | contract | ready-for-agent | |
| 9 | **4 Membership and accounts** (contract) | [82 One membership seam](issues/82-one-membership-seam.md) | contract | ready-for-agent | |
| 10 | 4 | [77 Account deletion](issues/77-account-deletion.md) | contract | ready-for-agent | Paul re-approves the `/privacy` sentence |
| 11 | **5 Public pages and accessibility** (contract) | [42 Public pages correctness (SEO)](issues/42-seo.md) | contract | ready-for-agent | Rescoped 2026-09-26 |
| 12 | 5 | [78 Accessibility pass](issues/78-accessibility-pass.md) | polish | ready-for-agent | |
| 13 | **6 Authoring polish** (polish) | [79 Authoring rough edges](issues/79-authoring-rough-edges.md) | polish | ready-for-agent | |
| 14 | 6 | [57 Empty states and placeholders](issues/57-in-app-help.md) | polish | ready-for-agent | Rescoped 2026-09-26 |
| 15 | **7 Editor split and phone sheet** (polish) | [86 Split the canvas, the Draft editor, and the layout module](issues/86-split-editor-modules.md) | polish | ready-for-agent | Blocked by 81 (chunk 1) |
| 16 | 7 | [53 The Step panel as a sheet on narrow screens](issues/53-mobile-step-sheet.md) | polish | ready-for-agent | Decisions to settle at the chunk's start |
| 17 | **8 AI editing** (contract) | [80 AI editing](issues/80-ai-editing.md) | contract | ready-for-agent | Reach goal |

## Awaiting a place in the order

New tickets land here until Paul places them.

_None._

## Parked

Not ordered. Each needs something outside the backlog before it can move.

| Ticket | Status | Waiting on |
|---|---|---|
| [39 Loading states](issues/39-loading-states.md) | needs-info | vercel/next.js#86055 |
| [44 Renaming the app](issues/44-rename.md) | needs-info | Paul choosing a name |
| [45 Atlas setup refresh](issues/45-atlas-setup-refresh.md) | needs-info | A harness session with Paul |

## Withdrawn (2026-09-26)

[14 AI authoring](issues/14-ai-authoring.md), [17 Manual layout](issues/17-manual-layout.md), [41 Drag-and-drop ordering](issues/41-drag-and-drop-ordering.md): all `wontfix`. The catch-alls [15](issues/15-post-hackathon-hardening.md), [64](issues/64-regression-pass-post-hackathon.md), [66](issues/66-production-smoke-2026-09-24.md), and [68](issues/68-production-regression-2026-09-24.md) are closed; each records where its items went.
