# 32: e2e evidence allowlist

Status: done
Blocked by:
Owner: Claude Fable 5.1
Parent: `.scratch/journeys-platform/spec.md`
Priority: harness hygiene (Paul, 2026-09-22, review of PR #30); any time.
Route: polish

**Why:** Every spec wrote its screenshot and video paths as literal `test-results/<test>/` strings, so a full `pnpm test:e2e` rewrote sixty-odd tracked screenshots for specs the ticket did not name. The agent git-policy hook stops agents restoring them, so Paul had to run `git checkout -- test-results` after every work package. Paul, 2026-09-22: "can we do something to prevent that from happening in the future without requiring me to run the command?"

**What to build:** one helper, `evidencePath(testName, file)` in `e2e/setup/evidence.ts`, that writes into the tracked proof root only for the tests named in `E2E_EVIDENCE` (comma separated, or `all`) and under the git-ignored `test-results/playwright/evidence/` otherwise; every spec builds its evidence paths with it; `docs/agents/testing.md` records the rule and the evidence run command.

Acceptance criteria:

- [x] No literal `test-results/…` path remains in any spec.
- [x] A full run with `E2E_EVIDENCE` unset leaves zero tracked evidence files modified.
- [x] A run with a test named in `E2E_EVIDENCE` writes that test's evidence into its tracked directory.
- [x] `pnpm test:e2e` passes once in full at the end.

## Comments

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/31 (base `staging`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** `30ba019` the helper, all 68 call sites in the 11 spec files, the policy sentence. Closeout — this commit. Direct checkout, no worktrees.

**Verified run command:** `pnpm lint; pnpm typecheck; pnpm test; pnpm test:e2e` with `E2E_EVIDENCE` unset — every block exit 0; unit 249/249; e2e 70 passed in 1.1m, 0 flaky, retries 0. Capture: `test-results/dod-1-commands.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 no literal evidence path in a spec | PASS | `grep 'test-results/' e2e/*.spec.ts` matches only one comment naming a capture file |
| AC-2 unset run touches nothing tracked | PASS | after the full run `git status --short test-results` lists nothing but the capture file; 69 scratch directories under `test-results/playwright/evidence/` |
| AC-3 named run writes the tracked directory | PASS | `E2E_EVIDENCE=landing pnpm test:e2e:prebuilt e2e/landing.spec.ts` rewrote `test-results/landing/landing.png` (mtime changed; bytes identical, so no diff) |
| AC-4 full `pnpm test:e2e` once at the end | PASS | `dod-1-commands.txt`: 70 passed, 0 flaky |

**Evidence committed:** `test-results/dod-1-commands.txt` only; the change writes no named screenshots by design.

**Deviations.** No AI review round: a mechanical path rewrite plus one 30-line helper, with the full suite as the check. Ticket created at closeout to keep the tracker complete.
