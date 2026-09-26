# 45: Atlas setup refresh

Status: needs-info
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: parked (Paul, 2026-09-26): harness work, in its own session whenever Paul has one. Product order: 71 → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
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
