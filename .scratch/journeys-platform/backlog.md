# Backlog

The single source of truth for **what to work on next**. The order below is Paul's. Tickets hold the what and the why. The spec's `[SCOPE CHANGE]` records hold the reasons for a re-order. This file holds only the order and each ticket's current status. Maintenance rules are in `docs/agents/issue-tracker.md` ("Priority").

Last re-ordered: 2026-09-26, post-hackathon grilling (Paul). Direction: polish, bug fixes, stability, and a clean technical design, with no feature bloat and no AI authoring.

## Ordered

Work top to bottom. The next ticket is the first row that is not `done` and is available to claim (its `Blocked by:` tickets are `done` on `staging`). One ticket per thread.

| # | Ticket | Route | Status | Note |
|---|---|---|---|---|
| 1 | [71 An image inside a list item is never silently dropped](issues/71-image-in-list-item.md) | contract | done | PR #97 |
| 2 | [72 Codebase design review](issues/72-codebase-design-review.md) | polish | ready-for-agent | Findings become tickets from 81; they may reshape everything below |
| 3 | [73 Stale saves are refused](issues/73-stale-saves-refused.md) | contract | ready-for-agent | Blocked by 72 |
| 4 | [74 Deploy and test stability](issues/74-deploy-and-test-stability.md) | polish | ready-for-agent | Blocked by 72; Paul turns on Skew Protection |
| 5 | [75 Completion survives a backtrack](issues/75-completion-sticks.md) | contract | ready-for-agent | |
| 6 | [76 The Judge can find a Response unclear](issues/76-judge-unclear.md) | contract | ready-for-agent | |
| 7 | [77 Account deletion](issues/77-account-deletion.md) | contract | ready-for-agent | |
| 8 | [42 Public pages correctness (SEO)](issues/42-seo.md) | contract | ready-for-agent | Rescoped 2026-09-26 |
| 9 | [78 Accessibility pass](issues/78-accessibility-pass.md) | polish | ready-for-agent | |
| 10 | [79 Authoring rough edges](issues/79-authoring-rough-edges.md) | polish | ready-for-agent | |
| 11 | [53 The Step panel as a sheet on narrow screens](issues/53-mobile-step-sheet.md) | polish | ready-for-agent | Decisions to settle at the start |
| 12 | [57 Empty states and placeholders](issues/57-in-app-help.md) | polish | ready-for-agent | Rescoped 2026-09-26 |
| 13 | [80 AI editing](issues/80-ai-editing.md) | contract | ready-for-agent | Reach goal |

## Awaiting a place in the order

New tickets land here until Paul places them. Ticket 72's findings will arrive here.

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
