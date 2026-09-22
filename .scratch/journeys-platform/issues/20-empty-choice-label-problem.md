# 20: An empty Choice label is a publish problem

Status: in-progress
Blocked by: 16
Route: contract
Owner: Claude Fable 5.1 (/implement, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Priority: small; fits alongside 19 (Paul, 2026-09-21: "Yes, that should be a publish problem").

**Why:** since ticket 16 a Choice drawn on the map (or made with "Add next step") starts with an empty label, nothing stops a Draft with one from publishing, and the runner would render such a Choice as a link with no text and no accessible name. The canvas and the delete confirmation already read an empty label as "Untitled choice"; publishing should refuse it instead.

**What to build:**

- A new `validateForPublish` rule `empty-choice-label`: every Choice whose label is empty or whitespace-only yields a problem addressed by `stepId` and `choiceId` with the message `Step "<title>" has a choice with no label`, grouped after `dangling-choice-target` and before `unreachable-step`. Because it carries both addresses, `problemsByAddress` files it under the Step and the Choice with no further change, so it shows in the panel's Problems section, under the Choice's row, in the header count and live list, and as a mark on the arrow.
- Amend the spec's publish rule list ("every Choice has a label") with a `[SCOPE CHANGE]` on the spec naming this ticket; ADR-0001 needs nothing.
- The runner keeps rendering `choice.label` as is: a Published Version can no longer contain an empty one.

Acceptance criteria:

- [ ] Seam A: a document with one whitespace-only Choice label yields exactly one `empty-choice-label` problem with that Step's and Choice's ids; the three seeded documents still yield none.
- [ ] Seam B: dragging a Choice on the canvas shows the problem on the arrow, under the Choice row, and in the header count; typing a label clears all three; publishing while a label is empty is refused with the message in the Validation list.
- [ ] Spec `[SCOPE CHANGE]` recorded; README's publish sentence mentions labels if it lists the rules.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's answer to ticket 16's review question, 2026-09-21.

## Comments

### [EXECUTION PLAN] 2026-09-22 — /implement (Claude Fable 5.1)

**Contract:** this ticket as written; no scope change. Criteria AC-A (Seam A), AC-B (Seam B), AC-C (spec and README) in checklist order. Derived DoD from the footer, `docs/agents/testing.md`, and `CLAUDE.md`: DoD-1 the `contract` command chain green (`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`, then one `E2E_EVIDENCE=canvas-empty-choice-label pnpm test:e2e`); DoD-2 every PASS artifact committed under `test-results/`, fixture journeys only. No schema, dependency, or lockfile change, so no `db:migrate` and no lockfile gate.

**Availability:** `Blocked by` 16 is `done` on `staging` (PR #19 merged); no other claim. Branch `feat/20-empty-choice-label` from `staging` at `eb0c258`, direct checkout, no worktrees.

**Structure:** one session, three seams in order. (1) Seam A by TDD in `src/lib/graph/validate.test.ts` then `validate.ts`: rule `empty-choice-label`, grouped after `dangling-choice-target` and before `unreachable-step`, addressed by `stepId` and `choiceId`; `problemsByAddress`, the panel, the header count, and the arrow mark need no change. (2) Spec: the "Graph document" publish rule sentence, story 37's rule list, and story 33's examples amended, with a `[SCOPE CHANGE]` naming this ticket; README's publish sentence does not list the rules, so it stays. (3) Seam B: one new Playwright test `canvas-empty-choice-label` in `e2e/canvas.spec.ts` that draws a Choice by dragging, reads the problem on the arrow, under the Choice row, and in the header count, types a label to clear all three, blanks it to whitespace, and is refused publication with the message in the "Publishing problems" list.

**Review:** `/code-review` (two fresh readers, standards and spec). **Red team:** not run — the policy names plans that materially change publishing's architecture; this adds one rule Paul already approved on 2026-09-21.

**Risk noted up front:** every existing canvas spec that draws a Choice types its label before asserting "No problems", so the new rule breaks none of them; confirmed by reading each `connectByDragging` and "Add next step" call site.

### [AI CODE REVIEW] 2026-09-22 — two-axis review of `eb0c258..db62b63`, fixes in `c3f2793`

Two fresh readers (opus, `/code-review`: standards and spec) read the whole diff against the ticket, `CLAUDE.md`, `CONTEXT.md`, `docs/agents/testing.md`, and the code the "no further change" claim rests on (`problemsByAddress`, `draft-editor.tsx`, `choice-list.tsx`, `journey-canvas.tsx`, `versions.ts`, the runner's Step view). **No blocking finding on either axis.**

**Standards** (1 hard, 4 judgement calls): evidence not yet committed at review time (expected; committed at closeout) — resolved; the single-arrow assertion read through the plural helper — **resolved (`c3f2793`)**, read by Choice id and checked cleared as well as set; the refusal block repeats `publish.spec.ts`'s shape — left, the repo keeps helpers per spec; the separate rule loop repeats the dangling loop's shape — correct by the file's own grouped-by-rule contract; `toHaveText` stricter than siblings' `toContainText` — left, tighter is intended after `toHaveCount(1)`. Vocabulary and helper reuse confirmed.

**Spec** (2 partial, 0 wrong, 0 creep): evidence and checklist pending closeout — resolved here; the `[SCOPE CHANGE]` under-reported its own edit to the testing bullet — **resolved (`c3f2793`)**. Confirmed: code and message verbatim; grouping after `dangling-choice-target`, before `unreachable-step`, locked by a test; whitespace handled by `trim()`; the seeded documents covered by the existing "is publishable" cases; every Seam B clause proved; README lists no rules, so it stands.

