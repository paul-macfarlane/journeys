# 45: Atlas setup refresh

Status: done
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`. Parked: harness work, in its own session whenever Paul has one.
Route: polish

**Why:** Paul, 2026-09-22, item 10: "I'd like to Update Atlas setup, a grill me for that alone might be good."

**Next step:** a dedicated grilling session (`/grill-with-docs` or `/mattpocock-skills:grilling`) over the questions below, then the `setup-atlas` skill's refresh (which preserves team-edited sections and reports them) and its adopt step for any guardrail file the session changes (`docs/agents/guardrails.md`; human approval required). Nothing below is decided; Paul asked for the grilling on 2026-09-22.

**Drift and questions gathered while writing the round-3 tickets:**

- The commit-time secret scrub still refuses every `pnpm-lock.yaml` commit, so lockfile commits are Paul's (`CLAUDE.md`). Does the hook gain a lockfile allowlist?
- `docs/agents/issue-tracker.md` carries two policies side by side: the local-markdown conventions at the top and the Atlas-managed section, plus Paul's proportional-records addendum. The readiness lines say `ready-for-agent` while the state table has no such state. Reconcile into one ladder.
- `docs/agents/testing.md`: the `run` and `db:up` rows are still `inferred`; the `E2E_EVIDENCE` rule and `test:e2e:prebuilt` are team additions. Confirm and mark verified.
- `CLAUDE.md` says PR previews are off and the Migrate action runs per branch; `human-prerequisites.md` §1 still says "Preview deployments: on for all other branches" and §7 names port 5434. Bring the human file up to date.
- The workflow list in `CLAUDE.md` names `/grill-with-docs`, `/to-spec`, `/to-tickets`, and `/wayfinder`, none of which appear in this session's skill list. Which skills are actually installed?
- The reviewer count, red-team policy, and worker-model choice for `polish` tickets are now team policy in `testing.md`; the Atlas planning profile still describes the full ladder. Decide which document owns it.
- Memory files carry lessons that belong in `docs/agents/` (evidence policy, zsh gotchas, Playwright patterns). Decide what is repository knowledge.

Acceptance criteria (to be completed after the grilling):

- [ ] The grilling's decisions are recorded here and in the documents they change.
- [ ] `setup-atlas` refresh and verify run clean, with every preserved team edit reported.

Verification: the `setup-atlas` verify output captured as `test-results/ac-2-atlas-verify.txt`. Origin: Paul's staging regression notes, 2026-09-22, item 10.

## Comments

### 2026-09-28 — Claude (Opus 5.5), harness session with Paul

`[CLOSEOUT]` Closed by Paul's call in the harness session (2026-09-28: "we can mark the task … as done"), without the grilling. PR: #120.

- `~/Code/atlas-plugins` pulled to `8f6701a` (only `docs/atlas-story.html` changed); the plugin is still 3.3.0 and the installed cache matches the repository.
- `setup-atlas` refresh: `plan` with a setup plan mirroring the current guidance writes nothing. Every file is `unchanged` or `preserve`: the team-edited sections in `CLAUDE.md`, `README.md`, `docs/agents/issue-tracker.md`, `planning.md`, and `testing.md`, plus the adopted `git_policy.py`. A clean 3.3.0 generation diffed section by section differs only where Paul's policies sit (closeout-commit `done`, the never-clear evidence root, flaky-test rules, `staging`-only PRs); no upstream template text changed, so nothing was applied.
- `verify`: 99 of 101 checks pass. The two `git-hooks-active` failures are by design: Atlas's hooks are chained behind husky (`core.hooksPath=.husky/_`, `hook_activation: chain`).
- Acceptance criteria: AC 2 `PASS`, evidence `test-results/ac-2-atlas-verify.txt`. AC 1 not applicable: no grilling was held, so no decisions were recorded.
- The drift questions above were not decided and stay open as notes; none is a ticket. Paul may raise any of them as a new ticket.
